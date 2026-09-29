# SHR-39 — protected local workspace checkpoint and restore

Base: `origin/main` at `4c22232b67345be7a19712c46fe6b49e1a43505a` (clean), branch `shreytalwar/shr-39-checkpoint-and-restore-the-previous-mac-workspace-locally`. Implements the approved ADR 0010 contract; no redesign, no database, no new dependency. Synthetic/local data only; no provider, paid or network calls.

Tested source SHA-256: `workspace-checkpoint.ts` `444387e6…329c`, `workspace-vault.ts` `2835f3f6…595c`, `job-controller.ts` `4309e6fd…f38`, `local-file-store.ts` `5e26d8e2…d68a`, `App.tsx` `9dbb75ce…3e`, `AtepdfWorkspaceVault.swift` `c58e1f97…cca`, `AtepdfPdfModule.swift` `5a054302…bd2`.

## What was implemented

- **Schema** (`packages/core/src/workspace-checkpoint.ts`): strict allowlisted v1 checkpoint — schema version, workspace ID, generation, revision, deletion epoch, saved/last-activity time, retention mode (`keep` default; a durable `quit` checkpoint is rejected), artifacts with size/SHA-256/inspection/blob generation, ordered originals, result history, focus, one-Undo predecessor, selection, empty reserved `collections`, typed display-only conversation and inert draft. Unknown fields, broken references, repeated refs/IDs and future schema versions are rejected.
- **Vault** (`packages/core/src/workspace-vault.ts`): one serialized coordinator. Save order: new immutable blobs → verify → complete manifest → verify → atomic head replacement (commit point) → collect everything not referenced by the current or previous generation. Restore authenticates head, manifest and every blob, checks size and SHA-256, and falls back only to the preceding generation of the same deletion epoch. Corrupt, missing-artifact, missing/locked/wrong key and future-schema cases open a blocked state that writes nothing. Clearing publishes a new deletion epoch with no predecessor before deleting old files. A head write that may have landed but fails verification is reverted to the last acknowledged head (or writing stops). SHR-71’s `safeOrdinaryText` is applied again to every persisted free-text field; a draft that the guard would change is not saved.
- **Controller/store**: `JobController` publishes import, transform and Undo results only after the durable save succeeds; on failure it withdraws the change (`LocalFileStore.mark/rollback`, revision still advances) and reports `STORAGE_WRITE_FAILED`. Cancellation cannot interrupt a save. `restore()` re-reads every saved PDF with the local engines, compares page geometry, then hydrates; the restored revision is advanced so pre-relaunch requests are stale. Chat/draft saves use `durableState(false)` so they never make an unconfirmed commit durable early. Without durability hooks, existing behavior is unchanged.
- **Mac native** (`AtepdfWorkspaceVault.swift`, module functions Catalyst-only): Application Support `atepdf/Workspace`, `ATW1` + CryptoKit AES-256-GCM combined box with role/workspace/ref/generation associated data, random 256-bit key in the Data Protection Keychain (`kSecAttrSynchronizable=false`, `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`), key never sent to JavaScript and never replaced over an existing workspace. Writes stage in the same volume, `F_FULLFSYNC`, `rename`, directory `fsync`; directories 0700, files 0600, workspace excluded from backup (reasserted after replacement); symlinks not followed.
- **App** (`App.tsx`): restores on launch before the composer mounts (conversation, current/earlier result cards, inert draft), never re-arms questions, pending clarification, planner requests/envelopes, confirmations, jobs or connection tokens, and makes no planner/status call during restore. Shows a one-line notice for blocked/unavailable/recovered states (retry offered only for retryable key/storage states before new work). Web and iOS keep session-only behavior (`createWorkspaceBackend()` returns null).

## Commands and results

Each `node` command used `PATH=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH`, run from the worktree root.

| Command | Result |
| --- | --- |
| `node --import tsx --test tests/regressions/workspace-persistence.test.ts` | **14/14 passed**; [persistence.log](persistence.log) |
| `node --import tsx --test tests/regressions/*.test.ts` | **90/90 passed** (76 existing + 14 new); [core.log](core.log) |
| `node --import tsx tests/native/apple/workspace/run.ts` | Exit 0; **40 Swift checks + TS↔Swift interop**; [native-workspace.log](native-workspace.log) |
| `node node_modules/typescript/bin/tsc --noEmit -p apps/universal/tsconfig.json` | Exit 0 |
| `node node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json` | Exit 0 |
| `node scripts/assets.mjs` then `expo export --platform web` (from `apps/universal`, output in session scratch) | Exit 0; [web-export.log](web-export.log) |
| Playwright `tests/e2e/planner.spec.ts tests/e2e/local-actions.spec.ts` against that export on `127.0.0.1:43291` (temporary config, mocked planner routes) | **28/28 passed**; [browser.log](browser.log). A first run failed 25/28 only because the export lacked the generated `/engines` worker; fixed by running `scripts/assets.mjs` (ignored output). |
| `scripts/native/mac-build.sh` | **BUILD SUCCEEDED**, Release Mac Catalyst arm64, strict signature verification passed; [mac-catalyst.json](mac-catalyst.json) |
| `git diff --check` | Exit 0 |

Persistence tests (real fixture PDFs through the real web-pdf engine and PDF.js inspection, temp directories, in-memory Keychain stand-in): quit/relaunch round trip of bytes/hashes, original order, history, focus, Undo predecessor, conversation, draft, revision/generation; one Undo after relaunch is durable; inert restore with `fetch` stubbed (0 calls), 0 transform calls and stale pre-relaunch plan rejected; no canary/password/token/`requestId`/planner fields in the decrypted manifest and no plaintext on disk; storage write failure withdraws import/transform/Undo; interrupted writes at four boundaries restore the previous generation and orphans are collected; truncated/corrupt manifest fallback only within an epoch, both-damaged fails closed with no writes; missing, corrupt, swapped and validly-sealed-but-wrong-hash blobs fail closed; future schema refused without downgrade writes; locked/unavailable/missing/wrong key fail safely and no replacement key is created; clear publishes a new epoch and never falls back across it; blobs are immutable and two generations retained; headless leftovers fail closed. Mutation checks (removing redaction, fallback, hash check or rollback) each made the relevant test fail.

## Mac/native checks actually run

- Host Swift harness compiled the shipped `AtepdfWorkspaceVault.swift` with `swiftc`: sealing format, AES-GCM authentication, associated-data binding, wrong/locked key, name validation, atomic head replacement, staging cleanup, symlink refusal, 0700/0600 permissions, backup exclusion flag, shipped Keychain query attributes and Swift↔TypeScript file interop.
- Live Keychain probe from the unsigned host tool: `SecItemAdd` → **-34018 (errSecMissingEntitlement)**, reported as `unavailable`. Not a pass or fail of the signed app.
- Real Mac Catalyst app (ad-hoc signed, exact staged path): launched, showed the “can’t save your workspace on this Mac” notice, sample import worked session-only, quit, no workspace directory written, relaunch restored nothing. This is the designed fail-safe on a build without a keychain access group.

## Not run / limitations

- **Successful durable restore inside the real Mac app was not verified.** The current ad-hoc development signing has no application identifier/keychain access group, so the Data Protection Keychain is unavailable and the app correctly stays session-only. A signed build with the final team/channel identity is required (SHR-41, SHR-91). Keychain item attributes as stored, backup exclusion on the real container, crash/force-quit at each write boundary, disk-full, sleep/wake and Keychain lock on the real app remain SHR-41 work.
- iOS/iPadOS and web intentionally stay session-only in this issue. No iOS export or device run was performed.
- Clear keeps the existing workspace key (key rotation/retirement, retention expiry, storage usage, and Clear History UI are SHR-40). If Start over fails to publish the new epoch, the chat is cleared in memory and a notice says the saved copy may reappear.
- PDF bytes cross the React Native bridge as base64 and every new blob is read back once to verify; large-workspace cost is unmeasured (SHR-43/SHR-34).
- Detection of secrets remains SHR-71’s recognized-pattern guard, not a guarantee for arbitrary free text. Saved PDF inspection text (document content) is encrypted but not redacted.
- Blocked state (corrupt/lost key/future schema) is read-only-for-disk: new work in that session is memory-only and is not saved until SHR-40 provides an explicit discard path.
