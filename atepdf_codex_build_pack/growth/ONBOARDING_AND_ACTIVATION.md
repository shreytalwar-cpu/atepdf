# Onboarding and activation specification
## Default: zero compulsory marketing screens
Open directly to the approved file workspace. Keep the three useful quick actions, primary Choose files button and composer. No full-screen pricing, questionnaire, email gate or notification request at launch. A small secondary Try a sample link is allowed within the empty state; it must not compete with the main CTA.

Returning users go to their last usable local workspace or a clean new job, never the onboarding loop. Deep links, Share Sheet launches and Android share intents enter with the selected files or draft intact, bypassing marketing education. If the OS provides only transient access, copy into permitted local working storage and explain lifetime limits.

## First session, screen by screen
| Moment | UI and action | State preserved / validation |
|---|---|---|
| Empty workspace | Existing approved screen; Choose files, three shortcuts, composer, Try a sample | Draft may be entered before files |
| File picker | System picker; request only selected-file access | Cancellation returns unchanged, no error/paywall |
| Files added | Compact file cards replace large mascot area; composer stays visible | Display order is source order; names are local-only |
| First cloud request | One concise privacy sheet with actual provider identity, what goes out, what stays local, Allow AI / Use local tools | Never send the draft before permission; refusal preserves local options |
| Request needs clarification | One relevant choice inside conversation, not a survey | No quota debit; no unsupported guesses |
| Processing | Real engine progress; Cancel; document preview only when requested | Originals retained; no synthetic timers |
| First result | Actual filename, size, page count and verified changes; Preview, Save, Share | View/export remain available if user never pays |
| Continued work | Composer focused; one suggested follow-up at most | References current result/version correctly |
| Optional Pro discovery | Nonblocking Pro link after completion or later explicit intent | No paywall covering the first export |

## The sample path
Bundle synthetic, licensed-to-use sample inputs: two small PDFs including one scanned page. A named local demo merges them and makes the scanned page searchable using the actual available engines. Start with these two operations; include compression only if the fixture can visibly benefit on all claimed platforms. Show measured results, not invented 73% savings.

Use a visibly labelled sample recipe, not an animation masquerading as live AI. It can execute offline once required engines/assets are available. A prefilled editable natural-language variant uses the real planner after consent. Each mode is clearly named, analytics distinguish demo from real user jobs, and neither proves product-wide compression/OCR reliability.

After the demo, offer Add my files. Do not require saving a sample to continue. Never import or inspect files beyond those selected.

## Privacy explanation
Badge: **PDF processing stays on this device.**

First cloud use: **AI helps understand your instructions.**
Body: "Your instruction and limited file details are sent to {provider_name} to plan the task. Your PDFs, page images and extracted text are processed here and are not uploaded by atepdf. Avoid including sensitive information in your instruction."
Actions: **Allow AI instructions** / **Use local tools**. Provide Details and Privacy links. Store consent version, scope and provider identity. Renew consent for material changes. Support withdrawal in Settings. Do not combine this with marketing opt-in or subscription acceptance. Actual provider logging/retention and subprocessors must be disclosed accurately before launch; do not promise zero retention without verifying the configuration.

User-directed export to iCloud, Drive or another share destination can upload a resulting file outside atepdf. Say so in the privacy detail; don't claim that a user-chosen external share is impossible. OS backups must be configured consistently with our promises, distinguishing entitlement preferences from working documents. No SDK screen replay of the workspace.

## Low-friction details that matter
Keep iPhone composer above the keyboard, with large touch targets and visible close controls. On iPad handle multitasking widths and pointer input. On Mac/web use drag anywhere sensible, keyboard shortcuts and a focused input without full-screen onboarding takeover. Price, entitlement and essential state changes must be accessible to screen readers. A reduced-motion preference removes bounce/confetti; no fake haptic-like visual blocking.

Collapse the decorative empty state as soon as files arrive. Keep one step of guidance, not simultaneous hint bubbles. Do not add compulsory themes, avatar, preferred name or occupation. Scope shortcuts to available capabilities; disabled operations explain why in plain language.

## Activation definition
Primary activation = first real user-file job validated and result opened or export initiated. Report demo activation separately. Native confirmed saves, web download initiation and share-sheet presentation are distinct events; do not assert a file reached disk or was delivered when the OS/browser cannot confirm it.

Track first-result success rate, time to first valid result, avoidable clarification and return to complete another task within 7/30 days. Initial targets are usability hypotheses: at least 18/20 observed first-time users complete a supported fixture without help; no protected originals overwritten; no missing free result after dismissal. Large real PDFs need different duration expectations from small fixtures.

No forced analytics consent to use the app. Necessary billing/rate-limit operational data and optional product analytics have separately documented purposes and handling.
