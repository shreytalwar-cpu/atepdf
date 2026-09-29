import Foundation
import CryptoKit
import Security

// Private encrypted workspace storage for Mac Catalyst (ADR 0010, SHR-39).
// One directory in Application Support holds sealed files only: a tiny head,
// versioned manifests and immutable PDF blobs. Each file is "ATW1" followed by an
// AES-256-GCM combined box (12-byte nonce, ciphertext, 16-byte tag) whose
// associated data names the file's role. The key stays in the device-local
// Keychain and never crosses into JavaScript.
public enum AtepdfWorkspaceKeyStatus: String { case ready, missing, locked, unavailable }

public protocol AtepdfWorkspaceKeyStore: AnyObject {
  func load() -> (AtepdfWorkspaceKeyStatus, SymmetricKey?)
  /// Creates a key only if none exists; an existing key is never replaced.
  func create() -> (AtepdfWorkspaceKeyStatus, SymmetricKey?)
}

public final class AtepdfKeychainWorkspaceKeyStore: AtepdfWorkspaceKeyStore {
  public static let defaultService = "dev.atepdf.workspace"
  public static let account = "workspace-key-v1"
  private let service: String
  public init(service: String = AtepdfKeychainWorkspaceKeyStore.defaultService) { self.service = service }

  /// Data Protection Keychain, never synchronized (no iCloud Keychain).
  public func baseQuery() -> [String: Any] {
    [kSecClass as String: kSecClassGenericPassword,
     kSecAttrService as String: service,
     kSecAttrAccount as String: Self.account,
     kSecUseDataProtectionKeychain as String: true,
     kSecAttrSynchronizable as String: false]
  }
  /// Device-only, available while the user session is unlocked.
  public func addQuery(_ key: Data) -> [String: Any] {
    var query = baseQuery()
    query[kSecValueData as String] = key
    query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    return query
  }
  public static func status(_ status: OSStatus) -> AtepdfWorkspaceKeyStatus {
    switch status {
    case errSecItemNotFound: return .missing
    case errSecInteractionNotAllowed: return .locked
    default: return .unavailable
    }
  }
  public func load() -> (AtepdfWorkspaceKeyStatus, SymmetricKey?) {
    var query = baseQuery()
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    guard status == errSecSuccess else { return (Self.status(status), nil) }
    guard let data = result as? Data, data.count == 32 else { return (.unavailable, nil) }
    return (.ready, SymmetricKey(data: data))
  }
  public func create() -> (AtepdfWorkspaceKeyStatus, SymmetricKey?) {
    let key = SymmetricKey(size: .bits256)
    let status = SecItemAdd(addQuery(key.withUnsafeBytes { Data($0) }) as CFDictionary, nil)
    if status == errSecSuccess { return (.ready, key) }
    if status == errSecDuplicateItem { return load() }
    return (Self.status(status), nil)
  }
}

public final class AtepdfWorkspaceVault {
  public enum Failure: Error { case name, io, format, key }
  public static let magic = Data("ATW1".utf8)
  private static let namePattern = try! NSRegularExpression(
    pattern: "^(?:head|manifests/[1-9][0-9]{0,14}\\.atw|blobs/(?:file|out)_[A-Za-z0-9_]{1,64}\\.atw)$")
  public let root: URL
  private let keys: AtepdfWorkspaceKeyStore
  private var key: SymmetricKey?
  private let lock = NSLock()

  public init(root: URL, keys: AtepdfWorkspaceKeyStore) {
    self.root = root.standardizedFileURL
    self.keys = keys
  }
  /// The resolved private container's Application Support, never a hard-coded path.
  public static func defaultRoot() throws -> URL {
    try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent("atepdf", isDirectory: true).appendingPathComponent("Workspace", isDirectory: true)
  }

  // MARK: Key custody
  public func keyStatus(create: Bool) -> AtepdfWorkspaceKeyStatus {
    lock.lock(); defer { lock.unlock() }
    if key != nil { return .ready }
    var (status, loaded) = keys.load()
    if status == .missing && create { (status, loaded) = keys.create() }
    key = loaded
    return status
  }
  private func currentKey() -> (AtepdfWorkspaceKeyStatus, SymmetricKey?) {
    lock.lock(); defer { lock.unlock() }
    if let key { return (.ready, key) }
    let (status, loaded) = keys.load()
    key = loaded
    return (status, loaded)
  }

  // MARK: Sealing
  public static func seal(_ plain: Data, key: SymmetricKey, associatedData: String) throws -> Data {
    let box = try AES.GCM.seal(plain, using: key, nonce: AES.GCM.Nonce(), authenticating: Data(associatedData.utf8))
    guard let combined = box.combined else { throw Failure.format }
    return magic + combined
  }
  public static func open(_ sealed: Data, key: SymmetricKey, associatedData: String) -> Data? {
    guard sealed.count >= magic.count + 12 + 16, sealed.prefix(magic.count) == magic,
          let box = try? AES.GCM.SealedBox(combined: sealed.dropFirst(magic.count)) else { return nil }
    return try? AES.GCM.open(box, using: key, authenticating: Data(associatedData.utf8))
  }

  // MARK: Files
  public static func validName(_ name: String) -> Bool {
    namePattern.firstMatch(in: name, range: NSRange(name.startIndex..., in: name)) != nil
  }
  private func url(_ name: String) throws -> URL {
    guard Self.validName(name) else { throw Failure.name }
    return root.appendingPathComponent(name, isDirectory: false)
  }
  /// Owner-only directories, and the whole workspace excluded from app-data backup.
  public func prepareDirectories() throws {
    let manager = FileManager.default
    for directory in [root, root.appendingPathComponent("blobs"), root.appendingPathComponent("manifests"), root.appendingPathComponent("staging")] {
      try manager.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
      try manager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: directory.path)
    }
    try excludeFromBackup(root)
  }
  /// Set, then verify, the exclusion. A workspace whose exclusion cannot be
  /// confirmed is not written.
  public func excludeFromBackup(_ url: URL) throws {
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    var target = url
    try target.setResourceValues(values)
    guard isExcludedFromBackup(url) else { throw Failure.io }
  }
  /// Foundation's read-back, or the exclusion marker Foundation stores on disk.
  /// Some restricted sandboxes (for example a seatbelt command sandbox) let the
  /// marker be written but make the resource-value read return false.
  public func isExcludedFromBackup(_ url: URL) -> Bool {
    let state = backupExclusionState(url)
    return state.resourceValue || state.marker
  }
  public func backupExclusionState(_ url: URL) -> (resourceValue: Bool, marker: Bool) {
    var fresh = URL(fileURLWithPath: url.path)
    fresh.removeAllCachedResourceValues()
    let resourceValue = (try? fresh.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup) == true
    return (resourceValue, Self.backupExclusionMarker(url))
  }
  public static let backupMarkerName = "com.apple.metadata:com_apple_backup_excludeItem"
  public static func backupExclusionMarker(_ url: URL) -> Bool {
    let size = getxattr(url.path, backupMarkerName, nil, 0, 0, XATTR_NOFOLLOW)
    guard size > 0 && size < 4096 else { return false }
    var buffer = [UInt8](repeating: 0, count: size)
    guard getxattr(url.path, backupMarkerName, &buffer, size, 0, XATTR_NOFOLLOW) == size,
          let value = try? PropertyListSerialization.propertyList(from: Data(buffer), format: nil) as? String else { return false }
    return value == "com.apple.backupd"
  }
  /// A directory entry change is only durable once the directory is synced.
  private func syncDirectory(_ directory: URL) throws {
    let descriptor = Darwin.open(directory.path, O_RDONLY)
    guard descriptor >= 0 else { throw Failure.io }
    defer { close(descriptor) }
    guard fsync(descriptor) == 0 else { throw Failure.io }
  }
  /// Stage in the same volume, flush to storage, then atomically rename over the target.
  private func writeDurable(_ target: URL, _ data: Data) throws {
    try prepareDirectories()
    let staged = root.appendingPathComponent("staging/\(UUID().uuidString).tmp")
    let descriptor = Darwin.open(staged.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600)
    guard descriptor >= 0 else { throw Failure.io }
    var renamed = false
    defer { if !renamed { unlink(staged.path) } }
    do {
      try data.withUnsafeBytes { (buffer: UnsafeRawBufferPointer) in
        var offset = 0
        while offset < buffer.count {
          let written = Darwin.write(descriptor, buffer.baseAddress! + offset, buffer.count - offset)
          if written < 0 && errno == EINTR { continue }
          guard written > 0 else { throw Failure.io }
          offset += written
        }
      }
      // F_FULLFSYNC asks the drive to flush; fsync is the fallback where unsupported.
      guard fcntl(descriptor, F_FULLFSYNC) == 0 || fsync(descriptor) == 0 else { throw Failure.io }
    } catch { close(descriptor); throw error }
    guard close(descriptor) == 0 else { throw Failure.io }
    guard rename(staged.path, target.path) == 0 else { throw Failure.io }
    renamed = true
    // The rename is visible now; a failed sync means it may not survive power loss.
    try syncDirectory(target.deletingLastPathComponent())
    try syncDirectory(root.appendingPathComponent("staging"))
    // File replacement can reset resource values; reassert the exclusion.
    try excludeFromBackup(root)
  }
  private func regularFile(_ url: URL) -> Bool {
    var info = stat()
    return lstat(url.path, &info) == 0 && (info.st_mode & S_IFMT) == S_IFREG
  }

  // MARK: Bridge operations
  public func exists(_ name: String) throws -> Bool { regularFile(try url(name)) }
  public func writeSealed(_ name: String, plain: Data, associatedData: String) throws {
    let target = try url(name)
    let (_, key) = currentKey()
    guard let key else { throw Failure.key }
    try writeDurable(target, try Self.seal(plain, key: key, associatedData: associatedData))
  }
  /// Status is "ok", "missing", "auth" (unopenable with this key/associated data) or "locked".
  public func readOpened(_ name: String, associatedData: String) throws -> (status: String, data: Data?) {
    let target = try url(name)
    guard regularFile(target), let sealed = try? Data(contentsOf: target) else { return ("missing", nil) }
    let (status, key) = currentKey()
    guard let key else { return (status == .locked ? "locked" : "auth", nil) }
    guard let plain = Self.open(sealed, key: key, associatedData: associatedData) else { return ("auth", nil) }
    return ("ok", plain)
  }
  public func list(_ directory: String) throws -> [String] {
    guard directory == "blobs" || directory == "manifests" else { throw Failure.name }
    let names = (try? FileManager.default.contentsOfDirectory(atPath: root.appendingPathComponent(directory).path)) ?? []
    return names.map { "\(directory)/\($0)" }.filter(Self.validName)
  }
  public func remove(_ name: String) throws {
    let target = try url(name)
    if unlink(target.path) != 0 && errno != ENOENT { throw Failure.io }
    try syncDirectory(target.deletingLastPathComponent())
  }
  public func cleanStaging() throws {
    let staging = root.appendingPathComponent("staging")
    for name in (try? FileManager.default.contentsOfDirectory(atPath: staging.path)) ?? [] where name.hasSuffix(".tmp") {
      unlink(staging.appendingPathComponent(name).path)
    }
  }
}
