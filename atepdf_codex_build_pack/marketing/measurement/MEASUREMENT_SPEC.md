# Consent-aware acquisition measurement specification
This supplements the existing v3/v2 product analytics allowlists. It does not authorise transmission.
Any conflict is resolved in favour of stricter data minimisation and explicit founder approval.

## Separate data domains
Marketing origin: approved public content, consent banner, optionally consented tags.
Application workspace: local files and composer, no advertising scripts, no replay, no tag manager.
Business backend: authenticated purchase/entitlement records and allowed aggregate product events.
Ad dispatch: minimum consented matching data and generic conversion fields through provider adapters.

A different route alone is not sufficient if scripts share the same live context and can read file UI.
Use an isolated app origin when practical; verify CSP, referrer policy, cookies and message channels.
Ad clicks pass a safe preset ID, never user text, PDF data or a path containing a filename.

## Internal event table
- session_started: random session ID, permitted source/campaign metadata, platform and consent state.
- files_imported: count bucket only; no filenames, paths, document content or cloud file URLs.
- ai_consent_decided: explicit grant/decline and policy version; separate from marketing preference.
- real_job_validated: status, timing bucket, capability ID internally, is_sample=false.
- export_initiated: initiation only; web download callback is not proof of successful saving.
- second_real_job: a distinct real input/job in a specified observation period.
- offer_viewed: product offer ID and surface, not the raw trigger instruction.
- checkout_opened: SKU/provider IDs and proposed quote, no payment credentials.
- first_payment_verified: provider transaction evidence and first-order identity.
- refund_verified / renewal_verified: ledger events; not new-customer acquisition.
- allowance_restored: internal reliability metric; not a positive ad conversion.

Document operation IDs stay internal and must not create advertising segments.
The provider can receive only generic Activated if marketing-consented, not “processed tax return”.

## Purchase accounting
Use one source of truth based on verified provider webhooks/transactions.
Store provider event ID, order ID, account/entitlement ID, SKU, gross price, sales tax, discount,
currency, settled/estimated fees, refund/chargeback, timestamp and verified status.
Exclude tests, restore, duplicate callbacks, pending payments, free trials and renewals from first-purchase counts.
Refunds adjust the real cohort. Do not double-subtract the original modeled refund reserve and actual refunded amount.

## Conversion adapter
Server-first is the proposed baseline.
At event time recheck marketing consent, region/platform permission and idempotency.
Use a stable namespaced event ID. An event sent previously must not be resent as a new purchase after retry.
Any optional browser event uses the same provider-compatible deduplication identity.
Do not attach an estimated lifetime value to a first-purchase event.
Recheck current authenticated API specifications before implementing required parameters and matching fields.
A reference allowlist or successful unit test is not proof of an accepted live provider event.

## Consent details
Consent refusal: no ad dispatch and no ad identifier persistence beyond what is lawfully necessary.
Unknown consent: treat as refused for optional marketing reporting.
Withdrawal: stop future marketing dispatch/identification; follow approved retention/deletion policy.
No fingerprinting, cross-device identity inference or email/phone hashing without an explicit lawful/consented design.
Native tracking requires an independently reviewed Apple/Android path; web consent cannot silently become app-tracking permission.

## Attribution views
1. First-party consented 7-day click view for comparable campaign decisions.
2. 30-day acquisition-cohort report for slower free-to-paid movement.
3. Platform-reported view including its disclosed modeling/view-through rules, separately labelled.
4. Verified total purchase ledger and unknown/unattributed counts.

Deduplicate cross-channel first buyers before calculating business totals.
Do not sum platform-reported customers.
Exclude existing subscribers from new-buyer economics; verify duplicate-account policies without invasive tracking.
Click-count, landing session and install definitions remain separate.
Measured repeat use is unavailable for users who decline optional analytics; denominator must reflect observable cohort,
with the unknown share reported rather than assumed inactive or active.

## Reports
Daily health: broken checkout, engine incident, spend anomaly, event count mismatch, cap remaining.
Weekly: campaign/cohort first buyers, refunds, annual mix, media cash, allocated creative/affiliates,
cash CAC, cash CAC of nonrefunded buyers, committed contribution, founder support minutes, second jobs.
Monthly: earned revenue, prepaid obligations, renewal cohorts and fixed overhead separately.

## Tests required in the application
Consent declined -> no browser or server ad transmission.
Raw prompt/filename sneaked into analytics -> rejected and never logged verbatim.
Real PDF operations -> no document-bearing request to analytics/planner/ad endpoints.
Purchase callback replay -> one first-purchase event.
Browser + server dual reporting if enabled -> one provider conversion after deduplication.
Pending purchase/restore/renewal -> no first-purchase acquisition event.
Refund -> cohort and entitlement reconcile.
Checkout canceled -> files, current output and instruction remain local and intact.
URL/referrer -> no raw prompt or document names.
Cross-device upgrade -> entitlement links but no document sync or fingerprinting.
