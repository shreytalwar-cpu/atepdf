# Measurement, recurring work and incident runbooks
Use existing PM03/PM10–12/PM17–24 and the application ledger. This is not permission to build a second warehouse or to collect new customer content.

## Shared identifiers
Carry safe experiment, creative, landing and preset IDs through the marketing journey where permitted. Keep provider transaction IDs in the financial system; do not expose them publicly. Name versions consistently. No raw user instructions, file names, local paths, document categories inferred from content or identity-based secrets in URLs/events.

## Three reconciliations
1. Media: delivered spend -> actual billed taxes/fees -> settled cash, with currency and reporting timezone.
2. Buyers: verified first payment -> refund/chargeback -> active entitlement. Separate recurring payments and restores.
3. Contribution: actual net receipts minus channel fees, refund handling, service reserve and acquisition cost. Distinguish annual cash from earned revenue.

PostHog measures explicit product events; RevenueCat/provider data explains purchases. Neither a trial nor an import is a paying customer. The old workbook figures remain assumptions. Where public tools disagree, keep both observations and investigate definitions rather than inventing a reconciliation.

## Time and attribution
Normalize time in UTC while retaining provider account timezone and currency. Fix a seven-day click operating view and a 30-day cohort view for this initial test, where permitted data exists. Use the same mature observation window for comparisons. Unknown attribution stays unknown. Do not fingerprint users to make a report complete or sum multiple platforms' claims for one order.

Do not overwrite a first-source field with every last click. Separate experiment assignment from marketing consent. An attribution field can be absent and the product must still work. Store only the allowed context; no third-party replay in the workspace.

## The key warning from the economics
An annual-only CAC ceiling is not suitable for a campaign whose buyers include monthly subscriptions. Compute the ceiling from actual offer mix and contribution. Track paid-channel CAC separately from blended CAC. Include the source/render/creator cost once. The INR 40,000 campaign envelope does not grow when a new tool is selected.

## Reporting operations
Manual report first: Codex reads approved exports or permitted live reports, validates timestamps/IDs/currencies, calculates the scorecard and proposes keep/change/pause. A future scheduled report requires a real approved scheduler, credentials scoped for reading, a timezone, dedupe key and failure alert. No scheduler or background work is enabled by this ZIP.

Suggested later cadence is a daily anomaly summary while ads run and a weekly decision memo. The output is a recommendation. Budget, publishing, pricing and bulk-email changes are not automatic. If no live data is available, output “not connected/no actuals”, not a fabricated report.

## Incident playbooks
**Privacy issue:** suspend affected telemetry and processing path, recommend/execute only an already-authorised protective ad pause, preserve sanitised diagnostic evidence and notify the owner. Do not copy customer files to an external tool to investigate.

**Bad output or misleading creative:** remove the unsupported claim from drafts immediately, flag live assets to the owner, pause affected delivery with authority, fix/test the capability, review the claim before relaunch.

**Spend discrepancy:** identify account/timezone/tax versus platform media, check simultaneous campaigns and pending scheduled posts. Never “fix” a discrepancy by silently raising the cap. Report invoice delay and attribution uncertainty.

**Tracking outage:** keep the product usable, mark cohort data incomplete, and recommend holding new spend rather than optimising on fabricated zeros. Never backfill consent.

**Purchase/access defect:** verify provider events, restore entitlement where authorised, avoid duplicate charges, hold acquisition and promotional messages to affected users.

**Connector failure:** log redacted error, stop writes, try an approved read-only export if permitted, continue independent local tasks. Do not grant broader credentials solely to bypass failure.

## Experiment discipline
One primary metric and one decision window per experiment, with guardrails for delivery, consent, refund and support. Small samples are directional. Do not repeatedly peek until a favourable number appears or claim causality from ad-library data. Record price/page/market changes and treat incomparable cohorts separately. Owner signoff is required for a new market or spend tranche.
