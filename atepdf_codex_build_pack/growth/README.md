# Growth and lifecycle implementation, v2

## Final v3 precedence
This growth package is retained in the final build handoff. Read `../DECISIONS_AND_PRECEDENCE.md` and `../STACK_DECISION.md` for the selected web foundation. Both financial workbooks and original model notes remain unchanged. Pricing, budgets and conversion remain hypotheses, with production disabled.

**28 September 2026 | atepdf | Commercial hypotheses, not live authorization**

The interface remains the product. This extension turns the existing build brief into a complete first-use, payment, repeat-use and self-service journey. It does not turn the app into a marketing funnel before the user can work.

## Read in this order
1. `MONETIZATION_HYPOTHESIS.md`: proposed offer, limits and decision gates.
2. `MODEL_RECONCILIATION.md`: differences between the two unchanged financial models.
3. `APPLLAMA_RESEARCH.md`: recorded patterns, evidence limitations, what to adopt and reject.
4. `ONBOARDING_AND_ACTIVATION.md`: workspace-first setup and genuine first result.
5. `PAYWALL_AND_BILLING.md`: contextual offer, purchase recovery and cross-platform entitlement.
6. `LIFECYCLE_AND_RETENTION.md`: the less visible flows that make a solo operation sustainable.
7. `ANALYTICS_AND_EXPERIMENTS.md`: measurement, attribution, costs and experiment discipline.
8. `COPY_DECK.md`, `SCREEN_AND_STATE_INVENTORY.md`, `IMPLEMENTATION_BACKLOG.md`.

`models/` contains the exact prior monetization and growth workbooks, notes and charts. Charts are scenario illustrations, not forecasts. Financial inputs are not runtime price configuration. Actual checkout uses verified store/provider product data.

`config/` contains proposed commercial configuration and a state inventory. `reference/growth_policy.py` is a tested, pure reference decision function, not production billing/security code. `tests/growth_policy_cases.jsonl` exercises it; `tests/growth_acceptance_cases.jsonl` specifies app and store tests that still require implementation.

`research/appllama/SOURCE_REGISTRY.json`, at the pack root, records 26 selected screen references from eight apps. The study used Appllama's screen names, flow order and UI-element metadata. Media downloads failed in this environment. No pixel review, live purchase, conversion test or complete competitor walkthrough is claimed. Codex can refresh the exact screen references in Appllama; asset access is not a prerequisite for building the already approved atepdf UI.

## Precedence
The latest user decisions and repository safety rules remain highest priority. These v2 documents clarify commercial/lifecycle requirements and supersede conflicting commercial defaults in the older notes, but do not override local processing, excluded features or approved atepdf art. Preserve the original engine architecture, contracts, tests and working source. Do not use the rejected PDFello or Melo concepts. Third-party screens are references, not licensed atepdf assets.

## Default journey
Workspace -> add files or try a real sample -> consent before first cloud instruction -> local execution -> validated result -> preview/save/share -> follow-up -> optional relevant Pro offer -> verified purchase -> resume the retained job.

No compulsory persona quiz. No hard launch paywall. No automatic subscription trial. No mandatory account before free value. No captive output. No repeated exit offers. No employee-heavy admin system.
