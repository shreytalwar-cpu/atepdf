# atepdf UI/UX execution plan

Prepared 29 September 2026. Planning and tooling deliverable, not a new UI implementation or completed usability study. Baseline: `1a602a0`; accepted application implementation: `afa15b5`. This is a work breakdown of existing F02/F03/F04/F05/F07/F09/F10 in `IMPLEMENTATION_STATUS.md`, not another roadmap.

## Product outcome

A person adds PDFs, asks for a change, understands what is happening, inspects the result, saves it and continues in the same conversation without learning a tool catalogue. The user can always identify the current document and recover from an unsuccessful operation.

Preserve React Native/Expo, official assistant-ui primitives, local PDF engines, the approved lowercase atepdf identity and gradient numeral 8. Web, iOS/iPadOS and Mac are in scope; Android stays deferred. Borrow familiar chat behaviour—composer, readable messages, stable scrolling, Stop and concise feedback—without copying ChatGPT branding or promising an award.

## Authority and starting evidence

- Owner decisions and current ADRs supersede historical handoff stack/consent instructions. Keep assistant-ui; AI-enabled shortcuts use the planner, local shortcuts remain available without AI, and ordinary Send does not add another consent card.
- `atepdf_codex_build_pack/DESIGN.md` and `atepdf_codex_build_pack/brand/APPROVED_BRAND.md` govern approved layout and identity. The brand board is name/logo only. No sidebar, permanent preview rail, splash requirement or new editing suite.
- `docs/FRONTEND_REFINEMENT_2026-09-28.md` records work already done. Extend it rather than rebuilding the chat shell.
- `docs/BETA_APPLE_QA.md`, `docs/BETA_IPHONE_QA.md` and `docs/evidence/native/beta-virtual-followup.json` distinguish actual engine/UI results from failed automation and unavailable configurations.
- Approved phone reference, logo crop and `docs/evidence/design/07-seamless-final-result.png` were viewed for this plan. That web capture is historical; it is not a fresh screenshot audit.
- Impeccable context inspection found no app-level PRODUCT.md or DESIGN.md. Capture the settled product brief and existing tokens during the first design pass; missing files do not authorize a new visual direction or rebranding. Do not modify the archived handoff.

## Execution sequence

| Pass | Retained tasks | Work and deliverable | Acceptance gate |
| --- | --- | --- | --- |
| 1. Observe the real journey | F02, F09 | Capture empty → attachments → merge → preview → remove → undo → save. Include one error, Stop, a product question and a clarification. Create a short evidence ledger with screenshot, source/build, platform, observed problem and priority. | Each finding has an observed state; distinguish product defect, test defect and unavailable environment. Rank the few problems that prevent or confuse completion. |
| 2. Specify the interaction and visual system | F02, F04, F05 | Record the incumbent typography, spacing, colour, radii, touch targets and motion. Define composer/document focus, scroll rules, result hierarchy and state transitions. Produce an annotated flow and component/state specification in the repository. | Every important state has a primary action, exit and recovery. No unsupported capability, invented progress, new navigation or silent change to approved identity. |
| 3. Perfect the complete merge journey | F02, F03, F04 | Refine the existing attachment presentation, composer, activity row, result card and preview. Implement import → merge → preview → remove → undo → actual export. | Real fixture output and independent reopen pass. Draft and previous valid output survive cancellation/failure; focused result is unambiguous; no repeated confirmation for ordinary safe operations. |
| 4. Extend the pattern | F05, F07 | Apply the same components to clarification, product answers, OCR, compression, no-useful-reduction, unsupported PDFs, disconnected AI and local resource failures. | Facts come from actual planner/controller/engine states. Actual PDF work remains local. Show quality choices only when meaningful; retain usable previous output. |
| 5. Adapt and harden | F02, F09 | Test web compact/desktop, phone, tablet portrait/landscape and Mac. Check software keyboard, large text, screen readers, reduced motion, pointer/keyboard navigation and long messages. | Controls are reachable, focus is predictable, reading position is preserved and no content is hidden behind the keyboard. Record native and browser evidence separately. |
| 6. Observe users and finish | F09, F10 | Run a small moderated study; fix the most consequential observed friction, then verify the changed states once. Produce a decision log and release UX checklist. | No unresolved task-blocking UX defect in the agreed launch workflow. Remaining limitations have explicit evidence and scope. Publication still requires separate authority. |

Execution estimate: roughly 6–10 focused working days for this UX pass, with overlapping implementation and testing; scheduling a study and waiting for physical-device access can extend it. This is not the full-launch estimate. Re-estimate after pass 1 instead of treating the range as a deadline.

## First executable slice

Audit and refine **document context + composer + result**, using the real three-page merge journey. First inspect the current screen and existing source; do not assume the historical screenshot is current. Make one batch of coherent fixes, then confirm them across web and an Apple simulator.

Known starting points to investigate, not fresh audit findings:

1. Composer focus can move an earlier preview out of view in large-text iPad landscape. Decide the intended reading/focus behaviour before changing scrolling. Keeping every old preview onscreen while typing is not automatically a requirement; reachable preview and predictable return are.
2. Delayed paired work produces XCTest idle waits with default motion. Separate app responsiveness from automation quiescence; both prior animation experiments failed. Do not ship another speculative animation change.
3. The retained export test rejects iOS's generic Back label. Fix public-picker navigation and rerun the affected test; do not mistake this test failure for evidence that the already verified export operation is broken.
4. Current sessions do not persist across termination. Specify recovery and deletion expectations before implementing local persistence under F04. Do not promise saved history in UI copy before it works.

Current Mac interactive checks remain deferred at the owner's request. Continue web/simulator work; resume Mac inspection when available without repeatedly asking to unlock. Physical keyboard, memory and lifecycle acceptance stays separate.

## State and component contract

| Component/state | Required behaviour |
| --- | --- |
| Empty workspace | Clear Add files action and a usable composer; approved illustration stays secondary and collapses after import. |
| Attachments | Local names, actual readiness and page counts; visible merge order. Do not send these local display names through the chat transport. Avoid adding a reorder feature unless it solves an observed problem. |
| Composer | Preserve draft, IME and fast typing; obvious Send/Stop; current-result context; no execution against an unfinished result. Keep the existing native uncontrolled-input fix. |
| Planning | Concise acknowledgement with cancellation. Describe interpretation separately from local processing. No simulated model reasoning or fake percentage. |
| Local processing | Stable activity row driven by real job events; show validation before completion. Optional detail rather than a wall of logs. |
| Result | One prominent output card with actual page/size facts, Save and Preview, plus contextual Undo. Follow-up copy: “Tell me what you’d like to do next.” |
| Preview | Read-only, bounded, with reachable page/zoom/close controls. Closing returns to the same conversation and meaningful focus. |
| Scrolling | Follow new work when the user is at the bottom. Do not pull them away while reading older content; offer Latest message. Avoid stealing focus on status updates. |
| Error/cancel | Preserve valid output and draft; state what happened and give one useful recovery action. Stop after commit must not claim the completed result was cancelled. |
| Save | Distinguish ready, share sheet closed, cancelled and confirmed saved. A destination copy must exist and reopen before tests claim export success. |
| AI unavailable | Keep local supported actions usable; explain the connection problem once in context. No recurring warning card or paid retry loop. |

## What “finished” means

- Real source/build-labelled screenshots for key states; one batched inspection and at most one visual confirmation round per scoped refinement. Unresolved issues become explicit work items instead of an endless polishing loop.
- Actual local merge/remove/undo/save journey, independent output inspection and immutable originals; engine regressions and privacy checks where the changed surface touches them.
- At least 44-point Apple and 44-CSS-pixel web touch targets per the existing product contract, visible focus and measured contrast against that contract. A screenshot alone does not establish screen-reader or accessibility compliance.
- No fake activity, duplicate tool execution, lost draft or stale result on cancellation/retry; complete plans only. No PDF bytes, previews, OCR text, passwords, local names/paths/checksums sent to planner or analytics.
- Large text, reduced motion, long filenames, multi-line prompts and interrupted operations exercised in the actual supported environments. Do not pass a keyboard-clearance check when the keyboard is offscreen.
- For a proposed study with five consenting representative testers: aim for at least four to complete the core journey without moderator rescue, and all five to understand that Save creates a copy and originals stay unchanged. These are proposed study gates, not measured results or a statistically representative sample. Any document-loss/privacy failure blocks acceptance.
- Production signing, authentication, payments, publication and broad PDF compatibility remain separate launch gates. Visual quality cannot substitute for them.

## Working setup and delegation

Use `$atepdf-chat-ux` for this workflow; see [tool routing](../skills/atepdf-chat-ux/references/tool-routing.md). Keep one design owner responsible for the overall flow. When parallel agents are authorized, give an implementation agent ownership of shared chat source, a QA agent ownership of tests/evidence, and a review agent read-only privacy/accessibility review. Do not have several agents edit App.tsx or change global simulator defaults concurrently. Parallelism should reduce independent work, not generate competing design systems.

Start with:

> Use $atepdf-chat-ux to audit the current document context, composer and result flow. Capture the actual web and iPhone simulator journey with bundled PDFs, rank the three most consequential issues, and implement one coherent refinement batch using existing assistant-ui components. Keep Mac UI checks deferred, use synthetic planner responses for QA, and record real output/privacy verification plus any unavailable checks.

No contact with testers, paid design generation, additional model test calls, public Figma sharing, deployment or plugin installation is authorized by this plan alone. Use existing authority where it already covers an action; no redundant approval step for local reversible work.

## Setup and validation record

The versioned skill is `skills/atepdf-chat-ux/`; `/Users/shrey/.codex/skills/atepdf-chat-ux` links to it without replacing an existing skill. Invoke `$atepdf-chat-ux`. A fresh chat may be needed for the skill picker to refresh; the SKILL.md can also be read directly. No MCP configuration, application source, running beta or API allowance was changed by this planning task.

Local link checks, YAML parsing, skill metadata/invocation checks and independent instruction review passed. The standard Python quick-validator was attempted but could not run because PyYAML is absent from both available Python runtimes; Ruby's YAML parser supplied the explicit fallback checks. No package was installed to work around that tooling dependency. This is skill/document validation, not an app build, fresh UX audit or connector-authentication test.
