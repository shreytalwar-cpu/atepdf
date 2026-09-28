import Foundation
import PDFKit
import ImageIO
import UniformTypeIdentifiers
import CryptoKit

func require(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
  if try !condition() { throw NSError(domain: "atepdf-synthetic-test", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
}
func mustReject(_ name: String, _ body: () throws -> Void) throws {
  do { try body() } catch is AtepdfPDFEngine.Failure { return }
  throw NSError(domain: "atepdf-synthetic-test", code: 2, userInfo: [NSLocalizedDescriptionKey: "Expected rejection: " + name])
}
func digest(_ url: URL) throws -> String { SHA256.hash(data: try Data(contentsOf: url)).map { String(format: "%02x", $0) }.joined() }

// Check actual colored pixels, independently of the engine's drawing transform.
// Bounds are normalized top-left image coordinates, with a two-pixel tolerance.
func redBounds(_ url: URL) throws -> CGRect {
  guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
        let context = CGContext(data: nil, width: image.width, height: image.height, bitsPerComponent: 8,
                                bytesPerRow: image.width * 4, space: CGColorSpaceCreateDeviceRGB(),
                                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)
  else { throw AtepdfPDFEngine.Failure.image }
  context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
  let pixels = context.data!.assumingMemoryBound(to: UInt8.self)
  var minX = image.width, minY = image.height, maxX = -1, maxY = -1
  for y in 0..<image.height { for x in 0..<image.width {
    let index = (y * image.width + x) * 4
    if pixels[index] > 150 && pixels[index + 1] < 100 && pixels[index + 2] < 100 {
      minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
    }
  } }
  try require(maxX >= minX && maxY >= minY, "Raster anchor exists")
  return CGRect(x: Double(minX) / Double(image.width), y: Double(minY) / Double(image.height),
                width: Double(maxX - minX + 1) / Double(image.width), height: Double(maxY - minY + 1) / Double(image.height))
}

func assertBounds(_ actual: CGRect, _ expected: CGRect, tolerance: Double, _ label: String) throws {
  try require(abs(actual.minX - expected.minX) <= tolerance && abs(actual.minY - expected.minY) <= tolerance
              && abs(actual.width - expected.width) <= tolerance && abs(actual.height - expected.height) <= tolerance,
              "Raster anchor \(label): \(actual) expected \(expected)")
}

let args = CommandLine.arguments
guard args.count >= 4 else { fatalError("Usage: apple-pdf-check FIXTURES SCRATCH EVIDENCE [inspect PDF]") }
let fixtures = URL(fileURLWithPath: args[1], isDirectory: true)
let scratch = URL(fileURLWithPath: args[2], isDirectory: true)
let evidence = URL(fileURLWithPath: args[3], isDirectory: true)
let manager = FileManager.default
try manager.createDirectory(at: scratch, withIntermediateDirectories: true)
try manager.createDirectory(at: evidence, withIntermediateDirectories: true)
let engine = AtepdfPDFEngine(allowedRoots: [scratch], outputRoot: scratch.appendingPathComponent("atepdf-preview"))
let isolatedHome = scratch.appendingPathComponent("Library/Containers/dev.atepdf.fresh.mac/Data", isDirectory: true)
let isolatedCache = isolatedHome.appendingPathComponent("Library/Caches", isDirectory: true)
try require(!AtepdfStoragePolicy.catalystIsolated(bundleIdentifier: "dev.atepdf.fresh.mac", home: isolatedHome, caches: isolatedCache, sandboxEntitlement: nil), "Missing sandbox entitlement rejected")
try require(!AtepdfStoragePolicy.catalystIsolated(bundleIdentifier: "dev.atepdf.fresh.mac", home: isolatedHome, caches: isolatedCache, sandboxEntitlement: kCFBooleanFalse), "False sandbox entitlement rejected")
try require(!AtepdfStoragePolicy.catalystIsolated(bundleIdentifier: "dev.atepdf.fresh.mac", home: isolatedHome, caches: isolatedCache, sandboxEntitlement: NSNumber(value: 1)), "Numeric sandbox entitlement rejected")
try require(AtepdfStoragePolicy.catalystIsolated(bundleIdentifier: "dev.atepdf.fresh.mac", home: isolatedHome, caches: isolatedCache, sandboxEntitlement: kCFBooleanTrue), "Independent Catalyst container accepted")
try require(!AtepdfStoragePolicy.catalystIsolated(bundleIdentifier: "dev.atepdf.fresh.mac", home: scratch, caches: scratch.appendingPathComponent("Library/Caches"), sandboxEntitlement: kCFBooleanTrue), "Unsigned global Mac home rejected")
try require(!AtepdfStoragePolicy.catalystIsolated(bundleIdentifier: "dev.atepdf.fresh", home: isolatedHome, caches: isolatedCache, sandboxEntitlement: kCFBooleanTrue), "Wrong Catalyst identity rejected")
try require(!AtepdfStoragePolicy.catalystIsolated(bundleIdentifier: "dev.atepdf.fresh.mac", home: isolatedHome, caches: scratch.appendingPathComponent("Library/Caches"), sandboxEntitlement: kCFBooleanTrue), "Global Mac caches rejected")
try require(!AtepdfStoragePolicy.catalystIsolated(bundleIdentifier: "dev.atepdf.fresh.mac", home: isolatedHome.appendingPathComponent("extra"), caches: isolatedCache, sandboxEntitlement: kCFBooleanTrue), "Container suffix mismatch rejected")
if args.count == 4 {
try require(AtepdfStoragePolicy.cleanupRootsIsolated(home: isolatedHome, caches: isolatedCache), "Missing dedicated cleanup directories accepted")
try manager.createDirectory(at: isolatedCache, withIntermediateDirectories: true)
let untouched = scratch.appendingPathComponent("untouched-cleanup-target", isDirectory: true)
try manager.createDirectory(at: untouched, withIntermediateDirectories: true)
let sentinel = untouched.appendingPathComponent("original.txt")
try Data("preserve this synthetic file".utf8).write(to: sentinel)
for name in ["atepdf-work", "atepdf-preview", "atepdf-previews"] {
  let root = isolatedCache.appendingPathComponent(name, isDirectory: true)
  for destination in [untouched, isolatedCache.appendingPathComponent("missing-target"), root] {
    try manager.createSymbolicLink(at: root, withDestinationURL: destination)
    try require(!AtepdfStoragePolicy.cleanupRootsIsolated(home: isolatedHome, caches: isolatedCache), "Cleanup root symlink rejected: " + name)
    try require(!AtepdfStoragePolicy.catalystIsolated(bundleIdentifier: "dev.atepdf.fresh.mac", home: isolatedHome, caches: isolatedCache, sandboxEntitlement: kCFBooleanTrue), "Catalyst constant rejects cleanup symlink: " + name)
    try manager.removeItem(at: root)
  }
  try Data("not a directory".utf8).write(to: root)
  try require(!AtepdfStoragePolicy.cleanupRootsIsolated(home: isolatedHome, caches: isolatedCache), "Cleanup root file substitution rejected: " + name)
  try manager.removeItem(at: root)
  try manager.createDirectory(at: root, withIntermediateDirectories: false)
}
try require(AtepdfStoragePolicy.cleanupRootsIsolated(home: isolatedHome, caches: isolatedCache), "Real dedicated cleanup directories accepted")
for component in ["Library", "Library/Caches"] {
  let home = scratch.appendingPathComponent("substituted-" + component.replacingOccurrences(of: "/", with: "-"), isDirectory: true)
  let link = home.appendingPathComponent(component, isDirectory: true)
  try manager.createDirectory(at: link.deletingLastPathComponent(), withIntermediateDirectories: true)
  try manager.createSymbolicLink(at: link, withDestinationURL: untouched)
  try require(!AtepdfStoragePolicy.cleanupRootsIsolated(home: home, caches: home.appendingPathComponent("Library/Caches")), "Cleanup parent substitution rejected: " + component)
  try manager.removeItem(at: link)
}
let aliasedHome = scratch.appendingPathComponent("os-home-alias", isDirectory: true)
try manager.createSymbolicLink(at: aliasedHome, withDestinationURL: isolatedHome)
try require(AtepdfStoragePolicy.cleanupRootsIsolated(home: aliasedHome, caches: aliasedHome.appendingPathComponent("Library/Caches")), "OS home alias canonicalised before owned roots")
try manager.removeItem(at: aliasedHome)
try require(try String(contentsOf: sentinel, encoding: .utf8) == "preserve this synthetic file", "Cleanup policy never touches target files")
}
if args.count == 6 && args[4] == "inspect" {
  let result = try engine.inspect(URL(fileURLWithPath: args[5]).absoluteString)
  let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
  print(String(data: data, encoding: .utf8)!)
  exit(0)
}
if args.count == 6 && args[4] == "recognize" {
  let cancellation = AtepdfPDFCancellation(), token = cancellation.begin()
  let output = try engine.recognize(URL(fileURLWithPath: args[5]).absoluteString,
                                    check: { try cancellation.check(token) },
                                    requestChanged: { cancellation.register($0, token: token) })
  print(String(data: try JSONSerialization.data(withJSONObject: output), encoding: .utf8)!)
  exit(0)
}
if (args.count == 6 || args.count == 7) && args[4] == "render" {
  let output = try engine.render(URL(fileURLWithPath: args[5]).absoluteString, pageNumber: args.count == 7 ? Int(args[6])! : 2, maximumDimension: 1600)
  print(String(data: try JSONSerialization.data(withJSONObject: output), encoding: .utf8)!)
  exit(0)
}
if args.count == 7 && args[4] == "codec" {
  let request = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: args[5]))) as! [String: Any]
  let output = try engine.reencodeJpeg(request["base64"] as! String, width: request["width"] as! Int,
                                      height: request["height"] as! Int, quality: 0.82)
  try JSONSerialization.data(withJSONObject: ["base64": output]).write(to: URL(fileURLWithPath: args[6]))
  exit(0)
}
let names = ["brief.pdf", "appendix.pdf", "mixed-text-and-scan.pdf", "scanned-note.pdf", "image-heavy.pdf"]
var hashes: [String: String] = [:]
for name in names {
  let destination = scratch.appendingPathComponent(name)
  if !manager.fileExists(atPath: destination.path) { try manager.copyItem(at: fixtures.appendingPathComponent(name), to: destination) }
  hashes[name] = try digest(destination)
}
let started = Date()
func uri(_ name: String) -> String { scratch.appendingPathComponent(name).absoluteString }
let brief = try engine.inspect(uri("brief.pdf"))["pages"] as! [[String: Any]]
try require(brief.count == 2, "Brief page count")
try require((brief[0]["text"] as! String).contains("A1"), "Brief A1")
try require((brief[1]["text"] as! String).contains("A2"), "Brief A2")
let appendix = try engine.inspect(uri("appendix.pdf"))["pages"] as! [[String: Any]]
try require(appendix.count == 1 && (appendix[0]["text"] as! String).contains("B1"), "Appendix B1")
let rendered = try engine.render(uri("brief.pdf"), pageNumber: 1, maximumDimension: 1024)
try require((rendered["width"] as! Int) * (rendered["height"] as! Int) <= 12_000_000, "Raster bound")
try require((rendered["height"] as! Int) == 1024, "Raster dimension")
let previewURL = URL(string: rendered["uri"] as! String)!
try Data(contentsOf: previewURL).write(to: evidence.appendingPathComponent("apple-preview.png"))
let largePreview = try engine.render(uri("brief.pdf"), pageNumber: 1, maximumDimension: 1800)
try Data(contentsOf: URL(string: largePreview["uri"] as! String)!).write(to: evidence.appendingPathComponent("apple-preview-1800.png"))

// A known PDF rectangle catches the former non-upscaling transform even though
// its canvas dimensions, page count and OCR text all appeared correct.
let anchorURL = scratch.appendingPathComponent("raster-anchor.pdf")
var mediaBox = CGRect(x: 0, y: 0, width: 300, height: 400)
let anchorConsumer = CGDataConsumer(url: anchorURL as CFURL)!
let anchorContext = CGContext(consumer: anchorConsumer, mediaBox: &mediaBox, nil)!
anchorContext.beginPDFPage(nil)
anchorContext.setFillColor(CGColor(gray: 1, alpha: 1)); anchorContext.fill(mediaBox)
anchorContext.setFillColor(CGColor(red: 1, green: 0, blue: 0, alpha: 1))
anchorContext.fill(CGRect(x: 70, y: 300, width: 40, height: 20))
anchorContext.endPDFPage(); anchorContext.closePDF()
let anchorData = try Data(contentsOf: anchorURL)
var rasterChecks: [[String: Any]] = []
let expectedAnchors: [(Int?, CGRect)] = [
  (nil, CGRect(x: 70.0 / 300, y: 80.0 / 400, width: 40.0 / 300, height: 20.0 / 400)),
  (0, CGRect(x: 20.0 / 200, y: 20.0 / 280, width: 40.0 / 200, height: 20.0 / 280)),
  (90, CGRect(x: 240.0 / 280, y: 20.0 / 200, width: 20.0 / 280, height: 40.0 / 200)),
  (180, CGRect(x: 140.0 / 200, y: 240.0 / 280, width: 40.0 / 200, height: 20.0 / 280)),
  (270, CGRect(x: 20.0 / 280, y: 140.0 / 200, width: 20.0 / 280, height: 40.0 / 200)),
]
for (rotation, expected) in expectedAnchors {
  let document = PDFDocument(data: anchorData)!, page = document.page(at: 0)!
  if let rotation { page.setBounds(CGRect(x: 50, y: 60, width: 200, height: 280), for: .cropBox); page.rotation = rotation }
  let input = scratch.appendingPathComponent("anchor-\(rotation.map(String.init) ?? "full").pdf")
  try require(document.write(to: input), "Raster anchor fixture write")
  for dimension in [96, 724, 1024, 1800] {
    let output = try engine.render(input.absoluteString, pageNumber: 1, maximumDimension: dimension)
    let width = output["width"] as! Int, height = output["height"] as! Int
    let outputURL = URL(string: output["uri"] as! String)!
    let actual = try redBounds(outputURL)
    try assertBounds(actual, expected, tolerance: 2 / Double(min(width, height)), "rotation \(rotation.map(String.init) ?? "none"), size \(dimension)")
    rasterChecks.append(["rotation": rotation ?? 0, "cropped": rotation != nil, "maximumDimension": dimension,
                         "width": width, "height": height, "redBounds": [actual.minX, actual.minY, actual.width, actual.height]])
  }
}
try JSONSerialization.data(withJSONObject: ["passed": true, "checks": rasterChecks], options: [.prettyPrinted, .sortedKeys]).write(to: evidence.appendingPathComponent("apple-raster-geometry.json"))
let scopedWork = scratch.appendingPathComponent("scoped-work", isDirectory: true)
let scopedPreview = scratch.appendingPathComponent("scoped-preview", isDirectory: true)
try manager.createDirectory(at: scopedWork, withIntermediateDirectories: true)
let scopedInput = scopedWork.appendingPathComponent("input.pdf")
if !manager.fileExists(atPath: scopedInput.path) { try manager.copyItem(at: scratch.appendingPathComponent("brief.pdf"), to: scopedInput) }
let scopedEngine = AtepdfPDFEngine(allowedRoots: [scopedWork], outputRoot: scopedPreview)
try mustReject("outside dedicated work directory") { _ = try scopedEngine.inspect(uri("brief.pdf")) }
let exportHash = try digest(scopedInput)
let exportSource = try scopedEngine.exportSource(scopedInput.absoluteString)
try require(exportSource == scopedInput.resolvingSymlinksInPath(), "Export returns only the canonical app-private source")
try require(try digest(scopedInput) == exportHash, "Export validation preserves source bytes")
try mustReject("export outside dedicated work directory") { _ = try scopedEngine.exportSource(uri("brief.pdf")) }
try mustReject("export directory") { _ = try scopedEngine.exportSource(scopedWork.absoluteString) }
try mustReject("export remote URI") { _ = try scopedEngine.exportSource("https://example.com/document.pdf") }
try mustReject("export URI query") { _ = try scopedEngine.exportSource(scopedInput.absoluteString + "?document=other") }
try mustReject("export URI fragment") { _ = try scopedEngine.exportSource(scopedInput.absoluteString + "#page=1") }
let workLink = scratch.appendingPathComponent("work-link")
if !manager.fileExists(atPath: workLink.path) { try manager.createSymbolicLink(at: workLink, withDestinationURL: scopedWork) }
let substitutedWork = AtepdfPDFEngine(allowedRoots: [workLink], outputRoot: scopedPreview)
try mustReject("work directory symlink") { _ = try substitutedWork.inspect(workLink.appendingPathComponent("input.pdf").absoluteString) }
let scopedResult = try scopedEngine.render(scopedInput.absoluteString, pageNumber: 1, maximumDimension: 96)
try require(URL(string: scopedResult["uri"] as! String)!.deletingLastPathComponent().path == scopedPreview.resolvingSymlinksInPath().path, "Dedicated sibling preview output")
let previewLink = scratch.appendingPathComponent("preview-link")
if !manager.fileExists(atPath: previewLink.path) { try manager.createSymbolicLink(at: previewLink, withDestinationURL: scopedPreview) }
let unsafePreview = AtepdfPDFEngine(allowedRoots: [scopedWork], outputRoot: previewLink)
try mustReject("preview directory symlink") { _ = try unsafePreview.render(scopedInput.absoluteString, pageNumber: 1, maximumDimension: 96) }

let rotationDocument = PDFDocument(url: scratch.appendingPathComponent("brief.pdf"))!
rotationDocument.page(at: 0)!.rotation = 90
rotationDocument.page(at: 1)!.setBounds(CGRect(x: 25, y: 40, width: 400, height: 500), for: .cropBox)
let rotationURL = scratch.appendingPathComponent("geometry.pdf")
try require(rotationDocument.write(to: rotationURL), "Synthetic geometry fixture write")
let rotated = try engine.inspect(rotationURL.absoluteString)["pages"] as! [[String: Any]]
try require(rotated[0]["rotation"] as! Int == 90, "Rotation metadata")
try require(abs((rotated[0]["width"] as! Double) - (brief[0]["height"] as! Double)) < 0.1, "Rotated width")
try require(abs((rotated[0]["height"] as! Double) - (brief[0]["width"] as! Double)) < 0.1, "Rotated height")
try require(rotated[1]["width"] as! Double == 400 && rotated[1]["height"] as! Double == 500, "Crop geometry")
let rotatedRender = try engine.render(rotationURL.absoluteString, pageNumber: 1, maximumDimension: 1024)
try Data(contentsOf: URL(string: rotatedRender["uri"] as! String)!).write(to: evidence.appendingPathComponent("apple-rotated-preview.png"))

try mustReject("remote URI") { _ = try engine.inspect("https://example.com/document.pdf") }
try mustReject("outside storage") { _ = try engine.inspect(fixtures.appendingPathComponent("brief.pdf").absoluteString) }
try mustReject("page zero") { _ = try engine.render(uri("brief.pdf"), pageNumber: 0, maximumDimension: 100) }
try mustReject("page missing") { _ = try engine.render(uri("brief.pdf"), pageNumber: 3, maximumDimension: 100) }
try mustReject("oversized render") { _ = try engine.render(uri("brief.pdf"), pageNumber: 1, maximumDimension: 100_000) }
let link = scratch.appendingPathComponent("outside.pdf")
if !manager.fileExists(atPath: link.path) { try manager.createSymbolicLink(at: link, withDestinationURL: fixtures.appendingPathComponent("brief.pdf")) }
try mustReject("symlink escape") { _ = try engine.inspect(link.absoluteString) }
try Data("not a PDF".utf8).write(to: scratch.appendingPathComponent("broken.pdf"))
try mustReject("malformed") { _ = try engine.inspect(uri("broken.pdf")) }
try mustReject("export malformed PDF") { _ = try engine.exportSource(uri("broken.pdf")) }
try mustReject("export symlink escape") { _ = try engine.exportSource(link.absoluteString) }
let cancelled = AtepdfPDFCancellation()
let token = cancelled.begin(); cancelled.cancel()
try mustReject("cancelled before inspection") { _ = try engine.inspect(uri("brief.pdf")) { try cancelled.check(token) } }
try mustReject("expired deadline") { try cancelled.check((cancelled.begin().0, Date.distantPast)) }

let imageData = try Data(contentsOf: fixtures.appendingPathComponent("image-input.png"))
let imageSource = CGImageSourceCreateWithData(imageData as CFData, nil)!
let originalImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil)!
let jpegData = NSMutableData()
let jpegDestination = CGImageDestinationCreateWithData(jpegData, UTType.jpeg.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(jpegDestination, originalImage, [kCGImageDestinationLossyCompressionQuality: 1] as CFDictionary)
try require(CGImageDestinationFinalize(jpegDestination), "Synthetic JPEG generation")
let recompressed = try engine.reencodeJpeg((jpegData as Data).base64EncodedString(), width: originalImage.width, height: originalImage.height, quality: 0.82)
let smaller = Data(base64Encoded: recompressed)!
try require(smaller.count < jpegData.length, "Actual JPEG reduction")
let smallerSource = CGImageSourceCreateWithData(smaller as CFData, nil)!
let smallerImage = CGImageSourceCreateImageAtIndex(smallerSource, 0, nil)!
try require(smallerImage.width == originalImage.width && smallerImage.height == originalImage.height, "JPEG dimension preservation")
try mustReject("mismatched JPEG dimensions") { _ = try engine.reencodeJpeg((jpegData as Data).base64EncodedString(), width: 1, height: 1, quality: 0.82) }
try mustReject("JPEG pixel budget") { _ = try engine.reencodeJpeg((jpegData as Data).base64EncodedString(), width: 5000, height: 5000, quality: 0.82) }
try mustReject("non JPEG") { _ = try engine.reencodeJpeg(imageData.base64EncodedString(), width: originalImage.width, height: originalImage.height, quality: 0.82) }

fputs("Apple fixture phase: local OCR\n", stderr)
let ocr = try engine.recognize(uri("mixed-text-and-scan.pdf"))
try require(ocr.count == 1 && ocr[0]["page"] as! Int == 2, "Skip original digital text pages")
let words = ocr[0]["words"] as! [[String: Any]]
let text = words.map { $0["text"] as! String }.joined(separator: " ")
try require(text.contains("Paperwork made simple"), "English OCR phrase")
try require(text.contains("DEMO-0042"), "English OCR invoice reference")
let mixed = try engine.inspect(uri("mixed-text-and-scan.pdf"))["pages"] as! [[String: Any]]
let pageWidth = mixed[1]["width"] as! Double, pageHeight = mixed[1]["height"] as! Double
for word in words {
  let x = word["x"] as! Double, y = word["y"] as! Double
  let width = word["width"] as! Double, height = word["height"] as! Double
  try require(x >= 0 && y >= 0 && x + width <= pageWidth + 1 && y + height <= pageHeight + 1, "OCR geometry bounded in PDF points")
}
try require(words.contains { ($0["text"] as! String) == "S1" && ($0["y"] as! Double) > pageHeight / 2 }, "OCR bottom-left geometry")
// The scan fixture's title starts near x=44pt, y=700pt. The old padded raster
// incorrectly projected it to x≈196pt, y≈540pt while still passing bounds tests.
let title = words.first { ($0["text"] as! String) == "Scanned" }
try require(title != nil, "OCR positional title exists")
try require((title!["x"] as! Double) > 35 && (title!["x"] as! Double) < 65
            && (title!["y"] as! Double) > 690 && (title!["y"] as! Double) < 740,
            "OCR coordinates overlap the source title rather than padded raster coordinates")
try JSONSerialization.data(withJSONObject: ocr, options: [.prettyPrinted, .sortedKeys]).write(to: evidence.appendingPathComponent("apple-ocr-words.json"))
fputs("Apple fixture phase: OCR cancellation\n", stderr)
let ocrCancellation = AtepdfPDFCancellation(), ocrToken = ocrCancellation.begin()
try mustReject("cancel active OCR") {
  _ = try engine.recognize(uri("mixed-text-and-scan.pdf"), check: { try ocrCancellation.check(ocrToken) }, requestChanged: {
    ocrCancellation.register($0, token: ocrToken)
    if $0 != nil { ocrCancellation.cancel() }
  })
}
let rotatedScan = PDFDocument(url: scratch.appendingPathComponent("scanned-note.pdf"))!
rotatedScan.page(at: 0)!.rotation = 90
let scanURL = scratch.appendingPathComponent("rotated-scan.pdf")
try require(rotatedScan.write(to: scanURL), "Synthetic rotated scan write")
try mustReject("rotated scan OCR") { _ = try engine.recognize(scanURL.absoluteString) }
for name in names { try require(try digest(scratch.appendingPathComponent(name)) == hashes[name], "Original immutable " + name) }
let report: [String: Any] = [
  "syntheticOnly": true, "platform": ProcessInfo.processInfo.operatingSystemVersionString,
  "reader": "Apple PDFKit/CoreGraphics", "ocr": "Apple Vision English", "codec": "Apple ImageIO",
  "passed": true, "briefPages": brief.count, "appendixPages": appendix.count,
  "preview": ["width": rendered["width"]!, "height": rendered["height"]!],
  "ocrPages": ocr.count, "ocrWords": words.count,
  "jpegBytesBefore": jpegData.length, "jpegBytesAfter": smaller.count,
  "originalHashesUnchanged": hashes, "elapsedSeconds": Date().timeIntervalSince(started),
  "checks": ["PDF page count and marker order", "CoreGraphics raster", "20 pixel-anchor checks across resolutions, rotations and nonzero crop origin", "rotation and crop geometry",
             "local-only file URI and symlink boundary", "Catalyst sandbox entitlement type and independent container", "malformed and range failures", "cooperative cancellation",
             "JPEG dimensions and measured reduction", "OCR phrase and absolute source-title position", "digital text skip", "immutable inputs"],
  "limitations": ["macOS helper execution; Expo/iOS integration tested separately", "no physical device or release proof", "CoreGraphics drawing is not interruptible mid-call"]
]
let resultData = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
try resultData.write(to: evidence.appendingPathComponent("apple-engine-tests.json"))
print(String(data: resultData, encoding: .utf8)!)
