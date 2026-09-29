# Monetization

Frozen factual record, 29 September 2026. **There is no working purchase/subscription integration.**

`packages/commerce/src/entitlement.ts`, `pending-job.ts` and `policy-sources.ts` implement provider-neutral synthetic state and reconfirmation contracts. Runtime commerce is disabled, commercial actions remain unavailable, and active app code does not import this package. Eight existing synthetic cases are not StoreKit, payment-provider or subscription sandbox transactions.

No live price, approved quota, paywall UI, checkout, receipt/server verification, restore purchase, renewal/refund/revocation flow, production purchase SKU or account entitlement integration is established. The bounded OpenAI development request allowance is provider-spend authorization, not the product's pricing model.

## Approved v1 target

[PRODUCT_V1.md Section 12](PRODUCT_V1.md#12-guest-allowance-accounts-and-pro) governs the commercial model: useful limited guest use without mandatory signup or consumer API keys; atePDF supplies AI; no registration top-up; monthly/annual paid Pro; allowance exhaustion blocks new processing/AI work. Access, preview/export of existing results, retained-result recovery/Undo, deletion, privacy controls and subscription management remain available. Commercial entitlement, technical safety and provider-cost controls are distinct.

These are requirements, not a working paywall or entitlement service. Exact guest allowance/reset/accounting, prices/currencies/Pro limits, failure/refund policy, direct-payment provider, legal seller, account linking and cross-channel recognition remain OPEN-02–04/09/10. Both Mac App Store and direct distribution are approved targets (Section 15); no live billing, publication or spending is authorized.

## Historical decision inputs

Commercial hypotheses and approval gates remain in the original pack, particularly [MONETIZATION_HYPOTHESIS.md](../atepdf_codex_build_pack/growth/MONETIZATION_HYPOTHESIS.md), [PAYWALL_AND_BILLING.md](../atepdf_codex_build_pack/growth/PAYWALL_AND_BILLING.md), [MODEL_RECONCILIATION.md](../atepdf_codex_build_pack/growth/MODEL_RECONCILIATION.md) and their retained model/task references. [COMMERCE_SANDBOX.md](COMMERCE_SANDBOX.md) records the narrow implementation boundary. No hypothesis becomes an approved product decision by being copied into this canonical index.

Earlier handoff numeric prices/quotas, free-tier variants and optional billing defaults are superseded wherever incompatible with v1 D-03/D-07–09 and BILL-01–10. They remain historical hypotheses, not approved numbers or launch policy. Subscription cadence and company AI cost ownership are now settled; payment/account implementation, offline policy and legal details remain open as indexed above.

Keep retained M6 and G commercial/lifecycle tasks. Do not add a duplicate monetization roadmap, provision products, contact customers, publish prices or perform live billing without explicit bounded authority. No user migration is part of the fresh build.
