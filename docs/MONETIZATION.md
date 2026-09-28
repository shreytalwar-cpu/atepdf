# Monetization

Frozen factual record, 29 September 2026. **There is no working purchase/subscription integration.**

`packages/commerce/src/entitlement.ts`, `pending-job.ts` and `policy-sources.ts` implement provider-neutral synthetic state and reconfirmation contracts. Runtime commerce is disabled, commercial actions remain unavailable, and active app code does not import this package. Eight existing synthetic cases are not StoreKit, payment-provider or subscription sandbox transactions.

No live price, approved quota, paywall UI, checkout, receipt/server verification, restore purchase, renewal/refund/revocation flow, production purchase SKU or account entitlement integration is established. The bounded OpenAI development request allowance is provider-spend authorization, not the product's pricing model.

## Preserved decision inputs

Commercial hypotheses and approval gates remain in the original pack, particularly [MONETIZATION_HYPOTHESIS.md](../atepdf_codex_build_pack/growth/MONETIZATION_HYPOTHESIS.md), [PAYWALL_AND_BILLING.md](../atepdf_codex_build_pack/growth/PAYWALL_AND_BILLING.md), [MODEL_RECONCILIATION.md](../atepdf_codex_build_pack/growth/MODEL_RECONCILIATION.md) and their retained model/task references. [COMMERCE_SANDBOX.md](COMMERCE_SANDBOX.md) records the narrow implementation boundary. No hypothesis becomes an approved product decision by being copied into this canonical index.

Unresolved: seller, free/paid capability boundary, platform purchase policy, price/currency, taxes, subscription versus one-time access, AI cost ownership, offline entitlement behavior, refunds/restoration, legal terms and support. Existing defaults do not require signup, a launch paywall, trial, sync or payment for privacy; they are recorded disabled policy inputs, not a completed offer.

Keep retained M6 and G commercial/lifecycle tasks. Do not add a duplicate monetization roadmap, provision products, contact customers, publish prices or perform live billing without explicit bounded authority. No user migration is part of the fresh build.
