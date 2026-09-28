# Native planner integration tests

These tests use an explicit synthetic provider on `http://localhost:3212`. The server constructs neither `LocalConfig` nor an OpenAI provider, reads no saved key, and performs no paid request. It rejects fixture filenames and a private-content canary at the provider boundary. Never use it as the owner's normal AI connection.

From the new atepdf repository with the existing Node and Apple development tools on PATH:

```sh
node --import tsx tests/native/planner/server.ts
```

In a separate terminal, compile and run the actual Swift transport against that server:

```sh
mkdir -p .build/swift-module-cache
xcrun swiftc -module-cache-path .build/swift-module-cache -parse-as-library apps/universal/modules/atepdf-planner/ios/AtepdfPlannerTransport.swift tests/native/planner/main.swift -o .build/native-planner-tests
.build/native-planner-tests
```

The executable checks pairing, credential-free status, private request admission, complete plan and product answer responses, redirect/oversized-response rejection, active and early cancellation, and disconnection. The server's `/test/evidence` endpoint returns only synthetic call/cancellation counts.

With the same server running, use XcodeBuildMCP `test_sim` for the `atepdfUI` scheme, Release configuration, and an iPhone simulator. The new UI test types a masked pairing code, asks a product question, merges the bundled PDFs, removes page 2, undoes the change, cancels a request, and disconnects. PDF processing and complete-plan validation are real; provider responses are synthetic. Check that all three tests pass with zero skips. The paired test explicitly skips when its test server is absent, so a skipped run is not pairing evidence.

Disconnect any manually paired test app and stop this server afterward. A development connection to the owner's real local gateway must use a new code created by that gateway; never substitute test responses for live AI. Physical devices, production authentication, paid-provider availability and purchases are outside this harness.
