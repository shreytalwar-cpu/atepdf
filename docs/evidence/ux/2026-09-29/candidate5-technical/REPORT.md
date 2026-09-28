# Candidate 5 — independent Assessment B

Technical browser audit and official detector, 29 September 2026. Assessment B did not read Assessment A, prior critique/audit reports, or other agents' findings. This report describes candidate 5, before any subsequent fixes by the parent agent.

## Target and evidence boundaries

- Source target: `apps/universal/App.tsx` plus `apps/universal/src`; source hashes are in `source-hashes.txt`.
- Actual app: `http://localhost:3213`, served from `.build/ux-20260929/candidate-web-5`. HTML SHA256 **b7dd9337fc5a30f055ed74b0f66684e1c1341580697d677d2c5019a43904667a**. Entry JS SHA256 **4c5e232d92ac04862c8944162a6c639ecec9f1dcbe4c297eb9f6051c3c92ac51**, 6,795,368 bytes. See `served-fingerprint.json`.
- Installed Chrome **154.0.8037.58**, headless, isolated browser contexts, reduced-motion preference. No owner desktop/browser interaction, simulator, physical device, paid provider call, install, source edit, or server restart.
- Local synthetic fixtures were imported using the actual file picker input. Real merge, inline preview, page navigation, preview zoom, download, and invalid-page response were exercised. Four real downloads were independently read using PDF.js after saving to disk.
- Web findings only. The project is adaptive, but the owner specifically bounded this assessment to browser evidence; native audit dimensions remain unscored. Screen-reader operation, physical touch, software keyboard, Dynamic Type and release conformance are **not verified**.

## Audit score

| Dimension | Score | Basis |
|---|---:|---|
| Accessibility | 2/4 | Control names, readable contrast and keyboard dialog recovery work, but the composer has no visible keyboard focus. |
| Performance | 2/4 | Responsive on this local computer, but a 6.8 MB entry bundle and 116–125 ms startup tasks need a constrained-device/network budget. No throttled/mobile hardware claim. |
| Responsive design | 3/4 | Four normal sizes and separate enlarged-text/zoom-equivalent checks work. Combined short viewport and enlarged text can erase the conversation area. |
| Theming | 2/4 | Semantic light tokens are in use; dark preference retains a light surface, with raw accent/fallback values and incomplete structured token documentation. |
| Implementation integrity | 3/4 | Real local output, truthful result identity, preview and errors form a coherent product. The inactive web styling block and advisory token drift prevent a stronger score. |
| **Total** | **12/20** | **Acceptable — significant work remains, concentrated in focus and resource/adaptivity limits.** |

The numeric score is a bounded technical audit, not a WCAG certification, design score, user study or production-performance grade.

## Findings

### P1 — Composer keyboard focus is visually suppressed

**Location:** `apps/universal/global.css:21`, `:34–36`; `apps/universal/src/components/assistant-ui/elements/thread.aui.tsx:732`.

The compiled CSS retains literal `@media web`. Chrome reports `matchMedia('web').matches === false`. The intended `.aui-composer-shell:focus-within` rule therefore never runs, while the textarea's `web:outline-none` does run. Keyboard Tab reaches the named textbox, but its outline style is `none`, and the parent has exactly the same `rgb(226, 231, 238)` border and `box-shadow: none` before and after focus. Other buttons retain a browser or explicit outline.

This makes the primary typing control hard to locate by keyboard and conflicts with the product's visible-focus requirement and WCAG 2.4.7. Move web styles into a web-supported scope or restore an explicit textarea focus treatment; confirm computed styles in the built export. Suggested command: `$impeccable harden`, then `$impeccable polish`.

Evidence: `1440-composer-keyboard-focus.png`; `browser-report.json`, case `1440`, `composerUnfocused`, `composerFocused`, `keyboard[4]`. This P1 was sent to the parent immediately.

### P2 — Enlarged text and short viewport can leave no usable conversation area

**Location:** `apps/universal/src/components/assistant-ui/elements/thread.aui.tsx:498–515`; `apps/universal/App.tsx:273–300`.

At **720 × 500 CSS px with root font size 200%**, the header, composer and secondary footer consume the visible workspace. The empty file-add area and conversation become obscured. After a real merge/preview, clicking Next page timed out because the composer or header intercepted the pointer. This combined stress condition is distinct from ordinary browser 200% zoom.

The **720 × 500 / DPR 2 layout equivalent of a 1440 × 1000 browser at 200% zoom** completed merge, preview, Next page and keyboard close. **1440 × 1000 with root text 200%** also completed those actions. Real browser-menu zoom was not exercised. Do not report the combined failure as a failed standard 200%-zoom test.

Allow the secondary footer/composer to yield space or let the overall short viewport scroll when enlarged text needs it. Suggested command: `$impeccable adapt`.

Evidence: `text200-720-empty.png`, `text200-720-preview.png`, corresponding JSON, and timeout in `browser-report.json`; comparison captures `zoom200-equivalent-*.png`, `text200-desktop-*.png`.

### P2 — Initial transfer and startup cost lack a constrained-device budget

**Location:** exported entry module `index-631bb63366488d626f71905e7ccc8cbb.js`; `apps/universal/App.tsx:264` (welcome illustration).

The entry JS is **6,795,368 bytes** and the welcome illustration transfers about **688 KB**. Fresh local contexts recorded a single **116–125 ms** long task during startup, and app readiness of **205–254 ms** on this machine. These are localhost measurements, not evidence that low-end phones or slow networks will be fast. PDF preview code is separately requested, which is useful, but the initial application transfer remains substantial.

Establish a transfer/parse budget before distribution, then inspect the bundle before claiming specific modules are unnecessary. Compress/resize the welcome asset and split only dependencies that the analyzer shows are avoidable at startup. Suggested command: `$impeccable optimize`.

Evidence: `served-fingerprint.json`, `browser-report.json` resource and long-task records. Worker resource durations in the browser entries include negative values, so those timing fields were not used as performance conclusions.

### P2 — Privacy dialog has redundant unnamed dialog semantics

**Location:** `apps/universal/App.tsx:256`.

React Native Web's `Modal` creates a `role="dialog" aria-modal="true"` wrapper, and the inner View adds another `role="dialog"`. Neither observed element has `aria-label`/`aria-labelledby`; the heading is only a child. This creates two unnamed dialog nodes. Keyboard focus nevertheless moves to Got it, stays there while Tab is pressed, and returns to the privacy trigger after Escape completes. The audit harness initially expected one dialog and exposed the duplicate.

Use one named dialog semantic boundary, checking the platform adapter so native modal behavior remains intact. This is a semantic quality issue; no screen-reader failure was claimed. Suggested command: `$impeccable harden`.

### P3 — Structured token documentation does not cover several intentional values

The detector found literal values outside the machine-readable DESIGN.md ramps. Several are already described in prose or are inactive CSS fallback values; see the detailed disposition below. Update the structured token record when those values are intentional, without changing the approved logo or incumbent palette merely to satisfy a detector. Suggested command: `$impeccable document`.

**Issue counts:** P0 **0**, P1 **1**, P2 **4**, P3 **1**. The privacy semantic issue is deliberately not promoted to a claimed screen-reader failure; the short-viewport failure is deliberately not promoted to a claimed standard zoom failure.

## Positive measured findings

- **320 × 568, 390 × 844, 768 × 1024, 1440 × 1000:** import, merge, preview, Next, preview Zoom in, Close, actual download, invalid page command all completed. Root/body/conversation horizontal overflow was zero in the captured normal states.
- Enabled visible controls met the **44 × 44 CSS px** target requirement. The automation's only small-control match was the intentionally hidden 1 × 1 file input (`tabIndex=-1`), activated through visible Choose/Add buttons; that is not a target-size defect.
- Computed enabled text contrast in normal captured states had no failures: primary button text **5.09:1**, privacy text **5.41:1**, secondary text **5.53:1**. Disabled controls were excluded from text-contrast failure counts. This custom measurement covers observed text and ancestor backgrounds, not exhaustive conformance or every pixel in imagery.
- The sampled controls have accessible names. Conversation results expose headings. Polite live regions contain factual state updates. Main landmark is absent; this is a navigation improvement opportunity rather than an observed task failure in this short one-workspace surface.
- Closing inline preview returned focus to its Preview trigger. Privacy dialog keyboard entry, Tab containment and Escape focus return worked after allowing dismissal to complete.
- All four actual saved outputs independently reopened as **3 pages in A1 / A2 / B1 order**. Invalid removal gave the valid range, stated files were unchanged, and retained the current 3-page result. This audit did not separately compare before/after-error export bytes; parent regression coverage owns that stronger assertion.
- Requests observed for the local flows were same-origin only. No planner POST or external request was observed in these cases. An explicit browser routing guard rejected any unexpected external or planner POST request; none fired. This bounds the observed flows, not every possible AI interaction.
- Dark OS preference retained light content without observed text-contrast failures. This is not a completed dark theme. Preview spinner disables animation under reduced motion in source; the entire run used reduced-motion preference, so no animation-performance claim is made.

## Official detector results and disposition

Command: Impeccable 4.3.1 bundled `detect --json apps/universal/App.tsx apps/universal/src`. Markup targets were passed; CSS was included through imports. **10 findings, all advisory; 0 error/warning findings.** Raw result: `detector.json`. The surrounding shell printed the JSON afterward, so the detector-specific exit code was not separately preserved; the returned JSON was complete and usable.

| Rule | Count | Exact locations and values | Contextual disposition |
|---|---:|---|---|
| `design-system-color` | 4 | `App.tsx:292` `#aa405e`; `src/platform/preview.css:8` `#267bff`; `:16` `#637089`; `:18` `#267bff` | Merge icon is an intentional accent absent from structured tokens. Three CSS values are fallback branches behind defined semantic tokens; they did **not** become computed preview colours. Those three are false positives for active visual drift. |
| `design-system-font-size` | 4 | `App.tsx:295` 11px; `src/components/JobActivity.tsx:42` 15px; `src/components/assistant-ui/elements/surfaces.tsx:24` 11px; `thread.aui.tsx:666` 13px | Quick-action 11px and activity 15px are expressly described in DESIGN.md prose but missing from its frontmatter type ramp. The other two are support/history primitives not activated in these representative workflows. No observed clipping/contrast failure is established by these advisories. |
| `design-system-radius` | 2 | `src/platform/preview.css:1` 14px; `:4` 9px | Preview's 14px radius is explicitly documented in DESIGN.md prose; 9px toolbar buttons are a structured-token omission. These are documentation alignment items, not proof of an incoherent UI. |

The parent reported the automatic detector hook was clean on modified files. That narrower hook scope does not contradict this complete App + src advisory scan. This scan is reused; it was not repeated after findings became available.

## Overlay, isolation and cleanup

- `impeccable context --target apps/universal/App.tsx` ran once; existing PRODUCT.md and DESIGN.md were read. The context includes historical-evidence links, but no linked assessment report was read.
- `.impeccable/critique/ignore.md` was absent. Parent owns slug/persistence/trend and synthesized critique; this agent did not read prior snapshots.
- Browser mutation preflight succeeded: title changed to `[Audit B] atepdf` and a local script marker ran. No document data was put into that script.
- One real `live-server --background` attempt in this agent's output folder returned **“Timed out waiting for live server to start.”** Cleanup `live-server stop --keep-inject` returned **“No running live server found.”** No detector script was injected; **no user-visible overlay exists**. Existing CSP restricts script/connect origins to self; it was not weakened or bypassed.
- Headless Playwright was the explicit owner-bounded fallback, despite native computer-use tools being available. All agent-created Chrome browsers/contexts were closed. The app server on 3213 was left running and untouched; 3211 was never used.
- Only report/scripts/evidence in this output folder were written. No source, config or native project was changed. No helper output temporary source file required deletion.
- Harness limitations: one selector was corrected because the app exposes two dialog roles; a second retry allowed Escape dismissal to finish before reading state. Completed 320/390/768 cases were retained instead of repeated. The characterization harness completed its browser loops and closed Chrome, then hit a PDF cleanup API mismatch before serializing its geometry; its screenshots remain, but no precise characterization geometry is claimed. Independent saved-PDF validation was rerun separately with the correct cleanup API and passed. No app behavior was mocked.

Questions skipped: Assessment B is an evidence handoff to the parent synthesis; the owner already authorized the complete cycle.
