# Monetization hypothesis to implement and test
**Status: proposed policy. All production SKUs, offers, merchant contracts and spending need founder approval.**

## 1. The offer
Charge for repeated convenience and automation, not for privacy, undamaged outputs or the ability to retrieve a file already promised free. The cloud model interprets a request; deterministic local engines do the processing.

| Plan | India planning anchor | International planning anchor | Entitlement hypothesis |
|---|---:|---:|---|
| Free | Free | Free | Basic local quick actions and 3 completed AI jobs per monthly allowance window |
| Pro monthly | INR 249/month | USD 5.99/month | 300 completed AI jobs per monthly allowance window; supported larger batches; saved reusable recipes |
| Pro annual | INR 1,999/year | USD 39.99/year | Same Pro capability, billed annually; AI allowance still refreshes monthly |

The India anchors include an assumed 18% tax; international anchors are before local tax. They are economic inputs, not guaranteed prices in every store. Runtime must display localized, verified product price, billing interval, tax treatment and renewal terms from the actual purchasing provider. Select annual visibly by default in the initial design, keep monthly equally discoverable, and never call annual "most popular" without evidence. Any savings badge must be calculated from current comparable monthly and annual offers; the annual amount remains the dominant price.

Free quota defaults to a server-issued calendar-month window with a localized reset date. For Pro use a server-issued monthly allowance schedule anchored to first activation, including annual purchasers and short-month/end-of-month cases. Restoration, sign-out, plan switches and cross-device use must not silently multiply allowances. Keep renewal date and allowance reset date distinct. Dates are verified server facts, not inferred from the device clock. A future policy change needs versioning and fair handling for current subscribers.

## 2. What counts as one job
One successfully completed user intent is one debit even when it merges, OCRs and compresses a batch. Model calls, pipeline steps, local pages and retries are not separate customer credits. Clarifications do not debit. A voluntary follow-up that changes a completed result is a new intent; correction of an app-caused error is not. Free users must be allowed a real multi-step success, not only a read-only demonstration.

Reserve allowance atomically before calling the paid planner. Commit after local validation reports completion; release on cancellation or failure, with lease expiry and idempotency to avoid stuck reservations. A coupled workflow that fails is not charged as success. For an independent partial batch, require the user to accept the clearly identified successful subset before one debit; retry remaining members under the same job reservation. The server cannot independently verify arbitrary browser-local work, so customer-friendly success charging is not a security proof. Separate rate limits, signed budget leases, bounded provider retries and absolute spending caps protect the business from false failure reports and free-tier abuse.

Local quick actions and already compiled recipe execution do not need a model call. Recipe creation/replay may require Pro as a convenience entitlement, but should not burn an AI allowance when no new interpretation occurs. Basic manual quick actions remain usable offline. Expired users can inspect/export their recipe definitions and files; do not delete them to force renewal.

One optional, built-in synthetic sample recipe runs locally without consuming AI quota. If the user changes its instruction and invokes the cloud planner, obtain consent and apply the normal quota rules. Never label a cached scripted demo as live AI.

## 3. Upgrade moments
A quiet link after a useful result is acceptable; an unsolicited modal blocking that result is not. Show a paywall when a free user explicitly asks for Pro details, attempts a supported Pro convenience feature, or begins a new AI job after using the free allowance. Preserve files and draft. Explain the exact reason and remaining free alternatives.

A paying user at the Pro allowance limit sees the next reset date, local options and support, not "Buy Pro" again. A broken or unsupported engine shows an honest capability explanation, not a paywall that implies payment will fix it. A pending purchase shows verification status instead of another charge button.

## 4. Trial and product exclusions
Default launch: no auto-renewing trial, no card required for free tasks, no weekly subscription, no lifetime unlimited AI. The free experience is the initial evaluation path. A seven-day subscription trial may later be tested for eligible users with provider-backed terms and founder approval. The earlier INR 99/USD 2.99 seven-day nonrenewing pass remains a distinct, disabled hypothesis, not a trial or extra launch SKU. Team, lifetime, referral-reward and Setapp revenue assumptions are excluded from the base configuration.

## 5. Economics and acquisition gates
Use the supplied models, not competitor revenue labels, to set targets. The earlier starting annual-customer cash CAC targets are INR 400 India web, INR 350 India store, INR 900 international web and INR 800 international store. They include attributable creative/partner costs. Monthly customers have a separate payback calculation and cannot inherit an annual budget.

The initial six-week acquisition ceiling remains INR 40,000: 8,000 creative, 4,000 first diagnostic media, 8,000 replication, 12,000 conditional expansion and 8,000 held reserve. This is not authorization to run ads. Release spending only with an approved channel, cap, dates and evidence. Keep paid CAC separate from blended CAC. Measure refunds and contribution, not just purchases or installs.

Paid growth assumptions in the 36-month model are scenario inputs, not a spend schedule Codex should activate. Do not connect ad-account write permissions simply to complete this build.

## 6. Decisions still needed before paid launch
Founder approves actual regional prices, purchasing providers, free/Pro limits, store entitlements, product names and launch scope after testing. Merchant eligibility, tax treatment and renewal wording need current checks. Free processing must work even when price configuration is missing. Disable purchase submission until product metadata and merchant setup are valid; do not substitute an invented price.

The solo-founder assumption removes payroll, not QA, security, accounting, support time or the cost of maintaining four surfaces. Keep those reserves visible in the financial dashboard and compare them with actual spending.
