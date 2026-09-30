# atePDF v1 UX specification

**Issue:** SHR-105 · **Status:** proposed · Components: [COMPONENT_INVENTORY.md](COMPONENT_INVENTORY.md) · Visual rules: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) · Mockups: [mockups/index.html](mockups/index.html)

This spec covers every major v1 flow, screen by screen and state by state. It is a presentation spec: behaviour it relies on (routing, validation, consent binding, persistence, entitlement) is defined in [PRODUCT_V1.md](../PRODUCT_V1.md) and the behavioural contract in [UX_STATE_CONTRACT.md](../UX_STATE_CONTRACT.md). Where a behaviour is still an open decision (OPEN-xx), this spec shows where it appears and uses a placeholder. It does not choose the answer.

**Screen IDs** (for example `S4.2`) are referenced by the mockups and by SHR-106 regression tests.

**Reference journey** (PRODUCT_V1 §5): add 3 PDFs → "Merge these" → "Remove pages 2 and 7" → "Get it below 5 MB, then password-protect it" → quality confirmation → secure password → verified protected result → "Undo that". Each step below is annotated where the journey passes through it.

---

## 1. Invariants every screen must keep

| Invariant | Where it shows in the UI |
|---|---|
| Conversation is the workspace | Every action, including quick actions, palette actions, answers and confirmations, appears as a turn in the thread |
| AI orchestrates intent | Chips and the palette produce a RequestBlock and use the same send path as typed text. Workspace commands (open, save, settings, help, cancel, privacy) are local UI (CONV-08). |
| Deterministic local execution | ActivityRow shows local stages with the Local pill. The result shows Verified only after independent checks. |
| Local-first, consent for content | The toolbar StatusPill is always visible. Any content transfer requires ConsentSheet (S10.3). No v1 flow sends content today. |
| Secrets out of chat | Passwords only in SecureInputCard. The composer warns and withholds on secret detection. |
| Originals immutable | Every result and failure copy says what is unchanged. Sources are never overwritten. |
| Honest progress and receipts | No invented percentages or estimates. "Saved" appears only after the write succeeds. |
| Access to existing work never blocked | Exhaustion, AI outage and errors never disable Save, Quick Look, Undo, deletion, privacy or help |

---

## 2. Window and shell

### S2.1 Window sizes

| Width | Layout |
|---|---|
| 640–759 (compact) | Gutters 16. StatusPill icon only. Chips: 2 + ⌘K. Result actions wrap under facts. Files panel as overlay only. |
| 760–1119 (regular) | Gutters 24. Files panel as overlay (toggle ⌥⌘I). |
| ≥ 1120 (expanded) | Files panel docked, shown automatically once files exist (the user's hide choice persists). Conversation centred in the remaining width. |

- Minimum window 640 × 520 and default 1024 × 720. Size and position are restored on relaunch.
- Height below 600: EmptyWorkspace drops the example prompts, the composer's maximum height becomes 120, and QuickLook fits the window.
- Full screen: the same layout. The toolbar stays visible, and the conversation column stays at most 720 wide.
- Live resize never reflows the thread scroll position away from the item at the top of the viewport.

### S2.2 Toolbar

Leading: WorkspaceContext. Trailing: StatusPill (Local) · Files panel toggle · More (⋯). There is no logo and no title text (the title is hidden; the window's accessibility title is "atePDF").

---

## 3. First launch, relaunch and restore

### S3.1 First launch
1. The window opens at the default size with `bg.window`, and there is no splash.
2. OnboardingSheet (S13) presents over the EmptyWorkspace immediately.
3. On "Get Started", the sheet dismisses, focus goes to the composer, and the composer hint row is visible.

### S3.2 Relaunch with a saved workspace (STATE-01, SHR-39)
1. While restoring: the composer shows the restoring state, the thread area shows `meta` "Restoring your workspace…" centred, and the toolbar WorkspaceContext is disabled.
2. Restored: the thread appears scrolled to the latest task, the draft (if any) is back in the composer, and the Files panel shows at its persisted visibility. There is no animation of the restored history.
3. If a result was committed just before quit and has no card, an AssistantMessage "Here's your current result." + ResultCard is appended (existing behaviour, new visuals).

### S3.3 Restore problems (existing vault outcomes, new presentation)

| Outcome | InlineBanner variant | Copy source | Actions |
|---|---|---|---|
| restored previous save | Info | existing notice | Dismiss |
| cleanup pending | Warning | `CLEANUP_PENDING_NOTICE` | — (clears itself) |
| blocked: keychain locked / unavailable | Danger | `blockedMessages` | Try Again (when retryable) |
| blocked: corrupt / missing artifact / newer schema / storage | Danger | `blockedMessages` + "New work in this session won't be saved." | — |
| unavailable | Warning | existing notice | — |
| save failed / paused | Warning | `SAVE_FAILED_NOTICE` / `SAVE_PAUSED_NOTICE` | — |

The copy is unchanged and moves from a grey caption under the header into InlineBanner at the top of the thread.

---

## 4. Empty workspace and import

### S4.1 Empty (no files, no conversation)
- EmptyWorkspace centred above the composer: mark · "Drop PDFs or images here" · "or press ⌘O to choose files" · up to 3 example prompts (they fill the composer only) · "Try with sample PDFs".
- Composer: placeholder "Describe what you need…". Chips are hidden, because nothing can run without files.
- Typing a request without files is allowed. On send, the assistant replies (through the normal path) and asks for files. A one-line local fallback, "Add the PDFs you'd like me to work on," is used only when the policy says not to call the model.
- The Files panel toggle is disabled.

### S4.2 Drag over the window
DropOverlay states (valid, mixed, none valid, busy) as in COMPONENT_INVENTORY B4. Dropping during a busy task is rejected with the busy label, which matches the current `DropSurface disabled={busy}`.

### S4.3 File picker
⌘O, or the composer ＋, or "Add Files…" in the palette or menu opens the native open panel, filtered to supported types, with multiple selection. Cancel changes nothing and adds no turn.

### S4.4 Importing
1. A SourceGroup turn appears immediately with the files in the chosen order and each row in the importing state. The ActivityRow above it reads "Checking 3 PDFs · 1 of 3 checked" (real counts), with Stop.
2. Each row settles as it is checked: thumbnail, pages, size, and a Locked or Unsupported state where that applies.
3. Completion: the header becomes "Added 3 PDFs · 24 pages · Checked on this Mac". The assistant line says "Your 3 PDFs are ready. What would you like to do? Merge uses this order." (existing copy, trimmed). The chips appear in the composer, the Files panel shows (≥ 1120), and focus stays in the composer.
4. Stopped during import: the rows that finished stay and the others show "Not added". The OutcomeNotice (cancelled) reports what was added.

### S4.5 Locked PDF imported
The row shows Locked, "Password needed". The assistant line reads: "Contract.pdf is password-protected. Enter its password in the secure field below. It stays on this Mac." A SecureInputCard (Unlock) follows. The user can ignore it and work on other files, and the locked file is excluded from plans until unlocked. See S10.5.

### S4.6 Unsupported or rejected file
The row is in the unsupported state with the specific reason ("Has form fields I can't preserve yet", "Damaged file structure", "Not a PDF or supported image"). The other files still import. The assistant summarises: "I added 2 of 3 files. Scan.tiff isn't a supported image type." Removing the row is possible (✕). Nothing about the rejected file is sent anywhere.

### S4.7 Images added
Images appear as source rows with an image thumbnail and "Image · 3024 × 4032 · 2.1 MB". The chips adapt ("Combine into a PDF"). Order semantics match PDFs.

---

## 5. Sources: order, selection and the Files panel

### S5.1 Order
- Visible order = merge/combine order (UX_STATE_CONTRACT). The order is shown by the number on each source row.
- Reorder, removal and multi-select **behaviour** is owned by SHR-73. This section defines their presentation. Until SHR-73 lands, SHR-106 renders the order numbers and hides the controls that change order or remove sources (MIGRATION_MAP section 3).
- Reorder: drag within the Files panel or the SourceGroup (drag handle on hover/focus), or ⌥↑ / ⌥↓ on a focused row. The number animates at `duration.fast`. An announcement is made.
- Reordering is local workspace state. It increments the workspace revision, so any pending clarification or proposal becomes stale ("This question is closed.") per CONV-04. The assistant adds the local `meta` line "Order changed: Invoice.pdf is now first."

### S5.2 Selection
- Click selects a row, ⌘-click adds to the selection, ⇧-click selects a range, and ⌘A in the panel selects all. Selection is shown with the selected state.
- Selection is used for Quick Look (Space), Save (⌘S on a result), drag-out to Finder (a result copy) and Remove (sources).
- **Selection does not change the processing target in v1.** The target is the current result or the sources, as UX_STATE_CONTRACT defines. If SHR-73 defines selection-as-target semantics, WorkspaceContext and the composer context row must then show the change explicitly ("Working on: 2 selected PDFs").

### S5.3 Remove a source
✕ on a hover or focused row, or Delete. If no plan is pending, it is removed immediately, with the local `meta` line "Removed Scan.pdf from this workspace. The file on your Mac is unchanged." If a pending choice references it, the choice goes stale. Undo (⌘Z) does **not** restore removed sources: Undo is reserved for results (STATE-06). The confirmation-free removal is safe because the original file is untouched.

### S5.4 WorkspaceContext popover
Shows "Working on" (the current result or sources, with thumbnails), then "Sources (3)" and "Results (2)" counts, and "Show Files Panel ⌥⌘I". Informational only.

---

## 6. Conversation

### S6.1 Sending a request (journey step: "Merge these three PDFs")
1. Return. The RequestBlock is appended, the composer clears, and the thread follows to the bottom.
2. The ActivityRow shows "Planning · Sending your instruction to atePDF AI" with the `cloud` "atePDF AI" marker and Stop.
3. With a plan:
   - A safe copy operation runs immediately. The ActivityRow switches to local stages.
   - A quality-changing operation shows a ProposalCard (S8.4).
   - A plan that needs verification shows the evidence ProposalCard.
4. The completed ResultCard replaces the ActivityRow. The assistant line comes first: "I've combined the three PDFs in the order you added them."

### S6.2 Clarification (journey: none; example "Which of these two files should come first?")
1. The assistant question, followed by a ChoiceList with file rows and thumbnails, plus "Something else…".
2. The composer placeholder changes, and the context row shows "Answering: Which file should come first?".
3. The answer arrives by one of three routes:
   - choosing a row: the RequestBlock shows the answer text, preceded by "Answer to: …";
   - typing an answer in the composer: the same result;
   - typing "cancel": the assistant replies "Okay. That request is cancelled. Your files are unchanged."
4. A stale question (files changed, or a new unrelated request) shows the stale state. Choosing it is impossible.

### S6.3 Follow-ups (journey: "Remove pages 2 and 7")
The current result is the default target (the context row shows it). The new result becomes Current, and the previous one collapses to an Earlier row in place. There is no separate "history screen": history is the thread plus the Files panel's Results section.

### S6.4 Invalid request
OutcomeNotice (invalid): "This PDF has 12 pages, so there's no page 14. Which pages should I remove?" Everything stays unchanged. Where the model supports it, the question binds as a clarification.

### S6.5 Help
The toolbar More ▸ Help, the palette's "What can atePDF do?", or the `?` Keycap in the composer hint. Local, with no AI call (CONV-08). The assistant message lists the supported capabilities from the runtime catalogue, with 3 example prompts that can be clicked to fill the composer.

### S6.6 Conversation length
The thread is virtualised (the existing FlatList). Earlier tasks are never auto-collapsed. ⌘↑ jumps to the start, and ⌘↓ or LatestButton jumps to the newest item.

---

## 7. Quick actions (AI-routed)

### S7.1 SuggestionChips
They appear in the composer action row when the input is empty and files exist. Clicking one appends a RequestBlock with a natural sentence and sends it through AI orchestration (D-04). Chips ending "…" (for example "Remove pages…") fill the composer for completion instead.

### S7.2 ActionPalette (⌘K)
The search field is focused, and the sections are Suggested / All actions / Workspace (COMPONENT_INVENTORY D3). A capability row behaves like a chip. A Workspace row runs locally. A row that isn't available for the current target is shown disabled with its reason ("Needs 2 or more PDFs", "Not available yet"): only actions the runtime catalogue marks as implemented are listed (TOOL-15).

### S7.3 When atePDF AI is unavailable (OPEN-09 pending)
- An InlineBanner (Offline/AI unavailable) at the top of the thread: "atePDF AI isn't reachable right now. Your files and results are still here." with Retry and "Status" actions.
- Chips and palette capability rows follow the outage policy. **Until OPEN-09 is decided, SHR-106 must render them disabled with the tooltip "Needs atePDF AI"**. This is the conservative presentation, and it does not invent a local fallback. Workspace commands stay enabled.
- **Known source mismatch:** the current source compiles explicit buttons locally (the documented uncommitted bypass in DECISIONS.md). This design does not endorse it. Restoring AI routing is separate code work, flagged in MIGRATION_MAP.

---

## 8. Processing and progress

### S8.1 Stages
ActivityRow stages (COMPONENT_INVENTORY C7) come only from planner and controller state: planning → (waiting) → local execution per step → verification → done. Import has its own stage.

### S8.2 Stop
- Stop (⌘., or Esc in an empty composer): the label changes to "Stopping…", then the OutcomeNotice (cancelled) reports controller truth:
  - before commit: "Stopped. No new result was created.";
  - after commit: the result card appears and the message says "That finished before it could stop. Here's the result."
- Planning cancelled: "Planning cancelled. No files changed."

### S8.3 Waiting on the provider
After 8 s (measured) in planning, the detail changes to "Still waiting for atePDF AI. You can stop; nothing has changed." There is no automatic retry that enlarges the payload (PRIV-06), and no spinner-only screen.

### S8.4 Quality confirmation (journey: "I may need to reduce image quality. Shall I continue?")
A ProposalCard (quality caveat) with the title "Image quality may change". Body: "To get below 5 MB I'd re-encode images. Text and vector graphics stay sharp. I'll make a copy; your current result stays as it is." Buttons: "Create Copy" (Iris) / "Keep Current Result". Choosing either appends a RequestBlock ("Yes, create a copy" / "Keep the current result") to keep the transcript truthful.

### S8.5 Multi-step progress
A step list inside the Disclosure ("Steps · 2 of 3"). The headline always names the current real step ("Compressing images", "Protecting with a password").

### S8.6 Verification
"Verifying the result" is the final stage for every operation. A ResultCard shows the Verified tag only when the controller reports independent validation passed (PDF-04). A verification failure is an OutcomeNotice: "The new copy didn't pass checks, so I didn't keep it. Your previous result is unchanged."

---

## 9. Results

### S9.1 Single result (current)
ResultCard (current), with the title from the operation and the facts from the artifact. The assistant line comes first and says what changed, per UX-02.

### S9.2 Compression with a target
Facts "8.2 MB → 3.7 MB". If the target was missed: the note "I got it to 5.4 MB, but couldn't reach 5 MB within the approved quality setting." and the Quality changed tag if images were re-encoded. When no reduction is possible: "This PDF is already as small as I can make it without losing quality. I kept the original." There is no new card and the previous result stays Current (TOOL-06).

### S9.3 Protected result (journey end)
Title "Protected PDF". Facts, plus the tag "Password required to open" (Locked tag variant). Note: "Opening it requires the password you set. atePDF didn't keep the password." (only if the implementation doesn't retain it). The password is never displayed.

### S9.4 Collection (split, PDF → images)
A CollectionCard (COMPONENT_INVENTORY C13). Quick Look pages through the items. Save All… opens a folder chooser, then collision handling (ConfirmSheet collision), then a receipt with real counts.

### S9.5 Text result
TextResultCard. Save as Text… creates `.txt`. Copy Text uses the local clipboard only.

### S9.6 Quick Look
Space, or a click on a thumbnail, or the `eye` button. Read-only. Esc or Space closes and focus returns to the invoker. The Files panel and palette are inert while it is open.

### S9.7 Save / export
1. ⌘S or Save… opens the native save panel for **this exact result**, pre-named from the title ("Merged PDF.pdf").
2. The panel was cancelled: receipt "Save cancelled · still ready to save".
3. Success: receipt "Saved to {folder name} as {file name}" with a `check`, and a "Show in Finder" link where the platform permits.
4. Failure: receipt "Couldn't save to {folder}. The result is still here. Try Again".
5. The receipt stays attached to that result even after it becomes Earlier.
6. For a cloud-backed destination, the receipt adds nothing extra, and Settings ▸ Privacy explains the difference (PRIV-10).

### S9.8 Previous results
- Earlier results are collapsed rows in the thread at their original position, and listed in Files panel ▸ Results (newest first).
- Expanding an Earlier row gives the secondary card: Save…, Quick Look. It does **not** retarget the composer (UX_STATE_CONTRACT).
- Allowance exhaustion never hides them (BILL-04).

### S9.9 Undo (journey: "Undo that")
- Triggers: the card's Undo; ⌘Z when focus is not in a text field, or when the composer is focused, empty and has no typing to undo; or typing "undo". While the composer holds text or text-undo history, ⌘Z is text undo only (MAC-02).
- The RequestBlock "Undo the last change." is followed by the assistant line "I restored the previous result. Your originals are unchanged." and the restored result's card (Current, with the note "Restored").
- The undone result stays in the thread as an Earlier row with the tag "Undone". It remains savable.
- No Redo. When nothing can be undone, the Undo control is hidden, and ⌘Z does nothing in the conversation (the Edit ▸ Undo menu item is disabled).

---

## 10. Privacy, consent and secure input

### S10.1 Local-processing messaging
- The toolbar StatusPill "On this Mac" is always visible and opens PrivacyPopover.
- Every ActivityRow in a local stage carries the Local marker.
- The SourceGroup header says "Checked on this Mac".
- There is no privacy boilerplate inside result cards.

### S10.2 Hosted AI disclosure (PRIV-02)
- In onboarding pane 2 (S13).
- In the Planning stage, the marker "atePDF AI" appears with a `cloud` icon. Hovering it gives the tooltip "Your instruction and anonymous file facts (page counts, sizes) are sent to plan this. Files and names aren't."
- In Settings ▸ AI, the full statement names the service (and the provider when OPEN-09 settles).

### S10.3 Content-transfer consent (PRIV-04, future; no v1 flow triggers it today)
1. The assistant says why (for example "Recognising handwriting needs a service outside your Mac.").
2. ConsentSheet appears with exact pages or data categories, recipients, purpose, retention, and the consequence of declining.
3. **Don't Send** (initial focus): OutcomeNotice "Nothing was sent. Your files are unchanged." plus the local alternative if one exists.
4. **Send 3 Pages**: the ActivityRow shows an Outbound marker "Sending 3 pages to {Provider}", and on completion a PrivacyReceipt is added to the thread and to Settings ▸ Privacy ▸ Activity.
5. A changed scope (more pages, a different recipient or purpose) opens a new sheet (PRIV-05).

### S10.4 Privacy receipts
Inline PrivacyReceipt plus the Settings activity list. The empty state of the list: "Nothing from your documents has left this Mac."

### S10.5 Secure input: Unlock
SecureInputCard (Unlock) → "Checking…" → on success, the row loses the Locked tag and the assistant says "Unlocked. I'm working on a copy; Contract.pdf itself is unchanged." On a wrong password, the field clears and "That password didn't work. Try again." appears. There is no attempt counter and no hint about the password. On cancel, the file stays locked and excluded.

### S10.6 Secure input: Protect (journey: "Enter the password in the secure field below.")
SecureInputCard (Protect) with Password + Confirm fields. The plan pauses at this step. After Protect, execution continues and the verified protected result appears (S9.3). If a password is typed into the composer instead, the existing secret detection withholds it, and the composer shows the inline warning "That looks like a password. Use the secure field so it stays out of the chat."

---

## 11. Errors, refusals and recovery

| Situation | Presentation | Recovery |
|---|---|---|
| Unsupported structure for this operation | OutcomeNotice refused: "This file has annotations I can't safely preserve in this operation yet. I haven't changed it." | "What's supported?" (local help) |
| Engine failure | OutcomeNotice couldn't finish + unchanged statement | Try Again (re-sends the same request through the normal path) |
| Verification failure | S8.6 | Try Again |
| Planning failed / invalid plan | "I couldn't work out a safe plan for that. Nothing changed. Could you say it another way?" | Composer focus |
| AI unavailable / offline | InlineBanner + OutcomeNotice for the attempted request | Retry, Status |
| Stale choice | ChoiceList stale state | Ask again |
| Missing file (moved) | FileRow missing state + assistant line | Locate… (open panel) |
| Disk full on save | Save receipt failure: "Your Mac is out of space. Free some space, then try again." | Try Again |
| Workspace save paused | InlineBanner warning (S3.3) | — |
| Resource limit (safety, BILL-07) | OutcomeNotice refused: "This file is too large to process safely on this Mac." **Never an upgrade prompt.** | — |
| Allowance exhausted | ExhaustedBar + OutcomeNotice (allowance) | See Pro, Restore |

---

## 12. Settings (⌘,)

A SettingsSheet with five tabs. Every row maps to an existing requirement. There are no speculative preferences.

### S12.1 General
- **Appearance:** System / Light / Dark (a SegmentedControl; subject to OD-3).
- **Conversation text size:** Small / Default / Large / Larger (MAC-03).
- **Show introduction again:** a button that re-opens onboarding.
- **Keyboard shortcuts:** "View All… ⌘/".

### S12.2 Privacy & Storage (STATE-03, PRIV-*, SHR-40 surfaces)
1. **How atePDF handles your files** (three rows, the same text as PrivacyPopover), plus "Read the privacy policy" (a link, configurable and unset until supplied).
2. **Storage on this Mac:** StorageMeter with a legend: Imported copies · Results · Previews · Text and analysis · Conversation · Diagnostics, with sizes.
3. **Keep my workspace:** a retention picker. Its options are `{retention options from OPEN-05 / SHR-40}`, with a description of what each removes. The layout is fixed and the values are not chosen here.
4. **Content sent off this Mac:** the activity list (PrivacyReceipts), with the empty state "Nothing from your documents has left this Mac."
5. **Clear workspace…** (Secondary): ConfirmSheet (Start Over).
6. **Delete all local data…** (Destructive-plain): ConfirmSheet (delete) listing categories and sizes; afterwards it returns to the first-launch state without re-running onboarding.
- A note under Storage: "Deleting removes atePDF's copies. It doesn't erase backups or files you saved elsewhere." (STATE-04).

### S12.3 AI
- **Status:** "atePDF AI · Connected / Unavailable · Last checked 10:42", with a Retry button.
- **What's sent to plan your requests:** instruction text, and anonymous file facts (page counts, sizes, types). **What's never sent:** files, names, paths, text, passwords.
- **Provider and retention:** a placeholder until OPEN-09 and PRIV-08 settle. It shows only verified statements.
- **Developer connection** (development builds only, never compiled into release): the existing OpenAI key entry, native pairing code and browser pairing move here from the conversation (MIGRATION_MAP). They keep SecureField treatment.

### S12.4 Account & Pro
- **Plan:** Guest / atePDF Pro (Monthly or Annual) / Expired, with a Tag.
- **Guest:** AllowanceMeter "{used} of {allowance} used" + "{what counts}" (OPEN-02 copy) + "See atePDF Pro".
- **Pro:** "Renews {date}" / "Ends {date}", "Manage Subscription…" (channel-aware: App Store vs direct, DIST-04).
- **Restore Purchase.**
- **Account:** sign-in or account rows appear only if OPEN-04 requires an account. The layout reserves a SettingsSection for it.
- **Grace or billing problem:** an InlineBanner inside the pane with "Update Payment…" (channel link).

### S12.5 About
BrandMark 64 · atePDF · version and build (`font.family.mono`) · Acknowledgements · Support (configurable) · "Send Diagnostics…" (opens a review sheet listing exactly what would be sent, already redacted, with Don't Send as the default; MEASURE-04) · Privacy Policy · Terms.

---

## 13. Onboarding (UX-01, D-16)

A 3-pane OnboardingSheet on first launch only. There is no signup, no payment and no skip (pane 2 carries the PRIV-02 disclosure). Return means Continue and ⌘[ means Back.

| Pane | Title | Body (target ≤ 35 words) | Illustration |
|---|---|---|---|
| 1 | "Just say what you need." | "Add PDFs or images, then describe the result: merge, compress, reorder, protect. atePDF makes a new file and keeps your originals untouched." | A mini thread: a request, then a Merged PDF result card |
| 2 | "Your files stay on this Mac." | "PDFs are processed on your Mac. Your instructions go to atePDF AI to plan the steps. Files and names don't. If anything else ever needs to leave, you'll be asked first." | Local pill + "atePDF AI" marker + Outbound pill labelled "Only with your OK" |
| 3 | "Start free." | "You can try atePDF without an account. When your free allowance runs out, atePDF Pro keeps you working, and your files always stay yours." | An AllowanceIndicator placeholder, with no number |

The final button is "Get Started". The allowance number is not shown in onboarding, because it is server-defined (OPEN-02).

---

## 14. Commercial surfaces (BILL-*, DIST-*)

| State | Surface |
|---|---|
| Guest, allowance available | AllowanceIndicator in the composer ("{n} free left"). Nothing else. |
| Before starting new work (BILL-05) | The indicator is visible in the composer at send time. When the next request would use the last unit: `meta` under the composer "This will use your last free request." |
| Low (the server's threshold) | The indicator turns `status.warning.fg`. |
| Exhausted | ExhaustedBar replaces the composer. OutcomeNotice (allowance) if a request was attempted. Existing results stay fully usable. |
| Paywall | PaywallSheet (from ExhaustedBar, AllowancePopover, Settings, or palette "atePDF Pro…"). |
| Purchase pending / failed / success | PaywallSheet states (COMPONENT_INVENTORY E6). |
| Restore | "Restore Purchase" (Paywall, ExhaustedBar, Settings): busy → "Restored atePDF Pro" or "No purchase found for this Apple ID" (channel wording). |
| Pro active | The indicator is hidden. Settings shows the plan. |
| Expired / revoked | ExhaustedBar with the copy "Your atePDF Pro subscription has ended. Renew to keep working. Your existing files are still available." |
| Safety limit | Never uses commercial surfaces (BILL-07). |

Prices, currencies, allowance size, the savings percentage and the reset schedule are placeholders (`{monthly_price}`, `{annual_price}`, `{allowance}`) sourced at runtime from StoreKit or the entitlement service. Nothing is hard-coded in the UI.

---

## 15. Keyboard and menus (MAC-02)

| Command | Shortcut | Menu | Notes |
|---|---|---|---|
| Add Files… | ⌘O | File | |
| Save Result… | ⌘S | File | The current result, or the focused result row |
| Save All Results… | ⌥⌘S | File | Collections |
| Start Over… | ⇧⌘⌫ | File | ConfirmSheet |
| Undo (result) | ⌘Z | Edit | Outside text fields, or in an empty composer with no typing to undo. Otherwise text fields keep native text undo (MAC-02). The menu item names the target: "Undo Typing" / "Undo Protect PDF". |
| Cut / Copy / Paste / Select All | standard | Edit | Native, never overridden in text fields |
| Focus composer | ⌘L | View | |
| Actions palette | ⌘K | View | |
| Files panel | ⌥⌘I | View | |
| Quick Look | Space / ⌘Y | View | When a file, row or thumbnail is focused |
| Jump to latest / first | ⌘↓ / ⌘↑ | View | When focus is in the conversation |
| Stop | ⌘. | Edit (Stop Task) | Also Esc in an empty composer while busy |
| Send | Return | — | ⇧Return inserts a newline |
| Choose option 1–9 | 1–9 | — | When a ChoiceList has focus |
| Reorder source | ⌥↑ / ⌥↓ | — | Files panel / SourceGroup focus |
| Settings… | ⌘, | atePDF | |
| Keyboard Shortcuts | ⌘/ | Help | |
| atePDF Help | ⌘? | Help | Local help |
| Close sheet / preview | Esc | — | Not in onboarding |
| Cycle regions | F6 / ⇧F6 | — | Toolbar → thread → composer → Files panel |

Shortcuts that would steal text-editing keys while the composer is focused (⌘Z, ⌘A, arrows, Space) apply to their text meaning there. Space opens Quick Look only outside text fields.

---

## 16. Accessibility and Mac behaviour (MAC-01, MAC-03)

- **VoiceOver structure:** window → toolbar (group "Toolbar") → region "Conversation" (tasks as groups, labelled "Request: …") → region "Composer" → region "Files". Result cards read their title, tags and facts in one label, with actions as separate elements. ActivityRow announces stage changes only (not every engine message), as the existing `useAnnounce` does.
- **Announcements:** the new assistant message (polite), receipt changes (polite), and errors (assertive only for failures of a user-initiated save).
- **Focus restoration:** sheets and Quick Look return focus to the invoker. After a result lands, focus stays in the composer, and VoiceOver users hear "Merged PDF is ready. 12 pages, 3.4 megabytes."
- **Reduce Motion:** DESIGN_SYSTEM 10.2. **Increase Contrast:** borders use `border.strong` everywhere and hairlines become 1 pt opaque. **Reduce Transparency:** the toolbar becomes solid.
- **Text size:** Settings ▸ General plus the system text size, where Catalyst provides it. At Larger, result actions wrap, chips move into the palette only, and nothing truncates the primary action.
- **Pointer and trackpad:** hover states only on pointer devices. Right-click and two-finger click open context menus on rows and cards. Pinch in Quick Look zooms. Drag-out of a result row or thumbnail produces a file copy in Finder (SHR-73/74).
- **Retina:** all marks and icons are vector. Thumbnails render at the display scale (the raster-scale fix in NATIVE_MAC.md stays).
- **Keyboard-only journey:** the reference journey must be completable with ⌘O, typing, Return, Tab into choices, Return, the SecureField, ⌘S and ⌘Z (empty composer). This is the acceptance script for SHR-76.

---

## 17. State coverage matrix

| State | Where defined |
|---|---|
| Empty | S4.1 EmptyWorkspace; Files panel toggle disabled; Settings activity empty (S10.4); collection "Show all" |
| Hover | COMPONENT_INVENTORY common states; row hover actions (C5, C12) |
| Focus | DESIGN_SYSTEM 9; composer focus (D1); row focus (B3, C8, D3) |
| Selected | C5 selected; C8 answered; E6 PlanOption; A7 |
| Loading | S3.2 restoring; S4.4 importing rows; C6 thumbnail placeholder; E6 loading prices |
| Busy | ActivityRow (C7); Button busy; Composer busy (D1); DropOverlay busy |
| Disabled | A1; SuggestionChips disabled with reason; palette unavailable rows |
| Success | Verified tag; save receipt; purchase success; unlock accepted |
| Warning | Quality ProposalCard; allowance low; InlineBanner warning; missing-file row |
| Error | OutcomeNotice couldn't finish; save failed; SecureField wrong password |
| Retry | Try Again on OutcomeNotice, save receipt, InlineBanner (restore), AI Retry |
| Blocked | ExhaustedBar; locked source excluded; restore blocked banner |
| Offline / provider unavailable | S7.3 InlineBanner + OutcomeNotice; Settings ▸ AI status |
| Destructive confirmation | ConfirmSheet Start Over / Delete all local data / Replace on collision |
| Refused | OutcomeNotice refused; unsupported source row |
| Cancelled | OutcomeNotice cancelled; ConsentSheet Don't Send |
| Stale | ChoiceList / ProposalCard stale |

---

## 18. Mockup index

Open `mockups/index.html#<anchor>`. Static captures are at `mockups/png/<anchor>-light.png`; dark captures are provided for `attached`, `palette`, `conversation`, `result`, `history`, `privacy` and `errors`. The `empty`, `settings` and `components` captures include dark frames.

| Screen | Mockup anchor (`mockups/index.html#…`) |
|---|---|
| Brand directions and icons | `brand` |
| S4.1 Launch / empty | `empty` |
| S4.2 Drag over | `drop` |
| S4.4 PDFs attached + composer | `attached` |
| S7.2 Actions palette ⌘K | `palette` |
| S6.1 Active conversation (planning) | `conversation` |
| S6.2 Clarification | `clarify` |
| S8 Processing with steps | `processing` |
| S8.4 Quality confirmation + S10.6 secure input | `confirm` |
| S9.1 Result | `result` |
| S9.4/S9.8 Multiple results + history + Files panel | `history` |
| S9.6 Quick Look | `quicklook` |
| S10.3 Consent sheet | `consent` |
| S12.2 Privacy & Storage | `privacy` |
| S12.1/S12.4 Settings | `settings` |
| S13 Onboarding | `onboarding` |
| S14 Paywall + exhausted | `paywall` |
| S11 Error / refusal / recovery | `errors` |
| Components and states sheet | `components` |
