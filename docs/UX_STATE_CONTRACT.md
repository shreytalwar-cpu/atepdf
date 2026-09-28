# atepdf conversation state contract

Recorded 29 September 2026 for the owner-approved UI/UX refinement. Audience: everyday users doing occasional PDF tasks. This specifies expected behavior within retained F02/F03/F04/F05/F07/F09/F10; it does not create a separate roadmap or claim that all checks have passed.

Product truth is in [PRODUCT.md](../apps/universal/PRODUCT.md); observed visual values are in [DESIGN.md](../apps/universal/DESIGN.md). Current source `8d71ac0` and independent desktop/compact assessment establish the starting state. The [execution plan](UI_UX_EXECUTION_PLAN.md) and current ADRs govern precedence over older handoff stack/consent wording.

## Document identity

- An original is an immutable imported PDF. Its visible order is its default merge order; retain that meaning when additional imports are added.
- A result is a committed, independently validated copy with its own local identity, page count, size and lineage. Do not derive completion from a model reply or a painted card.
- Exactly one result is current when result history exists. The card and composer context must identify it using a meaningful operation label or stable human-readable result label, plus useful facts. Page count alone is insufficient to distinguish versions.
- Previous outputs remain inspectable/savable in the conversation and are visibly marked as previous. Opening an old preview must not silently retarget the composer. If a future feature changes focus, it must state that change.
- Merge uses the originals in visible order. Other follow-ups use the current/explicitly selected supported target. Ambiguous file or page references require clarification; never silently choose or execute part of a plan.

## State transitions

| State | Visible truth and primary action | Exit and recovery |
| --- | --- | --- |
| Empty | Choose files, optional samples, usable draft composer and three supported quick actions. | A draft can precede files; a missing prerequisite produces one useful add-files route. |
| Import/preflight | Local filename and actual progress/readiness; preserve order. | Failed input does not discard usable inputs or a prior result. Keep error tied to the failed action. |
| Originals ready | Actual originals/pages and clear next action. | User sends instruction or selects a supported shortcut; optional AI availability does not disable local work. |
| Setup/planning | Brief factual acknowledgement, separate from PDF execution, with Stop. | Stop before execution produces no new output. No fake reasoning, percentage or provider retry loop. |
| Clarification | One plain-language question with only relevant choices or a short answer path. | Preserve files, current result and draft. Bind the answer to the current workspace revision; stale choices ask again. |
| Local quality choice | Explain the real quality tradeoff for image compression and that a copy is created. | Create copy or Keep working. Do not add this confirmation to ordinary safe-copy work. |
| Local processing | Controller-driven operation/stage, validation phase and Stop; details behind disclosure. | A new follow-up stays a draft or uses explicit Stop and change; never execute against unfinished output. |
| Completed | Current result identity, actual page/size facts, Save and Preview; Undo when a prior result is available. | Follow-up remains in the conversation. Hide unavailable Undo rather than spending a compact row on a permanently unusable control. |
| Preview | Read-only page, page count, navigation, zoom, Fit and Close within the selected result. Fit measures the remaining conversation height, including wrapped chrome. | Close returns to that conversation context and useful focus without changing current document implicitly. |
| Invalid/unsupported request | Explain the specific issue and one next step. Page errors state the valid range for the current target. | Keep previous valid output and reassure it is unchanged. Keep local actions usable. |
| Help | A visible Help control opens concise supported capabilities in this conversation. | The explicit Help control makes no hosted request. Ordinary typed questions still use the enabled LLM; local fallback makes optional setup clear. |
| AI unavailable | Explain availability once in context and identify a useful local path. | A product-help request must not imply that optional AI setup is required for working local actions. Offer connection setup only when relevant. |
| Cancelled | Say what stopped and whether an output was committed, based on controller truth. | Keep originals and the last valid result. Stop after commit must not relabel the committed output as cancelled. |
| Undo | Restore the earlier result and make it current; retain earlier conversation records. | Confirm the restored document identity and facts. No invented redo promise. |
| Saving | Receipt belongs to the exact immutable output, not whichever result later becomes current. | Distinguish cancelled picker, download started, share sheet closed and confirmed save. Failure leaves the output ready to retry. |
| Clear session | Explain that saving first preserves a copy and clearing removes session conversation/files. | Inline confirmation or Keep working. External originals are unchanged. |

## Scroll and focus

There are two intents to preserve: reading earlier conversation and following a newly submitted request. Do not infer reading intent merely because expanding/closing a preview temporarily changed the message list's height.

1. When the user submits a new instruction or taps a quick action, reveal that new exchange and its settled result, unless the user deliberately scrolls away during the run. A compact screen must not leave the previous blue Save button as the only visible result action after a new copy finishes.
2. When the user intentionally scrolls up while work continues, preserve the reading position and expose Latest message. New status events must not repeatedly force the bottom or steal keyboard focus.
3. Preview opening reveals reachable controls. Preview closure returns to the associated result and sensible scroll position; it does not create an accidental permanent “reading older content” state for the next explicit Send.
4. Keep the composer and current-document context reachable above the actual software keyboard. Large-text/landscape layouts may move or hide secondary shortcuts to protect typing and the primary action.
5. Closing a dialog restores focus to its invoking control. Closing preview returns focus to the result's Preview control or another explicit useful target; status announcements do not move focus.
6. Preserve draft text, IME composition and fast typing. Native UIKit owns the draft/caret through the existing uncontrolled composer. Do not mirror delayed external text snapshots into a controlled input.

## Data lifetime and privacy

Session persistence across termination is not implemented. The current local store, conversation entries, draft and result history are in-memory session state; “Save PDF” exports a copy, not history. Communicate “Save before closing” where relevant. Do not advertise autosave, retained chats or crash recovery before implementation and acceptance evidence exist.

Only privacy-checked instructions and the positive anonymous metadata projection may reach optional planning. Original names, document bytes, previews, recognised text, paths, checksums and secrets remain local. Passwords belong in dedicated local secure fields, never a chat reply. State presentation must not add document-bearing analytics, upload adapters or automatic model narration.

## Verification and starting gaps

The independent baseline assessment exercised real synthetic import → merge → preview → page navigation → close → remove page 2 → Undo, plus an invalid page and unavailable-AI product question. Desktop and 390 px compact captures showed working operations and no horizontal overflow. The compact preview-close/follow-up sequence left the new result below the visible conversation; generic result labels, terse recovery copy and the disabled Undo row were also observed. These are baseline findings to fix, not timeless descriptions of a later candidate.

Confirm each changed state with a bounded visual pass across desktop and compact web plus the assigned Apple simulator. Separately verify actual saved-copy content and immutable inputs. Check reading-position preservation, explicit-submission following, dialog/preview focus restoration, multiline/IME draft behavior, unavailable AI, meaningful quality choice, Stop timing and error recovery using synthetic data/provider responses.

Keyboard clearance requires a frame with the real software keyboard present. Screen-reader, larger-text, reduced-motion, native, physical-device and distribution checks are separate evidence categories. A screenshot or source token does not close them. Native Mac interaction remains deferred until the owner resumes it.
