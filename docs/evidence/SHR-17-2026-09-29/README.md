# SHR-17 clarification continuation evidence

Source base: `34819b6d42fcce5ef12b88eff9e115032b3a57d4` (`main` and `origin/main` matched after fetch). Work branch: `shreytalwar/shr-17-preserve-conversational-context-through-clarification`. The isolated final web test copy used the same `App.tsx` bytes as this branch (`SHA-256 058500afb9d71ad76503ae4bd8d8c7965086e200c4e5e8f0542539344d892cb9`); its browser bundle was `index-3105ac23e87d4feb1862f2a81820f2b7.js`. Existing installed dependencies were copied into isolated `/private/tmp/atepdf-shr17-final-7UddUx`; no dependency installation, owner server, saved key, or live provider was used.

The red browser test ran against an archive of the unchanged base application (`App.tsx` SHA-256 `b6394f917126b729c0eaaaa3cb16b5aab2df0eca99787f97955755a874fb28ca`). Command: `ATEPDF_BASE_URL=http://localhost:43217 node node_modules/@playwright/test/cli.js test tests/e2e/planner.spec.ts -g 'clarification reply carries'`. Result: **failed as intended** because the second model request had `pendingClarification === undefined`; see `red-browser.log`. Both planner status and model routes were mocked.

Final checks, run from the isolated copy unless stated otherwise:

| Command | Result |
| --- | --- |
| `node --import tsx --test tests/regressions/*.test.ts` | **75/75 passed** (`core-final.log`); includes mocked AI SDK transport, privacy, stale context, local PDF jobs, removal, Undo and retained plan corpus. |
| `node node_modules/typescript/bin/tsc --noEmit -p apps/universal/tsconfig.json` | Exit 0. |
| `node node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json` | Exit 0. |
| `EXPO_NO_TELEMETRY=1 node ../../node_modules/expo/bin/cli export --platform web --output-dir dist-web` (from `apps/universal`) | Exit 0 (`web-export.log`). |
| `ATEPDF_BASE_URL=http://localhost:43217 node node_modules/@playwright/test/cli.js test tests/e2e/planner.spec.ts` | **14/14 passed** against a separate local preview; synthetic planner/status routes only (`browser-results.json`). |
| `EXPO_NO_TELEMETRY=1 node ../../node_modules/expo/bin/cli export --platform ios --output-dir dist-native` (from `apps/universal`) | Exit 0 (`ios-export.log`). |
| `xcrun swiftc -module-cache-path /private/tmp/atepdf-shr17-final-7UddUx/swift-module-cache -parse-as-library apps/universal/modules/atepdf-planner/ios/AtepdfPlannerTransport.swift tests/native/planner/main.swift -o /private/tmp/atepdf-shr17-final-7UddUx/native-planner-tests` | Exit 0. |
| `/private/tmp/atepdf-shr17-final-7UddUx/native-planner-tests` | Exit 0 against the separate synthetic-only gateway on localhost:3212 (`native-planner-final.log`); valid pending context accepted and an extra nested `bytes` field rejected. |

The first full core attempt, under restricted loopback permissions, had an `EPERM` on an ephemeral TLS listener. It also exposed that retained seed fixture rows predate the new required nullable field; the fixture adapter now supplies `pendingClarification:null` while preserving all 25 supported and 21 adversarial plan assertions. The final core run passed with loopback access. These were verification-environment and fixture-contract issues, not PDF execution failures.

No paid calls or real credentials were used. The browser and Swift gateway responses were synthetic. iOS bundle export and the Swift transport test do **not** establish interactive native app acceptance; no simulator, physical device, or visual PDF-fidelity run was performed for SHR-17.
