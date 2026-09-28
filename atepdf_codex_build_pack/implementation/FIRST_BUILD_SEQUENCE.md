> **v7 source rule:** Work in the new independent atepdf repo. Attenlo PDF is read-only learning reference. Read `fresh-start/README.md` from the handoff root; never clone or modify the old app wholesale.

# First build sequence and release ladder
**Work in executable slices. Stages are dependency ordered, not promised dates.**

The original 65 technical tasks and 30 lifecycle tasks remain. The ten F-tasks in this folder are an integration overlay, not 10 additional independent features. Consolidate duplicate work in the application's status file.

## Slice A: fresh repository, bounded learning and the approved screen
Map to M0 and the relevant M1 design tasks; F01-F02.

Confirm the new project and separate read-only legacy roots. Perform a bounded source-learning pass, document evidence and initialise the new app with fresh dependencies and tests. Reuse shadcn/template primitives where they actually remove code. Show the approved empty state with functioning local file selection and keyboard-safe composer at phone/tablet/desktop sizes. Do not spend the first session on a marketing site, payment provider or brand naming.

Evidence: new independent Git root; old reference read-only and unavailable status if needed; learning register with exact evidence levels; newly runnable local app; screenshot of the approved direction; no document request on file import. Scaffold only in the new project. Missing native toolchains are labelled honestly.

Add a new-app regression for each old lesson worth transferring. No old source path, linked package or production service becomes required. Fresh-checkout independence is a release gate. If old source is unavailable, proceed with the approved constraints and mark the source audit pending.

## Slice B: real merge and a follow-up before more infrastructure
Map to M1/M2/M3 core executor tasks; F03-F04.

Inputs: `fixtures/startup/brief.pdf` (two pages) and `fixtures/startup/appendix.pdf` (one page). Read exact expectations from `fixtures/startup/expectations.json`.

Build merge through the real local engine. Show three pages in order A1, A2, B1. A follow-up removing physical page 2 leaves A1, B1. Undo returns to the prior committed three-page result. Save cancellation leaves a Ready result, not a false Saved status. Preserve original input checksums.

Before API access exists, a deterministic quick action supplies the plan; do not pretend it is model interpretation. Application tests must assert output independently of the UI renderer.

Evidence: real input/output counts and text markers, integrity/reopen result, original hashes, screenshots, unit/worker integration tests and working preview/save. These tests do not yet demonstrate compression or OCR.

## Slice C: genuine cloud intent with a local data boundary
Map to M2 planner/gateway, G04/G06 and F05-F06.

Configure one approved inexpensive model through the AI SDK. Use the current API project's actual supported model/options, not a model name assumed from old notes. Port the provided schemas and reference semantics into the actual runtime. A typed instruction produces a plan and the same local result as Slice B.

Test consent declined, provider timeout, wrong/missing model configuration, stale file selection, duplicate response, invalid operation and prompt/file-canary network leakage. Do not send local results back for a concluding paragraph. Demonstrate that local jobs continue after a plan is received even if the gateway becomes unavailable.

Evidence: live request/response with sensitive bodies excluded from logs, safe network capture, measured latency/token usage, command-case report and all failed/unrun cases. No approved API access means this slice is blocked, not passed; other local slices continue.

## Slice D: prove the central benefit
Map to M4, F07.

Use the mixed fixture for searchable OCR; add realistic image-heavy compression fixtures in the app's synthetic corpus. Implement scan classification, a correctly placed searchable text layer, real safe compression and final validation after the text layer is present. Verify that the original text pages remain usable and that the known scanned phrase becomes searchable.

The initial included small PDFs are NOT proof of compression capability and may not shrink. No copy-and-return compression, fake target claim or rasterising every page without explicit quality trade-off handling.

Evidence: merge -> OCR -> compress real outputs, size measurements, independent search/copy, preservation diffs, cancellation/memory tests and per-platform capabilities. Investigate parser/licence feasibility early rather than writing the paywall around unimplemented promises.

## Slice E: commercial and lifecycle completion
Map to M5/M6, G01-G30 by actual dependency, F08.

Workspace-first onboarding, real optional sample, correct allowances, contextual paywall, localized provider prices, verified sandbox purchases, restore, account linking without file sync, My plan, grace/expiry/refund, cancellation/deletion and useful help. Existing free results remain accessible.

No live price creation or production charge until approved. Paywall cannot sell support for a platform/operation that has not passed tests. Identity and receipts are metadata, not a reason to upload files.

Evidence: growth acceptance cases on actual app/store test accounts, quota reservation/reconciliation, no duplicate subscriptions, no document telemetry, cancellation/restore evidence and basic self-service support.

## Slice F: native parity and controlled release
Map to M4-08/M7, F09-F10.

Keep native targets in the work plan throughout; do not treat a responsive web view as a native app. Build fresh SwiftUI Apple and Kotlin/Compose Android adapters, guided by documented read-only old-source lessons where available. Use the same protocol, fixtures, operation semantics and lifecycle. A staged beta may ship a ready platform first, but the others remain tracked obligations.

Release the publicly advertised subset only after privacy, integrity, accessibility, memory and store evidence exists. Build signing, merchant verification and account ownership may require Shrey; continue independent testing while awaiting those.

## Session discipline
Timebox the initial reconnaissance rather than spending a full session planning. Write down actual commands and failures, then code. Validate one vertical slice at a time. A context reset should resume from `docs/IMPLEMENTATION_STATUS.md` and the next blocked/unblocked task, not restart the project.

End each session with: runnable entry point, completed task IDs, evidence paths, results and next executable task. A partial handoff can be honest; a fake complete handoff is unacceptable.
