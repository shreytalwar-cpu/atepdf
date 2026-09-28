# atepdf independent design review — Assessment A

Method: isolated Assessment A (`/root/ux_design_review`), completed without detector findings or other agents' reports.

Target: `apps/universal/App.tsx`, source `8d71ac0`, real Expo web app at `http://localhost:3213`. Operate mode. Reviewed 29 September 2026. Fresh isolated Chromium contexts at 1440 × 1000 and 390 × 844; bundled `brief.pdf` + `appendix.pdf` via the app's sample control. No paid/provider calls; non-local browser requests were blocked. Native/Mac UI remains outside this review.

## Design specificity

The opening is recognisably atepdf: the approved numeral 8, navy wordmark, friendly paper illustration, pale blue drop target and restrained blue action form a coherent identity. It preserves the approved conversational workspace and needs no new navigation or visual world. Once work begins, the surface becomes more generic: every generated file is titled “Your PDF is ready”, and the same visual priority is repeated for previous outputs. The strongest next refinement is to make document identity and version state as specific as the opening screen.

## Heuristic scores

Scores apply to the observed web flow, not physical-device or screen-reader conformance.

| # | Heuristic | Score / 4 | Evidence |
|---|---|---:|---|
| 1 | Visibility of system status | 2 | Readiness and page counts update; compact follow-up result can remain outside the viewport. |
| 2 | Match with the real world | 3 | Add, Merge, Preview and Save are natural; “physical page” and the disconnected planner answer need clearer guidance. |
| 3 | User control and freedom | 3 | Preview closes; remove and Undo work in the real flow; a latest-message control provides recovery. |
| 4 | Consistency and standards | 3 | Consistent buttons, colour hierarchy and chat framing; output cards lack visible current/previous distinctions. |
| 5 | Error prevention | 3 | Invalid page removal preserves the valid result; copy-producing changes and clear original/result roles help. |
| 6 | Recognition rather than recall | 2 | User must associate generic output cards with preceding messages and infer which file a follow-up targets. |
| 7 | Flexibility and efficiency | 2 | Samples, quick actions and typed removal are useful; follow-up can require an extra jump to reveal its result. Full keyboard accelerator coverage was not tested. |
| 8 | Aesthetic and minimalist design | 3 | Clean and calm; disabled Undo creates unnecessary compact-card height. |
| 9 | Error diagnosis and recovery | 2 | “That physical page does not exist” and “OpenAI is not connected yet” identify issues but do not supply the next step. |
| 10 | Help and documentation | 1 | Privacy details are available, but the basic “What can you do?” question dead-ends when AI is unavailable. |
| | **Total** | **24 / 40** | **Acceptable; focused improvements needed.** |

## What is working

- The opening has a single clear Choose files action and a low-risk sample route. Artwork collapses after import; real work takes over the screen.
- Merge produces one inline card with factual page/size information, a dominant Save action and a secondary Preview action. Read-only preview has reachable page, zoom, fit and close controls at both tested sizes.
- The actual remove → Undo sequence restores the previous three-page result in the UI, and invalid removal leaves it intact. Composer and local quick actions remain available after the errors.

## Priority issues

### P1 — Compact follow-up can leave the current result below the viewport

Observed sequence: sample import → Merge → Preview → Next page → Close preview → type “Remove page 2” → Send. At 390 × 844, the screen remains on the earlier three-page result. Its Save/Preview controls are visible; the new two-page card and its Save/Undo controls are below the conversation viewport. Only the bottom “Current result · 2 pages” label and a down-arrow hint expose the changed state. This remained after a 350 ms settling wait and occurred in both capture attempts. The desktop path revealed the new card correctly.

This can lead users to save the previous copy after a successful edit. Treat an explicit new user submission as intent to follow that new exchange; reveal its settled result. Continue preserving position for users who deliberately scroll up during background work. The existing Latest message control remains useful recovery, but it should not be needed for this direct action path. Suggested command: `$impeccable harden`.

Evidence: [compact follow-up](compact-05-removed.png); corresponding button geometry in `observations.json` has current Save at y=750 and Undo at y=802, behind/below the visible conversation, while previous Save is y=402. Relevant presentation logic: `apps/universal/src/components/assistant-ui/elements/thread.aui.tsx` message-list following and `apps/universal/src/platform/Preview.web.tsx` reveal behaviour.

### P2 — Repeated result cards do not identify the current version in place

The desktop removal and Undo screenshots show two cards with identical “Your PDF is ready” headings, identical green validation marks, and equally dominant blue Save buttons. Current/previous state is encoded mainly by chronological position, a slight border change, Undo, and the footer at the bottom. A three-page restored output is especially hard to distinguish from the three-page merged output without rereading conversation text.

Give cards concise operation-derived labels or stable result numbers, mark the active card “Current”, and label prior cards “Previous result”. Repeat the meaningful current label beside the composer, retaining page count. Keep previous outputs available in chat; do not add a sidebar or permanent preview rail. Suggested command: `$impeccable clarify`.

Evidence: [desktop removal](desktop-05-removed.png), [desktop Undo](desktop-06-undo.png). Source: `apps/universal/App.tsx:283` footer and `:295–301` artifact presentation.

### P2 — Recovery replies name the problem without offering the next action

“Remove page 99” yields “That physical page does not exist.” The current result has three pages, but the reply provides neither the valid range nor reassurance that the result is unchanged. “What can you do?” yields “OpenAI is not connected yet.” despite working local shortcuts directly below it. A novice can infer that the product requires setup before it can help.

Make page errors specific to the current result: valid page range plus unchanged-result reassurance. For unavailable AI, identify one useful local route and expose connection setup inline only when relevant. A basic product-help question can use a concise local capability answer where supported. Avoid adding recurring warning cards or a permanent tool catalogue. Suggested command: `$impeccable clarify`.

Evidence: [compact page error](compact-07-error.png), [compact unavailable AI](compact-08-unavailable.png), [desktop combined replies](desktop-08-unavailable.png). Source: `apps/universal/App.tsx:148–162` planner-disabled reply path; page-error copy comes from controller error surfaced through `finish`.

### P3 — Unavailable Undo consumes a full compact action row

After the first merge and after Undo, Undo is disabled but remains visible. At 390 px it wraps below Save and Preview into its own row, making the result card 52 px taller for an action that cannot be used. This pushes useful conversational content away in the most constrained view.

Render Undo when a prior result exists; reserve disabled state for temporary busy conditions. Preserve a 44 px target when actionable. Suggested command: `$impeccable distill`.

Evidence: [compact merged result](compact-03-merged.png), [compact Undo result](compact-06-undo.png). Source: `apps/universal/App.tsx:298`.

## Cognitive load

Moderate, with three checklist failures in the evolving conversation: hierarchy of current versus previous outputs, minimal choices when multiple equally weighted Save/Preview pairs are visible, and working memory needed to associate generic cards with the preceding operation. Chunking, grouping and progressive disclosure are otherwise good: the opening has one main action and an optional sample route; result and quick-action clusters contain at most three controls each.

The desktop post-removal decision exposes five result controls (two Save, two Preview, one Undo), plus three persistent quick actions. This is manageable only if current/previous hierarchy is made explicit. Do not solve it by adding another menu of PDF tools.

## Emotional journey

The friendly opening lowers intimidation. Immediate import acknowledgement and the concrete three-page result provide a satisfying peak. The compact follow-up is the main valley: an operation completes but its new artifact is hidden while the previous artifact remains inviting. Undo provides reassurance and visible recovery. The two terse failure replies end the tested journey with uncertainty rather than a clear way forward. Better result identity and one actionable next step would improve the ending without decorative celebration.

## Persona red flags

- **Jordan, first-time user:** the “What can you do?” answer does not explain the three working local actions; the sliders icon is the only connection route and has no visible text. May assume setup is mandatory.
- **Casey, distracted phone user:** after removing a page, the old blue Save button is visible and the current file is not. The disabled Undo row adds scrolling cost when returning after an interruption.
- **Alex, frequent PDF user:** repeated generic artifact titles make version scanning slow. The typed local removal path is efficient, but the follow-up viewport issue adds an unexpected navigation step.

## Minor observations and scope limits

- The compact “Make searchable” label wraps into two lines but remains legible and within a 44 px button. No horizontal document overflow was found in any of the 18 captured states.
- All visible interactive controls measured at least 44 × 44 CSS px in these states. The 1 × 1 hidden file input is not a visible touch-target defect. This is geometry evidence, not a full accessibility result.
- No page-level JavaScript errors were observed. The initial capture script raced painted transitions; screenshots were replaced after adding a 350 ms settle and an exact error-state wait. The persistent compact result visibility issue survived that correction.
- This is a visual/interaction review of the local no-key app. No save/download proof, output-content verification, paid planning, Stop timing, real clarification, native keyboard, screen-reader, zoom/large-text or physical-device result is claimed here. Root's broader execution plan owns those checks.
- Used installed headless Chromium executable build 1234 with project Playwright 1.63.0 because its expected 1243 executables were absent. Both fresh browser contexts and browser process were closed; the root-owned localhost server was left running.

Questions skipped: owner instructed execution of the established UI/UX plan; this review provides concrete fixes within that approved direction.
