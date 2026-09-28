# Candidate 9 — bounded visual confirmation

This is a confirmation of changed states, not a new scored critique. Twelve settled screenshots were captured once and visually inspected. The already-dispatched batch completed while the parent reported a separate compact removal regression; no second broad pass was started. That regression received one targeted geometry diagnosis and a web-only source correction, described below.

## Build and method

- Actual app: `http://localhost:3213`, candidate 9.
- HTML SHA-256: `66de4e2bf16d6b109360e4ff82b774b7186346261afebe9b4f2c47254303b961`.
- App.tsx SHA-256: `1e0b24c3a8b28b969b72a42df923dfddf6c5baaaeca73eb96e18af7347c95d5f`.
- The complete candidate-9 source fingerprints are in `geometry.json`; the workspace CSS subsequently received the narrowly authorized patch below, so that candidate-9 CSS fingerprint is historical.
- Isolated headless Google Chrome 154.0.8037.58 through the project's installed Playwright; a fresh context per viewport. Default text at 1440 × 1000, 390 × 844 and 320 × 568; 720 × 500 with document root font size set to 200% (32 px).
- Actual Choose files imports of bundled synthetic brief/appendix PDFs and actual Merge processing produced the previewed three-page result. Help was opened using the new visible footer control. PDF previews used the real renderer.
- Captures waited for rendering to finish, then 550 ms and two animation frames. No dialog-opening or color-transition frames were used as settled evidence.
- Browser routing allowed only GET requests to this exact local origin; every external request and POST was blocked by policy. Observed in the twelve-state capture batch: 107 local GET requests, zero attempted external/POST requests, zero page errors and zero scripted-step failures. No paid calls.

## Visual confirmation

| Requested state | Observed result |
|---|---|
| Desktop empty | Approved logo/artwork/drop area preserved. Choose files remains the primary action. The plain Help label is visible beside the secondary footer context and has a 44 × 44 target. |
| Desktop result | Current result, three-page facts, Save PDF, Preview and exact “Tell me what you’d like to do next.” invitation remain clear. Help adds no header crowding. |
| Desktop Help | The explanation appears inside the same chat and lists concrete PDF tasks, removal and Undo. It explicitly says AI is optional; no connection setup control is promoted by the explicit Help action. |
| Phone 390 result/Help | Result actions remain readable and reachable. The complete Help response is visible after settling, with the current-document footer retained. The new help control is 44 × 44. |
| Compact 320 empty | Choose files is fully inside the initial welcome viewport at y=123–167 and is 44 px high. Instructions remain in the welcome card. All shortcut icons measure 16 × 16; shortcut labels measure 12 px. The Help target is 50.125 × 44. |
| Compact preview, Next, Zoom and Fit | The preview panel is fully inside the 280-pixel conversation: y=60–332. All viewer controls remain visible. Next changes the rendered page from A1 to A2. Zoom changes the page canvas from 71 × 100 to 107 × 150 and correctly uses the internal page viewport; Fit returns it to 71 × 100 with scroll offsets zero. |
| 720 × 500 at 200% text, initial | Choose files is fully visible without preparatory scrolling at x=247.30, y=123, 225.39 × 56 px. The welcome viewport is y=60–260, so the complete button is well within it. The instruction beneath the button remains visible and enlarged; the lower-priority sample link continues below the initial view in the welcome scroller. |
| 720 × 500 at 200% text, preview | The complete preview panel is inside the conversation at y=60–260; the paper canvas is 54 × 76 at Fit. Composer, shortcuts and Help remain visible and enlarged. |

No document-width overflow was measured in any of the twelve states. The small fitted paper at the two constrained heights is an overview; text inspection still requires Zoom. This is a stated tradeoff, not a claim that tiny fit-page text is readable. The tested compact Zoom and Fit transitions work.

Images: `images/desktop-empty.png`, `desktop-result.png`, `desktop-help.png`, `phone-result.png`, `phone-help.png`, `compact-empty.png`, `compact-preview-page1.png`, `compact-preview-next.png`, `compact-preview-zoom.png`, `compact-preview-fit.png`, `large-text-empty.png`, and `large-text-preview-page1.png`.

## Concrete regression and narrow correction

The parent's candidate-9 full browser suite found the current result title clipped after: import → Merge → Preview → Close → scroll to earlier chat → submit page removal. I read its failure screenshot and reproduced that exact case once with synthetic samples, then measured the title and Save action.

At 320 × 568:

| Geometry | Candidate 9 | Same-page spacing probe |
|---|---:|---:|
| Conversation | y=60–340, height 280 | unchanged |
| Fixed footer | height 228 | unchanged |
| Current removal card | height 279 | height 263 |
| Result title | y=54–102; first 6 px clipped | y=66–114; fully visible |
| Save PDF | y=158–202; 44 px high | y=166–210; 44 px high |

The taller Help/context footer reduces the available conversation height. With bottom-follow active, the wrapped title plus the result card's former 16-pixel vertical padding and 12-pixel section gaps place the heading 6 pixels above the visible conversation. This is a spacing/available-height regression, not a lost result or failed operation.

The authorized correction changes **only** `apps/universal/src/platform/workspace.css`: inside the existing `max-height:600px` rule, current and earlier result cards use 12 px vertical padding and an 8 px row gap. Readable text, horizontal card padding, all 44-pixel controls, 16-pixel shortcut icons, 12-pixel shortcut text, Help, the exact follow-up copy and native/App source remain unchanged. No test assertion was weakened.

The after measurement above came from injecting precisely that CSS into the same candidate-9 browser state before applying it to the source. It is a **live style probe, not acceptance of a rebuilt candidate 10**. Exact before/after data are in `removal-spacing.json`, with the inspected `images/compact-removal-live-spacing-probe.png`. The source whitespace check passed. The parent owns export and the unchanged regression test on candidate 10.

## Limits and cleanup

This pass does not claim native, simulator, physical-device, software-keyboard, screen-reader, save/reopen, performance or release acceptance. The broader test suite belongs to the parent; this report does not substitute its visual subset for that suite. No new numeric design score was assigned.

Both isolated browsers closed normally. No server was started/stopped, no owner port 3211 was accessed, and no simulator was touched. Browser evidence and diagnostic scripts are contained in this confirmation directory. The only source change made during this confirmation was the explicitly requested short-window rule in `workspace.css`.
