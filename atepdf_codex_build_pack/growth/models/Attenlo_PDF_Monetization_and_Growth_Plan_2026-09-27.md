# Attenlo PDF: monetization and acquisition strategy
**Prepared for Shrey Talwar | 27 September 2026**

## Executive decision
Build a freemium, cross-platform PDF utility with a paid convenience layer, not a per-page processing business.
Cloud AI interprets instructions; customer devices execute PDF operations. No editing, annotation, form filling,
signing or redaction is added for monetization. One paid entitlement covers supported web, Android, iOS/iPadOS
and Mac apps; account linking does not synchronize documents.

The first goal is 50 genuinely paying customers with repeat use and measured acquisition costs, not a large install count.
Employee cash expense is zero in this plan. Existing equipment and developer subscriptions are assumed already owned;
allocate their actual share in the workbook to see fully loaded costs.

This document supplements, not replaces, the existing Codex build brief. It proposes prices and spend; it authorizes no purchase,
campaign, public deployment, price change or billing-provider contract.

## 1. Pricing to test
| Product | India | Global USD anchor | Role |
|---|---:|---:|---|
| Free | 0 | 0 | Useful basic local actions; three AI-completed jobs/month |
| Pro monthly | INR 249/month | USD 5.99/month | Recurring use without annual commitment |
| Pro annual | INR 1,999/year | USD 39.99/year | Main annual offer after demonstrated value |
| Later experiment: 7-day pass | INR 99, nonrenewing | USD 2.99, nonrenewing | Only if research reveals material episodic demand |

India pricing is modeled with 18% tax included. This is an assumption subject to accountant confirmation.
The USD anchor is before local tax. Localize other countries; do not silently absorb VAT without recalculating economics.

Pro proposal: 300 cloud-planned jobs/month, batch execution, saved recipes, repeat jobs and supported advanced processing.
A job means one completed user intent, including several engine steps. A 100-file batch should normally use one plan,
not 100 model requests. Clarification, system retries and repair of an app-caused failure do not consume extra customer jobs.
Quick actions and replaying an already validated recipe require no model request.

Free must demonstrate the actual multi-step experience, including a first useful output. Never run an apparently free job,
then demand payment to retrieve it. Inform the user of a limit before starting a new paid job. Keep original files and completed
outputs accessible. Do not charge for privacy or damage free output quality. No watermarks, workspace ads, dark-pattern weekly
renewals or mandatory account before the first free result.

Sell reduced effort and repeatability, not tokens. Put clear allowances in plan detail without making credits dominate the interface.
Do not offer lifetime unlimited cloud AI. A later perpetual local-only license would need a separately priced hosted-AI service,
clear maintenance terms and a much longer cost study.

A later 5-seat package around INR 7,999/year may be tested with actual small-firm demand; it is not part of the base forecast.
It must not imply cloud collaboration, enterprise security certification or managed service.

## 2. Market positioning
iLovePDF's USD offer returned USD 60/year in the initial research; a subsequent India-localized retrieval on the same date showed INR 3,400/year. Prices vary by region and should be checked at checkout. PDFgear markets a free toolkit. Smallpdf's current pricing page established Free/Pro packaging but its numeric price was not available in the retrieved content, so this model does not use it.

These are not equivalent feature sets: Attenlo deliberately excludes editing and signing. Do not claim to be cheaper for identical
functionality or the only local tool. The product hypothesis is that users will pay for a better instruction-to-result experience.

Prioritize repeat document handlers: small-business administrators, finance staff, accountants, consultants and frequent
submission/pack preparation users. Occasional one-file users can remain free. The product can be broad while the first paid
acquisition experiment targets one narrow audience.

## 3. Delivery economics
Published GPT-5.6 Luna prices checked: USD 0.20 / million input tokens and USD 1.20 / million output tokens.

Nominal call assumption:
- 2,500 input tokens and 450 billed output tokens.
- Cost = (2,500 x 0.20 + 450 x 1.20) / 1,000,000 = USD 0.00104.
- Apply a 1.25 overhead multiplier for retry/escalation cost.
- Convert at INR 90/USD, a planning convention, NOT a current FX quote.
- Budget cost per AI-completed job = INR 0.117.

| Monthly AI jobs | Estimated model bill (INR) |
|---:|---:|
| 10,000 | 1,170 |
| 100,000 | 11,700 |
| 1,000,000 | 117,000 |

This is instruction planning, not document-content analysis. Do not use these numbers to price long-document summarization,
vision, extraction or hosted OCR. They also exclude taxes on supplier bills and exceptional provider/FX charges.

At 50 jobs per paying subscriber/month, paid-user model cost is INR 5.85/month or INR 70.20/year.
At 300 jobs/month every month, paid-user model cost is INR 421.20/year.
At 20 active free users per payer, each using three jobs/month, allocated free AI cost is INR 84.24/payer/year.
Do not confuse the 300-job allowance with average actual usage.

100,000 active free users using three jobs each would cost INR 35,100/month in model use.
The free tier needs rate limits, absolute spend caps, bounded repairs and abuse prevention even though the per-job cost is low.
Count the bill of unsuccessful provider calls internally even when the customer receives no quota debit.

## 4. Fixed and non-AI costs
A workable starting budget is INR 10,000/month excluding variable AI, acquisition and founder cash pay.

| Line | Base monthly budget (INR) | Basis |
|---|---:|---|
| Web/API Workers | 450 | USD 5 published base, at planning FX |
| Database/auth/entitlements | 2,250 | Optional Supabase Pro USD 25 base |
| Email, monitoring and support software | 2,250 | Combined allowance, not a quoted bundle |
| Store membership allocation and domains | 900 | Rounded allowance including Apple annual membership |
| Bookkeeping, maintenance and testing contingency | 4,150 | Planning allowance |
| Total | 10,000 | No payroll |

Free tiers can reduce cash expenditure during beta. More projects, analytics volume, email traffic, SDK licenses, store fees,
or paid developer tools can increase it. Use one small stack, not a collection of subscriptions with overlapping features.
The workbook includes an additional developer-tool allocation input, initially zero.

No server-side PDF processing or document storage is budgeted because the product architecture excludes them. This does not mean
zero parser maintenance, device testing, security work, downloaded-engine distribution or engine licensing obligations.
A commercial SDK contract could materially change the model; obtain a quote and license review before adoption.

Cash support reserve is INR 60 per paid subscriber/year. This does not buy unlimited human support.
As a capacity example, 10,000 active users x 1% contacting support x 10 minutes = 16.7 founder hours/month.
The workbook separately illustrates founder time at 100 hours/month x INR 1,000/hour; it is opportunity cost, not payroll.

## 5. Payment and platform fees
Model assumptions:
- Apple eligible Small Business Program: 15%; enrollment and associated accounts matter.
- Standard Google Play subscription billing: combined 15% modeled; schedules vary by region/option.
- India web: Razorpay's standard published 2% plus GST on fee, modeled as a conservative 2.36% of gross payment.
- Global web/direct: Paddle standard 5% plus USD 0.50 per transaction, subject to merchant acceptance. Paddle invites sellers of products below USD 10 to discuss custom pricing; verify terms before launching the monthly or short-pass SKU.
- RevenueCat: published free below USD 2,500 monthly tracked revenue; then 1% of all tracked revenue. The model deliberately
  reserves 1% at every scale, even when the actual bill would still be zero.

Do not add Apple and Paddle fees to the same sale. Web checkout is not a universal in-app fee bypass.
Use compliant native purchasing and restore access; recheck regional steering and external-purchase rules at release.
Merchant-of-record services reduce indirect-tax administration but do not eliminate the founder's Indian accounting,
income-tax, entity or export-compliance responsibilities.

The USD 0.50 fixed fee matters on a USD 2.99 pass: the headline Paddle fee is about USD 0.65, or 21.7%, before other costs.
On a USD 39.99 annual purchase it is about 6.25%. This is one reason not to assume tiny global transactions are the cheapest route.

## 6. Annual unit economics, before acquisition and fixed overhead
Base assumptions: prices above; 3% ex-tax refund/dispute reserve; 1% sticker-price subscription-tooling reserve;
50 paid jobs/month; 20 active free users/payer at three jobs/month; INR 60 annual variable support reserve.

| Metric, INR | India web | India store | Global web | Global store |
|---|---:|---:|---:|---:|
| Sticker price | 1,999.00 | 1,999.00 | 3,599.10 | 3,599.10 |
| Revenue excluding modeled tax | 1,694.07 | 1,694.07 | 3,599.10 | 3,599.10 |
| Channel/payment fee | 47.18 | 254.11 | 224.96 | 539.87 |
| Refund/dispute reserve | 50.82 | 50.82 | 107.97 | 107.97 |
| Subscription tooling reserve | 19.99 | 19.99 | 35.99 | 35.99 |
| Paid AI | 70.20 | 70.20 | 70.20 | 70.20 |
| Free-user AI allocation | 84.24 | 84.24 | 84.24 | 84.24 |
| Variable support reserve | 60.00 | 60.00 | 60.00 | 60.00 |
| First-year contribution | 1,361.64 | 1,154.71 | 3,015.74 | 2,700.83 |
| Target all-in CAC at 30% of contribution | 408.49 | 346.41 | 904.72 | 810.25 |

Practical rounded CAC targets: INR 400 India web, INR 350 India store, INR 900 global web, INR 800 global store.
They are starting targets, not market quotes or proven achievable results.
The contribution ceiling is not a sensible acquisition budget: spending all of it leaves nothing for fixed costs, founder income
or errors. Stress 30% store fees, higher refunds, a higher free-user ratio and all-global prices inclusive of local tax.

Use separate CAC limits for monthly plans. A monthly buyer has not committed a year of revenue.
Do not use a SaaS revenue/churn shortcut that quietly assumes stable churn, mature retention and no refunds.

## 7. Acquisition metrics and limits
Cash CAC = acquisition media + paid creatives + affiliate payouts + allocated acquisition software, divided by new paying customers.
Use first successful purchases consistently in the model; reconcile refunded customers separately and track refund-adjusted CAC too.
The unit model already subtracts a refund reserve.
Economic CAC also allocates founder marketing time. Keep it visible without pretending it is a cash expense.

Funnel example: INR 20 CPC / (50% complete a first job x 6% of activated users pay) = INR 666.67 media CAC.
With 25% creative uplift, all-in cash CAC is INR 833.33. That may fit global annual web economics but not India annual economics.
At INR 45 CPC and 2% click-to-paid, media CAC is INR 2,250 and loaded cash CAC is INR 2,812.50: too high for the proposed targets.
All CPC/conversion figures are hypothetical; there is no measured ad-account data.

For apps, INR 30 per install / 2% install-to-paid = INR 1,500 media CAC. A cheap install is not automatically a good campaign.
Keep conversion windows, geography, product SKU and channel consistent. Do not attribute all organic purchases to paid ads.
Report paid-channel CAC and blended business CAC separately.

A diagnostic pause rule: after allowing conversion lag, pause an experiment with zero buyers after spending 3x target CAC.
This is a loss-control rule, not statistical proof that the channel cannot work.
At 30-50 paid conversions, results become directionally more useful but are still uncertain; compare at least two cohorts and
their refund/returning-use behavior before meaningful spend increases.

## 8. Distribution sequence
### Demonstration-led acquisition
Show a real 10-20-second workflow on synthetic files: add several PDFs, give one instruction, return the result.
Creative hooks: less tool-switching; no PDF upload for processing; repeat a saved routine.
Do not advertise unsupported operations or '100% offline AI'.
Codex can prepare the demo, script, landing variants and analytics. Founder approves publication and spend.

### Partner and micro-creator distribution
Test productivity creators and small-firm communities with a useful workflow, not mass unsolicited promotion.
Offer about 20% of the first payment's net receipts, after tax, channel fees and refunds, rather than perpetual commission.
Base illustration: approximately INR 319 per India-web annual payer and INR 653 per global-web annual payer.
Pay only after refund/fraud review; include upfront sponsorship costs when calculating CAC.

### Task-intent SEO and store listings
Create 6-10 genuinely useful pages for supported tasks: compress for an upload limit, merge and OCR, searchable scanned PDF,
prepare a batch for an accountant, process PDFs locally. Each opens the same workspace with intent prefilled.
No hundreds of thin AI pages, fake reviews, backlink purchases or artificial testimonials.
Store screenshots should show the real interaction and export, not just the mascot. Ask for reviews through allowed mechanisms
after genuine success, without purchase/review incentives.

### Narrow paid tests
Start with one channel, one language/market and one recurring-use audience. Test short demos through organic/partner exposure
before paying to amplify the strongest one. Broad 'free PDF' keywords and untargeted install campaigns are not the initial bet.
Platform availability can be broad; the marketing experiment should stay narrow.

### Setapp
Evaluate after product readiness, but budget zero base revenue until acceptance and real usage.
Its membership pool is allocated by usage and price tiers; 70% is not a promise that Attenlo gets 70% of every membership.
No fixed dollar-per-user income is assumed.

## 9. Six-week controlled acquisition budget
| Line | Ceiling |
|---|---:|
| Creative assets / optional creator | INR 8,000 |
| First paid diagnostic tranche | INR 4,000 |
| Replication tranche | INR 8,000 |
| Controlled expansion tranche | INR 12,000 |
| Held reserve | INR 8,000 |
| Maximum | INR 40,000 |

Release tranches only when prior evidence warrants them. This is a recommendation, not an approved campaign.
Example: INR 24,000 media + INR 8,000 creative yields 40 new payers. Media CAC is INR 600, all-in spent CAC is INR 800.
The INR 8,000 held reserve is not counted until actually spent. INR 800 may fit global annual sales, but not the India target.

Suggested launch envelope: INR 100,000, comprising INR 40,000 acquisition ceiling, INR 30,000 for three months of baseline operations,
INR 20,000 setup/testing/review reserve and INR 10,000 variable-cost/contingency buffer. Existing hardware and subscriptions are excluded.
Approval, not the size of the bank balance, controls each spend.

## 10. What a small successful business could look like
Illustrative steady state: 40% India / 60% global payers; 50% web/direct in each region; annual plans only;
30% annual renewal; INR 650 all-in CAC; 20 free MAU per payer; variable costs above.
INR 10,000 fixed/month below 1,000 paid subscribers, INR 20,000 at/above 1,000.
Replace nonrenewers: paid base x (1 - renewal) / 12 new customers per month.

| Paying annual subscriptions | Ex-tax subscription revenue/month equivalent | Contribution/month | Replacement acquisition/month | Fixed/month | Operating surplus/month |
|---:|---:|---:|---:|---:|---:|
| 100 | 23,642 | 18,485 | 3,792 | 10,000 | 4,694 |
| 500 | 118,212 | 92,427 | 18,958 | 10,000 | 63,468 |
| 1,500 | 354,636 | 277,280 | 56,875 | 20,000 | 200,405 |

These are scenario outputs, not forecasts. They are before income tax, founder pay, extra growth spend and reinvestment.
Gross contribution already covers fees/refunds and free-tier service costs. Renewal is not assumed to be excellent.
Broad subscription-app retention benchmarks do not establish this product's renewal.

In this model roughly 749 paying annual subscribers support INR 100,000/month operating surplus, and 2,178 support INR 300,000/month.
A 100-subscriber product can cover a lean cash budget, but does not necessarily compensate founder time.
Annual advance collections must not be confused with earnings; the workbook separates a 12-month illustrative cash path,
earned revenue and unearned subscription receipts. The illustrated new subscribers are editable assumptions, not a growth forecast.

## 11. Codex implementation addendum
Build commercial infrastructure without changing the approved one-workspace design.

1. Server-configured SKUs, country prices, job allowances, cohort flags and plain-language renewal disclosures.
2. Signed/verified entitlements and supported purchase/restore/refund states. Link accounts without syncing files.
3. Job accounting keyed to idempotent job IDs: reserve before execution, commit on validated success; release/refund allowance on failure.
4. Absolute gateway rate/cost ceilings independent of the customer-visible success counter, so failed-job abuse cannot exhaust budget.
5. Usage metering stores only token counts, costs, operation IDs, timings and status. No file bytes, names, OCR, previews or raw prompts.
6. Provider/channel ledger: customer price, included tax, discount, refund, fees, currency, received amount, commission and store SKU.
7. Event funnel: arrival -> files added -> first supported job success -> save -> repeat job -> offer seen -> purchase -> refund/cancel/renew.
8. Attribution by cohort/platform/market, with consistent windows and consent-aware minimal campaign identifiers.
9. Reports for first-payment contribution, media CAC, all-in CAC, refund-adjusted CAC, free-user subsidy and founder support time.
10. Remote kill switches for paid acquisition, broken engine capabilities, abusive planner traffic and new pricing experiments.
11. Test duplicate webhooks, pending purchases, restored purchases, offline entitlement cache, canceled renewal, failed job quota
    restoration, provider outage, local unsaved files and paywall dismissal.
12. Do not claim every local tool can be perfectly DRM-protected in a browser. Sell convenience and service reliability, not intrusive enforcement.
13. Do not add enterprise features, cloud processing, document telemetry or promotional clutter to increase ARPU.
14. Publish a weekly decision note: spend, paying customers, completed outputs, returns, revenue, contribution, support load and next one experiment.
15. No production spending or campaigns until founder grants bounded authority with a cap and end date.

## 12. Review cadence
First 20 users: observe usability and document quality.
First 50 payers: validate willingness to pay, refund causes, recurring need and per-SKU contribution.
First 100-200 payers: compare acquisition cohorts and regional economics; test pricing only when sample size can be meaningful.
First annual renewal: replace the retention assumption with actual renewal data. Until then, do not scale on speculative multi-year LTV.

Recommended weekly scorecard: first valid result rate, repeat job within 30 days among target users, paid conversion by acquisition cohort,
cash CAC, contribution after CAC, refund rate, AI bill per successful job, active free-to-paid ratio and support minutes.
Numerical release thresholds are operating hypotheses, not category benchmarks.

## Primary sources checked

- OpenAI model pricing: https://developers.openai.com/api/docs/models/gpt-5.6-luna
  Use: USD 0.20 / 1M input tokens; USD 1.20 / 1M output tokens.

- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
  Use: Paid plan starts at USD 5/month, with usage allowances and overages.

- Supabase pricing: https://supabase.com/pricing
  Use: Pro starts at USD 25/month; first micro compute instance covered by credits.

- RevenueCat pricing: https://www.revenuecat.com/pricing
  Use: Free below USD 2,500 monthly tracked revenue; then 1% of all tracked revenue. Model conservatively reserves 1% at every scale.

- Apple Small Business Program: https://developer.apple.com/app-store/small-business-program/
  Use: 15% commission conditional on enrollment and eligibility; not a universal rate.

- Google Play service fees: https://support.google.com/googleplay/android-developer/answer/112622?hl=en
  Use: Subscription fee schedules vary by region and billing option; standard Play billing modeled at a combined 15%.

- Paddle pricing: https://www.paddle.com/pricing
  Use: Standard pay-as-you-go: 5% + USD 0.50 per checkout; merchant approval and actual taxes/settlement terms require confirmation.

- Razorpay published fees: https://razorpay.com/solutions/e-commerce/
  Use: Domestic standard 2% plus 18% GST on processing fee = 2.36% cash fee; no input-tax credit assumed.

- Apple Developer membership: https://developer.apple.com/programs/whats-included/
  Use: USD 99/year or regional price, before applicable taxes.

- iLovePDF pricing: https://www.ilovepdf.com/pricing
  Use: USD 60/year observed for Premium; broader feature set, not an identical product.

- PDFgear: https://www.pdfgear.com/
  Use: Markets a free PDF toolkit; means price is not the only competitive consideration.

- Smallpdf pricing: https://smallpdf.com/pricing
  Use: Free and Pro tiers verified. Numeric price did not render in retrieved page; not used in calculations.

- Setapp membership revenue: https://docs.setapp.com/docs/setapp-membership-revenue
  Use: 70% usage-weighted pool, plus eligible 20% referral share. No acceptance or revenue assumed.

- RevenueCat subscription research: https://www.revenuecat.com/state-of-subscription-apps
  Use: Broad app benchmarks, not this product's cohorts. CAC, renewal, conversion and refunds here are explicit assumptions.

- Resend pricing: https://resend.com/pricing
  Use: Email allowance is a planning reserve; verify selected plan before purchase.


## Workbook map
Overview: key decision metrics and AI-cost scale.
Inputs: source-backed rates and editable assumptions, with comments.
Unit Economics: India/global and web/store annual and monthly contribution.
CAC Funnel: sample funnels, conversion sensitivity and actual-spend accounting.
Steady State: paying-user scale, retention sensitivity and profit targets.
12M Cash: editable annual-only worked example, not a forecast.
Experiments: bounded spending sequence and commercial implementation rules.
Sources: verification references and limitations.

All spreadsheet calculations were checked for formula errors before export. No live campaign, model reliability or conversion benchmark
has been measured for Attenlo by this exercise.
