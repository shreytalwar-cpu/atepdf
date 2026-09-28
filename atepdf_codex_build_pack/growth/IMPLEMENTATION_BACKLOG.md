# Lifecycle build order for Codex
Preserve the original 65-task engine/application backlog. These 30 tasks add commercial completeness. Do not implement fake billing screens before there is a genuine local result; do not wait for ad integrations to ship a working beta. A missing merchant credential blocks live purchase tests, not local UX work.

| ID | Priority | Workstream | Deliverable | Dependencies | Acceptance cases |
|---|---|---|---|---|---|
| G01 | P0 | Contract | Reconcile commercial assumptions and create safe disabled config | None | AC-46, AC-49 |
| G02 | P0 | UX | Workspace-first onboarding and deep-link entry | G01 | AC-01, AC-02, AC-03 |
| G03 | P0 | UX | Build real local sample fixture/recipe | G02 | AC-04 |
| G04 | P0 | Privacy | Cloud consent and withdrawal | G02 | AC-05, AC-06 |
| G05 | P0 | Privacy | Analytics payload boundary and backup exclusions | G01 | AC-07, AC-08 |
| G06 | P0 | Quota | Reservation, commit, release and window semantics | G01 | AC-09, AC-10, AC-11, AC-12, AC-15 |
| G07 | P0 | Quota | Partial job accounting and provider abuse controls | G06 | AC-13, AC-14 |
| G08 | P0 | Billing | Purchase adapter and verified entitlement schema | G01 | AC-25, AC-26 |
| G09 | P0 | UX | Contextual paywall and localized plan cards | G06, G08 | AC-16, AC-17, AC-18, AC-19, AC-20 |
| G10 | P0 | UX | Capability/allowance/error gates | G04, G07, G09 | AC-21, AC-22 |
| G11 | P0 | Billing | Checkout pending/cancel/failure/idempotency | G08, G09 | AC-23, AC-24 |
| G12 | P0 | Billing | Resume retained job after verified purchase | G10, G11 | AC-27 |
| G13 | P0 | Billing | Restore and identity-transfer collision handling | G08 | AC-28 |
| G14 | P0 | Billing | Renewal grace expiry refund state reconciliation | G08, G13 | AC-29, AC-30, AC-31 |
| G15 | P0 | Account | Optional linking and cross-platform access | G13, G14 | AC-32, AC-33, AC-34 |
| G16 | P0 | Account | Plan centre, management and cancellation | G14 | AC-35 |
| G17 | P0 | Account | Account deletion and separate local cleanup | G15, G16 | AC-36 |
| G18 | P0 | Reliability | Offline access and network recovery | G04, G14 | AC-37, AC-38 |
| G19 | P0 | Reliability | Save/share semantics and missing local history | G02 | AC-39, AC-40 |
| G20 | P1 | Retention | Saved recipe discovery/replay | G07, G10 | AC-41 |
| G21 | P0 | Support | Help and private diagnostics | G05 | AC-45 |
| G22 | P1 | Retention | System review scheduling and app sharing | G19 | AC-42, AC-43 |
| G23 | P2 | Retention | User-requested completion/routine reminders | G18 | AC-44 |
| G24 | P1 | Measurement | Funnel, cost and contribution report | G05, G08 | AC-49 |
| G25 | P1 | Experiment | Disabled experiment framework and stable assignments | G24, G09 | AC-46, AC-47 |
| G26 | P2 | Experiment | Optional provider trial spike after approval | G25, G14 | AC-48 |
| G27 | P0 | Design QA | Extend approved tokens across lifecycle states | G09, G16, G19 | AC-50, AC-51 |
| G28 | P0 | Release | Commercial claims, policy and asset review | G17, G21, G27 | AC-52, AC-35, AC-36 |
| G29 | P0 | Release | Cross-platform sandbox lifecycle test matrix | G12, G13, G14, G15, G18, G28 | AC-23, AC-24, AC-25, AC-28, AC-29, AC-30, AC-32 |
| G30 | P1 | Research | Reopen Appllama refs when media access works; record evidence | G01 | AC-50, AC-52 |

## Release gates
Beta: real first-use/task output, privacy gate, honest limits and functional secondary help. Paid launch: P0 lifecycle tasks, chosen-platform sandbox purchase/restore/refund evidence, recoverable identity, deletion and localized offer review. Pro recipes, larger batch claims and cross-device access only appear after their respective implementation tests pass. Later: bounded experiments, opt-in reminders and approved trial tests.

## Session instructions
Read existing progress and pick the next dependency-ready task. Implement, run tests, inspect UI and record evidence with IDs. Use installed native/web/build skills only when relevant; read source documents rather than guessing APIs. Refresh Appllama records with the exact source IDs; treat them as internal references, never runtime dependencies. No production campaign, paid SDK, live SKU or deployment action without explicit founder authorization.
