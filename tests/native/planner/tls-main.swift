import Foundation

@main struct NativeTLSPlannerTests {
  static func require(_ condition: Bool, _ message: String) throws { if !condition { throw NSError(domain: message, code: 1) } }
  static func pairing(_ suffix: String = "") async throws -> String {
    let (data, _) = try await URLSession.shared.data(from: URL(string: "http://127.0.0.1:3445/test/pairing" + suffix)!)
    return (try JSONSerialization.jsonObject(with: data) as! [String: Any])["code"] as! String
  }
  static func changed(_ code: String, key: String, value: Any) throws -> String {
    var payload = String(code.dropFirst("atepdf-beta:".count)).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
    payload += String(repeating: "=", count: (4 - payload.count % 4) % 4)
    var data = try JSONSerialization.jsonObject(with: Data(base64Encoded: payload)!) as! [String: Any]
    data[key] = value
    return "atepdf-beta:" + (try JSONSerialization.data(withJSONObject: data)).base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
  }
  static func main() async throws {
    let transport = AtepdfPlannerTransport(), code = try await pairing()
    for (key, value) in [("origin", "https://8.8.8.8:3444" as Any), ("origin", "http://127.0.0.1:3444"), ("expiresAt", 0), ("fingerprint", "invalid")] {
      do { _ = try AtepdfPlannerTransport.pairedEndpoint(changed(code, key: key, value: value)); throw NSError(domain: "unsafe endpoint admitted", code: 1) }
      catch is AtepdfPlannerTransport.Failure {}
    }
    let badPin = try changed(code, key: "fingerprint", value: String(repeating: "0", count: 64))
    do { try await transport.pair(id: UUID().uuidString, code: badPin); throw NSError(domain: "wrong certificate pin admitted", code: 1) }
    catch is AtepdfPlannerTransport.Failure {}
    for kind in ["wrong-host", "expired"] {
      let negative = AtepdfPlannerTransport(), pinnedInvalidCertificate = try await pairing("/" + kind)
      // The out-of-band pin exactly matches the presented leaf in each case.
      // Hostname/date policy must still reject it before any HTTP request.
      _ = try AtepdfPlannerTransport.pairedEndpoint(pinnedInvalidCertificate)
      do { try await negative.pair(id: UUID().uuidString, code: pinnedInvalidCertificate); throw NSError(domain: "correctly pinned \(kind) certificate admitted", code: 1) }
      catch is AtepdfPlannerTransport.Failure {}
      try require(try await negative.status(id: UUID().uuidString).contains("pairingRequired"), "invalid certificate leaves transport unpaired")
    }
    let (evidenceData, _) = try await URLSession.shared.data(from: URL(string: "http://127.0.0.1:3445/test/evidence")!)
    let evidence = try JSONSerialization.jsonObject(with: evidenceData) as! [String: Any]
    let negativeRequests = evidence["negativeRequests"] as! [String: Int]
    try require(negativeRequests["wrong-host"] == 0 && negativeRequests["expired"] == 0, "invalid certificates received no pairing secret")
    // The failed TLS request must not consume the one-use secret.
    try await transport.pair(id: UUID().uuidString, code: code)
    try require(try await transport.status(id: UUID().uuidString).contains("\"enabled\":true"), "pinned TLS connection status")
    let a="file_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", b="file_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    let request: [String: Any] = ["schemaVersion":"1.0","requestId":"req_"+UUID().uuidString.replacingOccurrences(of:"-",with:"").lowercased(),"workspaceRevision":2,"locale":"en-IN","instruction":"Merge the two PDFs",
      "files":[["ref":a,"kind":"pdf","pageCount":2,"sizeBytes":3000,"encrypted":false],["ref":b,"kind":"pdf","pageCount":1,"sizeBytes":2000,"encrypted":false]],"selectionRefs":[a,b],"focusedResultRef":NSNull(),"originalRefs":[a,b],"pendingClarification":NSNull(),"previousActionIds":[],"previousPlan":NSNull(),"capabilities":["merge_pdf","select_pages","ocr_pdf","compress_pdf"],"ocrLanguages":["eng"]]
    let result = try await transport.plan(id: UUID().uuidString, body: String(data: JSONSerialization.data(withJSONObject: request), encoding: .utf8)!)
    try require(result.contains("merge_pdf"), "complete plan over TLS")
    try await transport.disconnect(id: UUID().uuidString)
    try require(try await transport.status(id: UUID().uuidString).contains("pairingRequired"), "TLS disconnect")
    print("Native pinned TLS passed: private endpoint admission, stale code rejection, wrong pin, correctly pinned wrong hostname/expired leaf rejected before HTTP, pairing, complete plan, disconnect. Synthetic only.")
  }
}
