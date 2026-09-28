# Candidate 10 — exported correction confirmed

The three requested checks passed against the actual exported app at `http://localhost:3213`. All three settled screenshots were visually inspected. No source edits, new scoring, additional polishing or broader review was performed.

- HTML SHA-256: `e9c07d03c77cab35ab9e9c3732a94aa7e07999cb5c8e4d5ff288deb9faf82c47`.
- `workspace.css` SHA-256: `49f4478c047ecd33a77adc35d8217d2446ce7d978084e5e7b5b6037f56028f70`.
- Isolated headless Google Chrome 154.0.8037.58 via the project's installed Playwright, device scale factor 1. Captures waited for the actual renderer to finish, then 600 ms and two animation frames.

| Check | Actual exported result |
|---|---|
| 320 × 568 removal after closing Preview and reading earlier chat | The conversation is y=60–340. The complete two-line title is y=66–114; Save PDF is y=166–210 and 44 px high. Both are fully visible without a corrective scroll. The real result reports two pages. |
| 320 × 568 fitted preview of that result | The complete preview panel is y=60–332, inside the conversation. The actual PDF canvas is 71 × 100 at y=219–319, fully inside its page viewport and the conversation. Page 1 of 2 is shown. Fit is an overview at this constrained height; Zoom remains the route for reading detail. |
| 720 × 500, root text size 200%, initial Choose files | The complete button is x=247.30, y=123, width=225.39, height=56. Its 28 px label remains enlarged. The welcome viewport is y=60–260, so the whole button is visible before any click/focus/scroll. The instruction remains visible; the sample link is lower in the welcome scroller. |

Evidence: `geometry.json` contains exact measured bounds and request records. Screenshots: `images/compact-removal-result.png`, `images/compact-fitted-preview.png`, `images/large-text-initial-choose.png`. `capture.mjs` records the bounded procedure. Candidate-9 broader evidence and its separate live CSS diagnosis remain in `../confirmation-9/`; those files were not relabeled as candidate 10.

Only local GET requests were permitted. Observed: 45 local GET requests, zero external or POST attempts, zero page errors and zero assertion failures. Both contexts and the owned browser closed normally. No server, owner port 3211 or simulator was touched. This confirms the requested browser geometry only; the parent's full suite and native evidence remain separate.
