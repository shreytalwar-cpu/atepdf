# Cross-review fix pass, 30 September 2026

Addresses S44-01/02/03/04/05 and owner G5/G6. Cancelled pre-head saves leave attempt-owned orphans for later verified cleanup, without collecting any acknowledged generation. Reviewer repros A/C are permanent regressions. Aborted publication and failed withdrawal report that cancelled files may reappear after relaunch; storage notices survive invalidated ownership. Vault open is non-cancellable. Cancellation during PDF revalidation blocks saving visibly, offers retry while empty, and refuses to claim Start Over cleared a blocked durable workspace. Reopen is required before clearing that retained workspace.

Saved receipts stay bound to clear epoch, immutable ref and checksum through Undo/import/new results. Start Over clears receipts; the export lock is released only when the OS sheet settles. Imports clear pending clarifications (G5).

Local verification: 31 focused ownership/checkpoint/publication regressions passed; full suite 156 passed, one optional Python corpus skip; web and universal TypeScript checks passed; Expo web export passed; planner and ownership browser suites 21 passed. Synthetic fixtures and mocked transport only. Existing locked dependencies restored unchanged in this worktree. No live provider, signed Mac or distribution proof.

At rebase time origin/main was 785397328a9871e013cb6b351881cc6507872b6f. #83 was open, so no combined INT-05 implementation or acceptance is claimed. The second PR to land owns the heavy retention reconciliation and every combined test in Section C. INT-06 must preserve cancellation uncertainty, staged-map cleanup and page-verification clearing when #97 is incorporated.
