# atePDF interaction model

**Status:** the owner's requested interaction direction (SHR-106 polish, 1 October 2026), implemented on PR #107. Owner review and visual acceptance have **not** happened yet. This document sits under [PRODUCT_V1.md](../PRODUCT_V1.md) (product, privacy and safety), the [UX state contract](../UX_STATE_CONTRACT.md) and the SHR-105 [design system](DESIGN_SYSTEM.md). It does not override any of them.

The experience is **ASK → WORK → RESULT → CONTINUE**.

## 1. Principles

1. **The conversation is the primary control surface.** Files, Settings and the palette support it; none of them replaces it.
2. **Artifacts are the outputs, not prose.** A result is a document with a title, a preview, facts and actions. The sentence above it is one short line.
3. **People say what they want; atePDF reports actions and outcomes.** Quick actions are sentences a person could have typed ("Combine these PDFs"). They follow the same AI orchestration path as typed text (D-04).
4. **Internal vocabulary stays out of the ordinary UI.** Never show "planning", "orchestrating", "executing a plan", "calling a tool" or "validating schema". The developer connection in Settings ▸ AI is the only place these words may appear.
5. **Each task has one evolving surface.** That is the instruction, then one activity row, then the artifact or a concise outcome. There is no acknowledgement turn and no separate "completed" message.
6. **Progress is measured or it is indeterminate.** Never invent a percentage, count or time estimate.
7. **Fast work stays fast.** Animation never delays a result. There is no minimum duration and no held reply.
8. **Ask only when a decision is genuinely needed:** ambiguity, a quality change, a privacy transfer, or a destructive step.
9. **Files lists what the conversation can use.** It is not a file manager.
10. **Every finished task makes clear which result is current and what can happen next.**
11. **Failure, cancellation and uncertainty stay truthful and recoverable.**
12. **Keyboard, focus, scrolling and Reduce Motion are part of the model**, not polish to add later.

## 2. The four conversation objects

| Object | What it is | Presentation (code) |
|---|---|---|
| **Instruction** | The person's request. Compact, selectable and quieter than its result. An import is shown as its files, with the order number, a real thumbnail and page facts. | Filled block without a chevron (`App.tsx` UserMessage); `SourceGroup` |
| **Activity** | One row: activity glyph, a natural label, a real count when one exists, where the work runs ("On this Mac" or "atePDF AI"), Cancel, and a 3 pt bar. It appears only after 150 ms of work. Its reply replaces it in place, in the same list cell. | `ActivityRow`, `ProgressBar`, `describeActivity` in `src/ui/progress.ts` |
| **Decision** | A real question. The four kinds stay distinct: clarification (choice list), quality confirmation (Create Copy / Keep Current Result), privacy permission (SHR-37 scope, not in v1 UI) and destructive confirmation (Start Over, Delete Local Data). | `ChoiceList`, `ProposalCard`, `StartOverSheet`, the PrivacyStorage `Confirm` |
| **Artifact** | The resulting PDF: title, first-page preview with the Iris fold, page and size facts, a stable "Result N", Current, Verified, Save, Quick Look, Undo, and the save receipt. Earlier results collapse to one row and keep their own receipts. | `ResultCard`, `FileRow` |

Failure and cancellation are outcomes of an activity: the assistant line carries an outcome icon, plus **Edit Request** when the request can be changed and sent again. Nothing is resent automatically.

## 3. Presentation states (derived from authoritative state only)

| Application state | What the person sees |
|---|---|
| `loading` (file dialog, connection check) | "Getting ready…" (after 150 ms) |
| `planning` (instruction with atePDF AI) | "Working…", detail "Sending your instruction to atePDF AI.", where = atePDF AI. After 8 s: "Still working…" with a note that stopping changes nothing |
| `busy` · import | "Adding 3 PDFs…", determinate "n of N checked" (one file: indeterminate) |
| `busy` · step active | An operation label (§5) and the engine's own count when it reports one |
| `busy` · step `validating` | "Checking the result…", indeterminate. **No artifact and no Verified tag are shown yet.** |
| `busy` · `complete` (durable commit) | "Finishing…" |
| Stop requested and local work draining | "Cancelling…", quiet still bar, no Cancel button |
| Reply lands | The row is replaced by the reply in the same commit. If the reply lands a tick later, the row bridges at most 180 ms. |

The presentation never changes backend enums, persistence or the job controller. Page numbers and unit counts come from the accepted recipe and stored inspections (`JobProgress.steps[].units/pages`), and are display-only.

## 4. Progress and motion rules

**Progress sources:**

| Kind | Source | Display |
|---|---|---|
| Import | Count of independently checked files | "1 of 2 checked", determinate |
| Merge | The engine's "Merged i of N files" report | "1 of 2", determinate |
| Multi-step request | Completed steps out of total steps, plus the merge count within the current step | "Step 2 of 3", determinate |
| Remove pages, compress, OCR recognition, verification | No total exposed | Indeterminate, with an engine detail where available, such as "Page 3 of 18 recognised" or "Recognising text · 42%" (current page only) |

There are no arbitrary phase weights. When processing hits its total, the row changes to "Checking the result…", and the artifact appears only after verification passes.

**Motion families:**

| Family | Where it applies | Treatment |
|---|---|---|
| **Enter** | Turns, cards, receipts | 180 ms opacity with a 4 pt rise |
| **Transform** | Activity to outcome | The reply replaces the row in place; the result card scales from 0.98 and its Iris edge glints once over 900 ms |
| **Spatial** | Files panel; sheets, palette and popovers | Files panel: 240 ms with a 12 pt slide. Sheets, palette, popovers: 120–280 ms scale and fade |
| **Restore** | Undo | The restored card enters like a new artifact, with a Restored tag |

Every item appears once per session, and restored conversations don't animate. Under Reduce Motion, movement becomes a fade of at most 120 ms, and the activity glyph and progress sweep stay still. Animations use React Native Animated only, with no library. Finite animations report themselves (`window.__atepdfAnimations`) so tests wait on state, not sleeps. There is no bounce, confetti or decorative loop.

## 5. Copy

| Situation | Text |
|---|---|
| Interpreting a typed request | Working… |
| Merge | Combining 3 PDFs… |
| Remove pages | Removing pages 4 and 8… (more than four pages: Removing 7 pages…) |
| OCR | Making 12 scanned pages searchable… · Checking for scanned pages… (none found) |
| Compress | Compressing images… |
| Verification | Checking the result… |
| Stop | Cancelling… → "Cancelled. No new result was committed." / "Cancelled. No files were changed." |
| Save | Saving… → "Saved to your device" (only when the exporter confirms) · "Ready · save cancelled" |
| No compression benefit | No smaller version was possible. This copy has the same content as your previous PDF. |
| Invalid page | Page 28 doesn’t exist. This PDF has 24 pages (1–24). Your files are unchanged. |

## 6. Artifact meanings

- **Current:** the result the next request applies to. There is exactly one, and it is never changed silently.
- **Verified:** the implemented independent checks passed (pages, order, text and geometry; SHR-45/47). It does not guarantee every visual property. It appears only on committed results.
- **Saved:** the export path confirmed success. A dialog opening or closing is not enough. The receipt stays with that exact PDF after newer results and after Undo.
- **Restored:** Undo made an earlier result current again. Its number and receipts are unchanged.

## 7. Confirmation rules

- **Ask** for quality-changing compression, clarifications with genuinely uncertain choices, Start Over and Delete Local Data, and any external content transfer under the approved privacy policy (none in v1). There is no standing consent and no silent permission.
- **Don't ask** for reversible copy-making: merge, remove pages, OCR and Undo all produce or restore copies, and originals never change.

## 8. Canonical journey

Import 2 PDFs → "Combine these PDFs" (Current, Verified) → "remove page 2" ("Removing page 2…") → Undo (Restored) → "Make this PDF smaller" (quality confirmation → Create Copy → smaller result, or the no-benefit outcome) → Quick Look → Save (receipt) → a follow-up request → Start Over (confirmation sheet).

## 9. Reference patterns (AppLlama, 1 October 2026)

**Scope.** The AppLlama library holds iOS App Store apps, so every observation below is **mobile-only**. None of it is evidence of Mac behaviour, motion timing or outcomes. Raycast and Codex aren't in the library; searching for "Raycast" returned nothing. The study used 10 credits on public screens only, and no atePDF content was sent. Screens were viewed from first-party links and are not committed.

| # | App · screen | Observed | Problem it solves | atePDF adaptation | Don't copy | Decision |
|---|---|---|---|---|---|---|
| 1 | ChatGPT (iOS) · Chat Conversation `oth_swzdv` | The assistant answer is plain text on the canvas with no bubble; only the user message has a soft grey block | Keeps long answers readable and quiet | Assistant text sits on the window; the instruction is the only filled block (already the SHR-105 rule) | Right-aligned speech bubble (not Mac or Codex density) | Adopt (confirms) |
| 2 | ChatGPT (iOS) · Chat Conversation `oth_swzdv` | A floating down-arrow chip above the composer when the latest content is out of view | Getting back to new content without losing your place | The existing "Latest" pill, shown only while away from the end | — | Adopt (confirms) |
| 3 | ChatGPT (iOS) · Chat Response `oth_sl4vk` | A row of copy, read-aloud, feedback, share and more under every answer | Per-answer actions | Web-only hover Copy; artifact actions live on the result card | Feedback thumbs, read-aloud, share row: noise for a PDF tool | Reject |
| 4 | Notee (iOS) · Note Processing `oth_ergco` | Full-screen stage checklist with a percentage, step statuses and "~3 min" | Long asynchronous work | One activity row with the current step; steps disclosure only for multi-step requests | The percentage weighted across stages, the time estimate and the full-screen takeover: we can't measure them honestly | Adapt (current step only) |
| 5 | Acrobat (iOS) · Tools Convert `oth_0meo7`; PDF Expert (iOS) · Tools Convert PDF `oth_sbcf1`; CamScanner (iOS) · PDF Tools `oth_r163d` | Tool catalogues as icon grids, each tool with a one-line outcome description | Discovering operations | The palette lists actions as outcome sentences ("Make smaller (compress images)") | The tools dashboard as the home surface (it breaks conversation-first) | Reject the grid, adapt the wording |
| 6 | PDF Expert (iOS) · Recents `oth_b8a66` | Real first-page thumbnails with a small dot marking a new file | Recognising documents at a glance | Real thumbnails everywhere, and an Iris fold marks atePDF results. Current gets the Iris rail. | Large tile grid; dot colour semantics | Adopt (thumbnails), adapt (marker) |
| 7 | Scan to PDF (iOS) · Merge File Picker `oth_teg2t` → Merge Documents `oth_tbufn` | Rows with page counts, then a modal asking for the new file's name before merging | Naming the output | Page counts on rows; the name is chosen at Save | A pre-merge naming dialog: an extra step for a reversible copy | Adopt rows, reject the dialog |
| 8 | Notee (iOS) · AI Chat Response `oth_7as41` | Suggested follow-up chips above the composer, specific to the content | Teaching the next useful request | Context chips are full sentences sent through `submit()` | Emoji chips; generic "assistant persona" bubbles | Adopt |
| 9 | CamScanner (iOS) · AI Chat `oth_7dqpi`; MarginNote 4 (iOS) · Chat Empty State `oth_hcnrj` | One capability sentence plus source tiles; a faint "drag here" hint; a model/mode selector | First use | Folio sheet: "Drop PDFs here", one capability sentence, Choose Files…, samples and three examples | "Hi, I'm your AI assistant" persona, mode/model selectors, drag-only affordance | Adapt |

**Checkpoint after implementation** (real Mac build, synthetic container; `docs/evidence/SHR-106-2026-10-01/polish/pass2/`):
- **1, 6 and 8 hold up.** Assistant text sits on the canvas, thumbnails are real with the Iris fold and Current rail, and the context chips teach requests.
- **2.** The Latest pill is unchanged, and the recordings didn't exercise it.
- **4.** One row with the current step works. A fast removal resolves straight into its artifact with no row (`clip-1`).
- **5.** The palette's outcome wording is in place.
- **A new finding outside the ledger:** the activity row showed "Getting ready…" with a moving bar while the system file dialog was open. It is now hidden while the person is choosing files.
- No adopted pattern added a step, and none was removed for making atePDF more generic.
