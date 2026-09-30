# atePDF v1 component inventory

**Issue:** SHR-105 · **Status:** proposed · Tokens: [atepdf-tokens.json](tokens/atepdf-tokens.json) · Rules: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) · Flows: [UX_SPEC.md](UX_SPEC.md)

Every reusable component in the v1 Mac app. Each entry gives its purpose, anatomy with tokens, variants, states, keyboard behaviour, accessibility, and where it is used (**Used in** refers to UX_SPEC sections). Token names are written as in the JSON (`group.name`), with these short forms: type roles by name (`body` = `type.body`, likewise `bodyStrong`, `headline`, `ui`, `uiStrong`, `meta`, `section`, `caption`, `kbd`); `duration.*` and `easing.*` = `motion.duration.*` / `motion.easing.*`; `elevation.N` as in the JSON. Space values refer to the `space` scale. Text uses `font.family.ui` unless stated.

**Common state vocabulary**, which applies wherever it is listed:

| State | Treatment |
|---|---|
| default | As specified |
| hover | Adds `surface.hover` (plain/row) or the `*Hover` fill (Iris). Pointer devices only; `duration.fast`. |
| focus | Keyboard focus ring (`focus.ringWidth` 2, `focus.ringOffset` 2, `focus.ringColor` = `accent.fill`), radius + 2 |
| pressed | Adds `surface.pressed` or the `*Pressed` fill |
| selected | `surface.selected` background, `accent.subtleBorder` outline for cards/items, `uiStrong` label |
| disabled | Label `text.disabled` on `surface.hover` (filled variants) or no fill (plain), icon at 40% opacity, no hover. Still focusable when an explanation tooltip exists. |
| busy | The label is replaced by the activity glyph plus a verb ("Saving…"); width is fixed to prevent layout shift |
| error | `status.danger.fg` icon and message directly below or inline. The control stays usable for retry. |

---

## A. Primitives

### A1 Button
- **Purpose:** every text action.
- **Anatomy:** optional 16 pt icon + 6 + label (`uiStrong`). Radius `radius.sm`. Height `size.control.md` 28 (lg `size.control.lg` 32 in sheets). Horizontal padding 10 (lg 12).
- **Variants:**
  - **Primary (Iris):** `accent.fill` background, `text.onAccent` label, hover `accent.fillHover`, pressed `accent.fillPressed`. One per region.
  - **Secondary:** `surface.raised` background, 1 pt `border.hairline` border plus `elevation.1` in light, `text.primary` label.
  - **Plain:** no background, `text.secondary` label, hover `surface.hover`.
  - **Destructive:** `status.danger.fill` background with `text.onAccent` label. Only in ConfirmSheet, never the default button.
  - **Destructive-plain:** `status.danger.fg` label, no fill (for example "Delete All Local Data…" in settings rows).
- **States:** default, hover, focus, pressed, disabled, busy.
- **Keyboard:** Space/Return activates when focused. The default button in a sheet responds to Return. Cancel buttons respond to Esc.
- **Accessibility:** role button, and the label is the visible text. An icon-only button requires an accessibility label and a tooltip.
- **Used in:** everywhere.

### A2 IconButton
- 28 × 28 (toolbar) or 24 × 24 (inline, `size.control.sm`), radius `radius.sm`, icon `size.icon.md` in `text.secondary`. Toolbar variant turns `text.primary` on hover.
- **Toggled** (for example the Files panel shown): `surface.pressed` background, `text.primary` icon.
- **States:** all common states except selected.
- **Tooltip** after 600 ms, showing the name and the shortcut (for example "Files panel ⌥⌘I").
- **Used in:** toolbar, composer attach, row hover actions.

### A3 Keycap
- Inline hint: `kbd` type, `text.tertiary`, 1 pt `border.hairline`, radius `radius.xs`, padding 0/4, min width 16. It may combine glyphs (⌘K).
- Decorative: hidden from accessibility, since the shortcut is exposed through the control's accessibility hint.
- **Used in:** composer hint row, palette rows, tooltips, empty state, ShortcutsSheet.

### A4 Tag
- `caption` type, radius `radius.xs`, height 18, padding 0/6.
- **Variants:**
  - Current: `accent.subtle` background, `accent.text` label.
  - Earlier: `bg.sunken` background, `text.secondary` label.
  - Verified: no fill, `check` icon + `status.success.fg`.
  - Locked: `lock-keyhole` icon + `text.secondary`.
  - Unsupported: `status.danger.bg` / `status.danger.fg`.
  - Quality changed: `status.warning.bg` / `status.warning.fg`.
  - Guest / Pro: `bg.sunken` / `accent.subtle`.
- **Accessibility:** read as part of the parent's label ("Merged PDF, current, verified, 12 pages, 3.4 megabytes").

### A5 StatusPill
- Height 24, radius `radius.full`, padding 0/8, 14 pt icon + 6 + `meta` label.
- **Variants:**
  - **Local** ("On this Mac"): `status.local.bg` / `status.local.fg`.
  - **Outbound** ("Leaves this Mac"): `status.outbound.bg` / `status.outbound.fg`.
  - **AI unavailable** ("atePDF AI unavailable"): `bg.sunken` / `text.secondary`.
- **Compact** (window < `size.window.compactBreakpoint`): icon only, 24 × 24, same accessibility label.
- **States:** hover, focus, pressed (it opens PrivacyPopover).
- **Used in:** toolbar, ConsentSheet header, PrivacyReceipt.

### A6 TextField / SecureField
- Height 28, radius `radius.sm`, `surface.raised`, 1 pt `border.strong`, `ui` text, placeholder `text.tertiary`. Focus: border `accent.fill` plus ring.
- **SecureField:** native secure text entry, with a `key-round` leading icon. Autocorrect, autofill suggestions and copy are off. Paste is allowed. There is no reveal toggle in v1. The value is never mirrored into React state beyond the submit handler and is cleared on submit, cancel or unmount (PDF-06).
- **Error:** a `meta` message in `status.danger.fg` below the field; the border stays `border.strong`, and the danger colour is carried by the message and icon.
- **Used in:** SecureInputCard, Settings (developer section), Paywall (none).

### A7 SegmentedControl
- Height 28, radius `radius.sm`, track `bg.sunken`. The selected segment uses `surface.raised` + `elevation.1`, `uiStrong`. Arrow keys move the selection.
- **Used in:** Settings ▸ Appearance, Settings ▸ Text size, PaywallSheet period.

### A8 Toggle
- 32 × 18 track, radius `radius.full`. Off: `border.strong` track. On: `accent.fill`. Knob `surface.raised`, 14 pt. Duration `duration.fast`.
- **Used in:** Settings (only for real boolean settings; see UX_SPEC 12).

### A9 Popover
- `surface.elevated`, radius `radius.xl`, `elevation.2`, hairline border, padding 12–16, 8 pt arrow-less offset from its anchor. Dismissed by Esc or click-away, returning focus to the anchor.
- **Used in:** PrivacyPopover, WorkspaceContext popover, AllowancePopover.

### A10 Menu
- Native context menu where the platform provides one (Catalyst `UIContextMenuInteraction` / menu-bar menus). For the in-window fallback: `surface.elevated`, radius `radius.md`, row height 24, `ui` text, shortcut right-aligned in `text.tertiary`, selected row `accent.fill` with `text.onAccent` (the macOS convention).
- **Used in:** toolbar ⋯, row context menus (file, result, collection item).

### A11 Sheet
- Attached to the window, centred. `surface.elevated`, radius `radius.2xl`, `elevation.3`, over a `scrim` backdrop. Widths: `size.sheet.sm` 420 (confirm), `size.sheet.md` 560 (consent, paywall, onboarding), `size.sheet.settings` 760 × 560, `size.sheet.previewMax` 1000 × 820 (Quick Look).
- **Anatomy:** optional 20 pt icon, title (`title1`), body (`body`/`ui`), footer with buttons right-aligned (cancel left of default). Padding 20, footer top border hairline.
- **Motion:** `duration.sheet` present, 180 ms dismiss, `easing.enter`/`easing.exit`.
- **Keyboard:** focus moves to the first meaningful control (not the default button when the action is consequential; see ConsentSheet). Esc cancels, except in onboarding, where Esc is ignored. Focus is trapped inside and restored to the invoker on close.
- **Accessibility:** role dialog, labelled by its title, modal.
- **Used in:** C-sections below.

### A12 Tooltip
- `surface.elevated`, radius `radius.sm`, `meta`, `elevation.2`, 600 ms delay, 0 ms when moving between adjacent tooltipped controls. Shows the full name and the shortcut.

### A13 Meter
- Determinate only. Track height 4, radius `radius.full`, track `bg.sunken`, fill `accent.fill`; `status.warning.fg` at the low threshold supplied by the service, `status.danger.fg` when exhausted.
- **Variants:** AllowanceMeter (used / available, from the server), StorageMeter (a stacked bar by category: originals `accent.fill`, results `status.local.fg`, previews and analysis `text.tertiary`, chat and other `border.strong`).
- Never animated from 0. It renders the known value.
- **Used in:** AllowancePopover, Settings ▸ Account & Pro, Settings ▸ Privacy & Storage.

### A14 ActivityGlyph
- 14 × 14. Two stacked rounded squares 10 × 5 (radius 1.5) with a 2 pt gap, in `accent.text`. The top and bottom alternate opacity 1 ↔ 0.35 over `duration.activityCycle`. With Reduce Motion it is static.
- Hidden from accessibility, since the parent announces the stage.
- **Used in:** ActivityRow, busy Buttons, toolbar WorkspaceContext while busy.

### A15 Disclosure
- A plain button with a `chevron-right` icon that rotates 90° over `duration.base`, followed by `meta` text in `text.secondary`. Content expands with an opacity and height transition. Announced as expanded or collapsed.
- **Used in:** ActivityRow steps, PrivacyReceipt details, ConsentSheet "What exactly is sent".

### A16 BrandMark
- An SVG of the approved mark (DESIGN_SYSTEM 2.4). Sizes 16, 20, 32, 64. Colours: `brand.iris` (onboarding, About), monochrome `text.tertiary` (empty state). The app icon uses `brand.ink`, `brand.inkTop`, `brand.irisLight`, `brand.irisDeep` and `brand.fold` in the icon layers only.

---

## B. Shell

### B1 WindowToolbar
- Height `size.toolbar.height` 52, full-bleed, `bg.window` (85% + blur where supported), bottom hairline once content scrolls under it (hidden at scroll top). Layer `layer.toolbar`.
- **Anatomy:** traffic-light inset 78 · WorkspaceContext (leading, after the inset) · flexible space · StatusPill (Local) · IconButton Files panel (`panel-right`, toggled state) · IconButton More (`ellipsis`, opens a Menu: Start Over…, Settings… ⌘,, Keyboard Shortcuts ⌘/, Help).
- The toolbar is a window drag region, except over its controls.
- **Compact:** StatusPill shows its icon only, and WorkspaceContext truncates first.
- **Used in:** all main-window states.

### B2 WorkspaceContext
- A plain button showing what the next instruction applies to: `ui` label + `meta` facts + `chevron-down`.
- **States:**
  - Empty: "No files yet" (disabled).
  - Sources only: "3 PDFs · 24 pages".
  - Current result: `file-text` + "Merged PDF · 12 pages".
  - Busy: ActivityGlyph + stage verb ("Merging…").
- **Click:** opens a Popover listing the current target and sources, with "Show in Files panel". It does **not** change the target in v1 (see UX_SPEC 5.4).
- **Accessibility:** "Working on: Merged PDF, current result, 12 pages. Show details."

### B3 FilesPanel
- Width `size.panel.files.default` 280 (resizable between `size.panel.files.min` and `size.panel.files.max`), `bg.panel`, leading hairline. Layer `layer.panel` (overlay mode: `elevation.3`, `radius.xl` on the leading corners, `surface.elevated`).
- **Anatomy:**
  - Header: "Files" in `section`, with a close IconButton in overlay mode.
  - **Results** section: the current result first as a FileRow (result variant, Current tag), then earlier results as FileRows (Earlier). A collection appears as one row that expands.
  - **Sources** section: ordered FileRows (source variant) with an order number and a drag handle.
  - Footer: "Stored on this Mac · 48.2 MB" (`meta`, `status.local.fg` icon), linking to Settings ▸ Privacy & Storage.
- **Empty:** hidden (it has no empty state; the toggle is disabled with the tooltip "Add files to see them here").
- **Keyboard:** ↑/↓ move between rows, Space opens Quick Look, ⌘S saves the focused result, ⌥↑/⌥↓ reorder the focused source, Delete removes the focused source (confirmation only if a pending plan references it; see UX_SPEC 5.3), and Return reveals the row's turn in the conversation.
- **Accessibility:** a landmark named "Files". Each section is a list. Reorder announces "Moved Invoice.pdf to position 1 of 3."
- **Used in:** 4, 5, 8, 9.

### B4 DropOverlay
- Covers the whole window content (layer `layer.dropOverlay`): `dropzone.fill` tint, an inner dashed border (1.5 pt `accent.fill`, radius `radius.xl`, 12 inset) and a centred label (`title2` + `meta`).
- **States:**
  - Valid: "Drop to add 3 PDFs" / "They'll be added in this order".
  - Mixed: "2 of 3 files can be added" / "Only PDFs and JPEG, PNG or HEIC images" (the formats come from the runtime capability catalogue, OPEN-07).
  - None valid: a `status.danger.fg` icon and "These files can't be added".
  - Busy: "Wait for the current task to finish, or press ⌘. to stop".
- Appears on drag-enter over `duration.fast` and disappears on leave or drop. **Test ID:** `drop-feedback` (kept).

### B5 InlineBanner
- Full-width inside the conversation column, above the thread (not the toolbar): `surface.raised`, hairline, radius `radius.lg`, 16 pt icon, `ui` text, trailing Plain buttons.
- **Variants:**
  - Info (`text.secondary` icon): restored an earlier save.
  - Warning (`status.warning.fg`): saving paused; cleanup pending.
  - Danger (`status.danger.fg`): workspace couldn't be opened, with Try Again.
  - Offline/AI unavailable (`cloud-off`, `text.secondary`): with Retry and Status.
- Dismissible only when informational. Persistent states stay until resolved.
- **Accessibility:** a polite live region on appearance.
- **Used in:** 3.3, 7.5, 12.4.

### B6 EmptyWorkspace
- Centred in the conversation column, above the composer. BrandMark 32 in `text.tertiary` · 16 · title "Drop PDFs or images here" (`title1`) · 6 · `meta` hint "or press ⌘O to choose files" · 24 · ExamplePrompt list (up to 3 rows: `ui` text with `corner-down-left` on hover) · 16 · Plain button "Try with sample PDFs".
- Example prompts fill the composer. They do not send and do not execute. They are drawn only from capabilities that the runtime catalogue marks as available (TOOL-15).
- **Test ID:** `welcome` (kept). The heading role stays. The heading text changes from "Drop files here" to "Drop PDFs or images here", and tests must be updated (MIGRATION_MAP).

---

## C. Conversation

### C1 Thread
- A vertical list in the conversation column. Spacing: 16 between turns in a task and 28 between tasks. Top padding 24; bottom padding = composer height + 16.
- **Scroll behaviour** follows UX_STATE_CONTRACT (follow on a new submission; preserve the reading position when the user scrolls up). **LatestButton** appears when the newest item is out of view.
- **Test ID:** `conversation` (kept).
- **Accessibility:** each task is a group labelled by its request. Assistant messages are announced through a polite live region (existing `useAnnounce`).

### C2 RequestBlock (user turn)
- Left-aligned (not right). `surface.request` background, radius `radius.md`, padding 8/12, max width 100% of the column, `bodyStrong` text in `text.primary`. A leading prompt glyph `chevron-right` 14 in `text.tertiary`.
- **Variants:**
  - Typed.
  - Quick action: identical, since it is a real conversational input (D-04); an optional trailing `meta` "via ⌘K" is not shown.
  - Answer to a clarification: identical, preceded by the question's context line in `meta`, "Answer to: Which file should come first?"
- **States:** default. Hover reveals a Copy IconButton (the local clipboard only).
- **Accessibility:** prefixed "You:". **Test ID:** `user-message` (kept).

### C3 AssistantMessage
- No container. `body` text in `text.primary`, starting at the column's left edge (aligned with the RequestBlock text, not its glyph). Paragraph spacing 8. Inline `code` in `bg.sunken`, radius `radius.xs`.
- **Variants:** normal; **OutcomeNotice** (see C11).
- Hover shows Copy.
- **Accessibility:** prefixed "atePDF:". **Test ID:** `assistant-message` (kept).

### C4 SourceGroup (files added)
- Renders a local import as a turn. Header `meta`: "Added 3 PDFs · 24 pages" + `status.local.fg` "Checked on this Mac". Below it, FileRows (source variant) in order, touching (2 apart), inside a `surface.raised` container with a hairline border, radius `radius.lg` and padding 4.
- **While importing:** each row shows the importing state as its own check completes (real per-file progress from the controller).
- **Collapsed:** more than 5 files show 4 rows plus "Show 3 more".
- **Used in:** 4.

### C5 FileRow / FileChip
- **FileRow:** height `size.row.height` 32 (44 with thumbnail variant), radius `radius.md`, padding 0/8.
  - Anatomy: [order number `meta` `text.tertiary`, sources only] · PageThumbnail `size.thumb.row` · name (`ui`, middle-truncated) · facts (`meta` `text.secondary`: "8 pages · 1.2 MB") · trailing Tag(s) · hover actions (Quick Look, drag handle for sources, remove ✕ for sources before processing).
- **FileChip** (compact, used in WorkspaceContext and composer context): height 22, radius `radius.sm`, `bg.sunken`, `size.thumb.chip` thumbnail + `meta` name.
- **Variants and states:**

| Variant | Visual |
|---|---|
| source | Order number; the drag handle appears on hover/focus |
| result | Current or Earlier tag; Save IconButton on hover |
| collection item | Checkbox-free; selectable; Save on hover |
| importing | Thumbnail placeholder `bg.sunken`, ActivityGlyph, facts "Checking…" |
| locked | `lock-keyhole` Tag "Locked"; facts "Password needed"; thumbnail shows a blurred placeholder (a locked PDF cannot be rendered) |
| unsupported / refused | `ban` icon in `status.danger.fg`; facts "Can't be added: {specific reason}"; row at 100% opacity with the text readable (never greyed out) |
| missing (file moved) | `triangle-alert` in `status.warning.fg`; facts "Moved or unavailable · Locate…" |
| selected | `surface.selected` background + `accent.subtleBorder` inset |
| dragging | `surface.elevated`, `elevation.2`, no tilt; a 2 pt `accent.fill` line marks the drop position |

- **Keyboard:** see FilesPanel. **Accessibility:** "Invoice.pdf, source 1 of 3, 8 pages, 1.2 megabytes." Locked and unsupported states are included in the label.

### C6 PageThumbnail
- A render of the real page on `page.paper`, `radius.thumb`, `elevation.page`. It keeps the page's aspect ratio inside the slot (letterboxed on `bg.sunken`).
- Sizes: `size.thumb.chip`, `size.thumb.row`, `size.thumb.card`, `size.thumb.evidence`.
- **Loading:** `bg.sunken` placeholder, no shimmer.
- **Failed render:** `file-text` icon on `bg.sunken`.
- Rendered locally only. Thumbnails are workspace content and never leave the Mac (UNDERSTAND-05).

### C7 ActivityRow
- Replaces the incumbent JobActivity. It sits inline where the result will appear.
- **Anatomy:** ActivityGlyph · stage label (`uiStrong`) · detail (`meta` `text.secondary`) · trailing Plain button "Stop" with Keycap ⌘. · optional Disclosure "Steps" (multi-step).
- **Stage labels** (driven by controller and planner state only):

| Stage | Label | Detail | Marker |
|---|---|---|---|
| planning | "Planning" | "Sending your instruction to atePDF AI" | `cloud` 12 pt + `meta` "atePDF AI" in `text.secondary`. Not the Outbound style: an instruction is not document content (PRIV-02/03). |
| provider slow (> 8 s, measured) | "Still waiting for atePDF AI" | "You can stop; nothing has changed." | same |
| import | "Checking 3 PDFs" | "2 of 3 checked" (real) | Local |
| executing | operation title ("Merging 3 PDFs", "Removing 2 pages", "Making text searchable") | engine message; real "Page 4 of 12" when the engine reports it | Local |
| validating | "Verifying the result" | "Checking pages, order and text with an independent reader" | Local |
| cancelling | "Stopping…" | "Waiting for the current step to stop safely" | — |

- **Steps disclosure:** one row per real step: `check` complete (`status.success.fg`), ActivityGlyph active, `circle` pending (`text.tertiary`), `x` cancelled or failed.
- **Completion:** the row is replaced in place by the ResultCard (`duration.base` crossfade). Failure is replaced by an OutcomeNotice.
- There is no percentage unless the engine reports real units. There is never a time estimate.
- **Test IDs:** `progress-message` and `activity-pulse` (kept on the glyph).

### C8 ChoiceList (clarification)
- Directly under the assistant question. Rows: height 32, radius `radius.md`, `surface.raised` inside a hairline container, radius `radius.lg`, padding 4. Each row: number Keycap 1–9 · `ui` label · optional `meta` detail (for example "Invoice.pdf · 2 pages"), with a thumbnail when the choice is a file or page.
- A final row "Something else…" focuses the composer.
- **States:** default, hover, focus (row focus), selected (after answer: the chosen row has a `check`, the others fade to `text.tertiary`), stale (container at 60% opacity and `meta` "This question is closed.").
- **Keyboard:** Tab from an empty composer moves into the list; ↑/↓ move; Return or 1–9 choose; Esc returns to the composer without answering.
- **Accessibility:** a radio-group-like list named by the question. The chosen answer is announced.

### C9 ProposalCard
- Used when the user must verify a target or consequence before execution (CONV-05, D-15). `surface.raised`, hairline, radius `radius.lg`, padding 12/14.
- **Anatomy:** icon (variant) · `headline` title · `ui` body (1–2 sentences) · optional evidence strip · footer: Primary + Secondary buttons.
- **Variants:**
  - **Quality caveat:** `triangle-alert` in `status.warning.fg`. Example title: "Image quality may change". Buttons: "Create Copy" (Iris) / "Keep Current Result". Test IDs: button names "Create optimised copy" and "Keep working" become "Create Copy" and "Keep Current Result" (MIGRATION_MAP).
  - **Evidence confirmation** (uncertain local detection, UNDERSTAND-03): `scan-search` in `text.secondary`. Example title: "Remove these 2 pages?". The evidence strip shows PageThumbnails at `size.thumb.evidence` with page numbers and the reason ("Looks blank", "Faint marks"); each thumbnail is a toggle (selected = included). Buttons: "Remove 2 Pages" (Iris; the label count follows the selection) / "Cancel".
  - **Plan preview** (multi-step with a material consequence): an ordered list of steps in `ui`.
- **States:** active, answered (buttons are replaced by `meta` "You chose: Create Copy"), stale (as ChoiceList).
- **Keyboard:** Return triggers the primary action only when focus is inside the card. Focus moves to the card when it appears, if the composer is empty.

### C10 SecureInputCard
- The password moment (D-14, PDF-06). `surface.raised`, 1 pt `status.local.fg` border at 40%, radius `radius.lg`, padding 12/14.
- **Anatomy:** `key-round` icon + `headline` ("Password for Contract.pdf" or "Choose a password for Merged PDF") · SecureField (and a Confirm field for Protect) · `meta` line with a `status.local.fg` icon: "Stays on this Mac. It's never added to the chat or sent to AI." · buttons "Unlock" / "Protect" (Iris) and "Cancel".
- **States:** default, focus (auto-focused on appear), verifying (busy button "Checking…"), wrong password (message "That password didn't work. Try again." with the field cleared, focus retained, no attempt counter), mismatch (Protect), done (the card collapses to `meta` "Password accepted · kept only for this task", or the result follows).
- **Composer interplay:** while the card is active, the composer placeholder reads "Use the password field above; don't type passwords here" and remains usable. The existing secret detection still guards the composer (SECRET_CHAT_WARNING).
- **Accessibility:** the field label includes the filename, and the privacy line is its description.

### C11 OutcomeNotice (refusal, error, cancelled)
- An AssistantMessage with a leading 16 pt status icon and an optional action row. It is not a card, so failures stay calm.
- **Variants:**

| Variant | Icon | Required copy element | Actions |
|---|---|---|---|
| refused (unsupported structure) | `ban` `status.danger.fg` | specific reason + "I haven't changed it." | "What's supported?" (Plain; local help, no AI call) |
| invalid request | `circle-x` `status.danger.fg` | valid range, for example "This PDF has 12 pages." | — |
| couldn't finish | `circle-x` `status.danger.fg` | "Your files and the previous result are unchanged." | Try Again |
| cancelled | `square` `text.secondary` | "Stopped. No new result was created." or "Stopped after the result was saved." (controller truth) | — |
| AI unavailable | `cloud-off` `text.secondary` | per the outage policy (OPEN-09) | Retry · Status |
| allowance exhausted | `lock` `status.warning.fg` | UX-02 copy | See Pro · Restore Purchase |
| save failed | `circle-x` `status.danger.fg` | "Couldn't save to {folder}. The result is still here." | Try Again |

### C12 ResultCard (single PDF)
- **Current** (full): `surface.raised`, hairline, `elevation.1`, radius `radius.lg`, padding 12/14.
  - Row 1: PageThumbnail `size.thumb.card` (Space/click = Quick Look) · title (`headline`, operation-derived: "Merged PDF", "PDF without pages 2 and 7", "Searchable PDF", "Smaller PDF", "Protected PDF") · facts (`meta`: "12 pages · 3.4 MB", or "8.2 MB → 3.7 MB" for compression) · tags: Current, Verified (check), optionally Quality changed.
  - Row 2 (optional note, `meta` `text.secondary`): an honest caveat, for example "Target was 5 MB; this is the smallest copy within the approved quality."
  - Actions (right-aligned in row 1 at ≥ 560 pt card width; otherwise row 3): **Save…** (Iris, ⌘S) · Quick Look (IconButton `eye`, Space) · More (IconButton: Show in Files Panel, Copy File Name).
  - **Undo** is a Plain button with the Keycap ⌘Z, in the card footer, only when a previous result exists (`store.canUndo`).
  - **Receipt line** under the actions (`meta`, polite live region): "Saved to Documents as Merged.pdf" · "Save cancelled · still ready to save" · "Couldn't save · Try Again". The receipt belongs to this exact result.
- **Earlier** (collapsed): a single FileRow (result variant, Earlier tag) with hover actions Save and Quick Look. No Iris. Clicking expands it to a secondary-styled card (Save as Secondary). There is no Undo on earlier results.
- **States:** current, earlier, saving (Save busy "Saving…"), saved (a receipt with a `check` in `status.success.fg`; the Save label stays "Save…" for another copy), save failed (receipt in `status.danger.fg`), restored by Undo (the card reappears with the `meta` note "Restored"), stale file (thumbnail missing, Quick Look disabled with an explanation).
- **Test IDs:** `current-result`, `previous-result`, `result-facts` (kept). Button names: "Save PDF" becomes "Save…", accessibility label "Save PDF" (kept for tests); "Preview" becomes Quick Look with the accessibility label "Preview" (kept); "Undo" (kept).

### C13 CollectionCard (multiple outputs, TOOL-14)
- Card as ResultCard. Header: `files` icon · title "Split into 4 PDFs" / "12 page images" · facts "4 files · 9.8 MB total" · Current / Verified tags.
- **Body:**
  - PDFs: a list of up to 6 FileRows (collection item) with number, name, pages and size, then "Show all 12".
  - Images: a grid of PageThumbnails at `size.thumb.card` (4–6 per row) with `meta` names below.
- **Actions:** **Save All…** (Iris, ⌥⌘S; opens a folder chooser) · Quick Look (the focused item; ←/→ inside Quick Look page through the items) · per-item Save on hover.
- **Collision:** a ConfirmSheet variant (see C-sheets): "3 files with these names already exist in Downloads" · Keep Both (default) / Replace / Cancel.
- **Receipt:** "Saved 4 files to Downloads/Split – Report" or partial: "Saved 3 of 4 · 1 couldn't be written · Try Again".

### C14 TextResultCard (Extract text)
- Card with a `text` icon, title "Extracted text", facts "12 pages · 4,210 words". The body is an excerpt (the first 6 lines in `body`, `text.secondary`, masked fade at the bottom) with page separators shown as `meta` "— Page 2 —".
- **Actions:** Save as Text… (Iris) · Copy Text (Secondary; the local clipboard) · Open in Quick Look (a full selectable text view).
- A warning Tag appears when OCR confidence is low: "Some text may be misread", with a Disclosure listing pages.

### C15 PrivacyReceipt
- An inline row after any content transfer (the future PRIV-04 flows). `meta` text + `arrow-up-right` in `status.outbound.fg`: "Sent 3 pages of Contract.pdf to atePDF relay → {Provider} for {purpose} · 10:42". Disclosure: the payload summary, recipients and retention statement exactly as shown in the consent.
- It is also listed in Settings ▸ Privacy & Storage ▸ Activity.
- **Used in:** 10.3. **No v1 flow triggers this today.** It is designed so that no transfer can ever happen without a visible receipt.

### C16 LatestButton
- A floating Secondary button centred above the composer: `arrow-down` + "Latest", `elevation.2`, radius `radius.full`. It appears when the newest content is out of view. ⌘↓ triggers it. Accessibility name "Latest message" (kept).

---

## D. Composer

### D1 Composer
- Docked at the bottom of the conversation column, with a 16 margin to the window's bottom edge. `surface.raised`, 1 pt `border.hairline`, radius `radius.xl`, `elevation.2`. Minimum height `size.composer.minHeight` 88.
- **Anatomy (top to bottom):**
  1. **Context row** (when files exist): FileChip for the target ("Merged PDF · 12 pp") or "3 sources", with an ⓘ tooltip "Your next request applies to this". `meta` `text.secondary`. Padding 10/12/0.
  2. **Input:** native multiline (the uncontrolled composer is kept), `body` text, placeholder `text.tertiary`. Grows to `size.composer.inputMaxHeight` 200, then scrolls. Padding 8/12.
  3. **Action row:** Attach IconButton (`plus`, ⌘O) · SuggestionChips (inline, when the input is empty) · flexible space · AllowanceIndicator (guest only) · Send/Stop button.
- **Send:** 28 × 28, radius `radius.sm`, `arrow-up`. Iris when the input has text and sending is allowed; `surface.hover` + `text.disabled` otherwise. Accessibility name "Send message" (kept).
- **Stop:** replaces Send while busy: Secondary style, `square` glyph, name "Cancel" (kept), shortcut ⌘. (and Esc when the composer is empty).
- **Hint row** (below the shell, outside it, `meta` `text.tertiary`, visible only when the input is focused and empty, and on first use): "Return to send · ⇧Return for a new line · ⌘K for actions".
- **States:**

| State | Treatment |
|---|---|
| empty | placeholder "Describe what you need…" (no files) / "What should I do with these 3 PDFs?" (sources) / "What next for Merged PDF?" (current result) |
| typing | Send is Iris |
| focus | border `accent.subtleBorder` + 40% ring |
| drag-over | the whole window DropOverlay (the composer doesn't get its own) |
| awaiting clarification | placeholder "Answer, or ask for something else…"; the context row adds the question in `meta` |
| busy | input stays editable (drafting allowed); Send replaced by Stop; Return does not send (hint: "Finish or stop the current task first") |
| secure input active | placeholder "Use the password field above; don't type passwords here" |
| AI unavailable | per OPEN-09: the input stays enabled; an InlineBanner explains; Send behaviour follows the policy |
| exhausted | the Composer is replaced by ExhaustedBar (D4); the draft is preserved |
| restoring | the shell is shown disabled with "Restoring your workspace…" (`meta`) |
| secret detected | an inline `meta` warning in `status.warning.fg` under the input; the text is not sent |

- **Keyboard:** Return sends; ⇧Return adds a newline; IME composition is respected. ⌘K opens ActionPalette. ⌘L focuses the composer from anywhere. ↑ in an empty composer does nothing (no message recall in v1). Tab moves to a pending ChoiceList or ProposalCard if present.
- **Accessibility:** textbox name "Tell atePDF what to do" (renamed from "Tell atepdf what to do"; tests updated).

### D2 SuggestionChips (quick actions, surfaced)
- Up to 3 chips inside the composer action row when the input is empty and there are files. Each chip: height 24, radius `radius.sm`, `bg.sunken`, `meta` `text.primary` label, no icon. A trailing Keycap chip "⌘K" labelled "More".
- Chips are **context-aware** and drawn only from the runtime capability catalogue (TOOL-15). Examples: sources = 3 → "Merge in this order", "Compress", "Make searchable"; a current result → "Compress", "Remove pages…", "Protect…".
- **Activation** puts a natural-language request into the thread as a RequestBlock (for example "Merge these 3 PDFs in this order") and sends it through the same AI orchestration path as typed text (D-04, CONV-01). A chip ending in "…" instead fills the composer ("Remove pages ") for completion.
- **States:** default, hover, focus, pressed, disabled (busy / not supported by the current target, with a tooltip saying why).
- **Test IDs:** button names "Merge", "Compress" and "Make searchable" are kept as accessibility names, with the visible label able to be longer.

### D3 ActionPalette (⌘K)
- A popover anchored above the composer, width `size.palette.width` 560, `surface.elevated`, radius `radius.xl`, `elevation.3`, layer `layer.popover`.
- **Anatomy:** a search field (`ui`, placeholder "Search actions…") · sections (`section` labels): **Suggested** (context-aware, the same source as the chips), **All actions** (every available capability, with the ones that don't apply to the current target listed as disabled with a reason), **Workspace** (Add Files… ⌘O, Save Result… ⌘S, Start Over…, Privacy & Storage…, Settings… ⌘,). Rows: height `size.row.height`, 16 icon, `ui` label, `meta` detail right-aligned ("3 PDFs", "current result"), Keycap if a shortcut exists. At most `size.palette.maxRows` 8 rows are visible before scrolling.
- **Behaviour:** type to filter (local, instant); ↑/↓; Return runs the action. Capability rows behave exactly like SuggestionChips (they become a conversational request through the AI). Rows ending in "…" fill the composer instead. Workspace rows are local UI commands (CONV-08: they need no model call). Esc closes and returns focus to the composer.
- **Why this is not a tools dashboard:** it has no persistent surface, it has no parameters UI, and every document action becomes a sentence in the conversation.

### D4 ExhaustedBar
- Replaces the composer in the same slot and at the same height when the guest allowance is exhausted, or Pro has expired or been revoked (BILL-02, BILL-04). `surface.raised`, hairline, radius `radius.xl`.
- **Content:** `lock` icon in `status.warning.fg` · `ui` "You've used your free allowance. Upgrade to keep working. Your existing files are still available." · Iris "See atePDF Pro" · Plain "Restore Purchase".
- Existing results keep Save, Quick Look and Undo. Help, privacy and deletion remain reachable.

### D5 AllowanceIndicator
- Guest only. Composer action row, left of Send: `meta` `text.tertiary` "{n} free left" from the server, with `tabular-nums`. At the service's low threshold: `status.warning.fg`. It opens AllowancePopover (the meter plus one line about what counts, OPEN-02 copy) and "See atePDF Pro".
- It is hidden for Pro. It never decrements optimistically: it shows the server value.

---

## E. Sheets and settings

### E1 QuickLookPreview
- Sheet `size.sheet.previewMax` (or 90% of the window, whichever is smaller). `bg.sunken` well. Pages on `page.paper` with `elevation.page`.
- **Header:** file name (`title2`) · facts (`meta`) · tags · trailing Save… (Secondary) · Close (IconButton ✕).
- **Footer toolbar:** Page n of N · ‹ › · zoom − / Fit / + · for collections: item n of N.
- **Left rail (≥ 800 pt wide):** page thumbnails at `size.thumb.row` × 2, with the current page selected.
- **Read-only.** For text results: selectable text (MAC-03). For OCR results: text that can be selected and searched in the text layer when the platform provides it; otherwise a note "Selectable text is available after saving".
- **Keyboard:** Space or Esc closes; ←/→ or PageUp/PageDown change page; ⌘+ / ⌘− / ⌘0 zoom; ↑/↓ scroll.
- **Accessibility:** region "Read-only preview" (kept). Buttons "Next page", "Zoom in" and "Close preview" (kept). Focus returns to the invoking thumbnail or button.

### E2 ConsentSheet (content transfer, PRIV-04/05)
- `size.sheet.md`. Header: StatusPill Outbound "Leaves this Mac" · title "Send part of Contract.pdf to {Provider}?" (`title1`).
- **Body:** a definition list (`section` labels, `ui` values):
  - **What:** PageThumbnails of the exact pages, or data-category chips ("Page images", "Extracted text"), with counts.
  - **To:** atePDF relay → {Provider}.
  - **Why:** the purpose, in one sentence.
  - **Kept by them:** the provider retention statement (PRIV-08 truth only).
  - **Kept by atePDF:** yes or no, and for how long.
  - **If you don't send:** the local alternative or consequence.
- A Disclosure, "What exactly is sent", shows the payload manifest.
- **Footer:** "Don't Send" (Secondary, **initial focus**, Esc) · "Send 3 Pages" (Iris; the label always states the scope; Return activates only after focus moves to it or ⌘Return is pressed).
- **Rules:** no "Always allow" checkbox (PRIV-05). Nothing is uploaded while the sheet is open. Cancel results in the OutcomeNotice "Nothing was sent. Your files are unchanged."

### E3 ConfirmSheet (destructive and collision)
- `size.sheet.sm`. Icon (`triangle-alert` `status.warning.fg`, or `trash-2` `status.danger.fg`) · title · body stating exactly what is removed and what stays · buttons.
- **Variants:**
  - **Start Over:** title "Start over?". Body: "This clears the conversation and atePDF's copies of its PDFs and results on this Mac. Files you added and PDFs you've saved elsewhere stay unchanged." Buttons: "Save Current Result…" (Plain, left) · "Cancel" (default) · "Start Over" (Destructive). Name "Clear session" becomes "Start Over" (tests updated).
  - **Delete all local data:** the same pattern. No typed confirmation: the sheet's explicit Destructive button is enough. The body lists the categories and sizes from StorageMeter.
  - **Collision:** Keep Both (default) / Replace / Cancel.

### E4 SettingsSheet
- `size.sheet.settings` 760 × 560. A top tab bar (a centred segmented set of icon + label items, the macOS Settings toolbar style): General · Privacy & Storage · AI · Account & Pro · About. The pane body scrolls.
- **SettingsSection:** a `section` label + a grouped container (`surface.raised`, hairline, radius `radius.lg`) of SettingsRows.
- **SettingsRow:** height ≥ 40, padding 0/14, `ui` label left, optional `meta` description below the label, control right (Toggle, SegmentedControl, Button, value text). Rows are separated by an inset hairline.
- **Keyboard:** ⌘1–⌘5 switch tabs; Tab moves through controls; Esc closes.
- **Pane content:** see UX_SPEC 12.

### E5 OnboardingSheet
- `size.sheet.md`, 3 panes, a pager of dots (`text.tertiary` / `accent.fill`), and buttons "Continue" (Iris) / "Back" (Plain). Each pane: a 160-pt illustration built from real components (a mini thread, a StatusPill pair, an AllowanceIndicator), then `display` title, then `body` text. Content: UX_SPEC 13.

### E6 PaywallSheet
- `size.sheet.md`. BrandMark 32 · "atePDF Pro" (`display`) · a one-line value statement · a list of 3 benefits (`ui` with `check`), using only approved claims (for example "Keep working after your free allowance", "The same local processing and privacy rules", "Manage or cancel in {channel subscription settings}"; never "unlimited", BILL-03) · **PlanOption** pair (Monthly / Annual) as two selectable cards (radius `radius.lg`, selected = `accent.subtleBorder` + `surface.selected`), with prices from StoreKit or the direct-channel provider and a savings line computed from real prices (never hard-coded) · Iris "Continue" · Plain "Restore Purchase" · `meta` links: Terms, Privacy, "Manage subscription".
- **States:** loading prices (the PlanOptions show a `bg.sunken` placeholder; Continue disabled), purchasing (busy), pending (`meta` "Waiting for confirmation from the App Store"), failed (an inline danger message), success (a check, "You're on atePDF Pro", Done), restore not found. Channel differences (App Store vs direct) change only the store copy and the manage link (DIST-01/04).

### E7 PrivacyPopover
- Opened from the toolbar StatusPill. Width 320. Three rows with icons:
  1. `status.local.fg` "Your files are processed on this Mac."
  2. `cloud` "Your instructions go to atePDF AI to plan the steps; files and names don't."
  3. `arrow-up-right` "Anything else leaves only if you approve it, one request at a time."
- A Plain link "Privacy & Storage settings".

### E8 ShortcutsSheet
- `size.sheet.md`. A two-column list of every shortcut from UX_SPEC 15, grouped. ⌘/ opens it.

---

## F. Coverage check

Tokens referenced above (by name) cover every token in `atepdf-tokens.json`. The remainder are used as follows:

- `bg.window`: the window, toolbar and thread background (B1, C1).
- `elevation.0`: every flat element on `bg.window` (messages, RequestBlock, Files panel rows).
- `surface.hover`, `surface.pressed`: the common states.
- `layer.base`: the thread and composer. `layer.sheet`: every E sheet.
- `motion` easing tokens: A11 and the rules in DESIGN_SYSTEM 10.
- `size.window.min`, `size.window.default`, `size.window.panelBreakpoint`, `size.conversation.maxWidth`, `size.conversation.gutter`, `size.conversation.gutterCompact`: shell layout (DESIGN_SYSTEM 5, UX_SPEC 2).
- `size.hit.pointerMin`, `size.hit.touchMin`: every control (DESIGN_SYSTEM 14).
- `size.icon.sm`, `size.icon.lg`: meta icons and sheet headers.
- `type.display`, `type.title1`, `type.title2`: E5, E6, A11, E1.
- `space` and `radius` scales: throughout.
- `font.family.mono`: About and Diagnostics build identifiers.
- `font.feature.numeric`: every fact.
- `motion.duration.instant`: Reduce Motion.
- `motion.reduced`: every animated component.
