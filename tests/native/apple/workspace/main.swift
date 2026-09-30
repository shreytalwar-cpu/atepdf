import Foundation
import CryptoKit
import Security

// Synthetic host checks for AtepdfWorkspaceVault (SHR-39; storage usage SHR-40). Compiled with swiftc
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

// 2b. Storage queries fail closed: an unknown state is an error, never "empty" or "missing".
let queries = AtepdfWorkspaceVault(root: scratch.appendingPathComponent("queries", isDirectory: true), keys: MemoryKeys(SymmetricKey(size: .bits256)))
try require(try queries.list("blobs").isEmpty && !(try queries.exists("head")), "a workspace that was never created lists empty and has no head")
try queries.writeSealed("blobs/file_q.atw", plain: Data([1, 2, 3]), associatedData: "q")
try queries.writeSealed("manifests/1.atw", plain: Data([4]), associatedData: "m")
func throwsIO(_ body: () throws -> Void) -> Bool { do { try body(); return false } catch { return true } }
let qBlobs = queries.root.appendingPathComponent("blobs"), qManifests = queries.root.appendingPathComponent("manifests")
chmod(qBlobs.path, 0o000)
try require(throwsIO { _ = try queries.list("blobs") }, "an unreadable blob directory throws instead of listing empty")
try require(throwsIO { _ = try queries.exists("blobs/file_q.atw") }, "an unsearchable directory throws instead of reporting a missing file")
try require(throwsIO { _ = try queries.readOpened("blobs/file_q.atw", associatedData: "q") }, "an unreadable blob throws instead of reading as missing")
chmod(qBlobs.path, 0o700)
chmod(qManifests.path, 0o000)
try require(throwsIO { _ = try queries.list("manifests") }, "an unreadable manifest directory throws instead of listing empty")
chmod(qManifests.path, 0o700)
chmod(qManifests.appendingPathComponent("1.atw").path, 0o000)
try require(throwsIO { _ = try queries.readOpened("manifests/1.atw", associatedData: "m") }, "an unreadable manifest file throws instead of reading as missing")
chmod(qManifests.appendingPathComponent("1.atw").path, 0o600)
// Write and search but no read permission: unlink succeeds, the directory sync cannot open it.
chmod(qBlobs.path, 0o300)
try require(throwsIO { try queries.remove("blobs/file_q.atw") }, "an unlink whose directory sync fails is reported as a failed removal")
chmod(qBlobs.path, 0o700)
try require(!(try queries.exists("blobs/file_q.atw")) && (try queries.list("blobs")).isEmpty, "the unlinked file no longer lists")
try queries.remove("blobs/file_q.atw")
print("ok  removing it again is idempotent and confirms the removal with a successful directory sync")
try queries.syncWorkspaceDirectory("blobs")
try queries.syncWorkspaceDirectory("manifests")
print("ok  explicit directory syncs succeed on readable workspace directories")
chmod(qBlobs.path, 0o300)
try require(throwsIO { try queries.syncWorkspaceDirectory("blobs") }, "a directory sync that cannot open the directory throws")
chmod(qBlobs.path, 0o700)
let fresh = AtepdfWorkspaceVault(root: scratch.appendingPathComponent("fresh-sync", isDirectory: true), keys: MemoryKeys(SymmetricKey(size: .bits256)))
try fresh.syncWorkspaceDirectory("blobs")
try require(throwsIO { try fresh.syncWorkspaceDirectory("staging") }, "only workspace data directories can be synced by name")
print("ok  syncing a directory that was never created has nothing to commit")

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

// 7. Storage usage (SHR-40): workspace files only, measured with lstat.
let usageRoot = scratch.appendingPathComponent("usage/Workspace", isDirectory: true)
let usageVault = AtepdfWorkspaceVault(root: usageRoot, keys: MemoryKeys(SymmetricKey(size: .bits256)))
try require(try usageVault.usage().isEmpty, "a workspace that was never created uses no storage")
try usageVault.writeSealed("head", plain: Data(repeating: 1, count: 10), associatedData: "head")
try usageVault.writeSealed("manifests/1.atw", plain: Data(repeating: 2, count: 100), associatedData: "m")
try usageVault.writeSealed("blobs/file_a.atw", plain: pdf, associatedData: "b")
try Data(repeating: 3, count: 7).write(to: usageRoot.appendingPathComponent("staging/interrupted.tmp"))
// Neither a symbolic link to a user's file nor an unrelated file is counted or followed.
let userFile = scratch.appendingPathComponent("usage/User Documents/Large original.pdf")
try manager.createDirectory(at: userFile.deletingLastPathComponent(), withIntermediateDirectories: true)
try Data(repeating: 9, count: 1_000_000).write(to: userFile)
let userHash = hex(Data(SHA256.hash(data: try Data(contentsOf: userFile))))
try manager.createSymbolicLink(at: usageRoot.appendingPathComponent("blobs/file_link.atw"), withDestinationURL: userFile)
try Data(repeating: 4, count: 50).write(to: usageRoot.appendingPathComponent("blobs/notes.txt"))
let measured = Dictionary(uniqueKeysWithValues: try usageVault.usage().map { ($0.name, $0.bytes) })
try require(measured == ["head": 42, "manifests/1.atw": 132, "blobs/file_a.atw": Int64(pdf.count + 32), "staging": 7], "usage reports each sealed workspace file's on-disk size and staging, nothing else")
try require(hex(Data(SHA256.hash(data: try Data(contentsOf: userFile)))) == userHash, "measuring never changes a file outside the workspace")
try manager.setAttributes([.posixPermissions: 0o000], ofItemAtPath: usageRoot.appendingPathComponent("blobs").path)
var usageFailed = false
do { _ = try usageVault.usage() } catch { usageFailed = true }
try manager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: usageRoot.appendingPathComponent("blobs").path)
try require(usageFailed, "an unreadable workspace directory is an error, never zero usage")

// 8. Staging cleanup is verified, and failures are reported (SHR-40 P1-2).
let stagingDir = usageRoot.appendingPathComponent("staging")
try Data(repeating: 5, count: 9).write(to: stagingDir.appendingPathComponent("second.tmp"))
try usageVault.cleanStaging()
try require(try manager.contentsOfDirectory(atPath: stagingDir.path).isEmpty && (try usageVault.usage()).allSatisfy { $0.name != "staging" }, "staging cleanup removes every staging file and verifies it is empty")
let neverStaged = AtepdfWorkspaceVault(root: scratch.appendingPathComponent("usage/Never", isDirectory: true), keys: MemoryKeys())
try neverStaged.cleanStaging()
try require(true, "a staging directory that was never created is clean")
try Data(repeating: 6, count: 11).write(to: stagingDir.appendingPathComponent("locked.tmp"))
try manager.setAttributes([.posixPermissions: 0o500], ofItemAtPath: stagingDir.path)
var unlinkFailed = false
do { try usageVault.cleanStaging() } catch { unlinkFailed = true }
try require(unlinkFailed && manager.fileExists(atPath: stagingDir.appendingPathComponent("locked.tmp").path), "a staging file that cannot be unlinked is an error, and it stays")
try manager.setAttributes([.posixPermissions: 0o000], ofItemAtPath: stagingDir.path)
var listingFailed = false
do { try usageVault.cleanStaging() } catch { listingFailed = true }
try manager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: stagingDir.path)
try require(listingFailed, "an unreadable staging directory is an error, never clean")
try require((try usageVault.usage()).contains { $0.name == "staging" && $0.bytes == 11 }, "retained staging bytes stay visible in usage")
try usageVault.cleanStaging()
try require(try manager.contentsOfDirectory(atPath: stagingDir.path).isEmpty, "a later retry removes the retained staging file")
let symlinkRoot = scratch.appendingPathComponent("usage/Linked", isDirectory: true)
try manager.createDirectory(at: symlinkRoot, withIntermediateDirectories: true)
let outsideDir = scratch.appendingPathComponent("usage/Outside staging", isDirectory: true)
try manager.createDirectory(at: outsideDir, withIntermediateDirectories: true)
try Data(repeating: 7, count: 13).write(to: outsideDir.appendingPathComponent("user.tmp"))
try manager.createSymbolicLink(at: symlinkRoot.appendingPathComponent("staging"), withDestinationURL: outsideDir)
var symlinkRefused = false
do { try AtepdfWorkspaceVault(root: symlinkRoot, keys: MemoryKeys()).cleanStaging() } catch { symlinkRefused = true }
try require(symlinkRefused && manager.fileExists(atPath: outsideDir.appendingPathComponent("user.tmp").path), "a symbolic-link staging directory is refused and its target left untouched")

// 6. Interop with the TypeScript backend format, using a synthetic shared key.
let interop = AtepdfWorkspaceVault(root: scratch.appendingPathComponent("interop"), keys: MemoryKeys(sharedKey))
try interop.writeSealed("blobs/file_swift.atw", plain: pdf, associatedData: "atepdf.workspace/v1|pdf|interop|file_swift|1")
let fromNode = try interop.readOpened("blobs/file_node.atw", associatedData: "atepdf.workspace/v1|pdf|interop|file_node|1")
try require(fromNode.status == "ok" && fromNode.data == pdf, "Swift opens a file sealed by the TypeScript test backend")
print("SHR-39/SHR-40 native workspace checks passed")
