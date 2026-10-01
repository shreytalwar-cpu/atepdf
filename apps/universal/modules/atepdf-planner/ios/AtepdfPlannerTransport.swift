import Foundation
import CryptoKit
import Security

// BEGIN GENERATED TRANSPORT POLICY
// From packages/contracts/transport-policy.json; node scripts/contracts.mjs.
private enum PlannerTransportPolicy {
  static let plannerResponseBytes = 524288
  static let controlResponseBytes = 8192
}
// END GENERATED TRANSPORT POLICY

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
    case unavailable, pairing, request, response, connection, privacy, destination, redirect, tooLarge, truncated, invalid
    var reasonCode: String? {
      switch self {
      case .destination: return "destination_not_allowed"
      case .redirect: return "redirect_not_allowed"
      case .tooLarge: return "response_too_large"
      case .truncated: return "response_truncated"
      case .invalid: return "provider_response_invalid"
      default: return nil
      }
    }
    var errorDescription: String? {
      switch self {
      case .unavailable: return "AI connection is not available on this device yet. Local quick actions still work."
      case .pairing: return "Pair this app with the atepdf browser again."
      case .request: return "This request cannot be sent safely. Your PDFs stay here."
      case .privacy: return "AI is unavailable. Use local tools instead. Your existing files and results are still available."
      case .destination: return "AI destination is not approved. No files changed."
      case .redirect: return "AI connection redirected. No files changed."
      case .tooLarge: return "AI response exceeded the supported size. No files changed."
      case .truncated: return "AI response was interrupted. No files changed."
      case .invalid: return "AI response could not be accepted. No files changed."
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
    let optionalKeys: Set<String> = ["selectorCapabilities","results"]
    let fileKeys: Set<String> = ["ref","kind","pageCount","sizeBucket","encrypted"]
    guard data.count <= 24_000, let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          keys.isSubset(of: Set(object.keys)), Set(object.keys).isSubset(of: keys.union(optionalKeys)), let instruction = object["instruction"] as? String, !instruction.isEmpty, instruction.count <= 1000,
          let files = object["files"] as? [[String: Any]], files.count <= 40, files.allSatisfy({ Set($0.keys) == fileKeys }) else { throw Failure.request }
    // Independent native pre-write admission, including callers that bypass JS.
    guard object["schemaVersion"] as? String == "1.0", object["locale"] as? String == "en-IN",
          let requestID = object["requestId"] as? String, matches(requestID, #"^req_[a-f0-9]{32}$"#),
          let revision = integer(object["workspaceRevision"]), revision >= 0,
          let selection = object["selectionRefs"] as? [String], let originals = object["originalRefs"] as? [String],
          let actions = object["previousActionIds"] as? [String], actions.isEmpty, object["previousPlan"] is NSNull,
          let capabilities = object["capabilities"] as? [String], capabilities.allSatisfy({ ["merge_pdf","select_pages","ocr_pdf","compress_pdf"].contains($0) }),
          let languages = object["ocrLanguages"] as? [String], languages.allSatisfy({ $0 == "eng" }),
          (languages.isEmpty || capabilities.contains("ocr_pdf")) else { throw Failure.request }
    let focus = object["focusedResultRef"] as? String
    guard focus != nil || object["focusedResultRef"] is NSNull else { throw Failure.request }
    let active = Set(selection + (focus.map { [$0] } ?? [])), refs = files.compactMap { $0["ref"] as? String }
    guard refs.count == files.count, Set(refs).count == refs.count, (selection + originals + (focus.map { [$0] } ?? [])).allSatisfy({ refs.contains($0) }),
          files.allSatisfy({ file in
            guard let ref = file["ref"] as? String, matches(ref, #"^(file|out)_[a-f0-9]{32}$"#), active.contains(ref),
                  file["kind"] as? String == "pdf", let pages = integer(file["pageCount"]), (1...100).contains(pages),
                  let bucket = file["sizeBucket"] as? String, ["<1MB","1-10MB","10-50MB",">50MB"].contains(bucket),
                  let encrypted = file["encrypted"] as? NSNumber, CFGetTypeID(encrypted) == CFBooleanGetTypeID(), !encrypted.boolValue else { return false }
            return true
          }), safeText(instruction) else { throw Failure.request }
    if let selectorValue = object["selectorCapabilities"] {
      guard let selectors = selectorValue as? [String], selectors.count <= 3, selectors.allSatisfy({ ["invoice","scanned_pages","blank_page_candidates"].contains($0) }) else { throw Failure.request }
    }
    if let resultValue = object["results"] {
      guard let results = resultValue as? [[String: Any]], results.count <= 40, results.allSatisfy({ result in
        guard Set(result.keys) == ["ref","status","pageCount","outcome"], let ref = result["ref"] as? String, active.contains(ref),
              let pages = integer(result["pageCount"]), (0...100).contains(pages), let status = result["status"] as? String, ["created","failed","cancelled"].contains(status),
              let outcome = result["outcome"] as? String, ["complete","target_not_met","no_change"].contains(outcome) else { return false }
        return true
      }) else { throw Failure.request }
    }
    if !(object["pendingClarification"] is NSNull) {
      let pendingKeys: Set<String> = ["originalRequestId","workspaceRevision","originalInstruction","question","choices","answers","selectionRefs","focusedResultRef","originalRefs"]
      guard let pending = object["pendingClarification"] as? [String: Any], Set(pending.keys) == pendingKeys,
            let originalID = pending["originalRequestId"] as? String, matches(originalID, #"^req_[a-f0-9]{32}$"#), originalID != requestID,
            integer(pending["workspaceRevision"]) == revision, pending["selectionRefs"] as? [String] == selection, pending["originalRefs"] as? [String] == originals,
            (pending["focusedResultRef"] as? String) == focus, (focus != nil || pending["focusedResultRef"] is NSNull),
            let original = pending["originalInstruction"] as? String, !original.isEmpty, original.count <= 1000, safeText(original),
            let question = pending["question"] as? String, !question.isEmpty, question.count <= 600, safeText(question),
            let choices = pending["choices"] as? [String], choices.count <= 6, choices.allSatisfy({ !$0.isEmpty && $0.count <= 100 && safeText($0) }),
            let answers = pending["answers"] as? [[String: Any]], answers.count <= 3,
            answers.allSatisfy({ answer in
              guard Set(answer.keys) == ["question","answer"], let question = answer["question"] as? String,
                    let text = answer["answer"] as? String else { return false }
              return !question.isEmpty && question.count <= 600 && !text.isEmpty && text.count <= 1000 && safeText(question) && safeText(text)
            }) else { throw Failure.request }
    }
    return data
  }
  private static func integer(_ value: Any?) -> Int? {
    guard let n = value as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), n.doubleValue.isFinite,
          n.doubleValue.rounded() == n.doubleValue, abs(n.doubleValue) <= 9_007_199_254_740_991 else { return nil }
    return n.intValue
  }
  private static func matches(_ text: String, _ pattern: String) -> Bool { text.range(of: pattern, options: .regularExpression) != nil }
  private static func safeText(_ text: String) -> Bool {
    // ADR 0012 N values and existing encoded-content/filename exclusions. No exception echoes input.
    let patterns = [
      #"(?i)sk-[a-z0-9_-]{12,}|\bAKIA[A-Z0-9]{16}\b|\b(?:ghp_|github_pat_)[a-z0-9_]{12,}|\beyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+|\b(?:api[_ -]?key|password|passphrase|passcode|secret|access[_ -]?token|refresh[_ -]?token|csrf[_ -]?token|pairing[_ -]?token)\s*["']?\s*(?:[:=]|is\b)\s*["']?\S+|\bmy\s+(?:password|passphrase|passcode|secret)\s+\S+|\bbearer\s+[a-z0-9._-]{12,}"#,
      #"(?i)(?:[a-z][a-z0-9+.-]*://|(?:data|file|blob|content|asset|ph):|[a-z]:[\\/]|(?:^|[\s"'(\[{=:])[~.]?\.?/\S+|\\\\)|%[a-f0-9]{2}|\\(?:u[a-f0-9]{4}|x[a-f0-9]{2})|[a-z0-9+/]{80,}={0,2}|[a-f0-9]{64}|\S+\.(?:pdf|png|jpe?g|docx?|xlsx?|csv|txt|json|zip|pptx?|odt|rtf|tiff?)\b"#,
      #"[\x{0000}-\x{0008}\x{000b}\x{000c}\x{000e}-\x{001f}\x{007f}\x{200b}-\x{200f}\x{202a}-\x{202e}\x{2060}-\x{206f}]"#
    ]
    return !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !text.contains("[Sensitive value removed]") && !hasPaymentCard(text) && matchesNone(text, patterns: patterns)
  }
  // A malformed policy expression must deny, never silently skip that rule.
  static func matchesNone(_ text: String, patterns: [String]) -> Bool {
    patterns.allSatisfy { pattern in
      guard let expression = try? NSRegularExpression(pattern: pattern) else { return false }
      return expression.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) == nil
    }
  }
  private static func hasPaymentCard(_ text: String) -> Bool {
    guard let expression = try? NSRegularExpression(pattern: #"\b\d(?:[ -]?\d){12,18}\b"#) else { return true }
    return expression.matches(in: text, range: NSRange(text.startIndex..., in: text)).contains { match in
      guard let range = Range(match.range, in: text) else { return true }
      let digits = text[range].compactMap { $0.wholeNumberValue }
      let sum = digits.reversed().enumerated().reduce(0) { total, item in
        let value = item.offset % 2 == 0 ? item.element : item.element * 2
        return total + (value > 9 ? value - 9 : value)
      }
      return (13...19).contains(digits.count) && sum % 10 == 0
    }
  }
  static func admittedEndpoint(_ endpoint: Endpoint) throws {
    // No signed release recipient registry or hosted disclosure exists yet (SHR-79/37).
    // Debug loopback IPC stays on this Mac. LAN beta is not permission to disclose H/N data.
    #if DEBUG
    guard ["localhost","127.0.0.1","::1"].contains(endpoint.url.host ?? ""),
          endpoint.url.user == nil, endpoint.url.password == nil, endpoint.url.path.isEmpty,
          endpoint.url.query == nil, endpoint.url.fragment == nil,
          (endpoint.url.scheme == "http" && [3210,3211,3212].contains(endpoint.url.port ?? 0) && endpoint.fingerprint == nil) ||
          (endpoint.url.scheme == "https" && (1024...65535).contains(endpoint.url.port ?? 0) &&
           endpoint.fingerprint?.count == 64 && endpoint.fingerprint?.allSatisfy({ "0123456789abcdef".contains($0) }) == true) else { throw Failure.destination }
    #else
    throw Failure.destination
    #endif
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
    try Task.checkCancellation()
    try admittedEndpoint(endpoint)
    if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    if path == "planner" { guard let body, let text = String(data: body, encoding: .utf8) else { throw Failure.request }; request.httpBody = try admittedBody(text) }
    let (bytes, response) = try await session.bytes(for: request, delegate: delegate)
    guard let http = response as? HTTPURLResponse, response.url == url else { throw Failure.redirect }
    if (300...399).contains(http.statusCode) { throw Failure.redirect }
    let limit = path == "planner" ? PlannerTransportPolicy.plannerResponseBytes : PlannerTransportPolicy.controlResponseBytes
    guard http.expectedContentLength <= limit else { throw Failure.tooLarge }
    guard http.mimeType == "application/json" else { throw Failure.invalid }
    var data = Data()
    do {
      for try await byte in bytes { try Task.checkCancellation(); guard data.count < limit else { throw Failure.tooLarge }; data.append(byte) }
    } catch is CancellationError { throw CancellationError() }
    catch let failure as Failure { throw failure }
    catch { throw Failure.truncated }
    if http.expectedContentLength >= 0 && http.value(forHTTPHeaderField: "Content-Encoding") == nil && data.count != http.expectedContentLength { throw Failure.truncated }
    if http.statusCode == 401 { throw Failure.pairing }
    if http.statusCode == 403 { throw Failure.privacy }
    guard http.statusCode == 200, let text = String(data: data, encoding: .utf8) else { throw Failure.invalid }
    return text
  }
}
