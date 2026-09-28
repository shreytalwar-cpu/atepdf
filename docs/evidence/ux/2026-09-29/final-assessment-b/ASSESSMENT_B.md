# Independent final technical Assessment B

Method: isolated Assessment B sub-agent `/root/ux_final_audit`. This assessment did not read Assessment A, previous reports, previous test results or previous screenshots. Findings were sealed pending the parent's explicit Assessment A completion gate.

Target: `apps/universal/App.tsx` and `apps/universal/src`, served by the existing candidate-8 local-only server at `http://localhost:3213`. The server was left running. HTML SHA-256 before and after: `c7b1daae9a9523f885b1b9a06c1e44eaeb8ffa25fd27591674cbc05d36507af1`. All 29 fingerprinted source files remained unchanged. See `fingerprint.json` and `fingerprint-final.json`.

## Implementation integrity verdict

Pass for the tested web scope. The approved brand, one conversational workspace, explicit current result, local processing and independently readable output form a coherent implementation. The scoped official detector returned raw `[]`, exit **0**, with no stderr and no findings or advisories. This does not establish complete accessibility, security or release readiness.

## Scoped technical score

| Dimension | Score | Evidence / limit |
|---|---:|---|
| Accessibility | 3/4 | Named real controls, visible focus, one named modal, trap and Escape return, measured text contrast pass. Real screen readers untested. |
| Performance | n/a | Profiling excluded by the assignment; no inferred performance score. |
| Responsive design | 3/4 | No document horizontal overflow and visible target sizes pass across tested widths. Short-window enlarged-text empty state hides the Choose files label until scrolling. |
| Theming | 3/4 | Approved light palette and main semantic tokens are consistent in inspected source and rendered states. Complete dark appearance was not tested or claimed. |
| Implementation integrity | 4/4 | Scoped detector clean; real local merge, save/download and independent reopen succeed with expected page order. |
| Scoped total | **13/16 (Good)** | Four scored dimensions only; not a full /20 audit. |

Verified issue count: **0 P0, 0 P1, 1 P2, 0 P3**. One additional preview-position observation remains inconclusive and is not counted as a proven defect.

## Verified finding

### [P2] Short window with enlarged text hides the initial file-choice label

- Category: responsive design / discoverability.
- Reproduction: fresh empty state at **720 × 500 CSS px**, document root font set to **200%**, measured root font **32px**.
- Evidence: `720x500-root200-empty.png`; `browser-evidence.json`, final viewport's `empty` state.
- The composer/footer starts at **y=276**. Choose files occupies **y=247–335**, leaving only its blue top visible above the composer; its label is clipped. The sample action is at **y=359–447**, also outside the visible welcome area. The add-files icon remains visible and usable, and the welcome is scrollable, so the workflow is recoverable.
- Impact: a first-time user at enlarged text sees instructions but cannot initially see the principal file-choice action or the fact that the welcome content continues below it.
- Location: `apps/universal/App.tsx:271` (`Welcome`, centered scroll content and spacing), `apps/universal/src/platform/workspace.css:7` (short-window layout rules).
- Recommendation: in this short-window, enlarged-text state, reduce the welcome's leading space or prioritize the complete Choose files button within the available area. Preserve readable text, the anchored composer and the approved one-screen layout.
- Suggested command: `$impeccable adapt`, then the already bounded final `$impeccable polish` confirmation. This assessment made no source edits.
- Standard: product larger-text and task-discoverability requirement. This root-font stress test alone is not a formal WCAG browser-zoom failure determination.

## Measured positive results

### Keyboard and privacy modal

- Fresh empty-state Tab order: Processed on your device → OpenAI connection → Choose files → Try the two sample PDFs → composer → Add files → Merge → Compress → Make searchable. Empty Send is correctly skipped while disabled.
- All sampled keyboard buttons displayed a **2px solid #1769df outline with 3px offset**. The composer used a **2px solid #1769df outline with 2px offset on its containing shell** despite the textarea's own outline being suppressed.
- Opening privacy by keyboard produced exactly **one** role=dialog with the accessible name **Processed on your device**.
- Initial focus landed on Got it. Four Tab presses and one Shift+Tab stayed inside the dialog. Escape dismissed it and restored focus to Processed on your device.
- Screenshot evidence: `keyboard-composer.png`, `privacy.png`. This tests DOM/keyboard semantics, not VoiceOver/NVDA narration.

### Responsive controls and contrast

| Viewport | Empty / result / preview horizontal document overflow | User-facing targets | Measured ordinary-text contrast |
|---|---|---|---|
| 1440 × 1000 | None | At least 44 × 44px | Pass |
| 768 × 1024 | None | At least 44 × 44px | Pass |
| 390 × 844 | None | At least 44 × 44px | Pass |
| 320 × 740 | None | At least 44 × 44px | Pass |
| 720 × 500, root font 200% | None | At least 44 × 44px | Pass; visibility finding above |

- Lowest measured enabled text contrast across the sampled empty/result/preview states was **5.094:1** (white Choose files or Save PDF text on the primary blue). The check accounted for solid ancestor backgrounds and opacity; it is a bounded DOM colour calculation, not a complete conformance scan.
- At 320px the preview navigation and zoom controls wrap into two groups, maintaining **44px** controls rather than overflowing horizontally.
- The 1 × 1px Choose PDF files input is an intentional invisible implementation control (`opacity:0`, `tabIndex=-1`, `DropSurface.web.tsx:17`). It is paired with visible Choose files/Add files actions and is excluded from the human target-size failure count. This is a manually verified measurement false positive, not an official detector finding.

### Actual result, preview and saved-output checks

- Each viewport loaded the app's two bundled synthetic PDFs and invoked the real Merge button. Result facts were **3 pages · 3.1 kB**, labelled Merged PDF / Current result.
- Read-only preview opened, Next page updated the status from **Page 1 of 3** to **Page 2 of 3**, and explicit Close preview restored focus to the Preview trigger in all five cases.
- Zoom in and Fit were clicked in the batch. Their immediate canvas-size samples were taken before all React/render transitions settled and therefore **must not be used to claim a numerical zoom/Fit correctness result**.
- Desktop follow-up Remove page 2 produced a current two-page result; Undo restored the current three-page result.
- Save exercised the real browser Blob-download fallback. Only `showSaveFilePicker` was removed in this isolated browser context to select that supported branch. No file bytes, engines, planner output or success responses were mocked. Native/system save-picker behavior was not tested.
- UI receipt accurately said **Download started · check your downloads**.
- The resulting `merged-output.pdf` was actually downloaded, then reopened in a separate Node PDF.js reader (writer: application pdf-lib). Independent extraction found **3 pages in A1, A2, B1 order**, each 595.2756 × 841.8898 with rotation 0. File size **3,099 bytes**; output SHA-256 **3929dcf8211c3f15d765c9a4889aa64fde9e2d18ecb97c4b1161f44500c1c503**.
- `independent-reopen.json` holds the per-page synthetic text and geometry. This is local synthetic evidence, not a complex-PDF preservation corpus.

## Inconclusive observation: preview position after control sequence

The initial preview DOM snapshots placed navigation and page content inside the conversation. The screenshots taken after Next page → Zoom in → Fit show the preview header low in the conversation, with its canvas below the composer. The immediate canvas samples also lag the action by one render, so this batch does **not** isolate whether the screenshots represent a stable scroll regression or intermediate rendering/scroll timing. Do not count a proven preview-layout defect from this evidence alone. Preserve this as a specific timing/scroll question if another already authorized test is available. Relevant code: `Preview.web.tsx:19` initial reveal and `thread.aui.tsx:381` scroll-content follow behavior. No extra browser pass was run.

## Detector and browser provenance

- Impeccable context ran exactly once in this agent's session, targeting `apps/universal/App.tsx`.
- Official detector ran exactly once: `impeccable detect --json apps/universal/App.tsx apps/universal/src`.
- Raw detector output: `detector.raw.json` = `[]`; exit in `detector.exit.txt` = `0`; `detector.stderr.txt` empty. No detector false positives to adjudicate.
- `.impeccable/critique/ignore.md` was absent. Its absence is recorded in `ignore-list.txt`.
- Product, design and relevant handoff instructions were read. The broader app is adaptive, but this assignment explicitly restricted runtime evidence to web and deferred owner Mac/native/physical checks.
- Browser fallback: no dedicated Browser skill was available in the task, and the assignment required isolation from owner UI. Playwright controlled a new headless installed Chrome process with a new context. Initial bundled Chromium launch failed before any page opened because its headless executable was absent; installed Chrome was then used without installation or owner-profile access.
- The browser allowed only GET requests to `http://localhost:3213`; external requests and all POSTs were blocked by a route guard. **198 requests**, all local GETs, were recorded; no external or POST attempt occurred. Planner status was read locally; there was no billable planner call. Port 3211 was not used.
- Mutable DOM preflight succeeded (temporary title change and appended script element). One official live-server start was attempted in the assessment output directory. It exited **1**, stderr **Timed out waiting for live server to start.** Therefore no overlay script was injected, no live browser detector ran, and no human-visible overlay is claimed. CSP was not weakened.
- Cleanup command returned **0**, **No running live server found.** See `overlay-cleanup.json`. The owned headless browser was closed. The pre-existing port-3213 server was left alone.
- Only assessment files were written under `.build/ux-20260929/final-assessment-b/`. Scripts, screenshots, saved synthetic output and raw measurements are retained there as evidence; no application source was edited.

## Limits

No real VoiceOver, NVDA, TalkBack, native simulator/device, software keyboard, browser zoom, dark appearance, physical touch ergonomics, long-session interruption recovery, moderated user study, live AI, performance profiling or release/distribution evidence was produced. The 720 × 500 test changed the root font to 200%; it is not an equivalent claim about native Dynamic Type or all browser zoom modes. Existing product limits remain unchanged.

Questions skipped: this is the gated technical sub-assessment; the parent owns the combined critique and any user questions.
