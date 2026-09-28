# Candidate Assessment A — independent design review

Method: isolated Assessment A sub-agent `/root/ux_candidate_a`; Assessment B and all prior assessment, detector, test and report outputs were excluded. This is the design half of the parent’s dual-agent critique, not a completed detector synthesis.

Target: `apps/universal/App.tsx`, shared conversation and inline web preview. Audience: everyday, occasional PDF users. Mode: Operate.

Served evidence: `http://localhost:3213`, source baseline `8d71ac0` plus the uncommitted UI candidate identified by the parent as candidate3. Supplied build-index fingerprint: `ec2b0487f0dfa4218d3da84dcb5716caaad62aa3eb9941ab35f28f2ff6001255`. A later thread-only source change was pending during report preparation, so this assessment does not claim to describe that subsequent build.

## Design specificity — independent verdict

The interface feels appropriate to atepdf. The approved gradient 8 and lowercase wordmark, friendly paper illustration, explicit original-file ordering, named PDF results, local-processing explanation and current-document cue give this otherwise familiar chat structure a concrete PDF purpose. It preserves the approved single workspace and avoids a second navigation system. The broad white canvas and rounded controls are common patterns, but here they help the task rather than displace it.

The candidate’s strongest design decision is the relationship between a named result, its page count, the visible Current/Earlier distinction and the persistent current-document footer. A user can understand what a follow-up will affect. Its weakest point is compact preview containment: the document grows into the available conversation space while its controls become harder to reach.

This judgment was formed from source and actual rendered states before any mechanical detector findings. No detector was run or read by Assessment A.

## Design health

| # | Heuristic | Score | Evidence and remaining limit |
|---|---|---:|---|
| 1 | Visibility of system status | 3/4 | Named current result and page count remain visible after merge, removal, Undo and a rejected page request. Compact preview can lose its heading above the visible conversation. Fast jobs were not slowed to evaluate long-running progress. |
| 2 | Match between system and real world | 3/4 | “Merged PDF”, “Save PDF”, “Preview” and the page-range error are plain and concrete. “AI connection”, local-server and anonymous-reference language remain less familiar to occasional users. |
| 3 | User control and freedom | 3/4 | Removal has an effective Undo; earlier results remain available; preview closes without changing the PDF. Compact preview’s Close control starts above the visible thread area. |
| 4 | Consistency and standards | 3/4 | Clear visual distinction between primary Save and secondary Preview; current and earlier results share predictable structure. Preview’s separate toolbar does not yet adapt as well as the shared controls. |
| 5 | Error prevention | 3/4 | Originals are identified; merge order is stated; the current document is repeated near the composer; page 99 does not produce a new result. The session-only boundary is explained in privacy details, rather than in the normal completion state. |
| 6 | Recognition rather than recall | 3/4 | Merge, Compress and Make searchable are explicit. Removing a page requires knowing what to type or asking for help; the completed card supplies a generic follow-up prompt. |
| 7 | Flexibility and efficiency | 3/4 | Quick actions and typed requests both work, and follow-up removal/Undo stay in the same conversation. No repeated consent interrupts the tested safe local operations. Keyboard, screen-reader and native efficiency were not verified. |
| 8 | Aesthetic and minimalist design | 3/4 | The initial action, document facts and Save have a clear hierarchy. Copy icons below ordinary assistant replies and repeated generic follow-up text consume some scarce phone space. |
| 9 | Error diagnosis and recovery | 3/4 | The observed invalid-page response states the available range and that files are unchanged, with the current result preserved. Other failure classes were outside this bounded pass. |
| 10 | Help and documentation | 2/4 | “What can you do?” receives a useful local capability explanation without AI. Help relies on the user asking, and says “Add PDFs” even when PDFs and a current result already exist. |
| **Total** | | **29/40** | **Good foundation; fix compact preview access before treating compact web as complete.** |

All ten heuristics apply to this operating surface. No score is evidence of accessibility conformance or release readiness.

## What works

1. **The first action is obvious.** Choose files is the sole strong action in a friendly, restrained drop area. The sample link makes a real task possible without needing personal documents. The short viewport removes decoration and retains the usable workflow.
2. **The current document is understandable.** Merge produced “Merged PDF · 3 pages”; removal produced “PDF with page 2 removed · 2 pages”; Undo returned to the three-page merged result. Current/Earlier labels and the footer agree in the observed states. Earlier Save buttons lose primary emphasis.
3. **Recovery is calm and concrete.** Undo explicitly reassures the user about originals. “Remove page 99” responds with “This PDF has 3 pages. Choose a page from 1 to 3. Your files are unchanged.” The usable result and composer remain available.

## Priority issues

### [P1] Compact preview clips a required zoom control and opens with its exit above the viewport

At 320 × 568, `compact-preview.png` shows Previous, the page count, Next and Zoom out; Zoom in is clipped at the right edge. The read-only heading, Fit and Close row is largely above the visible conversation, while the footer and composer retain their full height. The document is consequently shown too small to read with the zoom-in affordance absent from view.

This is more than visual polish: an occasional user trying to inspect a page can no longer see the control needed to make it readable. Scrolling can recover the header/Close row, but does not solve horizontal clipping of Zoom in. The 390 × 844 capture retains all toolbar controls.

Fix: let the preview toolbar use two explicit rows at narrow widths, preserving every 44-pixel target; size the page from the actual available thread space and initially reveal the preview header with its close action. Keep it inline. Source corroboration: `src/platform/preview.css` uses one nonwrapping toolbar with nonshrinking controls inside an overflow-hidden preview; `Preview.web.tsx` scrolls the whole preview to the nearest edge after first render.

Suggested commands: `$impeccable adapt`, `$impeccable layout`.

### [P2] The privacy dialog is taller than the compact viewport

`compact-privacy.png` shows the top of “Processed on your device” clipped and the bottom of “Got it” below the 568-pixel viewport. The remaining visible portion of Got it was clickable in this run, so this was not an observed trap. It does reduce the usable dismissal target and prevents reading the complete dialog from a naturally contained sheet.

Fix: constrain the dialog to available height, put the long explanation in a scrollable body and retain a fully visible dismissal action. Preserve the explicit instruction/file-data distinction. The current modal in `App.tsx` is a centered fixed-content View without a scrolling body.

Suggested commands: `$impeccable adapt`, `$impeccable harden`.

### [P2] The main page-removal follow-up depends on a remembered command

After producing the merged PDF, the only contextual instruction is “Tell me what you’d like to do next.” The visible shortcuts cover Merge, Compress and Make searchable. The real page-removal path works, but is exposed only after someone thinks to type it or asks “What can you do?” That adds avoidable recall for users who return only occasionally.

Fix: make the result’s existing follow-up line carry one useful, executable example such as `Try “remove page 2”` when the current document has at least two pages, or supply a compact contextual suggestion. Avoid expanding the permanent shortcut row into a tool catalogue. The no-AI capability response should use current-state wording rather than asking users with imported PDFs to add PDFs again.

Suggested commands: `$impeccable clarify`, `$impeccable onboard`.

No P0 was observed. The main task succeeded at all inspected sizes. The P1 is specific to compact preview usability, not the merge or removal engine.

## Cognitive load

At desktop and 390-pixel width, load is low: seven of eight checklist items pass. Single focus, chunking, related grouping, hierarchy, one decision at a time, limited choices and progressive disclosure are effective. The remaining weakness is working memory: removal’s wording must be recalled or discovered through help.

At 320 × 568, hierarchy/context additionally fails inside preview because its heading and exit are outside the initial visible area, giving two failures and moderate load. The privacy dialog has a containment failure rather than a large number of choices.

Decision counts above four: preview exposes six viewer controls overall (Previous, Next, Zoom out, Zoom in, Fit, Close), plus the result’s Save/Hide preview actions. Desktop and standard-phone grouping mostly makes this manageable: navigation and zoom are related, while Fit/Close are in the header. The compact layout collapses that visual grouping by clipping controls. Normal result decisions stay at two or three local actions; three separate workflow shortcuts are grouped below the composer, so counting every control on the screen as one undifferentiated decision would overstate load.

## Emotional journey

- **Entry:** approachable and low pressure. The sample action provides a safe way to learn; the illustration disappears when real content takes over.
- **Import:** file names, original labels and visible order establish trust. “3 pages in total” supplies a concrete expectation.
- **Completion peak:** a named result with a blue Save PDF action makes accomplishment legible without celebration or fake progress.
- **Inspection valley:** the compact preview makes the actual document small and conceals Zoom in, weakening confidence at the moment users want to verify their work.
- **Follow-up and recovery:** a new two-page copy, an explicit Undo and a restored merged result reassure users that experimenting does not destroy the original.
- **Error:** the page-range explanation is practical and does not punish the user.
- **Help ending:** the local capability explanation is useful; the last emphasis shifts to connecting OpenAI. On compact height, the beginning of that answer is above the visible thread area, leaving connection copy especially prominent. This is a possible perceptual emphasis problem, not proof that users cannot scroll back or that local actions are unavailable.

## Persona red flags

**Jordan — first-time, occasional user:** Choose files and Merge are discoverable, but removing a page is not demonstrated on the result. “AI connection” after a successful local workflow can leave uncertainty about what actually requires setup. The explicit no-AI capability answer partially addresses this.

**Casey — mobile user with limited space:** the compact preview loses Zoom in and initially loses its Close row; the privacy dismissal extends below the viewport. The main merge/result/composer layout itself remains usable at the same size.

**Sam — user needing larger or easier-to-read controls/text:** result text wraps instead of being truncated, and buttons look comfortably sized at standard phone width. The small footer and 11-pixel shortcut labels carry meaningful information; the compact preview problems would make careful inspection harder. These are visual concerns only: no Dynamic Type, screen reader or physical-device accessibility result is claimed.

## Minor observations

- [P3] Ordinary assistant replies keep a separate Copy icon row, including short ready/error replies. This provides little value to the observed PDF task while increasing conversation length on a phone.
- [P3] The no-AI help answer is a dense paragraph at narrow width. Short current-state guidance would be faster to scan, while retaining the honest limits on searchable PDFs and image compression.
- Save PDF was clearly present and visually prioritized. This assessment did not export/reopen a downloaded file, so it makes no independent export claim.

## Questions for design reflection

These are design prompts for the parent’s already-authorized execution cycle, not unanswered approval gates:

- Could the result’s existing follow-up line teach the one next command an occasional user is least likely to know?
- When vertical space is scarce, should document inspection reclaim some of the footer’s space while keeping the composer and current identity reachable?

Questions skipped: the owner already selected the audience, preserved-chat direction and full execution cycle; the parent explicitly instructed this assessment to proceed without reopening those decisions.

## Evidence and boundaries

One batched round used fresh isolated headless installed-Chrome contexts at 1440 × 1000, 390 × 844 and 320 × 568. It imported the actual bundled fixtures using “Try the two sample PDFs”, merged them, opened and navigated preview to Page 2 of 3, removed page 2, used Undo, submitted page 99, and asked “What can you do?” without a paid planner/key. It captured the compact privacy explanation too. UI page counts changed 3 → 2 → 3 as expected. No paid API request, credential setup, source mutation, native app, simulator, owner tab or port 3211 was used.

Artifacts: 21 viewport screenshots plus `journey.json` (visible text/state record) and `capture.cjs` (reproducible isolated browser steps) in this directory. All browser contexts and the launched browser were closed. The parent’s server was left running, and the parent was notified that capture had finished.

This is rendered browser inspection, not a moderated user study, native/simulator/physical-device proof, complete accessibility audit, independent PDF-output acceptance, persistence/restart test or release approval. Current source was read for context; rendered evidence is tied to the supplied served-build identity above. No previous report, other agent output or detector finding was consumed.
