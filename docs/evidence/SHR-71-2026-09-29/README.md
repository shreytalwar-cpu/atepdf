# SHR-71 — recognized-secret pre-retention guard

Base: `main` and `origin/main` at `99d02806aa42574ec590cd393bf5e1cb68ed56e1`, clean before the dedicated SHR-71 branch. Base `apps/universal/App.tsx` SHA-256: `058500afb9d71ad76503ae4bd8d8c7965086e200c4e5e8f0542539344d892cb9`. Final tested `App.tsx` SHA-256: `56f1b7035e90520c27a79d24550b7f4632b4a50c6e8405c63796f858cc13f38e`; `privacy.ts`: `3afb9fe4b1ba2e74813745bfb58f39b65a3216c3ba`. Final browser bundle: `index-fcca919114665f103632b4c75104debb.js` (SHA-256 `ffa24ccb8236dc638eb6564ede036e78c394c1eedb6e1dad964368b14df7f15d`); final iOS bundle: `index-2402ea88cd1467f8ccc9b4a5abc14772.hbc`.

## Reproduction before the fix

Added the browser regression to the unchanged application, exported it with `EXPO_NO_TELEMETRY=1 PATH=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node ../../node_modules/expo/bin/cli export --platform web --output-dir /private/tmp/atepdf-shr71-0lkOR8/red-web` from `apps/universal` (exit 0), served it on `127.0.0.1:43271`, and ran:

`PATH=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node node_modules/@playwright/test/cli.js test tests/e2e/planner.spec.ts --config /private/tmp/atepdf-shr71-0lkOR8/playwright.config.cjs -g 'recognized secret is stopped before ordinary transcript retention'`

**1/1 failed as intended:** the submitted synthetic password-like value was present in the user transcript entry before the planner's rejection. The test observed zero planner POSTs. The raw failed-test output echoed the synthetic canary and was removed from temporary test artifacts after this sanitized failure was recorded; it is not committed.

## Final checks

All commands ran against the work branch with installed dependencies. Each `node` command below was prefixed with `PATH=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH`. Browser status, model responses and provider failure were mocked; the browser used a separately exported bundle on `127.0.0.1:43275`, not the owner's server or saved key.

| Command | Result |
| --- | --- |
| `node --import tsx --test tests/regressions/*.test.ts` | **76/76 passed**; [core.log](core.log). Includes planner admission, bounded clarification, local jobs, revision/Undo, and synthetic secret/false-positive assertions. |
| `node node_modules/typescript/bin/tsc --noEmit -p apps/universal/tsconfig.json` | Exit 0. |
| `node node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json` | Exit 0. |
| `EXPO_NO_TELEMETRY=1 node ../../node_modules/expo/bin/cli export --platform web --output-dir /private/tmp/atepdf-shr71-0lkOR8/sealed-web` (from `apps/universal`) | Exit 0; [web-export.log](web-export.log). |
| `node node_modules/@playwright/test/cli.js test tests/e2e/planner.spec.ts --config /private/tmp/atepdf-shr71-0lkOR8/playwright-sealed.config.cjs` | **17/17 passed**; [browser.log](browser.log). The temporary config used a private output directory, no existing server, and a separate localhost port. |
| `EXPO_NO_TELEMETRY=1 node ../../node_modules/expo/bin/cli export --platform ios --output-dir /private/tmp/atepdf-shr71-0lkOR8/sealed-ios` (from `apps/universal`) | Exit 0; [ios-export.log](ios-export.log). |
| `git diff --check` | Exit 0. |

The browser tests inspect the post-input draft, transcript, pending clarification in the next request, model POST count and serialized payload, provider-error message, and copied assistant text. A rejected secret leaves the safe pending task available for a corrected answer; cancellation and Start Over clear it. Ordinary non-secret text remains accepted. Ordinary result entries now retain only a result reference, page/size facts and a sanitized display note; PDF inspection metadata and connection tokens stay outside the transcript. The tests use synthetic values only. The committed logs contain no full SHR-71 canary.

Scope limits: detection covers recognizable key/password/token patterns and is defense in depth, not a guarantee for arbitrary sensitive free text. No existing-history migration, persistence system, Protect/Unlock flow, live-provider interpretation, interactive native runtime, or physical-device acceptance was tested or implemented here. The native composer was type-checked and included in the iOS export; that export is not native runtime acceptance. Provider recovery/consent policy remains separate.
