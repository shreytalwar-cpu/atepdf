# Paywall and billing: one offer, complete recovery
## 1. Trigger policy
The paywall is a secondary sheet/page, not the opening screen. Eligible triggers: an explicit Pro tap; a supported Pro convenience such as saving a reusable recipe; the next AI request after a free allowance is exhausted. A first-result success may expose a quiet link, not an automatic modal. Free multi-step jobs remain allowed within their allowance and supported free batch limits.

Before any offer, confirm the operation actually exists on this platform, the files are usable and the entitlement is known. Do not show a sales solution to a parser bug, unsupported PDF, missing network or still-verifying transaction. A commercial batch cap is separate from a technical device limit: payment never promises to overcome memory constraints.

Preserve the pending job's local file IDs/order, draft, operation manifest hash and current result lineage. Dismissal returns to the exact workspace. After purchase, server verification precedes resuming; revalidate manifest/capability/permissions. If files changed during checkout, ask for a fresh confirmation rather than executing an old plan on new inputs.

## 2. Paywall anatomy
Use existing white/pale-blue/lavender surfaces, approved paper illustration at modest scale and the same blue CTA. No new dashboard, full-screen feature collage or competitor art. Phone: one readable sheet or pushed page with a clear close and scroll-safe CTA; keyboard dismissed without deleting the draft. Tablet/web/Mac: accessible centred sheet/dialog with sane maximum width, Escape/Back behaviour and focus restoration.

Suggested headline: **Less PDF work. More done.**
Context line at quota limit: "You've used your 3 free AI jobs this month. Get more with Pro, or keep using local quick actions."
Three benefits, only when implemented: **300 AI jobs each month**; **Larger batches and reusable recipes**; **One Pro account across supported devices**. The third must explain account linking and no document sync. Privacy stays available to everyone and is not listed as an exclusive Pro benefit.

Display annual and monthly choices together. The main number is the actual amount billed for the full period. A smaller monthly equivalent may accompany annual pricing but must not replace it. Show currency, tax treatment, recurring period and cancellation terms next to the CTA. Use verified localized StoreKit/Play/provider offer data, not hand-coded screenshots. If tax is calculated later, make that explicit before confirmation.

CTA without trial: **Continue with annual** or **Continue with monthly**, accompanied by actual charge/period. Secondary: **Continue free**. Footer: Restore purchases, Terms, Privacy, Manage existing purchase / Sign in where relevant. Restore is functional, not decorative. No fake countdowns, fabricated ratings, hidden X, guilt language or discount on every dismissal.

## 3. Trial variants are disabled at launch
Only expose a future seven-day auto-renewing trial when configured in the purchasing provider and the user is eligible. Display exact trial period, first charge date/amount and recurring interval, with an understandable way to cancel. An ineligible user sees ordinary pricing, never a promised free trial.

Only promise a reminder if the delivery mechanism and consent are real; re-evaluate if permission is denied. A local notification does not require uploading document data. Calendar dates must match store terms and time zones. Do not run simultaneous price, trial and placement experiments before the base flow is understood.

The nonrenewing seven-day pass from prior economics is a separate disabled idea. It is not implemented as a weekly subscription with a misleading label.

## 4. Purchase state machine
| Verified state | Customer experience | Entitlement behaviour |
|---|---|---|
| Product metadata loading/unavailable | Clear loading or retry; free actions available | No guessed price or enabled stale checkout |
| Checkout started | System/provider confirmation | Prevent duplicate submits |
| User cancels checkout | Return to prior workspace | No charge/no allowance debit |
| Payment pending / approval pending | "Waiting for payment confirmation" with Check status | No new Pro promise; preserve any separately valid existing access |
| Payment succeeds, verification pending | "Confirming your purchase" | Retain draft, no second purchase CTA |
| Verified active | "Pro is ready" then resume safely | One entitlement; no duplicate welcome/paywalls |
| Active but renewal cancelled | Show "Access until {verified_date}" | Keep current paid access until actual expiry |
| Verified grace period | Show billing issue and manage-payment action | Honour provider's grace entitlement |
| On hold / expired / revoked | Precise state and recovery option | Apply verified expiry/revocation, preserve files and basic local tools |
| Refund | State from verified refund/revocation evidence | Do not equate every refund event with immediate revocation; map provider semantics |
| Restoring | Show progress, success/no purchase/account conflict | Idempotent, no extra charge |

Read primary provider lifecycle docs in `research/POLICY_SOURCES.md` before implementation. Duplicate/out-of-order webhooks, delayed store payouts and client offline cache are separate concerns. Use server notifications plus authoritative provider lookups, monotonic transaction ordering and idempotency. Keep tests for refunded renewal, grace recovery, family sharing if offered and overlapping purchases.

## 5. Cross-device account model
A native purchaser can initially be anonymous on the store. Offer optional account linking after verification: "Use Pro on your other devices. Your documents stay here." A web purchase needs a recoverable verified email/account or equivalent purchase recovery path; do not create an unrecoverable anonymous browser entitlement. This requirement applies at purchase, not first free use.

Separate app identity, provider customer identity and store transaction IDs. Before linking or restoring, check collisions and disclose which account has access without revealing another person's information. Choose and document transfer rules before enabling RevenueCat-style restoration. Its restore operation is user initiated; don't trigger unexpected store login prompts every launch. Restoring an Apple purchase is not by itself a way to find it on Android without a common atepdf identity.

Prevent a second subscription where current verified cross-platform access already exists. Present management through the original purchasing channel. Never log secret receipts in product analytics. Account deletion, cancelling renewal and deleting local files are separate actions; explain and implement each without holding deletion hostage to a survey.

## 6. My plan, recovery and trust
From one secondary menu: plan, allowance remaining, allowance-reset date, renewal/expiry, billing provider, account status, restore, manage billing and support. Expose a clear online cancellation route through the appropriate provider; don't require emailing the founder. A confirmation page can optionally ask why after the action, but the survey must not be compulsory. Allow a voluntary monthly alternative only without obstructing cancellation.

Always preserve original and already-generated files on downgrade. If replay is a paid convenience, explain its loss without deleting recipe definitions. Keep a cached signed entitlement for bounded offline use under a documented policy; never erase the last known valid access simply because a webhook is late. On reconnect reconcile expiry and revocation.

## 7. Global platform rules
Default to required native billing where applicable. Web/direct Mac can use the selected eligible provider. Do not add external-purchase steering links in native apps from assumptions about another region. Recheck actual market rules at submission. One product group should prevent accidental concurrent monthly and annual subscriptions and define switch/proration behaviour. Annual AI allowance resets monthly, not only at renewal.
