import ExpoModulesCore
import Foundation
#if targetEnvironment(macCatalyst)
import Security
#endif

public final class AtepdfPdfModule: Module {
  private let workQueue = DispatchQueue(label: "dev.atepdf.local.pdf", qos: .userInitiated)
  private let cancellation = AtepdfPDFCancellation()
  #if targetEnvironment(macCatalyst)
  private let exportOwner = UUID()
  // Durable workspace I/O is serialized separately from PDF work.
  private let workspaceQueue = DispatchQueue(label: "dev.atepdf.local.workspace", qos: .userInitiated)
  private lazy var workspace: AtepdfWorkspaceVault? = {
    guard let root = try? AtepdfWorkspaceVault.defaultRoot() else { return nil }
    return AtepdfWorkspaceVault(root: root, keys: AtepdfKeychainWorkspaceKeyStore())
  }()
  private func requireWorkspace() throws -> AtepdfWorkspaceVault {
    try requireIsolatedStorage()
    guard let workspace else { throw AtepdfWorkspaceVault.Failure.io }
    return workspace
  }
  #endif
  private var storageIsolated: Bool {
    guard let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return false }
    let home = URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true)
    guard AtepdfStoragePolicy.cleanupRootsIsolated(home: home, caches: caches) else { return false }
    #if targetEnvironment(macCatalyst)
    guard let task = SecTaskCreateFromSelf(nil) else { return false }
    let entitlement = SecTaskCopyValueForEntitlement(task, "com.apple.security.app-sandbox" as CFString, nil)
    return AtepdfStoragePolicy.catalystIsolated(bundleIdentifier: Bundle.main.bundleIdentifier,
                                               home: home,
                                               caches: caches, sandboxEntitlement: entitlement)
    #else
    return true // iOS supplies the container; cleanup roots were checked above.
    #endif
  }
  private func requireIsolatedStorage() throws {
    guard storageIsolated else { throw AtepdfPDFEngine.Failure.localFile }
  }
  private lazy var engine: AtepdfPDFEngine = {
    let manager = FileManager.default
    let caches = manager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    return AtepdfPDFEngine(allowedRoots: [caches.appendingPathComponent("atepdf-work", isDirectory: true)],
                          outputRoot: caches.appendingPathComponent("atepdf-preview", isDirectory: true))
  }()

  // SHR-39 persists the workspace on Mac only; iOS keeps its session-only behavior.
  private var workspaceAvailable: Bool {
    #if targetEnvironment(macCatalyst)
    return storageIsolated
    #else
    return false
    #endif
  }

  private var exportAvailable: Bool {
    #if targetEnvironment(macCatalyst)
    return true
    #else
    return false
    #endif
  }

  public func definition() -> ModuleDefinition {
    Name("AtepdfPdf")
    Constants(["readerAvailable": true, "ocrAvailable": true, "storageIsolated": self.storageIsolated,
               "exportAvailable": self.exportAvailable, "workspaceAvailable": self.workspaceAvailable])
    #if targetEnvironment(macCatalyst)
    AsyncFunction("exportPDFAsync") { (uri: String) async throws -> String in
      try self.requireIsolatedStorage()
      let source = try self.engine.exportSource(uri)
      return try await AtepdfPDFExporter.shared.export(source, owner: self.exportOwner)
    }
    AsyncFunction("workspaceKeyStatusAsync") { (create: Bool) -> String in
      try self.requireWorkspace().keyStatus(create: create).rawValue
    }.runOnQueue(workspaceQueue)
    AsyncFunction("workspaceExistsAsync") { (name: String) -> Bool in
      try self.requireWorkspace().exists(name)
    }.runOnQueue(workspaceQueue)
    AsyncFunction("workspaceWriteSealedAsync") { (name: String, base64: String, associatedData: String) in
      guard let plain = Data(base64Encoded: base64) else { throw AtepdfWorkspaceVault.Failure.format }
      try self.requireWorkspace().writeSealed(name, plain: plain, associatedData: associatedData)
    }.runOnQueue(workspaceQueue)
    AsyncFunction("workspaceReadOpenedAsync") { (name: String, associatedData: String) -> [String: Any] in
      let result = try self.requireWorkspace().readOpened(name, associatedData: associatedData)
      guard let data = result.data else { return ["status": result.status] }
      return ["status": result.status, "base64": data.base64EncodedString()]
    }.runOnQueue(workspaceQueue)
    AsyncFunction("workspaceListAsync") { (directory: String) -> [String] in
      try self.requireWorkspace().list(directory)
    }.runOnQueue(workspaceQueue)
    AsyncFunction("workspaceRemoveAsync") { (name: String) in
      try self.requireWorkspace().remove(name)
    }.runOnQueue(workspaceQueue)
    AsyncFunction("workspaceSyncDirectoryAsync") { (directory: String) in
      try self.requireWorkspace().syncWorkspaceDirectory(directory)
    }.runOnQueue(workspaceQueue)
    AsyncFunction("workspaceCleanStagingAsync") {
      try self.requireWorkspace().cleanStaging()
    }.runOnQueue(workspaceQueue)
    AsyncFunction("workspaceUsageAsync") { () -> [[String: Any]] in
      try self.requireWorkspace().usage().map { ["name": $0.name, "bytes": Double($0.bytes)] }
    }.runOnQueue(workspaceQueue)
    #endif
    AsyncFunction("inspectAsync") { (uri: String) -> [String: Any] in
      try self.requireIsolatedStorage()
      let token = self.cancellation.begin()
      return try self.engine.inspect(uri) { try self.cancellation.check(token) }
    }.runOnQueue(workQueue)
    AsyncFunction("renderPageAsync") { (uri: String, page: Int, maximumDimension: Int) -> [String: Any] in
      try self.requireIsolatedStorage()
      let token = self.cancellation.begin()
      return try self.engine.render(uri, pageNumber: page, maximumDimension: maximumDimension) { try self.cancellation.check(token) }
    }.runOnQueue(workQueue)
    AsyncFunction("recognizeAsync") { (uri: String) -> [[String: Any]] in
      try self.requireIsolatedStorage()
      let token = self.cancellation.begin()
      return try self.engine.recognize(uri, check: { try self.cancellation.check(token) },
                                      requestChanged: { self.cancellation.register($0, token: token) })
    }.runOnQueue(workQueue)
    AsyncFunction("reencodeJpegAsync") { (base64: String, width: Int, height: Int, quality: Double) -> String in
      try self.requireIsolatedStorage()
      let token = self.cancellation.begin()
      return try self.engine.reencodeJpeg(base64, width: width, height: height, quality: quality) { try self.cancellation.check(token) }
    }.runOnQueue(workQueue)
    // Deliberately runs outside workQueue so a busy OCR request can be cancelled.
    AsyncFunction("cancelAsync") { self.cancellation.cancel() }
    OnDestroy {
      self.cancellation.cancel()
      #if targetEnvironment(macCatalyst)
      let owner = self.exportOwner
      Task { @MainActor in AtepdfPDFExporter.shared.cancel(owner: owner) }
      #endif
    }
  }
}
