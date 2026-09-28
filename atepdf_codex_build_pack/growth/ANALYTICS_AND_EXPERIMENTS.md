# Measurement, experiments and commercial control
## Privacy-preserving events
Instrument an explicit allowlist; do not install generic autocapture or workspace session replay. Event names are in `config/event-catalog.json`; the companion schema rejects extra properties. No file bytes, titles/names, raw prompts, OCR text, thumbnails, source URLs/paths, email addresses, advertising IDs, full receipts or error stack dumps in product events.

Necessary transaction/entitlement and abuse controls belong in separate, access-controlled operational systems. Optional product analytics must respect consent and deletion choices. Campaign taxonomy is allowlisted first-party source/medium/campaign values without free-text URLs; never collect URL query strings that could contain file information. Use a random event ID for deduplication. Optional random subject/session IDs may link permitted funnel events under the documented consent and retention policy; they must never derive from documents, hardware fingerprints or advertising identifiers. Without permitted linkage, report aggregates and the measurement limitation rather than inventing a user-level funnel. Aggregate where possible. Cross-device attribution requires appropriate identity/consent; no fingerprinting as a workaround.

## Funnel definitions
1. Qualified new prospect, with duplicate/return sessions reported separately.
2. Workspace ready and files added, distinguishing synthetic samples from user files.
3. AI consent decision where applicable.
4. Plan requested/accepted or clarification; track attempted and completed cost separately.
5. First validated result.
6. Preview opened, export initiated, confirmed native save when actually observable, or share sheet presented. Browser download click is not a confirmed save.
7. Second user-file job in another session and return within 7/30 days.
8. Relevant offer seen and its placement; plan selected; checkout started.
9. Server-verified first purchase; pending, cancelled, declined and duplicate events separated.
10. Renewal due/renewed, refund, entitlement cancellation/expiry, billing recovery and support.

Purchase and renewal truth comes from provider evidence, not frontend button clicks. Distinguish cancel-renewal from immediate loss of entitlement and refund from revocation. Attribute cohorts by first purchase date, plan, storefront, acquisition channel and experimental assignment version.

## Primary business metrics
Cash CAC includes media, attributable creative, partners and acquisition tools. Paid-channel CAC excludes organic customers from its denominator; blended CAC includes allocated organic acquisition work and all new buyers. Report refund-adjusted CAC alongside gross first-purchase CAC. Monthly and annual buyers require different contribution/payback calculations.

Thirty-day cohort contribution after acquisition is an early decision metric, with annual prepaid amounts recognized consistently over service rather than equated with monthly profit. Also show first-payment net cash and earned revenue separately. Do not compare 30-day earned annual revenue to twelve-month acquisition recovery without labeling the horizons. True annual renewal remains unknown until cohorts mature.

Track task success, first-result time, unnecessary clarification, replay success, refund incidence, support minutes, cost per successful AI job and free active users per payer. A paywall variant that increases purchases but materially harms valid-result completion/refunds/returning use is not automatically a winner.

## Experiment queue
| ID | Hypothesis | Control / test | Decision basis |
|---|---|---|---|
| EXP-01 | A real sample reduces blank-screen uncertainty | No sample nudge / optional sample link | Real-file activation, not sample clicks alone |
| EXP-02 | Contextual upgrade is more useful than generic discovery | User-requested/quota offer / small post-result Pro link | Paid contribution, task completion, interruption and refund guardrails |
| EXP-03 | Outcome copy makes Pro understandable | Neutral Pro label / outcome-led three-benefit copy | Comprehension interviews then purchase outcomes |
| EXP-04 | The free allowance is too restrictive or too generous | 3 / 5 monthly completed intents | Repeat use, cost per activated user, conversion and free subsidy |
| EXP-05 | A provider-backed trial helps recurring users | Freemium/no trial / eligible 7-day trial | Trial-to-paid, refunds, net contribution and renewal, not trial starts |

All experiments are disabled by default. Run one major commercial experiment at a time. Pre-register cohort, eligibility, measurement window, minimum detectable effect and a stopping rule before interpreting results. Founder interviews and 30-50 payers are directional evidence, not automatic statistical significance. Use confidence intervals and seasonality/channel checks; do not continually peek and declare a winner after a few payments.

Pricing tests need a separately approved economic/legal review, consistent local terms and protection for existing subscribers. Assign once per stable permitted subject where possible; don't change price mid-checkout or use sensitive personal attributes. Missing remote configuration falls back to safe known behaviour, not an aggressive paywall.

## Six-week commercial sequence
Weeks 1-2: observe about 20 first-time users; fix import, instructions, result quality, saving and clarity. Weeks 3-4: recruit first paid cohort with truthful demos and a narrow audience, subject to launch readiness. Weeks 5-6: compare first-payment contribution, refunds and repeat jobs before releasing another budget tranche. Calendar timing does not override technical release gates.

Use the prior INR 40,000 experimental ceiling only after founder approval. A pause after 3x target CAC with no buyers is a cash-loss guardrail after conversion lag, not proof a channel cannot work. Automatic ad-budget increases are out of scope.

## Founder reporting, not customer dashboard clutter
A restricted internal report or weekly CSV is enough initially: eligible prospects, first result, repeat sessions, paid mix, earned revenue, receipts, refunds, fees, AI bills, acquisition spend, paid/blended CAC, support load and cash reserved for prepaid service. No public data dashboard or internal financial charts in the consumer workspace.

Generate an actual-versus-assumptions export compatible with the supplied model categories. Do not rewrite the model to hide bad performance. Current purchase/engine/provider data eventually takes priority over all hypotheses in this pack.
