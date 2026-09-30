# SHR-85 evidence — seller, direct payments and cross-channel account ownership (30 September 2026)

**Source:** `origin/main` `ff3e29184b5bf039cc8938f71bbdb60f93f4ba7b`.  **Decision record:** [ADR 0013](../../adr/0013-seller-payments-account-ownership.md) (proposed; pending owner approval of SELL-1 to SELL-10).

| File | Content |
|---|---|
| [seller-account-cases.json](seller-account-cases.json) | The 37 acceptance cases from ADR 0013 section 18 (guest identity, App Store, direct, cross-channel/double subscription, Setapp, migration, device policy) and the proposed policy constants, for SHR-86/87/88/89 tests to consume once approved. Generated from the ADR table, so IDs and wording match it exactly. Policy cases only; they are not evidence that anything is implemented. |

## Research performed

- Primary-source web research on 30 September 2026: Apple App Review Guidelines, Developer Program License Agreement, StoreKit 2 / App Store Server API / Server Notifications documentation, Apple Developer enrolment and app-transfer help; Paddle, Stripe, Lemon Squeezy and Polar pricing, help-centre and developer pages; public docs.setapp.com pages and Setapp support. Every source is listed with its tag in ADR 0013 section 19, together with the items that could **not** be verified from a primary source.
- Pages were read without signing in. Stripe pricing pages geolocated to the India/UAE variants; US figures were not verified. Setapp portal-only terms were not read.
- Repository inspection: `packages/commerce` (disabled synthetic contracts, `subject_<32 hex>` references), `docs/MONETIZATION.md`, `docs/COMMERCE_SANDBOX.md`, historical `atepdf_codex_build_pack/growth/PAYWALL_AND_BILLING.md`, ADR 0011 (Setapp ENV-7) and ADR 0012 (H-09, N-07).

No company was incorporated. No Apple, Paddle, Stripe, Lemon Squeezy, Polar or Setapp account was created, signed into or changed. No Terms were accepted. No product, price, checkout or transaction was created. No credential was used. No runtime behaviour or test changed.
