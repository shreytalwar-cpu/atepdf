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

## Private TLS beta checks

The separate synthetic TLS harness never reads `.local` or constructs a paid provider:

```sh
node --import tsx tests/native/planner/tls-server.ts
```

It binds loopback 3444 for the native gateway, 3445 for test-only code issuance and counters, and 3446/3447 for deliberately invalid certificate fixtures. The test-only issuance endpoints must never be added to the application server. In another terminal:

```sh
xcrun swiftc -parse-as-library apps/universal/modules/atepdf-planner/ios/AtepdfPlannerTransport.swift tests/native/planner/tls-main.swift -o .build/native-tls-planner-tests
.build/native-tls-planner-tests
```

This exercises the actual Swift transport: private endpoint admission, expired pairing code, bad fingerprint, correctly pinned wrong-host and expired-leaf rejection before any HTTP request, successful one-use pairing, complete synthetic plan and disconnect. The native UI suite also has `testPinnedTLSPlannerMergeThroughNativeInterface`, which obtains a synthetic code through 3445 and runs the real app's three-page merge through the TLS connection. That UI test must pass with zero skips; the command-line helper alone is not iOS application proof. Stop the harness after acceptance. No private-LAN binding, system trust installation, physical-device success or paid request is implied.
