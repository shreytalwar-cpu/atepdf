# 07 | Dependency-ordered build backlog

Every item below requires code plus evidence, not a checkbox in a slide. All platforms are in scope from the architecture stage. Parallel work is appropriate after contracts are stable, not four independent interpretations of the product.

No calendar promise is embedded. Compression/OCR and native packaging are real feasibility work. Time-box spikes, report findings and continue independent UI/contract work instead of pretending a blocker is solved.

## M0 | Fresh repository, legacy learning and technical risk
| ID | Task | Acceptance evidence |
|---|---|---|
| M0-01 | Validate separate new/legacy roots and initialise or safely resume the NEW atepdf project. | New Git root not nested/shared with legacy; old source untouched; instructions and destination recorded. |
| M0-02 | Read old source/tests without writes; create fresh web baseline and reproduce useful cases in new tests. | Source/commit or unavailable status; new runnable app; no builds/install/tests in old checkout. |
| M0-03 | Inventory dependencies and upstream/transitive licences. | Exact version/licence/source/maintenance report. |
| M0-04 | Record legacy lessons, selective-port decisions and new clean architecture. | Evidence levels, provenance and regression test map; no bulk old source or runtime dependency. |
| M0-05 | Compression spike on representative PDFs. | Actual input/output bytes, render/text checks, target-not-met path. |
| M0-06 | Searchable OCR spike on real synthetic scans. | Independently searchable output; text/geometry checks. |
| M0-07 | Android local writer and browser native/WASM spike. | Running local merge and packaging evidence, not repo discovery alone. |
| M0-08 | Establish task board, capability matrix and risk register. | Clear blocked/experimental/tested statuses. |

**Exit:** know what exists, prove feasible engine routes or report specific unresolved routes, and begin implementation. Audit work must not consume every session without producing a real slice.

## M1 | Approved interface plus a real file result
| ID | Task | Acceptance evidence |
|---|---|---|
| M1-01 | Token/config layer and shared copy keys. | Brand changed in one place; no rejected rebrands. |
| M1-02 | Responsive empty workspace in NEW atepdf web source. | Screenshot comparison at phone/tablet/desktop. |
| M1-03 | Fresh SwiftUI Apple empty/loaded/result states. | Actual iPhone/iPad/Mac renders and keyboard behaviour. |
| M1-04 | Fresh Kotlin/Compose Android empty/loaded/result states. | Compose runtime/emulator screenshots, not a static image. |
| M1-05 | Local import, MIME sniffing, IDs and preflight. | File bytes never sent; malformed/encrypted/unsupported tests. |
| M1-06 | Real two-file merge through adapter/executor. | Independently reopened output in correct order. |
| M1-07 | Read-only preview and real save/share/export. | File saved only after picker confirmation; cancellation handled. |
| M1-08 | Immutable originals, result focus and undo foundation. | Original hashes unchanged locally; previous version restored. |
| M1-09 | Privacy disclosure and event-driven progress. | No AI call for Merge shortcut; no synthetic timer progress. |

**Exit:** on each implemented target, add files -> merge -> preview/save works locally in the approved interface. Unfinished targets remain explicitly experimental.

## M2 | Cloud instruction interpretation and conversational state
| ID | Task | Acceptance evidence |
|---|---|---|
| M2-01 | Integrate request/response schemas and generate DTOs. | Contract fixtures pass on TypeScript, Swift and Kotlin. |
| M2-02 | Build positive request serializer. | Filename/text/password canary tests reject leaks. |
| M2-03 | Backend provider adapter, secret handling and no-store config. | Real bounded API call; no secrets in client bundle. |
| M2-04 | Planner prompt + operation allowlist. | Golden cases compile to expected plans. |
| M2-05 | Local semantic compiler and stale-plan protection. | Bad refs, invalid ranges, cycles and unsupported ops rejected. |
| M2-06 | Multi-step chaining and result collections. | No reupload/reimport; upstream outputs feed downstream steps. |
| M2-07 | Current/original/focused-result context. | Follow-up cases pass across multiple versions. |
| M2-08 | Clarification, cancellation, outage and retry UX. | One useful question; local actions still work with gateway blocked. |
| M2-09 | Guest quotas, abuse controls, budget circuit breaker. | No unbounded request loops; useful rate-limit error. |
| M2-10 | Initial held-out planner evaluation. | Accuracy/latency/cost report; no hand-picked success-only demo. |

**Exit:** a live cloud plan executes only validated local actions; follow-up page removal and undo are correct. No document content reaches provider/backend.

## M3 | Dependable everyday local tools
| ID | Task | Acceptance evidence |
|---|---|---|
| M3-01 | Split/extract/delete with one-based page selectors. | First/last/ranges/reverse/invalid/all-deleted cases. |
| M3-02 | Reorder/rotate/reverse and exact ordering semantics. | Page geometry and visual checks; displayed input order respected. |
| M3-03 | JPEG/PNG to PDF. | EXIF/order/page-size tests; all advertised images supported. |
| M3-04 | PDF to page images. | Correct count/order/naming; oversized raster handling. |
| M3-05 | Digital text extraction to UTF-8. | Unicode and per-page separation; no cloud text transmission. |
| M3-06 | Bounded batch executor and partial-success UI. | One failed file does not masquerade as full success. |
| M3-07 | ZIP export and safe output naming. | Archives reopen; traversal/collision tests pass. |
| M3-08 | Preservation preflight and unsupported document handling. | Signed/complex-form/tagged cases fail safely where unsupported. |

**Exit:** everyday tools share one interface/executor and pass the same conformance corpus on target platforms.

## M4 | Hero workflow: compression and searchable OCR
| ID | Task | Acceptance evidence |
|---|---|---|
| M4-01 | Compression candidate pipeline. | Meaningful reduction on intended corpus; text/vector preservation. |
| M4-02 | Target-size logic and quality review. | Decimal/MiB tests; under-target truthful; no silent rasterisation. |
| M4-03 | Local page classification and OCR scheduling. | Skip existing text where appropriate; mixed-document handling. |
| M4-04 | Searchable text-layer writer/composition. | Independent search/copy and before/after visual comparison. |
| M4-05 | OCR language asset loading/caching/capabilities. | Real language availability; no pretend universal support. |
| M4-06 | Merge -> OCR -> compress -> final validation chain. | Actual final size includes text layer; all inputs/pages accounted for. |
| M4-07 | Memory limits, pause/cancel/interruption and cleanup. | Mid-range mobile tests; no corrupt committed output. |
| M4-08 | Per-platform core parity and capability publication. | Matrix backed by real tests on web, Android, Apple mobile and Mac. |

**Exit:** the main marketing demo is real and locally executed on every platform advertised as supporting it. Do not launch a “Compress” button that only returns its input.

## M5 | Repeatability and carefully bounded extensions
| ID | Task | Acceptance evidence |
|---|---|---|
| M5-01 | Save/rebind/revalidate local compiled recipes. | Old file refs/secrets removed; replay works without AI. |
| M5-02 | Local recent jobs, restore/reimport and clear-data behaviour. | Retention disclosed; missing file handles handled honestly. |
| M5-03 | Known-password unlock/protect where engine is tested. | Secure control; secret absent from cloud/history/logs. |
| M5-04 | Scoped Info/XMP cleanup. | Exact removed fields verified; no anonymisation claim. |
| M5-05 | Duplicate/interleave/bookmark splitting. | Explicit inputs, odd-page and missing-bookmark cases. |
| M5-06 | Blank-page candidate detection/review. | Faint text preserved unless user confirms removal. |
| M5-07 | Share extension/intents, OS integration and accessibility polish. | Actual import from another app without upload. |

**Exit:** extensions reuse the same workspace, do not introduce editing/annotation/signing, and only tested features are exposed.

## M6 | Commercial readiness without damaging simplicity
| ID | Task | Acceptance evidence |
|---|---|---|
| M6-01 | Optional accounts and entitlement abstraction. | Basic local use works without signup; no document sync. |
| M6-02 | Sandbox platform billing and verified server entitlements. | Restore, pending, expired, refund and account-link tests. |
| M6-03 | Honest paywall placement and pricing configuration. | No result held hostage after unannounced processing charge. |
| M6-04 | Public website/privacy/help/feature capability pages. | No unsupported feature/“all offline” claims or fake testimonials. |
| M6-05 | SEO entry points into the same workspace. | Merge/compress/OCR pages preselect intent, not separate clunky funnels. |
| M6-06 | Store metadata/assets and support reporting. | Screenshots from actual app; no customer documents in reports. |

**Exit:** sandbox commerce works; owner approval still required for prices, live products, public deployment and store submission.

## M7 | Verification and controlled release
| ID | Task | Acceptance evidence |
|---|---|---|
| M7-01 | Complete planner holdout and adversarial suite. | Threshold report with failures, not just average score. |
| M7-02 | PDF preservation/quality corpus across all adapters. | Reopen, render, text and feature retention checks. |
| M7-03 | Release-mode network privacy audit. | Canary report and approved endpoint inventory. |
| M7-04 | Full state/responsive/accessibility visual QA. | Approved reference comparison and fixed discrepancy ledger. |
| M7-05 | Device/browser memory, battery and interruption testing. | Real limits and supported-device policy. |
| M7-06 | Dependency/security/licence/release review. | SBOM, locked builds, source notices and no critical known blockers. |
| M7-07 | Reproducible builds, signing and distribution preparation. | Appropriate native build artifacts and installation tests. |
| M7-08 | Pilot with real first-time users and revise friction points. | Measured task completion, clarification and abandonment patterns. |
| M7-09 | Owner-controlled public release and rollback plan. | Approved claims/prices/channels; versioned rollback and capability flags. |

## Parallel agent ownership
After M0 and schemas are stable: one web/UI agent, one Apple agent, one Android agent, one engine specialist, one planner/security agent and one QA/release reviewer can work in bounded tasks. Use separate worktrees or ownership rules where supported. The integrator owns protocol changes, shared tokens, dependencies and release gates. Small projects can run these roles sequentially; do not create a multi-agent runtime inside the customer product.

## End-of-session report
Task IDs completed; commits/files touched; tests run and output; UI screenshots; actual capability differences; unresolved blockers; next executable task. Prefer continuation at the next backlog item over creating a new plan every session.
