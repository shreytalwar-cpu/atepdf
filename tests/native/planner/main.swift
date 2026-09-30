import Foundation

@main struct NativePlannerTests {
  static func check(_ value: Bool, _ message: String) throws { if !value { throw NSError(domain: "atepdf.native-tests", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) } }
  static func request(_ instruction: String) -> String {
    let a = "file_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", b = "file_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    let value: [String: Any] = ["schemaVersion":"1.0", "requestId":"req_"+UUID().uuidString.replacingOccurrences(of:"-",with:"").lowercased(), "workspaceRevision":2,"locale":"en-IN","instruction":instruction,
      "files":[["ref":a,"kind":"pdf","pageCount":2,"sizeBucket":"<1MB","encrypted":false],["ref":b,"kind":"pdf","pageCount":1,"sizeBucket":"<1MB","encrypted":false]],
      "selectionRefs":[a,b],"focusedResultRef":NSNull(),"originalRefs":[a,b],"pendingClarification":NSNull(),"previousActionIds":[],"previousPlan":NSNull(),"capabilities":["merge_pdf","select_pages","ocr_pdf","compress_pdf"],"ocrLanguages":["eng"]]
    return String(data:try! JSONSerialization.data(withJSONObject:value),encoding:.utf8)!
  }
  static func main() async throws {
    let transport = AtepdfPlannerTransport()
    try check(try await transport.status(id:UUID().uuidString).contains("pairingRequired"),"unpaired status")
    for code in ["atepdf-local:443:"+String(repeating:"a",count:64),"https://example.invalid","atepdf-local:3212:bad"] {
      do { _ = try AtepdfPlannerTransport.pairingParts(code); throw NSError(domain:"accepted invalid pairing",code:1) } catch is AtepdfPlannerTransport.Failure {}
    }
    let bad = request("Merge").replacingOccurrences(of:"\"instruction\":",with:"\"bytes\":\"PRIVATE-CANARY\",\"instruction\":")
    do { _ = try AtepdfPlannerTransport.admittedBody(bad); throw NSError(domain:"accepted document bytes",code:1) } catch is AtepdfPlannerTransport.Failure {}
    let statusURL = URL(string:"http://localhost:3212/api/planner/status")!
    let (statusData,_) = try await URLSession.shared.data(from:statusURL)
    let status = try JSONSerialization.jsonObject(with:statusData) as! [String:Any]
    var pairing = URLRequest(url:URL(string:"http://localhost:3212/api/planner/pairing")!)
    pairing.httpMethod="POST";pairing.httpBody=Data("{}".utf8);pairing.setValue("application/json",forHTTPHeaderField:"Content-Type");pairing.setValue("http://localhost:3212",forHTTPHeaderField:"Origin");pairing.setValue(status["token"] as? String,forHTTPHeaderField:"X-Atepdf-Token")
    let (pairData,_) = try await URLSession.shared.data(for:pairing)
    let code = (try JSONSerialization.jsonObject(with:pairData) as! [String:Any])["code"] as! String
    try await transport.pair(id:UUID().uuidString,code:code)
    let connected = try await transport.status(id:UUID().uuidString)
    try check(connected.contains("\"enabled\":true") && !connected.contains("token"),"paired status excludes credential")
    let plan = try await transport.plan(id:UUID().uuidString,body:request("Merge in the order added"))
    try check(plan.contains("merge_pdf"),"complete merge response")
    func plannerBytes() async throws -> Int {
      let (data, _) = try await URLSession.shared.data(from: URL(string: "http://localhost:3212/test/evidence")!)
      return (try JSONSerialization.jsonObject(with: data) as! [String: Any])["plannerBytes"] as! Int
    }
    let beforeCanaries = try await plannerBytes()
    try check(!AtepdfPlannerTransport.matchesNone("Synthetic instruction", patterns: ["["]), "malformed policy regex fails closed")
    for (index, instruction) in ["password: SYNTHETIC_SECRET", "my password SYNTHETIC_SECRET", "ghp_syntheticcredentialvalue", "AKIAABCDEFGHIJKLMNOP", "Bearer synthetic-token-value", "/Users/synthetic/private", "synthetic-client.pdf", "4111 1111 1111 1111", "4222222222222", "4000000000000000006", String(repeating: "a", count: 64)].enumerated() {
      do { _ = try AtepdfPlannerTransport.admittedBody(request(instruction)); throw NSError(domain: "native admission canary index \(index)", code: 1) }
      catch is AtepdfPlannerTransport.Failure {}
      do { _ = try await transport.plan(id: UUID().uuidString, body: request(instruction)); throw NSError(domain: "privacy canary admitted", code: 1) }
      catch is AtepdfPlannerTransport.Failure {}
    }
    for extra in ["pdfBytes", "fileName", "ocrText", "extractedText", "localLabel", "summary", "contentHash", "sizeBytes", "debugContext", "secureHandle", "encryptionKey", "deviceFingerprint", "clipboard"] {
      var canary = try JSONSerialization.jsonObject(with: Data(request("Merge").utf8)) as! [String: Any]
      canary[extra] = "SYNTHETIC_PRIVATE_VALUE"
      do { _ = try await transport.plan(id: UUID().uuidString, body: String(data: JSONSerialization.data(withJSONObject: canary), encoding: .utf8)!); throw NSError(domain: "unclassified canary admitted", code: 1) }
      catch is AtepdfPlannerTransport.Failure {}
    }
    try check(try await plannerBytes() == beforeCanaries, "native blocked payload bytes = 0")
    do { _ = try await transport.plan(id:UUID().uuidString,body:request("Synthetic privacy denial"));throw NSError(domain:"denial accepted",code:1) }
    catch AtepdfPlannerTransport.Failure.privacy {}
    var continued = try JSONSerialization.jsonObject(with: Data(request("Merge in the order added").utf8)) as! [String: Any]
    let originalRequestId = continued["requestId"] as! String
    let refs = continued["originalRefs"] as! [String]
    continued["requestId"] = "req_" + UUID().uuidString.replacingOccurrences(of:"-",with:"").lowercased()
    continued["instruction"] = "In the order added"
    continued["pendingClarification"] = ["originalRequestId":originalRequestId,"workspaceRevision":2,"originalInstruction":"Merge the two PDFs.","question":"Which order?","choices":["In the order added"],"answers":[],"selectionRefs":refs,"focusedResultRef":NSNull(),"originalRefs":refs] as [String: Any]
    var unsafeContinuation = continued
    var unsafePending = continued["pendingClarification"] as! [String: Any]
    unsafePending["bytes"] = "PRIVATE-CANARY"
    unsafeContinuation["pendingClarification"] = unsafePending
    do { _ = try AtepdfPlannerTransport.admittedBody(String(data:JSONSerialization.data(withJSONObject:unsafeContinuation),encoding:.utf8)!);throw NSError(domain:"accepted nested document bytes",code:1) } catch is AtepdfPlannerTransport.Failure {}
    let continuation = try await transport.plan(id:UUID().uuidString,body:String(data:JSONSerialization.data(withJSONObject:continued),encoding:.utf8)!)
    try check(continuation.contains("merge_pdf"),"bounded clarification reaches the synthetic provider")
    let answer = try await transport.plan(id:UUID().uuidString,body:request("What can atepdf do?"))
    try check(answer.contains("product_information"),"product answer")
    for instruction in ["Synthetic redirect","Synthetic oversized response"] {
      do { _ = try await transport.plan(id:UUID().uuidString,body:request(instruction));throw NSError(domain:"unsafe response accepted",code:1) } catch is AtepdfPlannerTransport.Failure {}
    }
    let id=UUID().uuidString,body=request("Wait for cancellation")
    let pending=Task { try await transport.plan(id:id,body:body) }
    try await Task.sleep(nanoseconds:200_000_000);await transport.cancel(id:id)
    do { _ = try await pending.value;throw NSError(domain:"cancel failed",code:1) } catch is CancellationError {}
    let early=UUID().uuidString;await transport.cancel(id:early)
    do { _ = try await transport.plan(id:early,body:request("Merge"));throw NSError(domain:"early cancel failed",code:1) } catch is CancellationError {}
    try await transport.disconnect(id:UUID().uuidString)
    try check(try await transport.status(id:UUID().uuidString).contains("pairingRequired"),"disconnected")
    print("Native URLSession tests passed: H buckets, 24 privacy canaries with zero outbound bytes, malformed regex refusal, local-only denial, pairing, bounded clarification, product answer, complete plan, redirect/body rejection, cancellation, disconnect. Synthetic loopback gateway only.")
  }
}
