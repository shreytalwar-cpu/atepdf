# SHR-85 evidence — seller, direct payments and cross-channel account ownership (30 September 2026)

**Source:** `origin/main` `785397328a9871e013cb6b351881cc6507872b6f`.  **Decision record:** [ADR 0014](../../adr/0014-seller-payments-account-ownership.md) (partially approved 30 September 2026: SELL-2 to SELL-10 approved, SELL-1 pending owner facts, awaiting Apple and Setapp responses; revision 2 applies the owner-authorized cross-review corrections S85-01 to S85-03). Guest, installation, session and account-lifecycle mechanics are defined once in ADR 0016 section 4 (SHR-79, consumer AI service; formerly numbered 0014 on its own branch).

| File | Content |
|---|---|
| [seller-account-cases.json](seller-account-cases.json) | The 57 acceptance cases from ADR 0014 section 18 (guest identity, App Store, direct, cross-channel/double subscription including unknown other-channel ownership X07–X11, purchase relink/recovery authorization R01–R08, Setapp, shared installation lifecycle I01–I07 mapped to ADR 0016 cases, migration, device policy) and the approved policy constants (legal seller pending SELL-1), for SHR-86/87/88/89 tests to consume. Generated from the ADR table, so IDs and wording match it exactly. Policy cases only; they are not evidence that anything is implemented. |

## Research performed

- Primary-source web research on 30 September 2026: Apple App Review Guidelines, Developer Program License Agreement, StoreKit 2 / App Store Server API / Server Notifications documentation, Apple Developer enrolment and app-transfer help; Paddle, Stripe, Lemon Squeezy and Polar pricing, help-centre and developer pages; public docs.setapp.com pages and Setapp support. Every source is listed with its tag in ADR 0014 section 19, together with the items that could **not** be verified from a primary source.
- Pages were read without signing in. Stripe pricing pages geolocated to the India/UAE variants; US figures were not verified. Setapp portal-only terms were not read.
- Repository inspection: `packages/commerce` (disabled synthetic contracts, `subject_<32 hex>` references), `docs/MONETIZATION.md`, `docs/COMMERCE_SANDBOX.md`, historical `atepdf_codex_build_pack/growth/PAYWALL_AND_BILLING.md`, ADR 0011 (Setapp ENV-7) and ADR 0012 (H-09, N-07).

No company was incorporated. No Apple, Paddle, Stripe, Lemon Squeezy, Polar or Setapp account was created, signed into or changed. No Terms were accepted. No product, price, checkout or transaction was created. No credential was used. No runtime behaviour or test changed.
