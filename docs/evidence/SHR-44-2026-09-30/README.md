# SHR-44 — Import cancellation and late workspace completion safety

30 September 2026. Implementation only for SHR-44. Started in an isolated worktree from latest fetched `origin/main`, `37e970025eaff9be35a2b8d5fa0291d9c7eef0a5`. [Source hashes](source.sha256) bind the runtime files to the test evidence. Existing engine, plan admission, provider routing, immutable originals and Undo semantics are retained.

## Before the change

The first nine ownership regressions exercised the actual `useWorkspace` hook with deterministic state/effect slots and delayed OS/transport promises. All nine reached their assertions and failed on the original App source; [baseline-hook.log](baseline-hook.log) records the failures. This is orchestration evidence, not a native UI run. The hook harness loads its compiled repository-source bundle from a private temporary file and removes it immediately after loading. The final browser tests exercise the real React interface with local PDF fixtures and mocked transport.

| Requested reproduction | Main-source behavior |
| --- | --- |
| Delayed sample, then Cancel | **Unsafe:** the delayed file imported and appended chat after Cancel. |
| Delayed sample, then Start Over | **Unsafe:** the delayed file populated the cleared session. |
| Old picker callback after a newer import | **Unsafe:** `new.pdf` was followed by `old.pdf` despite the replacement selection being authoritative. |
| Pending setup completion after reset | **Unsafe:** late status reopened a setup choice and appended a setup reply. |
| Pending workspace save / export after reset | **Checkpoint already safe:** serialized save then clear restored zero old files. **Export receipts unsafe:** delayed saved/shared/error receipts repopulated the cleared receipt map. |
| Repeated Cancel | Controller abort already tolerated repetition; pre-job sample acquisition remained live and a later rejection appended error noise. |
| Older completion after workspace generation/Undo changed | **Unsafe:** the older callback imported again and changed the revision/original list after Undo. Main had no acquisition-session ticket. |

A separate reproduction executed **unmodified core files extracted from the same main commit**, without switching an owner checkout: [baseline-core.log](baseline-core.log). It confirms that save→reset was already safe and that **Cancel during a pending import checkpoint was ignored**, leaving one old file in memory and on relaunch. The latter is now fenced as well.

## Ownership and cancellation

`WorkspaceSession` lives in `workspace-checkpoints.ts`, using the same ticket/advance pattern and location already present on the unmerged SHR-40 branch. A ticket is a generation check, paired with a cooperative abort signal. Cancel, confirmed reset, replacement acquisition/import, Undo and unmount invalidate earlier work. The session also cancels the controller's active job.

- Picker/sample/drop admission captures a ticket before any asynchronous acquisition. Admission, import replies/errors and finalizers check that ticket. A newer selection wins even when the older callback resolves last. Old finalizers cannot unlock a newer import.
- Native work retains the controller lock while cancellation drains; the `settle()` pattern matches SHR-40. Reset/replacement waits for that lock before making another workspace writable.
- Setup/status, restore, planner replies, local/planned execution receipts and asynchronous Undo presentation check session ownership before changing parent state.
- Export receipts require the session ticket, store revision, result reference and checksum to match. Stale receipts/errors are discarded; external writes and already-exported bytes stay valid.
- Chat/draft checkpoints check ownership when dequeued and before head publication. Scheduler callbacks queued before an exclusive reset are invalidated, including their error handlers. Existing deletion-epoch protection remains.
- Cancel requests cooperative abort without a provider/model call. An in-flight atomic head write is allowed to settle; if already published, a rollback checkpoint withdraws the candidate before the job unlocks. A failed withdrawal is reported as a failure rather than a successful cancellation.

Cancel first says cancellation was requested when a local job is still running. Only after that job drains can the current cancellation ticket append the controller's final acknowledgement. Another reset/import makes that acknowledgement stale too. No claim is made that a native synchronous call or OS picker stops instantly. Start Over retains its existing confirmation flow and is available during pending sample/picker/setup work.

## Cleanup and regression details

Every returned native picker handle is registered for cleanup **before** fallible metadata reads. Invalidated, rejected, partially read and unread copies are released through the same all-settled helper. Native deletion remains restricted to the app-private `DocumentPicker` cache; user originals are never released/deleted. Bundled samples use shared immutable asset-cache sources rather than new app-owned temporary copies. Browser samples are in-memory Files; their requests receive the cooperative abort signal. Stale unpublished vault blobs/manifests are collected under the existing private-root cleanup contract.

Tests assert complete current-result metadata/history/revision/hash equality after Cancel, Start Over, replacement import, Undo and direct generation advance. A local filesystem test verifies that the temporary copy is removed and the external original bytes are unchanged. Real PDF merge→save→page removal→Undo and OCR/compression workflows remain covered by browser regressions.

One existing clarification/secret regression used `not.toContainText` on a conversation element that is absent after a complete reset. Its reset assertion now requires **zero conversation elements**, followed by a fresh clarification request with no retained pending task. The privacy assertions before reset are unchanged.

## Verification

All data was synthetic/local; planner responses were mocked. No paid provider requests or external document transfer.

| Check | Result |
| --- | --- |
| SHR-44 focused regressions | **24/24 passed**, [focused.log](focused.log). |
| Full regression suite, corpus Python enabled | **150/150 passed, zero skipped**, [regressions.log](regressions.log). Includes import, progress/cancel, core integrity, native cancellation and protected persistence regressions. |
| Browser: ownership + planner/clarification + real workflows/Undo | **28/28 passed**, [browser.log](browser.log). |
| Universal TypeScript | `tsc --noEmit -p apps/universal/tsconfig.json`: exit 0. |
| Web TypeScript | `tsc --noEmit --incremental false -p apps/web/tsconfig.json`: exit 0. |
| Expo web export | Exit 0, [web-export.log](web-export.log). |
| iOS/Catalyst JavaScript bundle export | Exit 0, [ios-export.log](ios-export.log). No Swift/Objective-C files changed. |
| Whitespace/diff validation | `git diff --check`: exit 0. |

Commands used the existing bundled Node v24.19.0 and pinned repository dependencies. The full suite used the already available bundled Python via `ATEPDF_CORPUS_PYTHON`; no installation was needed. A temporary Metro configuration pointed the isolated worktree at the existing dependency folder for exports; it was restored. Build-generated validators and legacy browser artifacts were restored and are excluded from this change. Browser/headless and native bundle evidence is **not** physical Mac runtime, signing or release acceptance.

## SHR-40 reconciliation

SHR-40 remained unmerged when inspected. Its session abstraction and `JobController.settle()` are reused as the pattern here, rather than introducing a competing coordinator. No retention/settings/deletion feature is copied or implemented.

Overlap is unavoidable in `App.tsx`, `workspace-checkpoints.ts`, `job-controller.ts`, `workspace-vault.ts` and native picker startup/cleanup. When reconciling:

1. Keep **one** `WorkspaceSession` with this signal/current-ticket lifecycle; route SHR-40 expiry/deletion transitions through it too.
2. Keep **one** `settle()` and preserve this cancellation/rollback handling for a commit already saving.
3. Combine the vault's optional ownership predicate with SHR-40's existing save fence, deletion epoch and retention checks. SHR-40's private `#save(snapshot, activity, mode)` signature must retain activity/retention semantics; add ownership as a separate argument rather than replacing its Boolean activity argument.
4. Preserve SHR-40's private-root usage/deletion/startup cleanup and retention notices while carrying these completion/finalizer/receipt checks through the combined App paths.
5. Run both retention and ownership/persistence suites after reconciliation. This branch does not claim their combined behavior is verified.

Stop at In Review. No review of another PR, automatic review, merge or downstream SHR-73/74/75/78 work was performed.
