# SHR-47 — structural page verification evidence

Scope: production Merge/Remove promotion checks and their reusable expectations, independent inspection, regressions and versioned matrix evidence. No PDF executor, admission policy, AI routing, UI, tool inventory or compatibility disposition was expanded. No customer PDF, external upload, paid model call, real credential, dependency installation or owner application/session was used.

## Source boundary

Started from fetched `origin/main` **29f56ea919e73c12cdbd1c36f5f74cf37622347c**, including SHR-105 and SHR-46. Dedicated managed worktree: `/Users/shrey/.codex/worktrees/shr47-page-verification/atepdf`; branch `shreytalwar/shr-47-verify-page-identity-order-and-geometry-before-promoting`. The owner checkout remained on its existing clean local main at `4c22232b67345be7a19712c46fe6b49e1a43505a`.

Runtime implementation is **f7a62d4c9d9cebb6441a97a39a3dadfd55087196**. Complete matrix-receipt schema is **885b41c7d39b70b8ad7a8833bb7019016d9ec62a**. Final tested source is **5e99a99fbe0503c5525f4d1c8aeb636c62533da6**, adding assertions that each mutation fails specifically at the independent page gate. The subsequent evidence commit changes no runtime or test behavior. `prototype-v0` remains **5a6c0c542603cdb2a72bcdb2a91958ef3b6f12ab**. Source hashes and exact command arguments are recorded alongside the logs; untracked dependency/evidence files explain dirty metadata during the matrix run.

Existing installed dependencies were reused. Node **24.19.0**, Python **3.12.14** (ReportLab/pypdf/Pillow), PDF.js **6.3.289**, pdf-lib **1.17.1**, Chrome **154.0.8037.58**, Poppler **26.05.0**, Xcode **27.0 (27A266a)**, macOS **27.0 (26A428)**, arm64. Regression canvas rendering uses PDF.js's already installed optional canvas dependency. Temporary outputs and the matrix's private random-port listener are independent of owner servers and historical evidence.

## Reproduction and acceptance

Before changing runtime behavior, the existing main passed **126/126** regressions, zero skips ([baseline log](logs/baseline-126.log)). Three new real-artifact rejection tests then failed **0/3**: swapped same-size empty-text scans, shifted CropBox origin with unchanged dimensions, and the wrong retained scan were incorrectly reported `complete` and promoted ([pre-fix log](logs/pre-fix-three-mutants.log)). The initial three-test file used the baseline independent count/text inspection; it was subsequently extended to the full structural reader/tests. An initial test setup error requiring two merge inputs was corrected before this recorded reproduction and is not described as a product failure.

| Acceptance | Result and evidence |
| --- | --- |
| Independent physical identity and order | PDF.js / Apple CoreGraphics recompute orientation-neutral raster fingerprints. Same-size empty-text scans differ without OCR. Real swapped and wrong-retained-page outputs fail the independent gate. |
| Geometry and text | Compare MediaBox/CropBox x/y/width/height, canonical rotation, displayed dimensions, ordered fingerprints and normalized digital text. Crop/Media origin, rotation, order and count mutations fail. Apple box parsing is independent; browser/Android raw boxes are explicitly supplementary writer-library checks. |
| Operation-aware mapping | Merge follows accepted input order; Remove excludes accepted physical indices. Mapping and geometry are cloned before engine work and bound to the accepted revision. A direct contract test supports an explicit reorder/rotation expectation without adding an executor. |
| Promotion failure and safety | Each corruption asserts the specific independent-gate failure, no receipt/current-result/history/original change, and Undo only to an earlier valid result. Unavailable evidence fails closed. An engine trying to rewrite source inspection evidence cannot rewrite the captured expectation. |
| Stale and cancellation | Real output delayed during execution or inspection is rejected after revision changes. Cancel during validation retains the previous result and publishes no staged bytes/receipt. Stage references are cleared in `finally`. Existing atomic revision commit remains. |
| Positive real outputs | Ordinary, scanned, hybrid, geometry/font and blank/noisy fixtures cover mixed sizes, rotation and nonzero crop/media origins. Valid Merge/Remove results pass; saved copies independently reopen with the expected page mapping; Undo passes. |
| Matrix evolution | New schema v2 requires complete operation-bound production receipts; historical v1 schema/results are unchanged. Missing, incomplete or wrong-operation receipts cannot count as supported. |

The [verification contract](../../PAGE_VERIFICATION.md) details reader profiles and limits. Source evidence is transient/local: planner DTOs do not include it, checkpoint projection omits it, and restoration independently recomputes it. Existing schema/semantic/capability/file-reference/revision checks, immutable originals, staged/durable commit, cancellation, save and Undo remain in place.

## Checks and exact commands

Final source results are under [verification-final](verification-final/); initial complete-receipt results are retained at this directory's root. JSON result records contain absolute command arguments, working directory, environment overrides, exit codes and elapsed times.

| Check | Actual result |
| --- | --- |
| Focused gate/matrix/corpus/admission/workflow/controller tests | **62/62 passed**, zero skips |
| Full regression suite, including planner/persistence/native-boundary regressions | **142/142 passed**, zero skips |
| New structural tests using PDF.js | **16/16 passed** in focused/full suites |
| New structural tests using compiled Apple reader | **16/16 passed**; existing Apple engine and shared writer/controller chain also passed |
| Compatibility/shared-universal/web TypeScript | All three commands exited **0** |
| Browser corpus matrix and schema v2 | Exit **0**; **49/57 executed**, classification details below |
| Isolated web and iOS exports | Both exited **0**, using the runtime-identical f7a62d4 source archive |
| Changed Apple engine compilation for Mac Catalyst / iOS simulator | Both passed; compiler-only checks, not application/device runtime acceptance |
| Full Mac Catalyst Release app build | **Blocked/failed** by installed Pods source enumeration; no signature, sandbox launch or application acceptance claim |
| Android native compile/runtime | **Not run**: no configured/default Android SDK; no installation attempted |

Representative commands (the records preserve the full resolved paths/expanded regression file list):

```sh
NODE=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
PY=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3
ATEPDF_CORPUS_PYTHON="$PY" "$NODE" --import tsx --test tests/regressions/*.test.ts
ATEPDF_CORPUS_PYTHON="$PY" "$NODE" --import tsx --test tests/regressions/{page-verification,compatibility-matrix,pdf-corpus,local-workflow,content-admission,job-progress,core-integrity}.test.ts
"$NODE" node_modules/typescript/bin/tsc --noEmit -p tests/compatibility/tsconfig.json
"$NODE" node_modules/typescript/bin/tsc --noEmit -p apps/universal/tsconfig.json
"$NODE" node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json --tsBuildInfoFile /tmp/atepdf-shr47-final-5e99a99/web.tsbuildinfo
ATEPDF_MATRIX_RENDERER=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdftoppm "$NODE" --import tsx tests/compatibility/run.mts --output-dir /tmp/atepdf-shr47-final-5e99a99/matrix
ATEPDF_NATIVE_EVIDENCE_DIR=/tmp/atepdf-shr47-final-5e99a99/native "$NODE" tests/native/apple/run.mjs
```

The app exports ran `scripts/contracts.mjs`, `scripts/assets.mjs`, `scripts/build-gateway.mjs`, then existing Expo CLI `export --platform web` / `export --platform ios`, each with a new temporary destination and telemetry disabled ([commands/results](exports-result.json)). Only bundling ran; no planner service/model request was started. The archive reused APFS copies of installed dependencies rather than an external node_modules symlink, so Metro resolved packages within the isolated source tree.

Two behavior-specific test adjustments preserve intent: orchestration-only mocks now declare explicitly synthetic page evidence; real workflow/persistence tests use the actual independent reader. The Apple compression chain compares its existing page/text/geometry fields rather than requiring a new content fingerprint to remain identical after intentional JPEG quality change; its existing real before/after image checks remain. No unrelated test was skipped or weakened.

## Matrix findings, bounds and platform limitations

The final [matrix](verification-final/matrix/matrix.json) records **27 SUPPORTED, 16 SAFELY_REJECTED, 3 FAILED, 0 FIDELITY_MISMATCH, 3 UNVERIFIED, 1 NOT_IMPLEMENTED, 7 NOT_RUN**. Every row's classification matches the SHR-46 source-bound baseline. **30 PDFs** were saved and independently reopened; **13** Merge/Remove executions have complete production-gate receipts (**12 SUPPORTED**, plus the existing unresolved encoded-JPEG merge case). Five PNG references were retained. Existing encrypted-input generic refusals remain FAILED; encoded-versus-declared JPEG dimensions remain UNVERIFIED. Neither finding was repaired or counted as support. Representative PNGs are not appearance-comparison verdicts.

Identity bitmaps are at most **96×96**, sequential per page, independent of OCR; RGBA ceiling **36,864 bytes/page**, at most **921,600 fingerprint pixels** over the unchanged 100-page admission limit. Fingerprints/mappings are small metadata. Source/result readers still obey existing parser, file, page, decoded-image and job deadlines; a small final bitmap does not bound every upstream decoder allocation. Timings in the records include concurrent checks and are observations, not a benchmark or latency guarantee. Browser render tasks cancel; synchronous CoreGraphics drawing has cooperative checks around it and cannot be interrupted mid-call.

The full Mac app attempt used an exact f7a62d4 archive with runtime files byte-identical to final tested source ([comparison](build/runtime-archive-comparison.json)). The first build generated previously absent React Native dependency sources after compile-input errors. A retry reached native compilation but the already installed Pods project omitted **AtepdfWorkspaceVault.swift**, producing `cannot find 'AtepdfWorkspaceVault' in scope`. The vault, referencing module, Podfile and lock are unchanged from baseline main ([blocker proof](native-build-blockers.json)); only three Swift files appear in that installed target. No pod install/project regeneration or unrelated repair was performed. Full logs are preserved compressed under `build/`. A preliminary archive-preparation attempt used system Python without the needed tar extraction API; it failed before a build and was repeated with the installed Python 3.12 runtime.

The changed Apple engine separately compiled for `arm64-apple-ios16.4-macabi` and `arm64-apple-ios16.4-simulator`. The initial standalone Catalyst invocation lacked the standard SDK `System/iOSSupport` framework/include paths and failed to import UIKit through PDFKit; the corrected invocation passed ([exact command/result](verification-final/swift-catalyst-sdk-paths-result.json)). No SDK installation or selection setting was changed. The full application's existing Pods blocker remains; this isolated compilation does not replace an app build or interactive native acceptance.

Interactive Mac app acceptance, real-provider interpretation, device execution, Android compilation/runtime, distribution signing, notarization and release were not performed. Shared tests, a browser matrix, helpers and exports are not substitutes for those checks. Identical/coarsely indistinguishable page signals cannot establish unique provenance; changes below fingerprint resolution can escape detection. Exact rendering/font fidelity, annotation appearance and OCR placement remain **SHR-48/later work**. No claim of production readiness or complete visual fidelity is made.
