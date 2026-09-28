> **v6 brand override:** The final product name is **atepdf** (lowercase), with the approved gradient numeral **8** logo. Read [brand/APPROVED_BRAND.md](brand/APPROVED_BRAND.md) and [brand/brand.json](brand/brand.json). The uploaded brand board is not a UI specification. Keep the earlier approved drop-and-instruct interface, scope and local-processing architecture. Older filenames and protected source labels are retained for compatibility.

# Design contract | Friendly, simple and useful

## Source of truth
Primary references:
- `design/references/approved-iphone.jpeg`
- `design/references/approved-ipad.jpeg`

Secondary desktop styling reference:
- `design/references/desktop-style-reference.png`

The user's approved UI is the original friendly Attenlo-era file-drop/chat workspace, rebranded to atepdf. The latest brand board governs name/logo only, not layout. Earlier PDFello, Melo, dense dashboard and nature-landscape designs are not active specifications. Jomo was a tone reference, not a licence to copy another brand or restart design exploration.

The references are concept images, not functional specifications for every detail. This document records the necessary implementation differences: privacy copy must distinguish cloud interpretation from local processing; phone height must accommodate the keyboard; features must match actual capabilities; external device frames and decorative notes are presentation material, not app controls.

## Visual character
Bright white base; very pale cool-blue and lavender ambient shapes; deep navy text; a saturated blue primary action; mint, blush and lavender suggestion surfaces. Friendly paper illustration in the empty state, with restrained decorative strokes. No additional mascots, exaggerated baby-like copy, gamification, confetti on every task, glassy enterprise panels or grey dashboard theme.

Keep the illustration visible when the workspace is empty. Shrink/remove it once real files are present. Do not make the user scroll past decorative artwork to reach the instruction field.

## Brand and assets
Centralise `productName`, icon, wordmark, colour tokens, support URL and marketing domain. Use atepdf, the final owner-approved name, with the approved gradient numeral 8 logo. Read brand/APPROVED_BRAND.md for asset and precedence rules. No trademark or domain-availability claims.

Keep provided concept images as reference-only assets. Do not ship a screenshot as the interactive UI. Recreate text and controls with native/web components. Produce a separate high-resolution transparent illustration consistent with the approved paper character, using approved assets or an image-generation asset pass in Codex when available. Do not substitute random stock art. Do not distribute Apple fonts with web/Android assets; use platform system fonts or a separately reviewed open-licence font.

## Starting tokens
These are implementation starting values approximated from the concept, not exact measured brand standards. Tune against actual rendered screenshots.

| Token | Light value / rule |
|---|---|
| canvas | `#FFFFFF` |
| surface-cool | `#F4F8FF` |
| ink | `#11183F` |
| text-secondary | `#596783`; maintain contrast |
| primary | `#267BFF` |
| primary-gradient | `#39A6FF` to `#2665F5`, only on the principal CTA |
| lavender | `#8D86F4` |
| mint-surface | `#E9FAF3` |
| mint-ink | `#116853` |
| blush-surface | `#FFF0F4` |
| violet-surface | `#F2EDFF` |
| border | `#DFE6F4` |
| focus | strong visible blue ring, not colour-only state |
| radii | 12 compact, 20 cards, 28 composer/drop area, pill only for appropriate buttons |
| spacing | 4 / 8 / 12 / 16 / 24 / 32 / 48 |
| motion | 120-220 ms for state changes; honour Reduced Motion |

Use system-adaptive equivalents for dark mode, preserving hierarchy and accents. Do not globally invert the artwork. Large-text modes may simplify decoration. Minimum internal target sizes: 44 points on Apple, 48 dp on Android, 44 CSS pixels on web touch controls; these are product requirements. Contrast target: 4.5:1 ordinary text and 3:1 large text/non-text controls where applicable. Validate, do not assume pale text passes.

## Layout by platform
**iPhone / narrow Android / mobile web:** compact brand/privacy header; flexible drop area; one row of three shortcuts; bottom composer anchored above the safe area/keyboard. Prefer “Add files” or “Choose files” on touch, while still accepting drag/drop where supported. Do not require dragging on a phone. Header can show a compact shield icon with accessible explanatory text instead of forcing a long badge to wrap.

**iPad / Android tablet:** preserve the supplied wider drop area and full-width composer, constrained to a comfortable reading width. Keyboard/multiwindow resizing must keep both files and composer usable. Do not add a sidebar merely because space exists.

**Web / Mac:** centred workspace around 800-960 logical pixels wide, scaled for smaller windows; drop anywhere over the workspace; concise header with secondary history/settings menu. Mac uses real window controls and commands. No permanent output-preview rail, tool catalogue or marketing benefit grid inside the app.

## Allowed opening-screen copy
- Brand: “atepdf”.
- Desktop/tablet heading: “Drop files here”. Phone equivalent: “Add your files”.
- Secondary: “or choose files from your device”.
- Primary button: “Choose files”.
- Composer: “Tell atepdf what to do…”
- Shortcuts: “Merge”, “Compress”, “Make searchable”. An OCR icon may retain the familiar shortcut treatment, but the accessible label must explain it.
- Privacy badge: “Processed on your device”. Tapping opens the exact data explanation below.

Do not claim “Supports PDF, images and more” until the registry supports every listed type. Prefer “PDF, JPG and PNG” for the initial build.

## Honest privacy copy
Badge: **Processed on your device**.
First AI-use disclosure: **AI reads your instructions, not your files. Your instructions and limited file details are sent to our AI provider. PDF processing happens on this device.**
Details: **We do not automatically send PDF contents, page images or recognised text to our AI provider. Anything you type in the instruction box is sent for interpretation. Passwords belong in the secure password field.**
Add a concise note that user-chosen sharing or cloud-storage providers may transfer files outside the app. Do not say “no network”, “fully offline AI” or “nothing ever leaves your device”.

## State inventory and behaviour
| State | What appears | Primary action / exit |
|---|---|---|
| Empty | Approved drop/illustration, composer, three shortcuts. | Add files, or enter a draft request first. |
| Drag active | Drop target highlight and supported type hint. | Drop, or leave target. |
| Importing | Compact file cards with actual import/preflight state. | Cancel individual import. |
| Ready | File cards in explicit visible order, composer. | Send instruction / tap shortcut. |
| Interpreting | Brief “Working out the steps…” with cancel. | No fake processing yet. |
| Clarification | One plain-language question, compact answer controls. | Submit missing information. |
| Local action required | Secure password, unsupported feature choice or quality review. | Resolve locally; do not resend secrets. |
| Processing | One sentence + current engine step + actual progress + cancel. | Continue using app where safe. |
| Completed | File card(s), true size/page count, Preview/Save/Share, composer. | Follow-up, save or start over. |
| Partially completed batch | Successful outputs plus individually failed items. | Export successes or retry failed items. |
| Target not met | Best valid candidate and measured size, clear remaining gap. | Keep candidate, adjust quality or cancel. |
| Unsupported | One concise explanation; files remain selected. | Another supported instruction. |
| Offline / gateway failed | Explain chat availability; keep local shortcuts and compiled recipes. | Retry, or use local action. |
| Local memory/storage limit | Preserve original; specific smaller-batch suggestion. | Retry fewer files / use native app where verified. |
| Cancelled | Confirm output not committed; preserve original and usable results. | Retry or new instruction. |
| Preview | Read-only viewer, page navigation, zoom, close and save. | Back to same conversation state. |

## Interaction details that matter
- Choose/drop files must never submit them to the backend. Do not use multipart upload forms or server actions for document bytes.
- A request may be typed before adding files. Keep the draft and ask for the missing files with one action.
- Files are shown in the exact order used for a default merge. Reordering is optional, not a required extra screen.
- Preflight should not block typing. Disable execution only while required information remains unavailable.
- Single-tap shortcuts compile known plans locally; they do not call an LLM to interpret a button.
- Make the Send button visibly enabled/disabled; include an accessible name. On desktop Enter sends and Shift+Enter inserts a line break. Do not mishandle IME composition.
- After import, collapse the empty-state artwork into compact files. In keyboard-open state, composer and selected-file count remain visible.
- When requests are complete, auto-start safe copy-producing operations. A compact cancel/undo mechanism replaces repetitive confirmation dialogs.
- Passwords use local secure fields. Never ask for a password as a chat reply.
- “Remove page 3” operates on the focused/current version, not accidentally on the original. Show a compact active-result chip near the composer.
- When multiple outputs exist and “this one” has no focus, ask which output. Never silently choose.
- A follow-up during processing queues as a draft or offers “Stop and change”; do not execute against half-written output.
- Engine logs remain behind Details. A flowchart is not the default processing screen.
- A result is “Ready” before saving; it is “Saved” only after successful local export confirmation. Cancelling a save picker is not a save.
- Restore focus after dialog dismissal; support keyboard, VoiceOver, TalkBack and screen readers.
- Never use success sound/confetti by default. A small completion transition is sufficient.

## UI fidelity acceptance
Capture the actual app at compact phone, standard phone, portrait/landscape tablet, desktop and keyboard-open sizes. Compare palette, hierarchy, spacing, typography, illustration, CTA, shortcuts and composer against the reference. Record intentional deviations (privacy wording, adaptive layout, actual platform controls) separately from accidental drift.

Use a mismatch ledger: reference evidence, current screenshot, severity, fix, retest. Test real fixture imports and actual outputs, not a canned chat conversation. Passing unit tests does not count as visual verification.


## Version 2 secondary journey extension
Use `growth/SCREEN_AND_STATE_INVENTORY.md`, `growth/COPY_DECK.md` and the onboarding/paywall documents for the additional states. These are contextual cards/sheets, not added permanent primary navigation. Keep the approved atepdf design, with a compact sample link and concise cloud-AI disclosure where necessary. Pricing needs verified runtime text, visible dismissal and accessibility. Appllama references inform pattern choices only; no new brand, competitor art or full quiz funnel is approved.
