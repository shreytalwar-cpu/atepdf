import Foundation
import PDFKit
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
import Vision
import CryptoKit

/// Catalyst must never turn an unsigned launch into access to the user's global
/// caches. All values are supplied by native process APIs, never by JavaScript.
enum AtepdfStoragePolicy {
  static func cleanupRootsIsolated(home: URL, caches: URL) -> Bool {
    guard home.isFileURL, caches.isFileURL else { return false }
    // Resolve the OS-provided home first (e.g. /var -> /private/var on iOS),
    // then preserve every app-owned component below it for substitution checks.
    let home = home.standardizedFileURL.resolvingSymlinksInPath()
    let library = home.appendingPathComponent("Library", isDirectory: true)
    let expectedCache = library.appendingPathComponent("Caches", isDirectory: true)
    guard caches.standardizedFileURL.resolvingSymlinksInPath().path == expectedCache.path else { return false }
    let roots = [library, expectedCache] + ["atepdf-work", "atepdf-preview", "atepdf-previews"].map {
      expectedCache.appendingPathComponent($0, isDirectory: true)
    }
    return roots.allSatisfy { root in
      // destinationOfSymbolicLink also rejects dangling links and loops, which
      // resolvingSymlinksInPath alone can leave textually unchanged.
      guard (try? FileManager.default.destinationOfSymbolicLink(atPath: root.path)) == nil,
            root.resolvingSymlinksInPath().path == root.path else { return false }
      var directory: ObjCBool = false
      return !FileManager.default.fileExists(atPath: root.path, isDirectory: &directory) || directory.boolValue
    }
  }

  static func catalystIsolated(bundleIdentifier: String?, home: URL, caches: URL,
                               sandboxEntitlement: CFTypeRef?) -> Bool {
    #if ATEPDF_SYNTHETIC_CONTAINER
    let identifier = "dev.atepdf.synthetic.mac"
    #else
    let identifier = "dev.atepdf.fresh.mac"
    #endif
    guard let sandboxEntitlement,
          CFGetTypeID(sandboxEntitlement) == CFBooleanGetTypeID(), CFEqual(sandboxEntitlement, kCFBooleanTrue),
          bundleIdentifier == identifier, home.isFileURL, caches.isFileURL else { return false }
    let home = home.standardizedFileURL.resolvingSymlinksInPath()
    let caches = caches.standardizedFileURL.resolvingSymlinksInPath()
    let suffix = ["Library", "Containers", identifier, "Data"]
    guard Array(home.pathComponents.suffix(suffix.count)) == suffix else { return false }
    return caches.path == home.appendingPathComponent("Library/Caches", isDirectory: true).path
      && cleanupRootsIsolated(home: home, caches: caches)
  }
}

/// Read-only, on-device counterpart to the shared pdf-lib writer. No URL loading,
/// model transport, user filenames in errors, or original-file writes live here.
final class AtepdfPDFEngine {
  static let pixelLimit = 12_000_000
  private let roots: [URL]
  private let outputRoot: URL

  enum Failure: String, Error, LocalizedError {
    case localFile = "Choose a PDF copied into this app's local storage."
    case invalidPDF = "Independent PDF validation failed. Your original is unchanged."
    case locked = "Password-protected PDFs are not supported by this build."
    case pages = "Use a PDF with 1–100 pages."
    case geometry = "This page cannot be rendered safely. Your original is unchanged."
    case image = "This image cannot be processed safely. Your original is unchanged."
    case ocrGeometry = "OCR currently needs unrotated pages with an origin-aligned crop box."
    case ocrCount = "Use no more than 15 scanned pages per OCR job."
    case ocrUnavailable = "On-device English recognition is unavailable on this device."
    case ocrUnreliable = "Recognition was not reliable enough. No output was committed."
    case cancelled = "Cancelled. Your original is unchanged."
    case timeout = "Processing took too long. Try fewer pages."
    case save = "The local preview could not be saved."
    var errorDescription: String? { rawValue }
  }

  init(allowedRoots: [URL], outputRoot: URL) {
    self.roots = allowedRoots.map {
      $0.deletingLastPathComponent().standardizedFileURL.resolvingSymlinksInPath()
        .appendingPathComponent($0.lastPathComponent, isDirectory: true)
    }
    // The output location is supplied by trusted native code, separately from
    // input roots. Resolve only its parent so a substituted preview symlink is
    // rejected, rather than becoming a new write destination.
    let parent = outputRoot.deletingLastPathComponent().standardizedFileURL.resolvingSymlinksInPath()
    self.outputRoot = parent.appendingPathComponent(outputRoot.lastPathComponent, isDirectory: true)
  }

  func inspect(_ uri: String, check: () throws -> Void = {}) throws -> [String: Any] {
    let document = try open(uri)
    var pages: [[String: Any]] = []
    var physical: [[String: Any]] = []
    for index in 0..<document.pageCount {
      try check()
      guard let page = document.page(at: index) else { throw Failure.invalidPDF }
      let geometry = try dimensions(page)
      // A bounded render walks actual drawing operators, rather than treating a
      // readable page count as evidence that output is usable.
      let image = try raster(page, maximumDimension: 96, neutralRotation: true)
      guard let data = image.dataProvider?.data, let reference = page.pageRef else { throw Failure.invalidPDF }
      let identity = SHA256.hash(data: data as Data).map { String(format: "%02x", $0) }.joined()
      func box(_ rectangle: CGRect) -> [String: Double] {
        ["x": rectangle.origin.x, "y": rectangle.origin.y, "width": rectangle.width, "height": rectangle.height]
      }
      physical.append(["mediaBox": box(reference.getBoxRect(.mediaBox)),
                       "cropBox": box(reference.getBoxRect(.cropBox)),
                       "rotation": geometry.rotation, "identity": identity])
      try check()
      pages.append(["width": geometry.width, "height": geometry.height,
                    "rotation": geometry.rotation, "text": normalizedText(page)])
    }
    return ["pages": pages, "structure": ["version": 1, "reader": "coregraphics-raster96-v1", "pages": physical]]
  }

  func render(_ uri: String, pageNumber: Int, maximumDimension: Int,
              check: () throws -> Void = {}) throws -> [String: Any] {
    try check()
    let document = try open(uri)
    guard pageNumber > 0, pageNumber <= document.pageCount,
          let page = document.page(at: pageNumber - 1), maximumDimension > 0,
          maximumDimension <= 4096 else { throw Failure.geometry }
    let image = try raster(page, maximumDimension: maximumDimension)
    try check()
    let data = NSMutableData()
    guard let destination = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil)
    else { throw Failure.image }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { throw Failure.image }
    do {
      guard outputRoot.resolvingSymlinksInPath().path == outputRoot.path else { throw Failure.save }
      try FileManager.default.createDirectory(at: outputRoot, withIntermediateDirectories: true,
                                              attributes: [.posixPermissions: 0o700])
      var directory = outputRoot
      var options = URLResourceValues(); options.isExcludedFromBackup = true
      try directory.setResourceValues(options)
      let url = outputRoot.appendingPathComponent(UUID().uuidString.lowercased() + ".png")
      try (data as Data).write(to: url, options: [.atomic])
      try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
      #if os(iOS)
      try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: url.path)
      #endif
      do { try check() } catch { try? FileManager.default.removeItem(at: url); throw error }
      return ["uri": url.absoluteString, "width": image.width, "height": image.height]
    } catch let error as Failure { throw error }
    catch { throw Failure.save }
  }

  func recognize(_ uri: String, check: () throws -> Void = {},
                 requestChanged: (VNRecognizeTextRequest?) -> Void = { _ in }) throws -> [[String: Any]] {
    let document = try open(uri)
    var needed: [(Int, PDFPage)] = []
    for index in 0..<document.pageCount {
      try check()
      guard let page = document.page(at: index) else { throw Failure.invalidPDF }
      if normalizedText(page).isEmpty { needed.append((index + 1, page)) }
    }
    guard needed.count <= 15 else { throw Failure.ocrCount }
    var output: [[String: Any]] = []
    for (number, page) in needed {
      try check()
      let size = try dimensions(page)
      guard size.rotation == 0, abs(size.box.minX) < 0.01, abs(size.box.minY) < 0.01
      else { throw Failure.ocrGeometry }
      // Match web OCR's scale, while never exceeding the decoded pixel budget.
      let maximumDimension = Int(ceil(max(size.width, size.height) * 2.5))
      let image = try raster(page, maximumDimension: maximumDimension)
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = false
      request.recognitionLanguages = ["en-US"]
      do {
        guard try request.supportedRecognitionLanguages().contains("en-US") else { throw Failure.ocrUnavailable }
      } catch { throw Failure.ocrUnavailable }
      requestChanged(request)
      defer { requestChanged(nil) }
      try check()
      do { try VNImageRequestHandler(cgImage: image, orientation: .up, options: [:]).perform([request]) }
      catch { try check(); throw Failure.ocrUnreliable }
      try check()
      var words: [[String: Any]] = []
      var confidences: [Float] = []
      for observation in request.results ?? [] {
        guard let candidate = observation.topCandidates(1).first, !candidate.string.isEmpty else { continue }
        confidences.append(candidate.confidence)
        let string = candidate.string
        let matcher = try NSRegularExpression(pattern: "\\S+")
        for match in matcher.matches(in: string, range: NSRange(string.startIndex..., in: string)) {
          guard let range = Range(match.range, in: string),
                let rectangle = try? candidate.boundingBox(for: range) else { throw Failure.ocrUnreliable }
          let box = rectangle.boundingBox
          guard box.minX >= -0.001, box.minY >= -0.001, box.maxX <= 1.001, box.maxY <= 1.001,
                box.width > 0, box.height > 0 else { throw Failure.ocrUnreliable }
          // Vision and PDF both use a bottom-left origin. These are PDF points,
          // not raster pixels, and match OCRWord consumed by the shared writer.
          words.append(["text": String(string[range]), "x": max(0, box.minX) * size.width,
                        "y": max(0, box.minY) * size.height,
                        "width": box.width * size.width, "height": box.height * size.height])
        }
      }
      guard !words.isEmpty, !confidences.isEmpty,
            confidences.reduce(0, +) / Float(confidences.count) >= 0.45 else { throw Failure.ocrUnreliable }
      output.append(["page": number, "words": words])
    }
    return output
  }

  func reencodeJpeg(_ base64: String, width: Int, height: Int, quality: Double,
                    check: () throws -> Void = {}) throws -> String {
    try check()
    guard width > 0, height > 0, width <= Self.pixelLimit / height,
          quality.isFinite, quality > 0, quality <= 1,
          let data = Data(base64Encoded: base64),
          let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
          CGImageSourceGetCount(source) == 1,
          CGImageSourceGetType(source) as String? == UTType.jpeg.identifier,
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          (properties[kCGImagePropertyPixelWidth] as? Int) == width,
          (properties[kCGImagePropertyPixelHeight] as? Int) == height,
          let image = CGImageSourceCreateImageAtIndex(source, 0, [kCGImageSourceShouldCache: false] as CFDictionary)
    else { throw Failure.image }
    try check()
    let dataOut = NSMutableData()
    guard let destination = CGImageDestinationCreateWithData(dataOut, UTType.jpeg.identifier as CFString, 1, nil)
    else { throw Failure.image }
    CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
    guard CGImageDestinationFinalize(destination) else { throw Failure.image }
    try check()
    return (dataOut as Data).base64EncodedString()
  }

  // The system export picker receives only validated app-private PDF copies.
  // Returning this URL never grants access to a broader document directory.
  func exportSource(_ uri: String) throws -> URL {
    let url = try validatedLocalURL(uri)
    _ = try open(uri)
    return url
  }

  private func validatedLocalURL(_ uri: String) throws -> URL {
    guard let components = URLComponents(string: uri), components.scheme == "file",
          components.host == nil || components.host == "", components.query == nil, components.fragment == nil,
          let unresolved = components.url else { throw Failure.localFile }
    let url = unresolved.standardizedFileURL.resolvingSymlinksInPath()
    guard insideAllowedRoot(url), let values = try? url.resourceValues(forKeys: [.isRegularFileKey]),
          values.isRegularFile == true else { throw Failure.localFile }
    return url
  }

  private func open(_ uri: String) throws -> PDFDocument {
    let url = try validatedLocalURL(uri)
    guard let document = PDFDocument(url: url) else { throw Failure.invalidPDF }
    guard !document.isEncrypted, !document.isLocked else { throw Failure.locked }
    guard document.pageCount > 0, document.pageCount <= 100 else { throw Failure.pages }
    return document
  }

  private func insideAllowedRoot(_ url: URL) -> Bool {
    let path = url.standardizedFileURL.resolvingSymlinksInPath().path
    return roots.contains { $0.resolvingSymlinksInPath().path == $0.path && path.hasPrefix($0.path + "/") }
  }

  private func normalizedText(_ page: PDFPage) -> String {
    (page.string ?? "").split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
  }

  private func dimensions(_ page: PDFPage) throws -> (width: Double, height: Double, rotation: Int, box: CGRect) {
    guard let reference = page.pageRef else { throw Failure.invalidPDF }
    let box = reference.getBoxRect(.cropBox)
    let rotation = (page.rotation % 360 + 360) % 360
    guard [0, 90, 180, 270].contains(rotation), box.width.isFinite, box.height.isFinite,
          box.width >= 10, box.height >= 10, box.width <= 4000, box.height <= 4000,
          box.minX.isFinite, box.minY.isFinite else { throw Failure.geometry }
    return (rotation == 90 || rotation == 270 ? box.height : box.width,
            rotation == 90 || rotation == 270 ? box.width : box.height, rotation, box)
  }

  private func raster(_ page: PDFPage, maximumDimension: Int, neutralRotation: Bool = false) throws -> CGImage {
    guard maximumDimension > 0, let reference = page.pageRef else { throw Failure.geometry }
    let geometry = try dimensions(page)
    let size = neutralRotation ? (width: Double(geometry.box.width), height: Double(geometry.box.height))
      : (width: geometry.width, height: geometry.height)
    let scale = min(Double(maximumDimension) / max(size.width, size.height),
                    sqrt(Double(Self.pixelLimit) / (size.width * size.height)))
    // Floor keeps the allocated dimensions inside the pixel budget.
    let width = max(1, Int(floor(size.width * scale)))
    let height = max(1, Int(floor(size.height * scale)))
    guard width <= Self.pixelLimit / height else { throw Failure.geometry }
    try validateImageResources(reference)
    guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
                                  bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw Failure.image }
    let rectangle = CGRect(x: 0, y: 0, width: width, height: height)
    context.setFillColor(CGColor(gray: 1, alpha: 1)); context.fill(rectangle)
    // CGPDFPage's drawing transform scales down, but never up. First map the
    // complete logical page to the bitmap, then use its transform only for the
    // crop origin and page rotation. This also makes Vision's normalized boxes
    // correspond to PDF points rather than an artificially padded page.
    context.scaleBy(x: Double(width) / size.width, y: Double(height) / size.height)
    let logicalPage = CGRect(x: 0, y: 0, width: size.width, height: size.height)
    context.concatenate(reference.getDrawingTransform(.cropBox, rect: logicalPage, rotate: Int32(neutralRotation ? -geometry.rotation : 0), preserveAspectRatio: true))
    context.drawPDFPage(reference)
    guard let image = context.makeImage() else { throw Failure.image }
    return image
  }

  // Inspect image dimensions before CoreGraphics can decode image streams. Form
  // resource recursion is bounded; the shared writer separately rejects complex
  // document features before calling this adapter.
  private func validateImageResources(_ page: CGPDFPage) throws {
    guard let dictionary = page.dictionary else { throw Failure.invalidPDF }
    let scan = ResourceScan()
    // Page resources may be inherited from a Pages ancestor.
    var current: CGPDFDictionaryRef? = dictionary
    var ancestors = 0
    while let node = current {
      guard ancestors < 12 else { throw Failure.image }
      scan.visit(node, depth: 0)
      var parent: CGPDFDictionaryRef?
      if !CGPDFDictionaryGetDictionary(node, "Parent", &parent) { break }
      current = parent; ancestors += 1
    }
    if scan.failed { throw Failure.image }
  }

  private final class ResourceScan {
    var failed = false
    var examined = 0
    func inspectImage(_ dictionary: CGPDFDictionaryRef, depth: Int) {
      guard depth <= 12, examined < 10_000 else { failed = true; return }
      examined += 1
      var width: CGPDFInteger = 0; var height: CGPDFInteger = 0
      if !CGPDFDictionaryGetInteger(dictionary, "Width", &width) ||
         !CGPDFDictionaryGetInteger(dictionary, "Height", &height) ||
         width < 1 || height < 1 || width > AtepdfPDFEngine.pixelLimit / height { failed = true; return }
      for key in ["SMask", "Mask"] {
        var mask: CGPDFStreamRef?
        if CGPDFDictionaryGetStream(dictionary, key, &mask), let mask,
           let nested = CGPDFStreamGetDictionary(mask) { inspectImage(nested, depth: depth + 1) }
      }
    }
    func visit(_ dictionary: CGPDFDictionaryRef, depth: Int) {
      guard depth <= 12, examined < 10_000 else { failed = true; return }
      examined += 1
      var resources: CGPDFDictionaryRef?
      guard CGPDFDictionaryGetDictionary(dictionary, "Resources", &resources), let resources else { return }
      var objects: CGPDFDictionaryRef?
      guard CGPDFDictionaryGetDictionary(resources, "XObject", &objects), let objects else { return }
      let context = ResourceContext(scan: self, depth: depth)
      CGPDFDictionaryApplyFunction(objects, { _, object, pointer in
        guard let pointer else { return }
        let context = Unmanaged<ResourceContext>.fromOpaque(pointer).takeUnretainedValue()
        guard !context.scan.failed else { return }
        var stream: CGPDFStreamRef?
        guard CGPDFObjectGetValue(object, .stream, &stream), let stream,
              let dictionary = CGPDFStreamGetDictionary(stream) else { return }
        var subtype: UnsafePointer<CChar>?
        guard CGPDFDictionaryGetName(dictionary, "Subtype", &subtype), let subtype else { return }
        if String(cString: subtype) == "Image" {
          context.scan.inspectImage(dictionary, depth: context.depth)
        } else if String(cString: subtype) == "Form" {
          context.scan.visit(dictionary, depth: context.depth + 1)
        }
      }, Unmanaged.passUnretained(context).toOpaque())
    }
  }

  private final class ResourceContext {
    let scan: ResourceScan
    let depth: Int
    init(scan: ResourceScan, depth: Int) { self.scan = scan; self.depth = depth }
  }
}

/// Cancellation is observable between PDF calls and interrupts an active Vision
/// request. CoreGraphics rasterisation itself is synchronous and cannot be killed.
final class AtepdfPDFCancellation: @unchecked Sendable {
  private let lock = NSLock()
  private var generation = 0
  private var request: VNRecognizeTextRequest?
  private var deadline: DispatchWorkItem?
  func begin() -> (Int, Date) { lock.lock(); defer { lock.unlock() }; return (generation, Date().addingTimeInterval(120)) }
  func check(_ token: (Int, Date)) throws {
    lock.lock(); let cancelled = token.0 != generation; lock.unlock()
    if cancelled { throw AtepdfPDFEngine.Failure.cancelled }
    if Date() > token.1 { throw AtepdfPDFEngine.Failure.timeout }
  }
  func register(_ value: VNRecognizeTextRequest?, token: (Int, Date)) {
    lock.lock()
    let cancelled = token.0 != generation
    request = cancelled ? nil : value
    deadline?.cancel(); deadline = nil
    if let value, !cancelled {
      let item = DispatchWorkItem { [weak value] in value?.cancel() }
      deadline = item
      DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + max(0, token.1.timeIntervalSinceNow), execute: item)
    }
    lock.unlock()
    if cancelled { value?.cancel() }
  }
  func cancel() { lock.lock(); generation += 1; let active = request; request = nil; deadline?.cancel(); deadline = nil; lock.unlock(); active?.cancel() }
}
