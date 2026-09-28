# Conversation refinement

Owner direction: refine the shared atepdf interface with the clarity and interaction polish of a first-class chat product, including useful processing states. Keep assistant-ui, the approved atepdf mark/wordmark, the bright drop-and-instruct workspace and all results inside the conversation. No new navigation, remote PDF processing or paid model calls. A later owner instruction enabled the existing 20-request allowance and removed per-request AI consent cards (ADR 0006).

## Captured starting flow

1. **Empty workspace:** usable, but the composer footer repeats privacy and setup information. Captured in `evidence/design/01-before-empty.png`.
2. **Import → local merge:** actual bundled sample PDFs produce three pages. At 1280×720, the result's actions extend below the visible conversation while a tall composer/footer occupies the lower screen. Captured in `evidence/design/02-before-result.png`.
3. **Processing:** source previously displayed a changing engine sentence plus generic typing dots. The post-change browser test holds the real local OCR language asset to inspect the active state, then cancels and verifies the committed PDF remains byte-identical.

Both starting screenshots were captured in a new in-app browser sample session and opened from disk. Existing user sessions were preserved. Approved iPhone/iPad references were viewed again; their earlier brand label is superseded by atepdf's approved assets.

## Decisions and implementation

| Before | After | Why |
| --- | --- | --- |
| Separate AI warning, planning approval and safe-copy approval | One Send → plan → validate → local execution → inline result | The owner explicitly requested seamless operation; missing choices and genuine image-quality decisions remain actionable |
| Generic typing dots and changing sentence | Compact operation-specific activity with actual engine detail and optional real steps | Explain local work without pretending to expose model reasoning or inventing progress |
| No structured step status | Active → independent validation → checked events from the controller | A finished worker is not yet a validated output; late callbacks cannot regress state |
| Setup and repeated privacy copy below every conversation | Optional AI setup and new-chat controls in the compact header; one current-result context line | Give more of shorter windows to the conversation |
| Result card has several competing ready messages | File identity treatment, real page/size facts, primary Save, secondary Preview, quiet Undo | Make the result and next action easy to scan; show a save receipt only after a real attempt |
| Long native page raster expands the conversation | Bounded read-only preview with stable loading space, page navigation and fit/zoom controls | Keep the controls reachable while making page exploration deliberate |
| No visible response while dragging | Workspace drop feedback that follows actual file drag state | Confirm where files will go and that they remain local |
| Hard to return to the end of longer chats | Accessible Latest message control using the existing assistant-ui list | Preserve upward reading while making the current result reachable |
| Low-contrast placeholder/blue primary and undersized utility targets | Readable placeholder, darker approved-family blue, 44-point/pixel controls | Improve practical legibility and keyboard/touch use |
| Empty native Send looked active despite being disabled | Native opacity follows public composer.canSend; official Send retains disabled semantics | Make the visible control agree with the actual composer state |
| Native high-resolution raster had a centered, undersized page | Explicit bitmap scaling before crop/rotation transform | Make preview geometry and OCR coordinates agree with the PDF page |
| Motion includes text fading and unconditional modal fade | Only the decorative activity icon pulses; Reduced Motion disables it and optional fades | Keep changing facts readable and respect system preferences |

The public assistant-ui Thread, runtime, Send/Cancel, message, copy and input slots remain the foundation. No dependency or framework changes. The native input remains uncontrolled through the public slot to preserve the typing fix; visual changes do not restore the problematic controlled value feedback.

## Verification and limits

Final builds, screenshots, test totals and source hashes are recorded in the session report and `evidence/design/`. Screenshot review establishes visible layout, not full VoiceOver or accessibility compliance. Physical-device gestures, large accessibility text, IME/dictation and broad document performance remain separate F09 evidence. This is a concrete refinement pass, not an Apple Design Award or release-readiness claim.


Final web evidence: actual Expo export + production Next build and both TypeScript checks pass. All 66 Node regressions and 17 browser workflows pass. The browser suite additionally verifies prompt Stop while status is held, late-response cancellation, incomplete/stale/truncated response rejection, direct filename-redacted planning to real local merge, and the remaining balanced-compression quality choice. These planning responses are explicitly mocked; the two earlier owner-approved live cases remain the live-provider evidence.

Final inspected screenshots: `evidence/desktop-empty.png`, `phone.png`, `compact.png`, `tablet-portrait.png`, `tablet-landscape.png`, `keyboard.png`, `latest-message-result.png`, `preview.png`, `local-processing-reduced-motion.png`, and `drag-feedback.png`. The processing screenshot uses an isolated mocked no-key status for its earlier chat turn; it is not evidence that the owner's real key is absent. The actual enabled connection was separately checked through the UI in `evidence/design/06-ai-enabled.png`.

Native raster verification checks actual colored-pixel positions at 96, 724, 1024 and 1800 pixels, including all four rotations and a nonzero crop origin (20 cases). An independent title-position assertion catches the former OCR offset. The corrected 1800-pixel preview was opened and visually inspected; final application evidence is recorded separately from the helper proof.

Final iPhone application evidence: both UI tests pass on the corrected renderer. The selected page-2 screenshot (`evidence/native/ios-ui-renderer-03-inline-preview-second-page.png`) was opened and reviewed: full-page content, readable page controls and faded empty Send agree with the actual state. Source, built app and installed app hashes are recorded in `ios-ui-renderer-result.json`. Final browser results use the same source snapshot and pass all 17 workflows. The final local web result is captured in `evidence/design/07-seamless-final-result.png`.

Final Mac application evidence: exact staged/signed artifact `atepdf-mac-80vob5yq` passed merge, correctly scaled pages 1/2, zoom/pan/Fit, typed removal/undo and save cancellation. `evidence/design/mac-final.png` was opened and reviewed after the correction; the pre-fix capture is preserved as `mac-before-raster-fix.png`. See `evidence/native/mac-final-corrected-smoke.json` for source/signature/container checks and the separate actual-save evidence.
