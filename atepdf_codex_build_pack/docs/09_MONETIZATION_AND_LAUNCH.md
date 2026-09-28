> **Version 2 addendum takes precedence for commercial defaults.** Read `../growth/MONETIZATION_HYPOTHESIS.md`, `../growth/PAYWALL_AND_BILLING.md` and `../growth/MODEL_RECONCILIATION.md`. The unchanged original financial documents/workbooks are in `../growth/models/`. No trial or production pricing/spend is automatically enabled. Original text follows for context.

# 09 | Commercial build requirements and launch

## Product simplicity comes first
Do not make accounts, credits or a subscription screen the first experience. A user should understand the product by finishing a real job. Prices and quotas below are policy choices to configure and test, not commitments approved by the owner.

## Proposed commercial shape
**Free:** useful basic local quick actions and a bounded allowance of AI-planned tasks. No watermark and no surprise registration to retrieve an already-created free result.

**Pro:** more conversational jobs, larger/longer batches within actual device limits, reusable workflow convenience and paid advanced features that have passed quality gates. Privacy and preserving originals are not premium extras.

Prefer monthly/annual consumer pricing over enterprise per-seat jargon for the primary app. Leave exact amounts, currency tiers, trial policy and allowances in configuration for owner approval. Do not launch an “unlimited AI” promise without abuse and margin data. Browser-local restrictions are commercially useful UX rules, not tamper-proof security boundaries.

## Entitlement model
Optional account links purchases across supported channels without synchronising customer documents. Server stores account, product SKU, provider transaction reference, entitlement state and expiry. Local app stores a short-lived/verifiable entitlement cache; basic free local tools must not fail solely because the account server is unavailable.

Implement purchase pending, success, restore, expiration, cancellation-at-period-end, refund, chargeback and account deletion. Use verified platform transaction/webhook evidence; never trust a client “paid=true” flag. Keep purchase verification behind provider interfaces.

Apple/Google digital-goods rules and regional exceptions change. Use supported native billing as the default where required, verify current rules at release and do not add external payment-link workarounds based on this brief [S20, S21]. Web/direct Mac billing can use an approved provider after merchant eligibility and tax/account setup are resolved. Setapp can be evaluated as a separate optional Mac distribution channel; do not make approval or revenue assumptions.

## Paywall placement
Show limits before a new chargeable request starts, not after producing a result and trapping it. Keep drafts/files locally available when a user declines. Quota exhausted -> explain remaining local actions. Privacy disclosure must not be disguised as subscription acceptance.

## Website
Main message: **Drop your files. Tell atepdf what to do. Get the result.**
Supporting message: **AI understands the instructions. Your device processes the PDFs.**
Use an actual short demo of merge + OCR + compression + follow-up. No claims about being the first, universally better, supporting every PDF or a “Smallpdf killer” without measured evidence. That phrase is an internal ambition, not a verified public comparison.

Pages: home/product, private processing, supported tools/capabilities, help, pricing when approved, privacy, terms, contact and downloads. Tool-intent pages such as merge/compress/OCR should open the same workspace with a suggested intent, not rebuild fragmented single-tool funnels.

Search content should explain genuine tasks and limitations. No hundreds of thin AI-generated pages or fake ratings/customer logos. Public technical claims come from the tested capability registry.

## Launch analytics
Measure task completion, time to first valid result, unnecessary clarification rate, failed engine operations, target-not-met rate, follow-up success, save completion, returns and paid conversion. Do not collect document text, raw prompts, filenames, OCR content, preview recordings or passwords. An opt-in feedback mechanism can ask whether the result was useful without sending the file.

## Pilot and rollout
Start with a labelled private beta and synthetic demo fixtures. Test with a small set of first-time users across the target devices. Watch where people hesitate rather than asking only whether they like the colours. Fix file import, unclear options, incorrect defaults, waiting and save confusion before adding more features.

Expand a platform only after its release gates pass. A web beta can serve Windows users immediately where supported, but do not describe Windows native support. Final prices, store listings, domains, paid SDK contracts, live payment products and production deployment require explicit owner authority.
