import Foundation
import CryptoKit
import Security

// Synthetic host checks for AtepdfWorkspaceVault (SHR-39). Compiled with swiftc
// against the shipped source. This is not Mac Catalyst app acceptance: the
// Keychain probe runs from an unsigned command-line tool (see SHR-41).
func require(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
  if try !condition() { throw NSError(domain: "atepdf-workspace-test", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
  print("ok  \(message)")
}
final class MemoryKeys: AtepdfWorkspaceKeyStore {
  var key: SymmetricKey?; var state: AtepdfWorkspaceKeyStatus = .ready
  init(_ key: SymmetricKey? = nil) { self.key = key }
  func load() -> (AtepdfWorkspaceKeyStatus, SymmetricKey?) { state != .ready ? (state, nil) : key.map { (.ready, $0) } ?? (.missing, nil) }
  func create() -> (AtepdfWorkspaceKeyStatus, SymmetricKey?) { if key == nil { key = SymmetricKey(size: .bits256) }; return (.ready, key) }
}
func hex(_ data: Data) -> String { data.map { String(format: "%02x", $0) }.joined() }
func bytes(_ hex: String) -> Data { var out = Data(); var i = hex.startIndex; while i < hex.endIndex { let j = hex.index(i, offsetBy: 2); out.append(UInt8(hex[i..<j], radix: 16)!); i = j }; return out }
func mode(_ url: URL) throws -> Int { (try FileManager.default.attributesOfItem(atPath: url.path)[.posixPermissions] as! NSNumber).intValue }

let args = CommandLine.arguments
guard args.count >= 4 else { fatalError("Usage: workspace-check SCRATCH FIXTURE_PDF KEYHEX") }
let scratch = URL(fileURLWithPath: args[1], isDirectory: true)
let pdf = try Data(contentsOf: URL(fileURLWithPath: args[2]))
let sharedKey = SymmetricKey(data: bytes(args[3]))
let manager = FileManager.default

// 1. Sealed round trip, authentication and associated-data binding.
let keys = MemoryKeys()
let root = scratch.appendingPathComponent("Library/Application Support/atepdf/Workspace", isDirectory: true)
let vault = AtepdfWorkspaceVault(root: root, keys: keys)
try require(vault.keyStatus(create: false) == .missing, "missing key is reported without creating one")
try require(vault.keyStatus(create: true) == .ready, "key created only when asked")
try vault.writeSealed("blobs/file_a.atw", plain: pdf, associatedData: "pdf|a|1")
let stored = try Data(contentsOf: root.appendingPathComponent("blobs/file_a.atw"))
try require(stored.prefix(4) == Data("ATW1".utf8) && stored.count == pdf.count + 4 + 12 + 16, "ATW1 + nonce + ciphertext + tag layout")
try require(stored.range(of: Data("%PDF".utf8)) == nil, "PDF bytes are not stored in plaintext")
let opened = try vault.readOpened("blobs/file_a.atw", associatedData: "pdf|a|1")
try require(opened.status == "ok" && opened.data == pdf, "round trip returns identical PDF bytes")
try require(SHA256.hash(data: opened.data!).description == SHA256.hash(data: pdf).description, "round trip hash matches")
try require(try vault.readOpened("blobs/file_a.atw", associatedData: "pdf|a|2").status == "auth", "different generation in associated data is refused")
var tampered = stored; tampered[tampered.count - 1] ^= 1
try tampered.write(to: root.appendingPathComponent("blobs/file_b.atw"))
try require(try vault.readOpened("blobs/file_b.atw", associatedData: "pdf|a|1").status == "auth", "flipped tag byte is refused")
try stored.prefix(20).write(to: root.appendingPathComponent("blobs/file_c.atw"))
try require(try vault.readOpened("blobs/file_c.atw", associatedData: "pdf|a|1").status == "auth", "truncated file is refused")
try require(try vault.readOpened("blobs/file_missing.atw", associatedData: "x").status == "missing", "missing file is reported")
let other = AtepdfWorkspaceVault(root: root, keys: MemoryKeys(SymmetricKey(size: .bits256)))
try require(try other.readOpened("blobs/file_a.atw", associatedData: "pdf|a|1").status == "auth", "wrong key is refused")
let lockedKeys = MemoryKeys(); lockedKeys.state = .locked
let locked = AtepdfWorkspaceVault(root: root, keys: lockedKeys)
try require(locked.keyStatus(create: true) == .locked, "locked keychain is not replaced by a new key")
try require(try locked.readOpened("blobs/file_a.atw", associatedData: "pdf|a|1").status == "locked", "locked keychain reads report locked")

// 2. Names, atomic replacement, staging cleanup and listing.
for bad in ["../escape", "/etc/passwd", "blobs/../head", "blobs/file_a.pdf", "staging/x.tmp", "manifests/0.atw", "head/x"] {
  var rejected = false
  do { try vault.writeSealed(bad, plain: Data([1]), associatedData: "x") } catch { rejected = true }
  try require(rejected, "rejects storage name \(bad)")
}
try vault.writeSealed("head", plain: Data("one".utf8), associatedData: "head")
try vault.writeSealed("head", plain: Data("two".utf8), associatedData: "head")
try require(try vault.readOpened("head", associatedData: "head").data == Data("two".utf8), "head is replaced atomically by rename")
try require(try manager.contentsOfDirectory(atPath: root.appendingPathComponent("staging").path).isEmpty, "no staging leftovers after successful writes")
try Data([0]).write(to: root.appendingPathComponent("staging/interrupted.tmp"))
try vault.cleanStaging()
try require(try manager.contentsOfDirectory(atPath: root.appendingPathComponent("staging").path).isEmpty, "interrupted staging files are removed")
try vault.writeSealed("manifests/1.atw", plain: Data("{}".utf8), associatedData: "m")
try Data([0]).write(to: root.appendingPathComponent("manifests/notes.txt"))
try require(try vault.list("manifests") == ["manifests/1.atw"], "listing ignores unexpected files")
try vault.remove("manifests/1.atw")
try require(try vault.list("manifests").isEmpty, "remove deletes a sealed file")
try manager.createSymbolicLink(at: root.appendingPathComponent("blobs/file_link.atw"), withDestinationURL: root.appendingPathComponent("blobs/file_a.atw"))
try require(!(try vault.exists("blobs/file_link.atw")) && (try vault.readOpened("blobs/file_link.atw", associatedData: "pdf|a|1").status) == "missing", "symbolic links are not followed")

// 3. Owner-only permissions and backup exclusion of the whole workspace.
for directory in ["", "blobs", "manifests", "staging"] {
  try require(try mode(root.appendingPathComponent(directory)) & 0o777 == 0o700, "directory \(directory.isEmpty ? "root" : directory) is 0700")
}
try require(try mode(root.appendingPathComponent("blobs/file_a.atw")) & 0o777 == 0o600, "sealed blob is 0600")
try require(try mode(root.appendingPathComponent("head")) & 0o777 == 0o600, "head is 0600")
// The on-disk exclusion marker is asserted directly; Foundation's read-back is
// reported, because restricted command sandboxes can hide it (see SHR-39 evidence).
let exclusion = vault.backupExclusionState(root)
try require(exclusion.marker, "workspace directory carries the backup-exclusion marker on disk after replacement")
try require(vault.isExcludedFromBackup(root), "vault verifies the backup exclusion after replacement")
print("info Foundation isExcludedFromBackup read-back: \(exclusion.resourceValue)")
let unmarked = scratch.appendingPathComponent("unmarked", isDirectory: true)
try manager.createDirectory(at: unmarked, withIntermediateDirectories: true)
try require(!vault.isExcludedFromBackup(unmarked) && !AtepdfWorkspaceVault.backupExclusionMarker(unmarked), "a directory without the exclusion is not reported as excluded")

// 4. Keychain attributes as shipped: Data Protection Keychain, never synchronized, device-only.
let store = AtepdfKeychainWorkspaceKeyStore()
let base = store.baseQuery(), add = store.addQuery(Data(repeating: 0, count: 32))
try require(base[kSecUseDataProtectionKeychain as String] as? Bool == true, "query uses the Data Protection Keychain")
try require(base[kSecAttrSynchronizable as String] as? Bool == false, "query excludes synchronizable items")
try require(base[kSecClass as String] as! CFString == kSecClassGenericPassword, "generic password item")
try require(add[kSecAttrAccessible as String] as! CFString == kSecAttrAccessibleWhenUnlockedThisDeviceOnly, "key is WhenUnlockedThisDeviceOnly")
try require(AtepdfKeychainWorkspaceKeyStore.status(errSecItemNotFound) == .missing && AtepdfKeychainWorkspaceKeyStore.status(errSecInteractionNotAllowed) == .locked && AtepdfKeychainWorkspaceKeyStore.status(-34018) == .unavailable, "keychain status mapping")

// 5. Live Keychain probe with a throwaway service name. Reported, not asserted:
// an unsigned host tool may lack the entitlement the signed app has.
let probeService = "dev.atepdf.workspace.selftest.\(UUID().uuidString)"
let probe = AtepdfKeychainWorkspaceKeyStore(service: probeService)
let rawAdd = SecItemAdd(probe.addQuery(Data(repeating: 7, count: 32)) as CFDictionary, nil)
if rawAdd == errSecSuccess { SecItemDelete(probe.baseQuery() as CFDictionary) }
let (created, createdKey) = probe.create()
var live: [String: Any] = ["rawAddOSStatus": Int(rawAdd), "createStatus": created.rawValue]
if created == .ready, let createdKey {
  let (loaded, loadedKey) = probe.load()
  live["reloadMatches"] = loaded == .ready && loadedKey.map { $0.withUnsafeBytes { Data($0) } } == createdKey.withUnsafeBytes { Data($0) }
  var attributesQuery = probe.baseQuery(); attributesQuery[kSecReturnAttributes as String] = true
  var attributes: CFTypeRef?
  if SecItemCopyMatching(attributesQuery as CFDictionary, &attributes) == errSecSuccess, let found = attributes as? [String: Any] {
    live["accessible"] = found[kSecAttrAccessible as String] as? String
    live["synchronizable"] = (found[kSecAttrSynchronizable as String] as? NSNumber)?.boolValue ?? false
  }
  live["deleteStatus"] = Int(SecItemDelete(probe.baseQuery() as CFDictionary))
}
print("keychain-probe \(String(data: try JSONSerialization.data(withJSONObject: live, options: [.sortedKeys]), encoding: .utf8)!)")

// 6. Interop with the TypeScript backend format, using a synthetic shared key.
let interop = AtepdfWorkspaceVault(root: scratch.appendingPathComponent("interop"), keys: MemoryKeys(sharedKey))
try interop.writeSealed("blobs/file_swift.atw", plain: pdf, associatedData: "atepdf.workspace/v1|pdf|interop|file_swift|1")
let fromNode = try interop.readOpened("blobs/file_node.atw", associatedData: "atepdf.workspace/v1|pdf|interop|file_node|1")
try require(fromNode.status == "ok" && fromNode.data == pdf, "Swift opens a file sealed by the TypeScript test backend")
print("SHR-39 native workspace checks passed")
