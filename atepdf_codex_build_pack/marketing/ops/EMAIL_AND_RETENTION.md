# Email and retention without a growth tax on the user
The utility should make the next real job easier, not manufacture a daily engagement habit. Implement this alongside existing lifecycle requirements, not as a second onboarding funnel.

## Deliverability before delivery
Use Resend's official integration when selected. Verify the legal sender, correct domain, SPF/DKIM records and a reviewed DMARC policy with the domain owner. Do not blindly replace DNS records or enforce a strict policy that breaks legitimate mail. Separate transactional and marketing sending purposes where practical. Resend documents domain verification and subdomain segmentation. [T13,T14]

Test reply handling, HTML/text alternatives, mobile layout, accessible links, failed delivery and provider suppression. A domain looking verified in a screenshot is not enough; inspect the real provider state and approved test inbox. Use existing sender-domain expertise rather than invent DNS values.

## Consent and preferences
Marketing consent is independent from AI-use consent and purchase. No scraped/customer lists. Maintain unsubscribe, bounce, complaint and deletion suppression. Apply preferences at send time, including after queueing. An email change or reimport cannot erase an unsubscribe. Respect required transactional notices while preventing promotional content from being relabelled transactional.

Include functioning unsubscribe and sender information in marketing messages, with any required provider headers. Turn off open tracking initially; do not treat opens as proof of engagement or return. Handle links without exposing document data. Choose the relevant legal and provider requirements before public sending; this is an implementation policy, not legal clearance.

## Initial lifecycle: draft definitions
| Moment | Message/action | Eligibility and stop |
|---|---|---|
| Account created | Brief access/help email | Requested/appropriate service message; no sales essay |
| First real result | In-app save/share guidance | No email or push required |
| Second multi-step job | Suggest saving a recipe | Local, dismissible; no forced habit |
| Recipe tip | One useful example | Marketing opt-in, verified supported feature, no unresolved incident |
| Later return invitation | One relevant invitation, not daily reminders | Opt-in; delayed; suppress recent active users, opted-out users and unresolved support cases |
| Payment problem | Correct provider/account recovery route | Verified billing state; no duplicate dunning beside existing provider flow |
| Cancelled renewal | Acknowledge remaining access | Do not falsely report instant loss of Pro |
| Refund or entitlement defect | Support-first recovery | Suppress acquisition and win-back pressure |

Exact delays and suppression thresholds are test configuration, not claims about how much retention improves. No automated sending is enabled in this pack.

## Draft email examples
**Subject: Your atepdf access**
“Your account is ready. Add a file and tell atepdf what you need. You can manage your plan from Settings. Linking devices shares access, not your documents.”
Send only if this accurately describes the user's actual account/entitlement.

**Subject: Keep your next PDF job simple**
“Try combining your files and making scanned pages searchable in one request. Your PDFs are processed on your device; AI helps understand the instruction. Open the example when you next have a document pack to prepare.”
Use a tested safe preset, accurate feature availability and a visible unsubscribe.

**Subject: Help with your document?**
“Reply with the step that failed and the error code. Please do not email confidential PDFs, passwords or payment details.”
This is support copy, not permission to send an unsolicited campaign.

## Measurement
Judge delivered opted-in cohorts by real subsequent use, verified purchases/renewals, complaints and support workload. Compare equal observation windows. No conversion uplift is assumed. Marketing is allowed to remain off while the core product ships.
