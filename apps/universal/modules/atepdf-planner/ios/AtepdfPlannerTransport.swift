import Foundation
import CryptoKit
import Security

private final class RejectPlannerRedirects: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  let endpoint: AtepdfPlannerTransport.Endpoint
  init(endpoint: AtepdfPlannerTransport.Endpoint) { self.endpoint = endpoint }
  func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge,
                  completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
    guard let pin = endpoint.fingerprint else { completionHandler(.performDefaultHandling, nil); return }
    guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
          challenge.protectionSpace.host == endpoint.url.host, challenge.protectionSpace.port == endpoint.url.port,
          let trust = challenge.protectionSpace.serverTrust else { completionHandler(.cancelAuthenticationChallenge, nil); return }
    // CopyCertificateChain may evaluate trust. Set the policy and forbid issuer
    // fetches first, including for a peer that will subsequently fail its pin.
    guard SecTrustSetPolicies(trust, SecPolicyCreateSSL(true, challenge.protectionSpace.host as CFString)) == errSecSuccess,
          SecTrustSetNetworkFetchAllowed(trust, false) == errSecSuccess,
          let chain = SecTrustCopyCertificateChain(trust) as? [SecCertificate], chain.count == 2,
          let leaf = chain.first, let anchor = chain.last else { completionHandler(.cancelAuthenticationChallenge, nil); return }
    let actual = SHA256.hash(data: SecCertificateCopyData(leaf) as Data).map { String(format: "%02x", $0) }.joined()
    // The exact leaf pin arrived with the one-use pairing code. Trust only its
    // private issuer for this session, then still check hostname, dates and EKU.
    guard actual == pin,
          SecTrustSetAnchorCertificates(trust, [anchor] as CFArray) == errSecSuccess,
          SecTrustSetAnchorCertificatesOnly(trust, true) == errSecSuccess,
          SecTrustEvaluateWithError(trust, nil) else { completionHandler(.cancelAuthenticationChallenge, nil); return }
    completionHandler(.useCredential, URLCredential(trust: trust))
  }
  // Async bytes(for:delegate:) uses a task delegate. Handle its challenge here
  // as well as the session-level challenge so the same checks always apply.
  func urlSession(_ session: URLSession, task: URLSessionTask, didReceive challenge: URLAuthenticationChallenge,
                  completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
    urlSession(session, didReceive: challenge, completionHandler: completionHandler)
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                  newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
    completionHandler(nil) // Never forward a pairing secret or bearer to a redirect.
  }
}

/// Private beta only. Tokens live in this actor, never JS, files or preferences.
actor AtepdfPlannerTransport {
  enum Failure: LocalizedError {
    case unavailable, pairing, request, response, connection
    var errorDescription: String? {
      switch self {
      case .unavailable: return "AI connection is not available on this device yet. Local quick actions still work."
      case .pairing: return "Pair this app with the atepdf browser again."
      case .request: return "This request cannot be sent safely. Your PDFs stay here."
      case .response: return "The planner response could not be accepted. No files changed."
      case .connection: return "The planner connection is unavailable. Keep atepdf running on your Mac and both devices on the same Wi-Fi."
      }
    }
  }
  struct Endpoint: Sendable { let url: URL; let fingerprint: String? }
  private struct Connection { let endpoint: Endpoint; let token: String; let expiresAt: Double }
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
  static func privateIPv4(_ host: String) -> Bool {
    let pieces = host.split(separator: ".", omittingEmptySubsequences: false)
    guard pieces.count == 4 else { return false }
    let values = pieces.compactMap { Int($0) }
    guard values.count == 4, zip(pieces, values).allSatisfy({ String($0.1) == $0.0 && (0...255).contains($0.1) }) else { return false }
    return host == "127.0.0.1" || values[0] == 10 || (values[0] == 172 && (16...31).contains(values[1])) || (values[0] == 192 && values[1] == 168)
  }
  static func pairedEndpoint(_ code: String) throws -> (Endpoint, String) {
    if !code.hasPrefix("atepdf-beta:") {
      let (port, localCode) = try pairingParts(code)
      #if os(iOS) && !targetEnvironment(simulator) && !targetEnvironment(macCatalyst)
      throw Failure.pairing // A phone never sends a bearer over plain HTTP.
      #else
      return (Endpoint(url: URL(string: "http://localhost:\(port)")!, fingerprint: nil), localCode)
      #endif
    }
    let encoded = String(code.dropFirst("atepdf-beta:".count))
    guard encoded.count <= 1500, !encoded.isEmpty, encoded.allSatisfy({ "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".contains($0) }) else { throw Failure.pairing }
    var base64 = encoded.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
    base64 += String(repeating: "=", count: (4 - base64.count % 4) % 4)
    guard let data = Data(base64Encoded: base64), let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          Set(object.keys) == ["v", "origin", "fingerprint", "code", "expiresAt"], object["v"] as? Int == 1,
          let origin = object["origin"] as? String, let url = URL(string: origin), url.scheme == "https",
          let host = url.host, privateIPv4(host), let port = url.port, (1024...65535).contains(port), origin == "https://\(host):\(port)",
          let fingerprint = object["fingerprint"] as? String, fingerprint.count == 64, fingerprint.allSatisfy({ "0123456789abcdef".contains($0) }),
          let localCode = object["code"] as? String, let expiry = object["expiresAt"] as? Double,
          expiry > Date().timeIntervalSince1970 * 1000, expiry <= Date().timeIntervalSince1970 * 1000 + 305_000 else { throw Failure.pairing }
    _ = try pairingParts(localCode)
    return (Endpoint(url: url, fingerprint: fingerprint), localCode)
  }
  static func admittedBody(_ body: String) throws -> Data {
    let data = Data(body.utf8)
    let keys: Set<String> = ["schemaVersion","requestId","workspaceRevision","locale","instruction","files","selectionRefs","focusedResultRef","originalRefs","pendingClarification","previousActionIds","capabilities","previousPlan","ocrLanguages"]
    let fileKeys: Set<String> = ["ref","kind","pageCount","sizeBytes","encrypted"]
    guard data.count <= 24_000, let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          Set(object.keys) == keys, let instruction = object["instruction"] as? String, !instruction.isEmpty, instruction.count <= 1000,
          let files = object["files"] as? [[String: Any]], files.count <= 40, files.allSatisfy({ Set($0.keys) == fileKeys }) else { throw Failure.request }
    if !(object["pendingClarification"] is NSNull) {
      let pendingKeys: Set<String> = ["originalRequestId","workspaceRevision","originalInstruction","question","choices","answers","selectionRefs","focusedResultRef","originalRefs"]
      guard let pending = object["pendingClarification"] as? [String: Any], Set(pending.keys) == pendingKeys,
            let original = pending["originalInstruction"] as? String, !original.isEmpty, original.count <= 1000,
            let question = pending["question"] as? String, !question.isEmpty, question.count <= 600,
            let choices = pending["choices"] as? [String], choices.count <= 6, choices.allSatisfy({ !$0.isEmpty && $0.count <= 100 }),
            let answers = pending["answers"] as? [[String: Any]], answers.count <= 3,
            answers.allSatisfy({ answer in
              guard Set(answer.keys) == ["question","answer"], let question = answer["question"] as? String,
                    let text = answer["answer"] as? String else { return false }
              return !question.isEmpty && question.count <= 600 && !text.isEmpty && text.count <= 1000
            }) else { throw Failure.request }
    }
    return data
  }
  func pair(id: String, code: String) async throws {
    let (endpoint, safeCode) = try Self.pairedEndpoint(code)
    let current = generation
    let data = try JSONSerialization.data(withJSONObject: ["code": safeCode])
    let text = try await call(id: id, endpoint: endpoint, path: "pair", body: data, token: nil)
    guard current == generation, let object = try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any],
          let token = object["token"] as? String, token.count == 64, token.allSatisfy({ "0123456789abcdef".contains($0) }),
          let expiry = object["expiresAt"] as? Double, expiry > Date().timeIntervalSince1970 * 1000,
          expiry <= Date().timeIntervalSince1970 * 1000 + 8 * 60 * 60 * 1000 + 5000 else { throw Failure.pairing }
    connection = Connection(endpoint: endpoint, token: token, expiresAt: expiry)
    generation += 1
  }
  func status(id: String) async throws -> String {
    guard let saved = connection, saved.expiresAt > Date().timeIntervalSince1970 * 1000 else { connection = nil; return Self.unpaired }
    do { return try await call(id: id, endpoint: saved.endpoint, path: "planner/status", body: nil, token: saved.token) }
    catch Failure.pairing { if connection?.token == saved.token { connection = nil }; return Self.unpaired }
  }
  func plan(id: String, body: String) async throws -> String {
    let data = try Self.admittedBody(body)
    guard let saved = connection, saved.expiresAt > Date().timeIntervalSince1970 * 1000 else { throw Failure.pairing }
    return try await call(id: id, endpoint: saved.endpoint, path: "planner", body: data, token: saved.token)
  }
  func disconnect(id: String) async throws {
    let saved = connection; reset()
    if let saved { _ = try? await call(id: id, endpoint: saved.endpoint, path: "disconnect", body: Data("{}".utf8), token: saved.token) }
  }
  func cancel(id: String) {
    if let task = calls[id] { task.cancel() }
    else { if cancelled.count >= 128 { cancelled.removeAll() }; cancelled.insert(id) }
  }
  func reset() { generation += 1; connection = nil; calls.values.forEach { $0.cancel() } }
  private func call(id: String, endpoint: Endpoint, path: String, body: Data?, token: String?) async throws -> String {
    guard UUID(uuidString: id) != nil, calls[id] == nil else { throw Failure.request }
    if cancelled.remove(id) != nil { throw CancellationError() }
    let task = Task { try await Self.exchange(endpoint: endpoint, path: path, body: body, token: token) }
    calls[id] = task
    defer { calls[id] = nil }
    do { let text = try await task.value; guard !task.isCancelled else { throw CancellationError() }; return text }
    catch is CancellationError { throw CancellationError() }
    catch let error as Failure { throw error }
    catch { if task.isCancelled { throw CancellationError() }; throw Failure.connection }
  }
  private static func exchange(endpoint: Endpoint, path: String, body: Data?, token: String?) async throws -> String {
    guard ["pair","planner","planner/status","disconnect"].contains(path),
          let url = URL(string: endpoint.url.absoluteString + "/api/native/\(path)") else { throw Failure.request }
    let config = URLSessionConfiguration.ephemeral
    config.urlCache = nil; config.httpCookieStorage = nil; config.urlCredentialStorage = nil
    config.httpShouldSetCookies = false; config.requestCachePolicy = .reloadIgnoringLocalCacheData
    config.waitsForConnectivity = false; config.allowsCellularAccess = false
    config.tlsMinimumSupportedProtocolVersion = .TLSv12
    config.timeoutIntervalForRequest = 35; config.timeoutIntervalForResource = 40
    let delegate = RejectPlannerRedirects(endpoint: endpoint)
    let session = URLSession(configuration: config, delegate: delegate, delegateQueue: nil)
    defer { session.invalidateAndCancel() }
    var request = URLRequest(url: url)
    request.httpMethod = body == nil ? "GET" : "POST"; request.httpBody = body
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    try Task.checkCancellation()
    let (bytes, response) = try await session.bytes(for: request, delegate: delegate)
    guard let http = response as? HTTPURLResponse, response.url == url else { throw Failure.response }
    if http.statusCode == 401 { throw Failure.pairing }
    guard http.statusCode == 200, http.mimeType == "application/json", http.expectedContentLength <= 256_000 else { throw Failure.response }
    var data = Data()
    for try await byte in bytes { try Task.checkCancellation(); guard data.count < 256_000 else { throw Failure.response }; data.append(byte) }
    guard let text = String(data: data, encoding: .utf8) else { throw Failure.response }
    return text
  }
}
