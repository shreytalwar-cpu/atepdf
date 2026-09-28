# Internal beta preparation — 2026-09-28, continued 29 September locally

The owner-private browser beta is running at http://localhost:3211. The final application source checkpoint is `afa15b5` on `codex/atepdf-chat-workflows`, following the beta transport/launcher checkpoint `2cb0c83`. Web, Mac Catalyst Release and unsigned iPhone Release application builds passed. Simulator acceptance and its remaining configuration-specific gaps are recorded separately below; this is not physical-device or distribution acceptance.

## Source and authority

Resumed `/Users/shrey/Documents/ChatGPT/atepdf` from `63e5127`; no application was recreated. The separate Attenlo PDF reference `/Users/shrey/Documents/attenlo/attenlo-docs` was not read, modified, built or run in this slice. Earlier bounded observations and provenance remain in `docs/legacy-learning`.

The owner moved today's testing to simulators because the phone is unavailable, then explicitly deferred Mac UI checks while the Mac is locked. Android remains deferred. This advances retained F09/F10, not a duplicate roadmap. No production signing identity, public deployment, purchase integration, migration or publication was performed.

The owner explicitly approved 20 additional AI requests, including at most two synthetic checks now. Exactly two live GPT-6 Luna checks passed, leaving 18 at final restart. No extra paid test or retry was made. The 2,000-output-token application cap stays removed.

## Implemented

- `packages/planner/src/native-beta.ts`, `scripts/native/beta-tls.mjs` and the native Swift transport add an opt-in private TLS companion. Exact certificate pinning, hostname/date/server-policy checks, one-use pairing and memory-only bearer credentials protect the approved anonymous planning request. Browser/key setup remains loopback-only; PDF processing remains on the device. See ADR 0009.
- `scripts/beta/` adds independent start/stop/status and verified Mac opening. Management authenticates process ownership; start preserves the key and allowance. Device sharing is off by default and remains off on the current host.
- `apps/universal/App.tsx` gives the native conversation more room with the landscape keyboard, and uses whole-label horizontal quick actions at larger text sizes on narrow screens.
- `apps/universal/src/platform/Preview.native.tsx` separates page navigation and zoom into two rows where larger text would clip a control. Targets remain at least 44 points.
- `tests/native/ios/AtepdfWorkflowUITests.swift` extends actual simulator acceptance; `docs/BETA_DEVICE_ACCEPTANCE.md` records tomorrow's physical save/reopen, immutable-original, undo, OCR/compression and lifecycle procedure.

## Verification

| Check | Result / exact boundary |
| --- | --- |
| Web and shared native TypeScript | Passed on final source |
| Regression tests | 72 passed, 0 failed, 0 skipped |
| Actual Expo web export and Next production build | Passed; `.build/beta-web-build.log` |
| Browser workflows on new beta host | 19 passed in 53.7 seconds; real local fixture outputs and privacy assertions, mocked planner, zero paid calls |
| Launcher tests | 15 passed, including complete TLS companion lifecycle using CA-only client trust; no owner key or allowance mutation |
| Mac Catalyst Release | Passed; strict local ad-hoc signature and sandbox verification; latest registered artifact `/private/tmp/atepdf-mac-wiqs9zkf/atepdf.app` |
| iPhone arm64 Release | Build passed unsigned; not installed or physically tested |
| Native TLS / transport | Swift positive and certificate/redirect/body-boundary negatives passed; separate simulator pinned-TLS UI merge passed |
| Live GPT-6 Luna | Exactly two approved direct-Send checks: real local merge and physical page removal; saved A1/B1 output independently reopened |
| Native UI | Exact per-build results, screenshots, source hashes and failures in [iPad QA](BETA_APPLE_QA.md) and [iPhone QA](BETA_IPHONE_QA.md) |

Current consolidated evidence: [beta-validation.json](evidence/native/beta-validation.json), [Mac artifact](evidence/native/beta-mac-build.json), [unsigned iPhone build](evidence/native/beta-device-compile.json), [model status](evidence/native/beta-model-status.json), and [TLS checks](evidence/native/beta-tls-transport.json). The earlier Mac candidate was launched by exact path; the latest candidate was registered but not newly launched or interactively accepted.

The final iPad simulator also passed a real Safari download → system Files picker/Open → import → merge → Vision OCR → compression workflow in 66.3 seconds using the actual local engines. It retained the expected four pages. Browser and native helper outputs independently establish the bounded local merge/OCR/compression chain. That OCR/compression run stopped at the in-app result. A separate follow-up below establishes an actual native Files save and independent inspection for the three-page merge; it does not retroactively establish a saved OCR/compression export. The iPhone's software-keyboard frame was offscreen; exact typing and larger-text preview controls passed, but visible-keyboard clearance remains unverified. The iPad larger-text portrait workflow exercised an actual visible software keyboard successfully. Native UI reports retain other interrupted or failed test attempts rather than treating them as passes.

## Follow-up virtual acceptance

Accepted application implementation remains `afa15b5`; the continuation starts from evidence checkpoint `cb23813`. It adds public-system-UI acceptance tests, source-mapped evidence and a synthetic-provider counter fix. No production change from either animation experiment was retained. The 72 regressions, 19 browser workflows and earlier web/Mac/device builds above were not rerun solely for these test additions. A fresh original-source simulator Release application build passed and its installed bytes matched the captured products.

- An iPhone system **Save to Files** action saved an actual 3,100-byte merge. atepdf was terminated and relaunched. The surviving local-provider copy independently passes PDF.js validation: three pages in A1/A2/B1 order, complete matching text, page boxes and rotation; SHA-256 `4ae158da5e4f1576d9842141faaf65b17502327d42815844973b8ee5a48ab8c0`. The [exact destination and verifier evidence](evidence/native/beta-iphone-saved-copy-independent.json) records the nested QA folder restored by the system picker. No host file injection was used. The exact copy reopened in system Preview and was visually inspected. A later single full-flow test compiled but failed a system picker navigation guard before saving; no all-green combined export suite is claimed. Details are in [iPhone QA](BETA_IPHONE_QA.md).
- Original-source local merge → page-two preview → typed removal → typed undo passed with real public **Reduce Motion** on, in 133.693 seconds. Both original motion settings were restored and rechecked.
- Pairing-only and completed immediate-answer resume passed. The strict delayed-answer resume passed with real Reduce Motion on (0.155-second activation, 4.613-second draft continuation); default-motion automated waits remain unresolved. Both pulse candidates failed and were fully reverted.
- A corrected simultaneous large-text landscape check still failed: the composer and Send clear the visible keyboard, but composer focus scrolls the earlier preview above the chat viewport. This is not a complete landscape pass.
- The synthetic delayed-response server now removes its abort listener when a response settles. The reusable real-HTTP regression passed: successful completion remains uncancelled after the later deadline, while aborting pending work increments cancellation exactly once. No owner key or paid request was involved.

The [follow-up acceptance record](evidence/native/beta-virtual-followup.json) extends [the baseline evidence](evidence/native/beta-validation.json); they do not replace its original timestamps or counts. The owner beta stayed running, unchanged, with **18 requests**, and device sharing stayed off. Mac artifact signature, identity and bundle hashes were reverified without opening its UI. Owned synthetic test listeners were stopped. Pre-existing untracked duplicate public assets and local tooling were preserved.

## Corrections and retained failures

The initial iPad landscape keyboard left an 80-point conversation viewport; the correction measured 176 points at ordinary text size. Larger-text iPhone quick actions previously broke words across lines; whole labels now remain in a horizontal row. Its preview zoom button previously extended beyond the clipped frame; final focused reachability/zoom/Fit/Close checks passed after the two-row correction.

The async Foundation byte-stream API needed an explicit task delegate for trust and redirect refusal. Trust network fetches are disabled before certificate-chain evaluation. A full launcher test caught ambiguous CA/leaf subjects that a full-chain trust test missed; generated certificates now use distinct subjects and SKI/AKI, and the regression trusts only the CA. No accept-all fallback or system trust change was introduced. Launcher malformed-HMAC byte lengths and IPv6-only port conflicts also have passing regressions.

Native UI discovery exposed test assumptions: multi-select Files requires Open after selecting a document, Downloads labels can be ambiguous, and interactive scrolling can dismiss a keyboard and change viewport geometry. Full screenshots distinguish these from app-only snapshots. Earlier long paired interruption tests waited repeatedly for XCTest animation completion; the narrower evidence and remaining uncertainty are in BETA_APPLE_QA.md. No private quiescence bypass or speculative production fix was used.

Three byte-identical generated ` 2.ts` files in `.next/types` caused duplicate declarations. Only these verified generated copies were preserved outside the build at `/private/tmp/atepdf-generated-type-duplicates-k6_wuall`; source and unrelated untracked files were left intact. Type checks then passed. The first final Mac attempt was blocked by sandbox access to Xcode services; the authorized local build passed with service access. Impeccable mechanical checks reported no findings for the edited UI; actual simulator inspection supplied the layout evidence.

## Remaining acceptance and next task

Use [INTERNAL_BETA.md](INTERNAL_BETA.md) to open the local beta. Chats are session-scoped: save wanted results before closing or process termination. No persistent document history is claimed.

At the next device session, connect the physical iPhone/iPad, approve the independent development signing setup and private-network test, then execute [BETA_DEVICE_ACCEPTANCE.md](BETA_DEVICE_ACCEPTANCE.md) against the exact candidate. Test real Files import/save/reopen, byte-identical undo, OCR/compression, background/lock/return and memory pressure. Resume Mac interactive acceptance when available. Production authentication, notarization/distribution, live purchases and migration remain outside this owner-private beta. Actual StoreKit/provider sandbox testing is unimplemented; the eight disabled-commerce contract tests are not a billing-provider pass.
