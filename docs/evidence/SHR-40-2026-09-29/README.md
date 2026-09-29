# SHR-40 — retention settings, storage usage and safe local deletion

Base: `origin/main` at `c11a19e24b82de171cd7e74b3e7e5fcbe6ac2e74` (SHR-39 merge), branch `shreytalwar/shr-40-add-retention-settings-storage-usage-and-safe-local-deletion`. Implements the retention policy already approved in ADR 0010 / SHR-38 on top of the SHR-39 vault. No new retention modes, no new dependency, no cloud, no key rotation, no secure-erase claim. Synthetic/local data only; no provider, paid or network calls.

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

Expiry publishes a new empty **deletion epoch** with no predecessor, exactly like Start over, then removes and verifies removal of the old files; it never falls back across that epoch. A clock earlier than the saved times by more than 5 minutes, or an invalid clock, means the age is unknown: the workspace is blocked (`clock`) and left untouched, never deleted early or silently extended. Keep until I delete it never depends on the clock. atePDF cannot delete anything while it is not running; the dialog says so.

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

Each `node` command used the Codex bundled Node runtime (`v24.19.0`), run from the worktree root. Tested sources (SHA-256 prefix): `workspace-vault.ts` `67156a097e7d283a`, `workspace-checkpoint.ts` `61d008941cc318fe`, `job-controller.ts` `c87a3e2288c5f559`, `App.tsx` `0518145625e3c4a4`, `PrivacyStorage.tsx` `bc4a6918f103ac03`, `AtepdfWorkspaceVault.swift` `ab94c0bb08caea91`.

| Command | Result |
| --- | --- |
| `node --import tsx --test tests/regressions/workspace-retention.test.ts` | **24/24 passed**; [retention.log](retention.log) |
| `node --import tsx --test tests/regressions/*.test.ts` | **133/133 passed** (109 existing, including all 33 SHR-39 persistence tests unchanged, + 24 SHR-40); [core.log](core.log). The private-TLS beta test binds `127.0.0.1` normally on this host. |
| Mutation checks (ignored `.build/mutate.py`): 13 deliberate weakenings of `workspace-vault.ts`, each run against the SHR-40 suite, then restored | **13/13 caught**; [mutations.log](mutations.log). They include: no save fence after a wipe; quit mode still writing; a setting change counted as activity; age checked only after PDFs load, or never after load; no clock check; a save that does not check expiry; Delete local data keeping the setting; unreferenced files counted as workspace; switching to quit keeping the workspace; wiping after an unconfirmed head removal; fallback keeping the older manifest setting; expiry measured from `savedAt`. |
| `node --import tsx tests/native/apple/workspace/run.ts` | Exit 0; **59 checks** (55 SHR-39 + 4 new storage-usage checks: a never-created root uses nothing; each sealed file’s size and staging are reported and nothing else — a symlink to a 1 MB user file and an unrelated file are ignored; the user file’s hash is unchanged; an unreadable directory is an error, never zero); [native-workspace.log](native-workspace.log) |
| `node node_modules/typescript/bin/tsc --noEmit -p apps/universal/tsconfig.json` | Exit 0 |
| `node node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json` | Exit 0 |
| `node scripts/contracts.mjs`, `assets.mjs`, `build-gateway.mjs`, then `expo export --platform web` | Exit 0; [web-export.log](web-export.log). `contracts.mjs` rewrote two generated validator files by one line each; reverted, not part of this change. |
| `expo export --platform ios` (output in ignored `.build`) | Exit 0; [ios-export.log](ios-export.log). Compiles the native JS bundle, including `temporary.native.ts` and `workspace.native.ts`. |
| Playwright, **all** specs in `tests/e2e`, against the fresh export on `localhost:43301` (temporary list-reporter config; `ATEPDF_BASE_URL` set so the workflow spec’s egress check uses that origin) | **56/56 passed** (52 existing + 4 new in `retention.spec.ts`); [browser.log](browser.log). Existing specs rewrite tracked `docs/evidence/*` screenshots and PDFs; those were reverted after each run. |
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
- **Temporary-file accounting.** It uses Expo’s `File.size`, which reports 0 for a file it cannot read, so an unreadable temporary file would be under-counted rather than reported as unmeasurable.
- **Not applicable yet.** The app has no unlock/decrypted-PDF feature, diagnostics cache or usage allowance, so there is no decrypted-copy, diagnostics or zero-allowance path to test. The new controls do not depend on AI, planning or any allowance.
- **Expiry needs atePDF running.** Nothing is deleted while atePDF is closed; expiry happens at the next launch, and the dialog says so. There is no timer while the window stays in front and idle; checks run at launch, on return to atePDF, before an action and at each save.
