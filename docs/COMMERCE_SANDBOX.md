# M6-01 commerce foundation — disabled, synthetic contracts only

This continues retained M6-01 and the contract portions of G11–G15. F08 remains incomplete. No seller, account service, price, quota, product identifier, payment provider, checkout UI, networking or transaction verification was added. `COMMERCE_ENABLED` is a literal `false`, `commercialActionsAvailable()` always returns `false`, and the application does not import this package. Local PDF processing, previews and saved results remain independent of commerce.

## Implemented source

- `packages/commerce/src/entitlement.ts`: provider-neutral entitlement observation reducer, separate local checkout/restore activity, and time-bound domain access decisions.
- `packages/commerce/src/pending-job.ts`: local-only draft and validated-recipe snapshot, manifest/intent comparison, fresh request binding, and explicit confirmation contract. It never invokes the planner, PDF engine, purchase provider or a save operation.
- `packages/commerce/src/policy-sources.ts`: references to the unchanged owner handoff hypotheses and financial models, plus disabled lifecycle defaults. These references preserve the hypotheses as source data without copying tentative economics into application configuration.
- `tests/regressions/commerce.test.ts`: eight synthetic contract tests.

## Entitlement boundary

`VerifiedObservation` describes evidence that a **future authoritative verifier** would supply. The name and TypeScript shape do not verify a receipt, signature, account or provider response. No such verifier exists in this package. Synthetic tests construct these observations directly; they are not proof of a purchase or an active customer's access.

A future adapter must verify authenticity and account ownership, reconcile all relevant purchases, and assign a monotonic aggregate `verificationRevision` for each opaque account reference. Raw webhook delivery order, transaction date, a client `paid=true` flag, or the device clock cannot substitute for that verification. This foundation does not implement multi-provider purchase aggregation, account linking, transfer rules or signed offline entitlement caching.

The reducer rejects account mismatches, malformed observations, conflicting equal revisions, reused latest event identities and regressing verification times. Exact duplicates are idempotent; older revisions cannot restore access after a newer revocation. Active and grace access expire at the exact supplied boundary. A cancelled renewal retains access until verified expiry. Refunds are not automatically interpreted as revocation: a future verifier must map actual provider semantics into an authoritative observation.

Local `checkout_pending`, `verification_pending`, `restore_pending`, `cancelled` and `failed` activity cannot grant access or erase separately valid access. Receiving an account observation does not claim a particular checkout/restore flow completed. A later integration must resolve those activities explicitly. The domain access evaluator requires a trustworthy time value; it is not a production security gate, and it cannot enable the disabled application commerce path.

## Pending job boundary

Snapshots retain the user's draft locally and copy a complete validated request/recipe. The binding covers workspace revision, anonymous file versions and order, page/byte facts, selections, current result, originals, tested operations, available OCR languages and the intended instruction. It excludes file bytes, filenames, paths and checksums. **The snapshot still contains the user's draft/instruction and must never be sent to a billing provider, analytics or a support report.** There is no persistence or transmission adapter here.

Even an identical workspace produces `confirmation_required`, never automatic execution. Changes to the workspace, manifest or instruction produce `replan_required`. Confirmation checks the reviewed request identity and current binding again before returning a proposal. Any eventual execution still goes through the existing job controller's revision, capability, immutable-file, duplicate-request and independent-output-validation gates. Nothing in this contract charges a customer, records a completed job or consumes AI allowance.

## Verification and remaining gates

`node --import tsx --test tests/regressions/commerce.test.ts`: **8/8 passed**. Cases cover disabled commerce, preserved source references, pending/cancel/failure behavior, active/grace/expiry/revocation, duplicate/out-of-order events, account conflicts, mutable source isolation, local draft preservation, explicit confirmation and stale manifest/intent rejection.

`pnpm typecheck`: **passed**. These are synthetic domain/contract tests and a TypeScript check. They are **not StoreKit sandbox tests, provider receipt verification, an application purchase workflow, a native build or a commercial release approval**.

M6-02 still requires an approved platform sandbox, verifier/account design and actual transaction/lifecycle evidence. M6-03 still requires approved provider-backed offer data and actual accessible recovery UI. Production prices, allowance policy, purchasing products, seller identities, external deployment and migration retain their owner approval boundaries. The original handoff remains the source for commercial hypotheses and the existing roadmap.
