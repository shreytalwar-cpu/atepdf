import ExpoModulesCore
import Foundation

public final class AtepdfPlannerModule: Module {
  private let transport = AtepdfPlannerTransport()
  private var available: Bool {
    return true
  }
  private func requireAvailable() throws {
    guard available else { throw AtepdfPlannerTransport.Failure.unavailable }
  }
  public func definition() -> ModuleDefinition {
    Name("AtepdfPlanner")
    Constants(["available": self.available])
    AsyncFunction("statusAsync") { (id: String) async throws -> String in
      try self.requireAvailable(); return try await self.transport.status(id: id)
    }
    AsyncFunction("pairAsync") { (id: String, code: String) async throws in
      try self.requireAvailable(); try await self.transport.pair(id: id, code: code)
    }
    AsyncFunction("planAsync") { (id: String, body: String) async throws -> String in
      try self.requireAvailable(); return try await self.transport.plan(id: id, body: body)
    }
    AsyncFunction("disconnectAsync") { (id: String) async throws in
      try await self.transport.disconnect(id: id)
    }
    AsyncFunction("cancelAsync") { (id: String) async in await self.transport.cancel(id: id) }
    OnDestroy { let transport = self.transport; Task { await transport.reset() } }
  }
}
