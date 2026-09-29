# SHR-39 — protected local workspace checkpoint and restore

Base: `origin/main` at `4c22232b67345be7a19712c46fe6b49e1a43505a` (clean), branch `shreytalwar/shr-39-checkpoint-and-restore-the-previous-mac-workspace-locally`. Implements the approved ADR 0010 contract; no redesign, no database, no new dependency. Synthetic/local data only; no provider, paid or network calls.

First review round: PR #81 head `5d86e86`. Review fixes (this revision) tested source SHA-256: `workspace-checkpoint.ts` `8db0a6fc…e766735e`, `workspace-vault.ts` `b81336ec…9c25d940`, `job-controller.ts` `25550cd2…462094fc`, `App.tsx` `6175ab59…b23a5f70`, `AtepdfWorkspaceVault.swift` `47314bff…ffe80523`. See [PR #81 review fixes](#pr-81-review-fixes) for what changed after the first round. Second-round fixes (on top of `0604901`) tested source SHA-256: `workspace-vault.ts` `3e3a4c8e…cd2bae69`, `workspace-checkpoints.ts` `2f7a353f…7d2bf65a`, `job-controller.ts` `e1ed89a3…4286f991`, `App.tsx` `57883a6a…a9f07c80`, `ComposerInput.native.tsx` `4787a308…1b088429`; see [PR #81 second review fixes](#pr-81-second-review-fixes).

## PR #81 second review fixes

The second review found two more P1 defects in Start over. Both were reproduced on `0604901`: the new tests fail there ([original-0604901-p1-4-5.log](original-0604901-p1-4-5.log)), and a probe shows the exact end state ([original-0604901-probe.log](original-0604901-probe.log)). Focused regressions: [p1-second-review.log](p1-second-review.log), **5/5**.

**P1-4: a queued chat or draft save could undo Start over.** *Reproduced:* Start over succeeded (no controller error, no files shown), but a save queued behind it was *published* into the new epoch, and relaunch restored `["old chat that Start over must remove"]` and the old draft. *Fix:*
- **Vault fence:** `WorkspaceVault.save()` captures the deletion epoch when the save is requested and refuses to write (`StaleSaveError`, nothing written) if a clear committed first.
- **App suspension:** chat and draft checkpoints go through a new `CheckpointScheduler` (`packages/core/src/workspace-checkpoints.ts`). Start over runs inside `scheduler.exclusive()`. That cancels any pending draft timer, ignores chat/draft checkpoint requests while the clear runs, and resumes only after the App has reset its chat and draft view to empty (synchronously, before resuming).
- **Draft reset:** the composer draft is cleared too. The native input is told explicitly via `resetComposerInput()`, because it is uncontrolled.
- **Failure path:** a failed Start over resumes checkpointing in the unchanged workspace.

*Tests:*
- `P1-4 a chat or draft save queued behind Start over cannot resurrect old text`: the reviewer's exact race.
- `P1-4 Start over suspends chat and draft checkpoints and resets the view before they resume`: covers a pending draft timer, chat/draft activity during the clear, no save during the transaction, only new-epoch text after it, and no old text in the published manifest.
- `P1-4 a failed Start over resumes checkpointing in the unchanged workspace`.

**P1-5: Start over could imply removal while old encrypted PDF copies remained.** *Reproduced:* with blob removal failing, the clear reported no error and no message and relaunch showed an empty workspace, but 4 old encrypted blobs were still on disk and the key was still present. *Fix:*
- **Verified cleanup:** cleanup is now explicit and verified. `#collect` removes each unreferenced manifest and blob independently, lists again to verify, and retries the pass a bounded number of times. It reports success only when nothing unreferenced remains.
- **Tracked state:** the vault tracks `cleanupPending`. `clear()` returns `{cleanupComplete}`. The controller still empties the workspace, because the clear itself is durable, but sets the truthful `CLEANUP_INCOMPLETE` message instead of implying removal. The App shows it as a notice ("some of atePDF’s earlier PDF copies couldn’t be removed from this Mac yet. They stay encrypted and can’t be opened in atePDF; it will keep trying to remove them.").
- **Retries:** cleanup is retried after every later checkpoint and at every launch. On launch, anything the head and its predecessor don't reference is removed and verified, and the outcome carries `cleanupPending`. The notice clears only once a retry verifies removal.
- **Evidence kept after a fallback:** after a fallback restore, the unreadable newest manifest's files are kept as evidence rather than collected.

*Tests:*
- `P1-5 Start over does not claim removal until old PDF copies are verified gone, and retries cleanup`: removal that throws, and removal that silently leaves the file; checks the truthful message, that the copies really remain, that relaunch shows an empty workspace (never old data), and that a same-session retry verifies removal.
- `P1-5 an incomplete cleanup is retried and verified at the next launch`: relaunch with removal still failing reports `cleanupPending`; relaunch with removal working cleans up during open and verifies.

Mutation checks: removing the epoch fence, the scheduler suspension, or the cleanup verification each makes the corresponding new test fail.

## PR #81 review fixes

The independent review found three P1 defects and a Swift harness discrepancy. Each one was reproduced against the original PR code (`5d86e86`, exported to a scratch directory with the new tests copied in; [original-code-p1.log](original-code-p1.log)), then fixed. Focused regressions: [p1-regressions.log](p1-regressions.log), **8/8**.

**P1-1: a save reported as failed could become the restored state.** *Reproduced:* the head was atomically replaced, its directory sync then failed, and putting the old head back also failed. The app still said "wasn't kept", and relaunch restored the change (`head restore fails, manifest withdrawn: a change reported as not kept must never be restored`). *Fix:* `#commitHead` establishes where a head replacement ended before anything is reported:
- **Published:** the write, file sync, directory sync and read-back all succeeded.
- **Unpublished:** after any failure the head is read again. If the acknowledged head is still there, the new head never replaced it. Otherwise the new generation is withdrawn: its manifest is removed (unlink plus directory sync), and the acknowledged head is written back. Restoring the head is enough on its own. Removal alone is enough only when restore can fall back to an acknowledged same-epoch generation.
- **Uncertain:** only if reconciliation also fails. The app then withdraws the change from view with `STORAGE_UNCONFIRMED` ("it may reappear when atePDF opens again. Saving is paused"), never "wasn't kept", and the vault stops writing.

Sync failures are write failures in both backends: Swift `syncDirectory` now throws, and `remove` syncs the directory. A generation number that a head may have named is never reused. *Tests:*
- `P1-1 a failure after head replacement is reconciled`: a matrix of head restore and manifest removal each succeeding or failing. It asserts that whenever the message is "wasn't kept", relaunch does not contain the change.
- `P1-1 a head write that fails before replacement is definitely unpublished`: also covers sync failures on blobs and manifests.
- `P1-1 the first save after genesis cannot be withdrawn by manifest removal alone`.

**P1-2: a missing head could delete a committed generation-1 workspace.** *Reproduced:* a committed gen-1 workspace with only its head removed relaunched as `empty`, and `manifests/1.atw` plus its PDF blob were deleted. *Fix:* a new workspace first publishes a sealed **genesis head** (generation 0, names no manifest) before any user data can be written. Stored files without a head therefore always mean the head was lost. They are preserved byte-for-byte, the workspace opens blocked (`corrupt`), and saving and clearing are refused. An interrupted first save is proven uncommitted by the genesis head on disk; its orphan files are collected only after a real checkpoint publishes. *Tests:* `P1-2 a committed generation-1 workspace whose head is lost is preserved and blocked, never opened empty` and `P1-2 the genesis head is the evidence that an interrupted first save was never committed`.

**P1-3: Start over emptied the screen before the clear was durable.** *Reproduced:* when the clear manifest write failed, the store was already empty and the message said the chat was "cleared here". Relaunch brought the old work back. *Fix:*
- `JobController.clear()` awaits the vault's clear and empties the store only after the new deletion-epoch head is published and verified. `App.tsx` clears the visible conversation only after that succeeds.
- If the head write fails, the clear is completed by rolling forward (a pre-clear head is never put back).
- A definite failure keeps the workspace shown with `CLEAR_FAILED` ("nothing was removed").
- An unconfirmed clear keeps the workspace shown with `CLEAR_UNCONFIRMED`, and saving is paused.
- The Start over question now says what it removes on this Mac ("atePDF’s saved copies of its PDFs, results and draft … Files you added and PDFs you saved elsewhere stay unchanged"). The privacy panel says it is not secure erasure. Session-only builds keep their existing wording.

*Tests:* `P1-3 Start over empties the workspace only after the durable clear is verified` (files are still shown while the clear head is written), `P1-3 a failed or unconfirmed Start over keeps the workspace shown and never reports a clear that relaunch undoes` (failure before publication, head failure before replacement, sync failure with successful roll-forward, sync and roll-forward failure, each followed by relaunch), and `P1-3 no fallback across a deletion epoch after Start over`.

**Swift harness backup-exclusion discrepancy: environment-sensitive, plus a real verification gap.** The reviewer's run was inside Codex's `workspace-write` seatbelt sandbox. Reproduced with `codex sandbox -c sandbox_mode="workspace-write"`:
- `setResourceValues` succeeds, and the marker xattr `com.apple.metadata:com_apple_backup_excludeItem = com.apple.backupd` is present on disk and readable with `getxattr`.
- `URLResourceValues.isExcludedFromBackup` nevertheless reads `false` inside that sandbox. It reads `true` unsandboxed.
- The original harness fails only in that sandbox ([original-harness-codex-sandbox.log](original-harness-codex-sandbox.log)) and passes on the host.

The implementation also set the flag without verifying it. *Fix:*
- `excludeFromBackup` now verifies after setting (Foundation read-back, or the on-disk marker when the read-back is restricted) and throws otherwise, so an unverifiable exclusion fails the write closed. Confirmed with a `sandbox-exec (deny file-write-xattr)` probe: the write is refused and no file is created.
- The harness now asserts the on-disk marker directly and the vault's verification, adds a negative check that an unmarked directory is not reported as excluded, and prints Foundation's read-back as information.

The harness passes on the host ([native-workspace.log](native-workspace.log), read-back `true`) and inside the Codex sandbox ([native-workspace-codex-sandbox.log](native-workspace-codex-sandbox.log), read-back `false`, marker present).

## What was implemented

- **Schema** (`packages/core/src/workspace-checkpoint.ts`): strict allowlisted v1 checkpoint — schema version, workspace ID, generation, revision, deletion epoch, saved/last-activity time, retention mode (`keep` default; a durable `quit` checkpoint is rejected), artifacts with size/SHA-256/inspection/blob generation, ordered originals, result history, focus, one-Undo predecessor, selection, empty reserved `collections`, typed display-only conversation and inert draft. Unknown fields, broken references, repeated refs/IDs and future schema versions are rejected.
- **Vault** (`packages/core/src/workspace-vault.ts`): one serialized coordinator. A new workspace first publishes a sealed genesis head. Save order: new immutable blobs → verify → complete manifest → verify → atomic head replacement (commit point, reconciled on failure as above) → collect everything not referenced by the current or previous generation. Restore authenticates head, manifest and every blob, checks size and SHA-256, and falls back only to the preceding generation of the same deletion epoch. Corrupt, missing-artifact, missing/locked/wrong key and future-schema cases open a blocked state that writes nothing. Clearing publishes a new deletion epoch with no predecessor before deleting old files, and the workspace is emptied only after that is verified. SHR-71’s `safeOrdinaryText` is applied again to every persisted free-text field; a draft that the guard would change is not saved.
- **Controller/store**: `JobController` publishes import, transform and Undo results only after the durable save succeeds; on failure it withdraws the change (`LocalFileStore.mark/rollback`, revision still advances) and reports `STORAGE_WRITE_FAILED`. Cancellation cannot interrupt a save. `restore()` re-reads every saved PDF with the local engines, compares page geometry, then hydrates; the restored revision is advanced so pre-relaunch requests are stale. Chat/draft saves use `durableState(false)` so they never make an unconfirmed commit durable early. Without durability hooks, existing behavior is unchanged.
- **Mac native** (`AtepdfWorkspaceVault.swift`, module functions Catalyst-only): Application Support `atepdf/Workspace`, `ATW1` + CryptoKit AES-256-GCM combined box with role/workspace/ref/generation associated data, random 256-bit key in the Data Protection Keychain (`kSecAttrSynchronizable=false`, `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`), key never sent to JavaScript and never replaced over an existing workspace. Writes stage in the same volume, `F_FULLFSYNC`, `rename`, directory `fsync`; directories 0700, files 0600, workspace excluded from backup (reasserted after replacement); symlinks not followed.
- **App** (`App.tsx`): restores on launch before the composer mounts (conversation, current/earlier result cards, inert draft), never re-arms questions, pending clarification, planner requests/envelopes, confirmations, jobs or connection tokens, and makes no planner/status call during restore. Shows a one-line notice for blocked/unavailable/recovered states (retry offered only for retryable key/storage states before new work). Web and iOS keep session-only behavior (`createWorkspaceBackend()` returns null).

## Commands and results

Each `node` command used `PATH=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH`, run from the worktree root.

| Command | Result |
| --- | --- |
| `node --import tsx --test --test-name-pattern="P1-[45]" tests/regressions/workspace-persistence.test.ts` | **5/5 passed** (second review); [p1-second-review.log](p1-second-review.log). Against `0604901`: 3 of 3 then-existing fail ([original-0604901-p1-4-5.log](original-0604901-p1-4-5.log)). |
| `node --import tsx --test --test-name-pattern="P1-[123] " tests/regressions/workspace-persistence.test.ts` | **8/8 passed** (first review); [p1-regressions.log](p1-regressions.log). The same tests against `5d86e86`: 7 of 8 fail ([original-code-p1.log](original-code-p1.log)). |
| `node --import tsx --test tests/regressions/workspace-persistence.test.ts` | **27/27 passed**; [persistence.log](persistence.log) |
| `node --import tsx --test tests/regressions/*.test.ts` | **103/103 passed** (76 existing + 27 SHR-39); [core.log](core.log) |
| `node --import tsx tests/native/apple/workspace/run.ts` | Exit 0; **42 Swift checks + TS↔Swift interop**; [native-workspace.log](native-workspace.log). The same command inside `codex sandbox -c sandbox_mode="workspace-write"`: exit 0, 42 checks; [native-workspace-codex-sandbox.log](native-workspace-codex-sandbox.log). |
| `node node_modules/typescript/bin/tsc --noEmit -p apps/universal/tsconfig.json` | Exit 0 |
| `node node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json` | Exit 0 |
| `node scripts/assets.mjs` then `expo export --platform web` (from `apps/universal`, output in session scratch) | Exit 0; [web-export.log](web-export.log) |
| `expo export --platform ios` (from `apps/universal`, output in session scratch) | Exit 0; [ios-export.log](ios-export.log). Compiles the native JS bundle, including `ComposerInput.native.tsx`. Not a device or runtime run. |
| Playwright `tests/e2e/planner.spec.ts tests/e2e/local-actions.spec.ts` against a fresh export of this revision on `127.0.0.1:43291` (temporary config, mocked planner routes) | **28/28 passed**, twice; [browser.log](browser.log). A run made while the Catalyst build was saturating the CPU failed 27/28 ([browser-under-build-load.log](browser-under-build-load.log)): the existing Start over test asserts `not.toContainText` on the conversation element, which disappears once the welcome screen shows. The test passed 3/3 in isolation and in both uncontended full runs. The UI reached the correct cleared state in the failed run. In the first round, a run failed 25/28 only because the export lacked the generated `/engines` worker (fixed by `scripts/assets.mjs`, ignored output). |
| `scripts/native/mac-build.sh` | Not rerun for the second review: no Swift or native storage code changed (`git diff 0604901 -- apps/universal/modules` is empty). **BUILD SUCCEEDED** for both earlier rounds, Release Mac Catalyst arm64, strict signature verification passed; [mac-catalyst.json](mac-catalyst.json) |
| `git diff --check` | Exit 0 |

Persistence tests (real fixture PDFs through the real web-pdf engine and PDF.js inspection, temp directories, in-memory Keychain stand-in): quit/relaunch round trip of bytes/hashes, original order, history, focus, Undo predecessor, conversation, draft, revision/generation; one Undo after relaunch is durable; inert restore with `fetch` stubbed (0 calls), 0 transform calls and stale pre-relaunch plan rejected; no canary/password/token/`requestId`/planner fields in the decrypted manifest and no plaintext on disk; storage write failure withdraws import/transform/Undo; interrupted writes at four boundaries restore the previous generation and orphans are collected; truncated/corrupt manifest fallback only within an epoch, both-damaged fails closed with no writes; missing, corrupt, swapped and validly-sealed-but-wrong-hash blobs fail closed; future schema refused without downgrade writes; locked/unavailable/missing/wrong key fail safely and no replacement key is created; clear publishes a new epoch and never falls back across it; blobs are immutable and two generations retained; headless leftovers fail closed. Mutation checks (removing redaction, fallback, hash check or rollback) each made the relevant test fail.

## Mac/native checks actually run

- Host Swift harness compiled the shipped `AtepdfWorkspaceVault.swift` with `swiftc`: sealing format, AES-GCM authentication, associated-data binding, wrong/locked key, name validation, atomic head replacement, staging cleanup, symlink refusal, 0700/0600 permissions, the verified backup-exclusion marker, shipped Keychain query attributes and Swift↔TypeScript file interop. Run on the host and inside the Codex seatbelt sandbox.
- Live Keychain probe from the unsigned host tool: `SecItemAdd` → **-34018 (errSecMissingEntitlement)** on the host, **-25291 (errSecNotAvailable)** inside the Codex sandbox; both reported as `unavailable`. Not a pass or fail of the signed app.
- Real Mac Catalyst app (ad-hoc signed, exact staged path): launched, showed the “can’t save your workspace on this Mac” notice, sample import worked session-only, quit, no workspace directory written, relaunch restored nothing. This is the designed fail-safe on a build without a keychain access group. The rebuilt review-fix app behaved the same; no genesis head is written when the key is unavailable.

## Not run / limitations

- **Successful durable restore inside the real Mac app was not verified.** The current ad-hoc development signing has no application identifier/keychain access group, so the Data Protection Keychain is unavailable and the app correctly stays session-only. A signed build with the final team/channel identity is required (SHR-41, SHR-91). Keychain item attributes as stored, backup exclusion on the real container, crash/force-quit at each write boundary, disk-full, sleep/wake and Keychain lock on the real app remain SHR-41 work.
- iOS/iPadOS and web intentionally stay session-only in this issue. No iOS export or device run was performed.
- Clear keeps the existing workspace key (key rotation/retirement, retention expiry, storage usage, and Clear History UI are SHR-40). So while cleanup is incomplete, the remaining encrypted copies could still be decrypted with that key by code holding it. The UI says the copies remain and are retried; it does not claim they are unreadable to the key. Cleanup retries are bounded per attempt and repeat on later checkpoints and launches; there is no background timer. A failed or unconfirmed Start over leaves the workspace shown; an unconfirmed one pauses saving until relaunch, and there is no in-app discard path for that state yet (SHR-40).
- The reconciliation paths (sync failure after rename, failed withdrawal, failed roll-forward) are exercised with the Node test backend's fault injection and by code review of the Swift write/sync/remove order. They were not fault-injected in the real Mac app (SHR-41).
- The Start over UI sequencing in `App.tsx` is covered by controller/vault tests plus the browser Start over specs (session-only path). No React/native UI test drives the durable failure branches.
- PDF bytes cross the React Native bridge as base64 and every new blob is read back once to verify; large-workspace cost is unmeasured (SHR-43/SHR-34).
- Detection of secrets remains SHR-71’s recognized-pattern guard, not a guarantee for arbitrary free text. Saved PDF inspection text (document content) is encrypted but not redacted.
- Blocked state (corrupt/lost key/future schema) is read-only-for-disk: new work in that session is memory-only and is not saved until SHR-40 provides an explicit discard path.
