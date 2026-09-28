import Foundation

private final class RejectPlannerRedirects: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                  newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
    completionHandler(nil) // Never forward a pairing secret or bearer to a redirect.
  }
}

/// Local development only. Tokens live in this actor, never JS, files or preferences.
actor AtepdfPlannerTransport {
  enum Failure: LocalizedError {
    case unavailable, pairing, request, response, connection
    var errorDescription: String? {
      switch self {
      case .unavailable: return "AI connection is not available on this device yet. Local quick actions still work."
      case .pairing: return "Pair this app with the atepdf browser again."
      case .request: return "This request cannot be sent safely. Your PDFs stay here."
      case .response: return "The planner response could not be accepted. No files changed."
      case .connection: return "The local planner is unavailable. Keep the atepdf browser server running on this Mac."
      }
    }
  }
  private struct Connection { let port: Int; let token: String; let expiresAt: Double }
  private var connection: Connection?
  private var generation = 0
  private var calls: [String: Task<String, Error>] = [:]
  private var cancelled = Set<String>()
  private static let unpaired = "{\"connected\":false,\"enabled\":false,\"remaining\":0,\"model\":\"gpt-6-luna\",\"pairingRequired\":true}"

  static func pairingParts(_ code: String) throws -> (Int, String) {
    let parts = code.split(separator: ":", omittingEmptySubsequences: false)
    guard parts.count == 3, parts[0] == "atepdf-local", let port = Int(parts[1]), [3210,3211,3212].contains(port),
          parts[2].count == 64, parts[2].allSatisfy({ "0123456789abcdef".contains($0) }) else { throw Failure.pairing }
    return (port, code)
  }
  static func admittedBody(_ body: String) throws -> Data {
    let data = Data(body.utf8)
    let keys: Set<String> = ["schemaVersion","requestId","workspaceRevision","locale","instruction","files","selectionRefs","focusedResultRef","originalRefs","previousActionIds","capabilities","previousPlan","ocrLanguages"]
    let fileKeys: Set<String> = ["ref","kind","pageCount","sizeBytes","encrypted"]
    guard data.count <= 24_000, let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          Set(object.keys) == keys, let instruction = object["instruction"] as? String, !instruction.isEmpty, instruction.count <= 1000,
          let files = object["files"] as? [[String: Any]], files.count <= 40, files.allSatisfy({ Set($0.keys) == fileKeys }) else { throw Failure.request }
    return data
  }
  func pair(id: String, code: String) async throws {
    let (port, safeCode) = try Self.pairingParts(code)
    let current = generation
    let data = try JSONSerialization.data(withJSONObject: ["code": safeCode])
    let text = try await call(id: id, port: port, path: "pair", body: data, token: nil)
    guard current == generation, let object = try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any],
          let token = object["token"] as? String, token.count == 64, token.allSatisfy({ "0123456789abcdef".contains($0) }),
          let expiry = object["expiresAt"] as? Double, expiry > Date().timeIntervalSince1970 * 1000,
          expiry <= Date().timeIntervalSince1970 * 1000 + 8 * 60 * 60 * 1000 + 5000 else { throw Failure.pairing }
    connection = Connection(port: port, token: token, expiresAt: expiry)
    generation += 1
  }
  func status(id: String) async throws -> String {
    guard let saved = connection, saved.expiresAt > Date().timeIntervalSince1970 * 1000 else { connection = nil; return Self.unpaired }
    do { return try await call(id: id, port: saved.port, path: "planner/status", body: nil, token: saved.token) }
    catch Failure.pairing { if connection?.token == saved.token { connection = nil }; return Self.unpaired }
  }
  func plan(id: String, body: String) async throws -> String {
    let data = try Self.admittedBody(body)
    guard let saved = connection, saved.expiresAt > Date().timeIntervalSince1970 * 1000 else { throw Failure.pairing }
    return try await call(id: id, port: saved.port, path: "planner", body: data, token: saved.token)
  }
  func disconnect(id: String) async throws {
    let saved = connection; reset()
    if let saved { _ = try? await call(id: id, port: saved.port, path: "disconnect", body: Data("{}".utf8), token: saved.token) }
  }
  func cancel(id: String) {
    if let task = calls[id] { task.cancel() }
    else { if cancelled.count >= 128 { cancelled.removeAll() }; cancelled.insert(id) }
  }
  func reset() { generation += 1; connection = nil; calls.values.forEach { $0.cancel() } }
  private func call(id: String, port: Int, path: String, body: Data?, token: String?) async throws -> String {
    guard UUID(uuidString: id) != nil, calls[id] == nil else { throw Failure.request }
    if cancelled.remove(id) != nil { throw CancellationError() }
    let task = Task { try await Self.exchange(port: port, path: path, body: body, token: token) }
    calls[id] = task
    defer { calls[id] = nil }
    do { let text = try await task.value; guard !task.isCancelled else { throw CancellationError() }; return text }
    catch is CancellationError { throw CancellationError() }
    catch let error as Failure { throw error }
    catch { if task.isCancelled { throw CancellationError() }; throw Failure.connection }
  }
  private static func exchange(port: Int, path: String, body: Data?, token: String?) async throws -> String {
    guard [3210,3211,3212].contains(port), ["pair","planner","planner/status","disconnect"].contains(path),
          let url = URL(string: "http://localhost:\(port)/api/native/\(path)") else { throw Failure.request }
    let config = URLSessionConfiguration.ephemeral
    config.urlCache = nil; config.httpCookieStorage = nil; config.urlCredentialStorage = nil
    config.httpShouldSetCookies = false; config.requestCachePolicy = .reloadIgnoringLocalCacheData
    config.waitsForConnectivity = false; config.allowsCellularAccess = false
    config.timeoutIntervalForRequest = 35; config.timeoutIntervalForResource = 40
    let session = URLSession(configuration: config, delegate: RejectPlannerRedirects(), delegateQueue: nil)
    defer { session.invalidateAndCancel() }
    var request = URLRequest(url: url)
    request.httpMethod = body == nil ? "GET" : "POST"; request.httpBody = body
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    try Task.checkCancellation()
    let (bytes, response) = try await session.bytes(for: request)
    guard let http = response as? HTTPURLResponse, response.url == url else { throw Failure.response }
    if http.statusCode == 401 { throw Failure.pairing }
    guard http.statusCode == 200, http.mimeType == "application/json", http.expectedContentLength <= 256_000 else { throw Failure.response }
    var data = Data()
    for try await byte in bytes { try Task.checkCancellation(); guard data.count < 256_000 else { throw Failure.response }; data.append(byte) }
    guard let text = String(data: data, encoding: .utf8) else { throw Failure.response }
    return text
  }
}
