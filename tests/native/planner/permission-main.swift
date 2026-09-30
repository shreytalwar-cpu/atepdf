import Foundation

@main struct NativeReleasePermissionTests {
  static func main() async throws {
    func counters() async throws -> String {
      let (data, _) = try await URLSession.shared.data(from: URL(string: "http://localhost:3212/test/evidence")!)
      return String(data: data, encoding: .utf8)!
    }
    let before = try await counters(), transport = AtepdfPlannerTransport()
    do {
      try await transport.pair(id: UUID().uuidString, code: "atepdf-local:3212:" + String(repeating: "a", count: 64))
      throw NSError(domain: "release route must require verified registry", code: 1)
    } catch is AtepdfPlannerTransport.Failure {}
    guard try await counters() == before else { throw NSError(domain: "release denied payload wrote bytes", code: 1) }
    print("Release native default-deny passed: unapproved route, zero outbound pairing/planner bytes. No provider or production registry.")
  }
}
