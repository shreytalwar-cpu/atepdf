# SHR-40 — retention settings, storage usage and safe local deletion

Base: `origin/main` at `c11a19e24b82de171cd7e74b3e7e5fcbe6ac2e74` (SHR-39 merge), branch `shreytalwar/shr-40-add-retention-settings-storage-usage-and-safe-local-deletion`. Implements the retention policy already approved in ADR 0010 / SHR-38 on top of the SHR-39 vault. No new retention modes, no new dependency, no cloud, no key rotation, no secure-erase claim. Synthetic/local data only; no provider, paid or network calls.

## PR #83 review fixes (first independent review)

The first review of `8e45ca6` found three P1 defects. Each was reproduced against `8e45ca6` with the new tests before fixing: [original-8e45ca6-p1-1-browser.log](original-8e45ca6-p1-1-browser.log) (2 of 2 fail) and [original-8e45ca6-p1-2-3.log](original-8e45ca6-p1-2-3.log) (4 of 4 fail). Focused regressions on the fix: [p1-review.log](p1-review.log) (5/5 Node) and the P1-1 tests in [browser.log](browser.log).

**P1-1: a delayed import could repopulate the workspace after Delete local data.** *Reproduced:* with the sample download held, Delete local data reported success. When the download was released, `importFiles` ran and the two PDFs, the “I’ve added 2 PDFs” message and their saves landed in the new, empty workspace. The same happened with a file chooser answered after the delete.
*Fix:* a `WorkspaceSession` (`packages/core/src/workspace-checkpoints.ts`) issues a ticket when a picker, sample download or drop starts. Delete local data, Start over (both the saved and session-only paths), expiry and an expiring setting change advance the session **as they begin**. `pick()` checks its ticket after the picker or download resolves. A stale completion releases the picker copies and returns: no import, no conversation entry, no error message, no save. `importFiles()` takes the ticket too, and checks it before starting and again before reporting. The deletion does not wait for a picker the user still has open. It invalidates the pending completion instead.
*Tests* (`tests/e2e/retention.spec.ts`, the real App path in the browser build with the synthetic backend):
- `P1-1 a sample download that finishes after Delete local data is discarded…` holds `/fixtures/*.pdf`, deletes, releases the download, and waits.
- `P1-1 a file chooser that completes after Delete local data is discarded…` imports, opens **Add files**, deletes, then answers the chooser.

Both then check: the welcome screen; no “I’ve added” or “ready” message; the backend write count and stored file list identical to right after the delete; no blobs; still empty after reload. Plus the unit test `P1-1 a completion ticket goes stale once the workspace is emptied, and only then`.

**P1-2: a failed staging cleanup was reported as complete.** *Reproduced:* with staging listing, unlink or directory sync failing, `deleteAll()` returned `cleanupComplete: true` and the staging bytes stayed on disk. A file left by a failed write was never removed.
*Fix:*
- The backend contract for `cleanStaging()` is now: remove every staging entry, sync the directory, verify it is empty, and **throw** on any listing, unlink, sync or verification failure. Swift previously ignored listing and unlink errors and only removed `*.tmp`. It now also refuses to follow a staging path that is not a real directory (for example a symbolic link). The Node test backend matches.
- The vault no longer calls it with errors swallowed. Staging is part of `#collect`: it is cleaned at launch, Start over, expiry, switching to quit and Delete local data. It is also cleaned at every later cleanup while an earlier staging cleanup is unconfirmed or after any failed write (`#stagingPending`).
- `cleanupComplete` and `cleanupPending` are true only when staging is verified too. Retained staging bytes show in usage as **Waiting to be removed**.
- Launch no longer blocks the workspace when staging cannot be cleaned; that is now pending cleanup.

*Tests:*
- `P1-2 a staging listing or unlink failure keeps Delete local data incomplete, visible as pending, until a later cleanup removes it`. Listing failure, unlink failure, and an unlink reported done that leaves the file: each gives an incomplete message, a pending warning, and 64 bytes shown as pending. A later save while the failure persists stays pending. The next save after the failure clears removes the file, and only then clears the warning.
- `P1-2 a staging directory sync failure is unconfirmed, and relaunch retries staging cleanup before reporting it complete`. A launch with the sync still failing stays pending; the next launch completes. Start over includes staging.
- `P1-2 a staging file left by a failed write is removed and verified at the next save`.
- Swift harness: 7 new checks. Every staging file is removed and verified; a never-created staging directory is clean; an unlinkable file throws and stays; an unreadable directory throws; retained bytes are visible in usage; a later retry removes them; a symlinked staging directory is refused and its target left untouched.

**P1-3: a backward clock of up to 5 minutes was tolerated.** *Reproduced:* a 7-day workspace reopened normally with the clock one minute earlier than its saved times.
*Fix:* `CLOCK_TOLERANCE_MS` is removed. For a finite setting with retained content, any `now < lastActivityAt` or `now < savedAt` (or an invalid clock) is `clock`. At launch the workspace is blocked with the files untouched. While running, expiry does not happen, saving stops, and nothing is deleted or extended. Keep until I delete it and Delete when atePDF quits still do not depend on the clock.
*Test:* `P1-3 a clock earlier than any saved time, by any amount, fails closed…`. One-minute and one-millisecond rollbacks block, with files byte-identical. A clock after the last activity but before a later save time (a setting change) still blocks. A running workspace moved back 1 ms reports `clock` and refuses to save.

**Follow-ups.**
- **Temporary-file size.** Sizes now come from `File.info()`. If any temporary file’s size is unknown, the temporary total is unknown: the row shows “Couldn’t be measured” and the total reads “At least …”, never an exact-looking figure (browser test `temporary files that cannot be measured never produce an exact-looking total`).
- **Start over vs Delete local data.** The Start over question now says the Keep workspace setting stays as it is. The Delete local data confirmation says it resets the setting and that Start over keeps it.

**Mutation checks:** 19/19 caught, including 6 new ones: the old 5-minute tolerance restored; save time not checked; a staging failure counted as cleaned; staging never cleaned; a failed write not scheduling staging cleanup; staging pending ignored in the result ([mutations.log](mutations.log)).

## PR #83 final review fixes (B1–B3)

The final adversarial review of `3e3bfc6` found three blockers. Each was reproduced against `3e3bfc6` with the new tests before fixing: [final-original-3e3bfc6-b1-b2.log](final-original-3e3bfc6-b1-b2.log) (3 of 3 Node tests fail) and [final-original-3e3bfc6-b3-browser.log](final-original-3e3bfc6-b3-browser.log) (2 of 2 browser tests fail). The fixes were then merged with `origin/main` at `7853973` without conflicts, and every check below ran on the merged tree.

**B1: deleting an unopenable workspace could resurrect the old conversation.** *Reproduced:* with the key locked, `remove(head)` reported success but left the head, every cleanup listing failed, and `deleteAll()` returned "incomplete". Once the key was available, a relaunch restored the old conversation.
*Fix* (`WorkspaceVault.#wipe`): a resolved `remove()` no longer counts as proof. After each attempt (up to 3), an independent `exists(head)` query runs. The head counts as gone only when a remove that also synced is followed by a definite "absent". If the head is still present, the result is `DELETE_FAILED`. If its presence can't be determined, the vault fails closed with `DELETE_UNCONFIRMED`. In both cases nothing else is removed, no genesis head is written, the fence does not advance and the vault stays blocked.
*Tests:* `B1 a head removal that reports success but leaves the head is verified, and unlock/relaunch never restores the old conversation` covers the review case: the first head removal lies and every listing fails. The test checks the relaunched state itself (conversation, draft and PDFs empty; outcome blocked). It also checks why: 2 head removals, and the head independently absent. `B1 a head that stays present, or whose presence is unknown, is never reported deleted…` covers a persistent lie and an `exists` failure. Both are rejected with the files byte-identical and the vault still blocked, and a queued save is refused.

**B2: a fallback restore dropped the staging cleanup obligation.** *Reproduced:* with a corrupt newest manifest, staging bytes present and staging cleanup failing, the previous generation restored with `cleanupPending=false`. A later save never retried, so the staging bytes stayed.
*Fix* (`WorkspaceVault.#open`, new `#sweepStaging`): staging is swept on every restore, whichever generation restored. A failure leaves `stagingPending`/`cleanupPending` set, the bytes count as `pending` in usage, and every later cleanup (each save) retries until the backend verifies staging is empty. Manifest/blob collection after a fallback is unchanged: the unreadable newest manifest is still kept as evidence.
*Test:* `B2 a fallback restore keeps staging cleanup pending and counted until a later save removes it`. The previous generation restores (conversation, draft and artifact refs match it), `cleanupPending` is true, and usage reports 64 pending bytes. With cleanup allowed again, the next save removes the staging file, clears the flag and reports 0 pending bytes.

**B3: a delayed connection-status response could repopulate the chat after deletion.** *Reproduced:* with `/api/planner/status` held, Delete local data (or Start over) completed. The held response was then released, `connect()` appended its "Connect OpenAI…" message to the cleared chat, and that message was saved.
*Fix* (`apps/universal/App.tsx`): the existing `WorkspaceSession` ticket is used; no second generation system was added. `connect()`, `checkConnection()` and `refreshConnection()` capture a ticket when they start and change no chat, connection state or saved workspace once it is stale. The API-key and native pairing/disconnect completions use the same check. `connect()` also has its own `AbortController`, which `stopWork()` aborts, but correctness does not depend on the abort.
*Tests* (`tests/e2e/retention.spec.ts`): `B3 a connection response that arrives after Delete local data…` and `…after Start over…` hold the first status request, clear, release it, then check four things: no message, no new write, the stored files unchanged and the empty state still shown. They then start a new connection check in the new session and check it is answered normally (once), and that nothing returns after a reload.

| Final-round command (merged tree; `workspace-vault.ts` `dc4c756059045677`, `App.tsx` `4e234f08d329bcda`) | Result |
| --- | --- |
| Focused B1/B2 (`--test-name-pattern="B1\|B2"`) | **3/3**; [final-review.log](final-review.log) |
| `workspace-retention.test.ts` | **31/31** (28 earlier + 3 final-review) |
| `workspace-persistence.test.ts` + `workspace-retention.test.ts` (SHR-39 + SHR-40) | **64/64**; [final-persistence-retention.log](final-persistence-retention.log) |
| `node --import tsx --test tests/regressions/*.test.ts` (includes main's newer compatibility/corpus tests) | **157 tests: 156 passed, 0 failed, 1 skipped**. The skip is main's SHR-45 optional-Python generator test. The private-TLS loopback test bound `127.0.0.1` and passed normally. [final-core.log](final-core.log) |
| `node --import tsx tests/native/apple/workspace/run.ts` | Exit 0, **66 checks**; [final-native-workspace.log](final-native-workspace.log) |
| `tsc --noEmit` for `apps/universal` and `apps/web` | Both exit 0 |
| Playwright, **all** specs, fresh export on `localhost:43301` | **61/61 passed**, including the delayed sample, delayed file chooser and both delayed connection-response tests; [final-browser.log](final-browser.log). The rewritten tracked evidence and the regenerated contract validators were reverted. |

**Known limitation (B1).** If the storage layer keeps claiming the head is removed while it stays on disk, the head can't be removed without the key. Nothing on the Mac can then stop a later unlocked launch from opening that workspace. atePDF never reports it deleted: the user is told nothing was removed, and a later launch opens it whole, as it was. Removing its manifests without the key is not attempted, because it depends on the same failing listing and the message promises nothing was removed.

## What was built

**Retention settings** (`packages/core/src/workspace-vault.ts`, `apps/universal/src/components/PrivacyStorage.tsx`). The four approved options, in the approved words: **Keep until I delete it** (default), **30 days**, **7 days**, **Delete when atePDF quits**. They live in a *Keep workspace* radio group in the existing privacy dialog, which becomes **Privacy & storage** on builds that keep a workspace (the Mac). The dialog opens from the “Processed on your device” control or with ⌘, (web renderer).

- The setting is stored in the encrypted checkpoint (as ADR 0010 specifies) **and** in the sealed head. The head is the commit point, so if restore has to fall back to the previous generation, whose manifest may predate a setting change, the head’s newer setting wins. A head that disagrees with its own manifest is refused (`corrupt`).
- Changing the setting is **not** workspace activity: the retention age keeps counting from the last change to chat, draft, files or results. A shorter setting applies to that age at once. When a change would delete the workspace now, the dialog says so first (“It hasn’t changed for 10 days, so the 7-day setting deletes it now…”) and nothing happens until the user confirms.
- **Start over** keeps the chosen setting. **Delete local data** returns it to Keep until I delete it (ADR 0010: the stored retention selection is removed with the workspace; a new workspace uses the default).

**Expiry (7 and 30 days).** The whole workspace expires as one unit, measured from the checkpoint’s `lastActivityAt`, which only a save of user activity advances; launches and viewing do not. It is checked:
1. at launch, before any PDF is read (so a damaged or missing PDF cannot keep an expired workspace alive), and again on whatever was actually loaded (including the same-epoch fallback);
2. when atePDF becomes active again (`AppState`), when not busy;
3. before an action (send, quick action, Undo, add files, Help);
4. inside every save: a save that finds the period has passed expires the workspace instead of writing, so a late draft or result can never renew it (`WorkspaceExpiredError`).

Expiry publishes a new empty **deletion epoch** with no predecessor, exactly like Start over, then removes and verifies removal of the old files; it never falls back across that epoch. A clock earlier than the last activity or save time by any amount (no tolerance, since the first review), or an invalid clock, means the age is unknown: the workspace is blocked (`clock`) and left untouched, never deleted early or silently extended. Keep until I delete it never depends on the clock. atePDF cannot delete anything while it is not running; the dialog says so.

**Delete when atePDF quits.** Choosing it (after a confirmation) publishes a new empty epoch whose checkpoint holds only the preference, and removes the saved workspace *before* the session continues in memory. From then on saves write nothing. Quitting, a crash and a force quit therefore all look the same at the next launch: an empty workspace, still in quit mode. Closing a window, minimizing or backgrounding does nothing to the session. Switching back to a durable mode saves the current session only, with its own activity time; the epoch before the switch is never reachable again. A quit-mode checkpoint that contains workspace content is rejected by the schema.

**Storage usage.** `WorkspaceVaultBackend.usage()` (Swift `AtepdfWorkspaceVault.usage()`, `workspaceUsageAsync`) returns the on-disk size of each regular workspace file, measured with `lstat` inside the private workspace root only: symbolic links are not followed or counted, and a directory that cannot be read is an error, never zero. The vault classifies the files:

| Row in the dialog | What it counts |
| --- | --- |
| Imported PDF copies | Encrypted blobs of originals referenced by the current or fallback generation |
| Results | Encrypted result blobs referenced by the current or fallback generation |
| Conversation, drafts and page text | Head and referenced manifests (chat, draft, per-page text from local inspection/OCR, workspace metadata) |
| Waiting to be removed | Unreferenced manifests/blobs whose removal is still pending, and interrupted staging files |
| Saved workspace atePDF couldn’t open | Everything, when the workspace is blocked or unavailable |
| Temporary files and previews | Files under atePDF’s private Caches folders: `atepdf-work` (processing and export hand-off), `atepdf-preview(s)` and `DocumentPicker` import copies |

External originals and files the user saved are outside these roots and are never listed. Sizes are file sizes (not allocated blocks), stated as “Sizes of the files atePDF keeps in its own storage on this Mac”.

**Delete local data.** One destructive action with a confirmation that lists what goes (saved conversation, drafts, imported copies, results, page text, previews, temporary files; the setting returns to the default) and what does not (files added from elsewhere, PDFs the user saved), and says it is not secure erasure and does not remove copies in other apps’ backups. It:
1. stops and joins active work first (planning aborted, job cancelled; a commit already saving finishes or is withdrawn; in-flight handlers finish) — `JobController.settle()`;
2. on an open workspace publishes a new empty epoch first (same crash-safe path as Start over), then removes and verifies everything older;
3. on a workspace that **could not be opened** (missing key, damage, newer version, clock) removes the head first and proceeds only once that removal is confirmed (unlink + directory sync), so any later crash leaves stored files without a head, which launch keeps blocked and never restores; then removes every manifest, blob and staging file and starts a fresh workspace (genesis head) when the key allows;
4. then removes temporary files (only now nothing can be reading them);
5. advances an in-memory save fence, so a save requested before the deletion can never land in the new workspace — including after a blocked workspace is replaced by a new one whose epoch restarts at 0.

Feedback is truthful: “deleted” only when removal was verified; otherwise it says encrypted files remain and will be retried (at later saves and at launch, per SHR-39), or that temporary files will be removed at next launch; a failure before anything was removed says nothing was removed. The button waits while a save to the user’s own location is in progress and until the saved workspace has finished opening.

**Startup cleanup.** `DocumentPicker` import copies left by an interrupted import are now removed at launch with the other private temporary folders (ADR 0010 temporary-work cleanup).

## Decisions to review

- **No schema version bump.** `schemaVersion` stays 1. A quit-mode checkpoint is now allowed when it holds no workspace content, and the head gains an optional `retention` field. SHR-39 (unreleased) readers treat either as `corrupt`: blocked, nothing deleted.
- **Start over keeps the setting; Delete local data resets it.** Resetting on Start over would silently weaken a user’s privacy choice (for example 7 days → keep forever).
- **Key not rotated or removed.** The Keychain key is kept across Delete local data (ADR 0010’s “retired key” removal is not implemented; SHR-40’s brief excludes key rotation beyond strict need). The epoch fence and head-first wipe already prevent resurrection; leftover encrypted files stay decryptable with that key until removed.
- **Browser test hook.** `apps/universal/src/platform/workspace.web.ts` and `temporary.web.ts` read `globalThis.__ATEPDF_TEST_WORKSPACE__` if a test installs it before load. The web app never creates one; without it the web build keeps its unchanged session-only behaviour (the existing dialog and all existing browser specs are unchanged).

## Commands and results

Each `node` command used the Codex bundled Node runtime (`v24.19.0`), run from the worktree root. Tested sources (SHA-256 prefix, review-fix revision): `workspace-vault.ts` `d464e3b82befa2ef`, `workspace-checkpoint.ts` `61d008941cc318fe`, `workspace-checkpoints.ts` `3bde81d5229fd02b`, `job-controller.ts` `c87a3e2288c5f559`, `App.tsx` `8e82fca4bd535136`, `PrivacyStorage.tsx` `03b00c7cf0a8e956`, `AtepdfWorkspaceVault.swift` `e3d8a13a683455a5`.

| Command | Result |
| --- | --- |
| `node --import tsx --test tests/regressions/workspace-retention.test.ts` | **28/28 passed** (24 first round + 4 review regressions); [retention.log](retention.log). With the SHR-39 suite: **61/61**; [persistence-retention.log](persistence-retention.log). Focused review regressions (`--test-name-pattern="P1-"`): **5/5**; [p1-review.log](p1-review.log) |
| `node --import tsx --test tests/regressions/*.test.ts` | **137/137 passed** (109 existing, including all 33 SHR-39 persistence tests unchanged, + 28 SHR-40); [core.log](core.log). The private-TLS beta test binds `127.0.0.1` normally on this host. |
| Mutation checks (ignored `.build/mutate.py`): 19 deliberate weakenings of `workspace-vault.ts`, each run against the SHR-40 suite, then restored | **19/19 caught**; [mutations.log](mutations.log). They include: no save fence after a wipe; quit mode still writing; a setting change counted as activity; age checked only after PDFs load, or never after load; no clock check; a save that does not check expiry; Delete local data keeping the setting; unreferenced files counted as workspace; switching to quit keeping the workspace; wiping after an unconfirmed head removal; fallback keeping the older manifest setting; expiry measured from `savedAt`. |
| `node --import tsx tests/native/apple/workspace/run.ts` | Exit 0; **66 checks** (55 SHR-39 + 7 staging-cleanup checks from the review round + 4 storage-usage checks: a never-created root uses nothing; each sealed file’s size and staging are reported and nothing else — a symlink to a 1 MB user file and an unrelated file are ignored; the user file’s hash is unchanged; an unreadable directory is an error, never zero); [native-workspace.log](native-workspace.log) |
| `node node_modules/typescript/bin/tsc --noEmit -p apps/universal/tsconfig.json` | Exit 0 |
| `node node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json` | Exit 0 |
| `node scripts/contracts.mjs`, `assets.mjs`, `build-gateway.mjs`, then `expo export --platform web` | Exit 0; [web-export.log](web-export.log). `contracts.mjs` rewrote two generated validator files by one line each; reverted, not part of this change. |
| `expo export --platform ios` (output in ignored `.build`) | Exit 0; [ios-export.log](ios-export.log). Compiles the native JS bundle, including `temporary.native.ts` and `workspace.native.ts`. |
| Playwright, **all** specs in `tests/e2e`, against the fresh export on `localhost:43301` (temporary list-reporter config; `ATEPDF_BASE_URL` set so the workflow spec’s egress check uses that origin) | **59/59 passed** (52 existing + 7 in `retention.spec.ts`, including the 2 P1-1 delayed-completion tests and the unmeasurable-temporary test); [browser.log](browser.log). Existing specs rewrite tracked `docs/evidence/*` screenshots and PDFs; those were reverted after each run. |
| `scripts/native/mac-build.sh` | **Built**; strict signature and sandbox entitlement checks passed. The ad-hoc app launched, wrote no workspace (no Keychain key on ad-hoc builds) and was terminated; [mac-catalyst.json](mac-catalyst.json) |

Screenshots of the shared UI (browser, synthetic backend): [privacy-storage.png](privacy-storage.png), [confirm-quit-mode.png](confirm-quit-mode.png), [confirm-delete.png](confirm-delete.png).

**Browser spec** (`tests/e2e/retention.spec.ts`, synthetic in-memory backend persisted in `sessionStorage` so a reload is a relaunch, fake clock):
1. The four approved options in order, with Keep until I delete it checked by default. ⌘, opens the dialog; Tab reaches the options; Space and Enter choose one; the finite-mode note appears; Escape closes; the choice survives a relaunch; usage is shown by category, including temporary files.
2. Delete local data: the confirmation lists what goes and what stays and says it isn’t secure erasure; focus lands on Cancel; Cancel changes nothing. Delete removes every blob, leaves one empty manifest, resets the setting, clears temporary files and the conversation; nothing returns after reload; a second delete is harmless.
3. Delete when atePDF quits: confirmation; the saved copy is removed; the open session stays and keeps working without writing anything; after reload the workspace is empty and the setting is kept; switching back to Keep saves new work, which then survives reload.
4. 7 days: after 8 idle days the next action (Merge) deletes the workspace first and says why; nothing returns after reload. With Keep, idle 10 days, choosing 7 days asks first (“hasn’t changed for 10 days”); Cancel keeps everything; confirming deletes it.

**Node regressions** (`tests/regressions/workspace-retention.test.ts`): real synthetic PDFs through the real engines and the SHR-39 Node vault backend. External originals are copied into a separate temporary “user” folder and a result is saved there as the user’s export; both are hashed before and after.

| Required coverage | Test(s) |
| --- | --- |
| Default Keep until I delete it | `the default is Keep until I delete it: no age expiry…` (400 days closed, still restored) |
| 7-day expiry, fake clock | `7 days: expiry is measured from the last change, not from launches…` (6 days plus a passive launch, and 7 days − 1 min, both restore; 7 days expires; only the new empty epoch is left, with no predecessor; external files byte-identical; no resurrection later) |
| 30-day expiry, fake clock | `30 days: a change renews the age…` |
| Expiry while running, late saves | `while atePDF runs…` (a draft save after the period expires the workspace instead of renewing it), `expireIfDue expires at once; saves queued behind it are refused…` |
| Shorter setting; a setting change is not activity | `a shorter setting applies to the existing age at once…` |
| Clock failure | `a clock earlier than saved times fails closed…` (blocked, files byte-identical, saves refused, 1-minute skew tolerated, NaN clock blocked, Keep unaffected) |
| Delete when atePDF quits | `Delete when atePDF quits clears durable state first…`, `a crash while switching to Delete when atePDF quits never brings back the earlier workspace` |
| Ephemeral → durable | `switching from Delete when atePDF quits back to a durable mode saves only the current session` (its own activity time, no pre-quit blob, recognized secret redacted, fallback is the empty quit generation) |
| Relaunch after clear; reset to default | `Start over keeps the retention setting; Delete local data resets it…`, `Delete local data removes every managed file…` (only head and new manifest remain; corrupting the new epoch blocks rather than falling back) |
| Repeated deletion | `repeated Delete local data and Start over are safe and idempotent` |
| Active-work / delete race | `Delete local data joins active work: a running job is cancelled first…`, `a job already saving its commit settles before Delete local data, which then removes it` |
| Workspace that can’t be opened | `Delete local data works when the saved workspace cannot be opened (missing key, damage, newer version)` (a save queued behind the delete is refused with `StaleSaveError`), `deleting an unopenable workspace removes the head first and reports failure truthfully` |
| Permission/storage failures, incomplete cleanup | `a failed Delete local data on an open workspace removes nothing and says so` (ENOSPC), `permission and storage failures during deletion leave cleanup pending…` (real `chmod 000`; finished at relaunch; a usage failure is an error, not zero) |
| Deletion epoch safety | The expiry, quit and delete tests above, plus `an expired workspace reached through the same-epoch fallback is expired, not restored` (the head’s setting wins; a head disagreeing with its manifest is refused) and `an expired workspace is deleted even when one of its PDFs is missing or damaged` |
| Storage usage excludes external files | `storage usage counts only atePDF-managed workspace files, by category…` (totals equal the files on disk; a 5 MB file written to the user folder changes nothing; pending, quit and blocked categories) |
| Secret-retention protections | `retention changes keep SHR-71 protections…` (no recognized secret in any file or decrypted manifest after five mode changes, including quit and back), plus all SHR-39 secret tests unchanged |
| Schema | `a quit-mode checkpoint may hold the preference only` |

## Not verified here

- **Mac UI.** The panel was not inspected inside the Catalyst app this session: background window capture failed, the full-screen prompt was not answered and an accessibility query timed out (see [mac-catalyst.json](mac-catalyst.json)). Keyboard and focus behaviour is verified in the shared UI through the browser; Mac Full Keyboard Access and VoiceOver are not.
- **A working Mac vault.** As in SHR-39, the ad-hoc build cannot get a Keychain key, so it is session-only. There the panel shows the “can’t save your workspace” note, and Delete local data removes only temporary files. Retention, expiry, quit mode and deletion against the real container and Keychain need a signed build (SHR-41 / SHR-91).
- **Real-app failure and crash injection.** Deletion and expiry failures were injected through the Node backend and a real `chmod` in temporary directories, not in the running app. Forced termination at each deletion step on the Mac is SHR-41.
- **Temporary-file accounting.** Since the review round, sizes come from Expo’s `File.info()`; if any size is unknown the total is shown as “At least …”. This is verified in the browser with the synthetic backend, not against real Caches folders.
- **Not applicable yet.** The app has no unlock/decrypted-PDF feature, diagnostics cache or usage allowance, so there is no decrypted-copy, diagnostics or zero-allowance path to test. The new controls do not depend on AI, planning or any allowance.
- **Expiry needs atePDF running.** Nothing is deleted while atePDF is closed; expiry happens at the next launch, and the dialog says so. There is no timer while the window stays in front and idle; checks run at launch, on return to atePDF, before an action and at each save.
