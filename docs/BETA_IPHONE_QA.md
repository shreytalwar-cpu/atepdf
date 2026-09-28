# iPhone Simulator beta QA — 28–29 September 2026

The first captured Release application passed the two ordinary local-only iPhone UI tests. A refreshed app then passed exact typing at accessibility-large size and completed import, merge and preview before correctly failing the visible-software-keyboard gate. The final focused accessibility-large test passed page navigation, zoom, fit and close after correcting the clipped toolbar. This is Simulator evidence, not physical-device or distribution acceptance. The initial QA reused captured products. Later test-only builds and actual saved-copy acceptance are recorded separately below. No planner request, owner credential access or old-project access occurred in this iPhone QA pass.

## Final UX source — 29 September, `7935daa`

The latest [Release build and source-matched result](evidence/native/ux-discovery-final-result.json) passes the actual local import/merge/preview/removal/Undo/share-dismissal workflow (67.347s) and fast typing/backspace (10.987s). The current-result title, Save, Undo and new Help footer were visually inspected. This remains the explicitly named hardware-input test: the software keyboard is offscreen, so visible iPhone keyboard clearance is still unverified. The actual destination-save/restart/Preview proof below remains bound to its earlier captured binary; it is not relabelled as a rerun on the new build.

## Tested application

- Device: iPhone 17 Pro, iOS Simulator 27.0 (24A434), arm64, `D68C4547-67D3-4960-AAB9-D85FD786D6FC`.
- Captured Release test products: `/Users/shrey/Library/Developer/XcodeBuildMCP/workspaces/atepdf-0efe6fe22454/test-products/test_sim_2026-09-28T16-58-18-575Z_pid12385_383dd25f.xctestproducts`.
- Executed source snapshot: [beta-ipad-planner-source.json](evidence/native/beta-ipad-planner-source.json), captured from HEAD `63e5127c663588b6b1f29c56eec19ced5c25230b` plus its recorded worktree files. Later test-only source additions are not part of these products.
- Installed executable, embedded JavaScript bundle and `Info.plist` matched those captured products byte for byte: [build and installed proof](evidence/native/beta-iphone-build-proof.json).
- Only `testBundledMergePreviewRemovalUndoAndShareDismissal` and `testNativeComposerPreservesFastTypingAndBackspace` ran in the baseline. Tests used the bundled synthetic PDFs and the actual local engine.

## Baseline result

**2 passed, 0 failed, 0 skipped**; 119.7 seconds in the tests and 144.1 seconds in the runner. [Result summary](evidence/native/beta-iphone-baseline-summary.json), [runner log](evidence/native/beta-iphone-baseline.log), [attachment index](evidence/native/beta-iphone-baseline-attachments.json).

The real interface imported `brief.pdf` and `appendix.pdf`, merged three pages, displayed page 2 inline, accepted exact `remove page 2` input with an added/deleted character, produced two pages, undid to three pages, opened the system share sheet, and dismissed it with the honest receipt. The separate typing case preserved `remove page 2`, then `remove page 2x`, then the original text after Backspace. Empty-composer Send was disabled after submissions in the workflow.

- [Inline second page](evidence/native/beta-iphone-baseline-workflow-03-inline-preview-second-page.png): the corrected native raster fills the source page width; preview navigation remains inside the conversation.
- [Command ready](evidence/native/beta-iphone-baseline-workflow-04-command-ready.png).
- [Undo result](evidence/native/beta-iphone-baseline-workflow-05-undo-restores-three-pages.png).
- [Share dismissal](evidence/native/beta-iphone-baseline-workflow-06-share-dismissed-with-honest-receipt.png).
- [Fast typing and Backspace](evidence/native/beta-iphone-baseline-typing-native-exact-fast-input-and-backspace.png).

The captured test checks keyboard existence; it does not include the newer explicit software-keyboard frame assertions. The final typing hierarchy places the keyboard at `(0, 918, 402, 226)` while the app is 874 points tall: this keyboard is offscreen. The screenshots therefore do not establish on-screen software-keyboard clearance. Share dismissal does not establish a saved destination or independent reopen.

## Accessibility-large probe

Original UIKit configuration was `UICTContentSizeCategoryL`, Reduce Motion false. The iPhone alone was changed through public `simctl ui` to `accessibility-large`. UIKit confirmed `UICTContentSizeCategoryAccessibilityL`. Reduce Motion was unchanged.

The initial larger-text workflow **failed before import** because its first sample-button tap did not reveal the lower part of the Welcome ScrollView. The recorded viewport is `(0, 138, 402, 333.7)`, content height 626, and the sample button is `(45, 637, 312, 86)`. This is a test reachability gap, not proof that a user cannot scroll to the button. The test did not attempt scrolling at this step.

The screenshot also shows awkward midword wrapping of the three quick-action labels. Each button is 105 points tall, and the composer is 185 points tall. The keyboard was not opened, so the remaining usable conversation height with a software keyboard is not established by this run.

- [Screenshot](evidence/native/beta-iphone-accessibility-large-initial-final-screen.png).
- [Accessibility hierarchy](evidence/native/beta-iphone-accessibility-large-initial-final-accessibility-hierarchy.txt).
- [Result summary](evidence/native/beta-iphone-accessibility-large-summary.json).
- [Initial failure log](evidence/native/beta-iphone-accessibility-large-initial.log).
- [Original-setting restoration](evidence/native/beta-iphone-setting-restore.json): restored to `large`, read back as `large`.

The initial screenshots preserve a separate midword quick-action wrapping defect. It was corrected in the refreshed application below. A public DeviceHub menu inspection was blocked by the host lock before any input; keyboard settings were not changed. The owner deferred Mac UI interaction, so no further UI or unlock attempt is part of this QA.

## Refreshed accessibility-large result

Used immutable Release products at `/Users/shrey/Library/Developer/XcodeBuildMCP/workspaces/atepdf-0efe6fe22454/test-products/test_sim_2026-09-28T17-21-47-165Z_pid12385_a4339560.xctestproducts`. The [executed source snapshot](evidence/native/beta-ipad-accessibility-source.json) records HEAD `2cb0c8376daf734e9a09dd82472138dfd2032e98` plus frozen worktree changes, including the footer correction and measured Welcome scroll helper. [Final installed proof](evidence/native/beta-iphone-final-build-proof.json) again matches the installed executable, embedded JavaScript and `Info.plist` to the captured products exactly.

**1 passed, 1 failed, 0 skipped**. Exact `remove page 2` typing, added `x` and Backspace passed. The full workflow reached ordinary Welcome scrolling, sample import, local three-page merge, page 1 preview and page 2 navigation. It then failed at the strict software-keyboard visibility gate. It did not execute removal, undo or sharing in this refreshed larger-text run. Those operations passed in the earlier baseline.

- [Final result summary](evidence/native/beta-iphone-accessibility-large-final-summary.json), [runner log](evidence/native/beta-iphone-accessibility-large-final.log), [attachments](evidence/native/beta-iphone-accessibility-large-final-attachments.json).
- [Merged result and corrected quick actions](evidence/native/beta-iphone-accessibility-large-final-workflow-02-merged-three-pages.png): visible Merge and Compress labels occupy single lines; the horizontal action row is 44 points tall instead of 105. The third action extends beyond the viewport in a horizontal ScrollView. Horizontal scrolling to that action was not exercised by these tests.
- [Page 2 preview before toolbar correction](evidence/native/beta-iphone-accessibility-large-final-workflow-03-inline-preview-second-page.png): the raster and page navigation are visible. This revealed that the single-row preview toolbar clipped its rightmost Zoom in control at accessibility-large size. The correction and successful follow-up are recorded below.
- [Exact typing](evidence/native/beta-iphone-accessibility-large-final-typing-native-exact-fast-input-and-backspace.png).
- [Measured geometry](evidence/native/beta-iphone-accessibility-large-final-workflow-keyboard-workspace-geometry.txt): conversation `(0, 138, 402, 406.7)`, composer `(25, 553.7, 352, 119)`, Send `(333, 676.7, 44, 44)`, keyboard `(0, 918, 402, 226)`. Keyboard/app intersection is zero, so software-keyboard clearance is explicitly **unverified**, not passed. The app's footer-hiding branch for a visible larger-text keyboard was not established by this run.

The iPhone was restored to its original `large` category after the refreshed probe; public `simctl ui` readback was `large`. Reduce Motion was unchanged. No iPad settings, XcodeMCP global defaults or production identities were modified.

## Final preview-control acceptance

**1 passed, 0 failed, 0 skipped**, 60.7 seconds in the test and 73.2 seconds in the runner. Executed only `testPreviewToolbarControlsRemainReachableAtCurrentTextSize` at UIKit `UICTContentSizeCategoryAccessibilityL` using the captured Release products `/Users/shrey/Library/Developer/XcodeBuildMCP/workspaces/atepdf-0efe6fe22454/test-products/test_sim_2026-09-28T17-28-27-903Z_pid12385_9d524d88.xctestproducts`. The [source snapshot](evidence/native/beta-ipad-final-source.json) records commit `afa15b5` and the executed file hashes. [Build/installed proof](evidence/native/beta-iphone-preview-controls-build-proof.json) matches the installed application bytes to those products.

The app uses separate navigation and zoom rows when the preview is narrow and text is large. The test imported the samples, merged, opened the preview, navigated to page 2, tapped Zoom in and Zoom out with the expected enabled-state changes, zoomed again and tapped Fit to reset, returned to page 1, and closed the preview. Measured controls had at least 44-point width/height and stayed within the conversation's horizontal bounds; ordinary scrolling revealed controls before taps. No keyboard was required for this focused test.

- [Passing summary](evidence/native/beta-iphone-preview-controls-summary.json) and [runner log](evidence/native/beta-iphone-preview-controls.log).
- [Final screenshot](evidence/native/beta-iphone-preview-controls-native-preview-controls-at-current-text-size.png) and [control hierarchy](evidence/native/beta-iphone-preview-controls-preview-controls-at-current-text-size.txt).
- [Attachment index](evidence/native/beta-iphone-preview-controls-attachments.json).

The public text-size setting was restored to `large` and verified after this final run. No further exploratory UI changes were made. The remaining executable check is to enable an actual software keyboard when simulator UI or a physical device is available, then rerun the strict larger-text workflow through removal, undo and sharing. The zero-intersection failure above remains unmodified in the evidence.

## Actual Files save, app restart and independent reopen

The follow-up exercised the original accepted application source `afa15b5`, after both temporary pulse experiments were reverted. The actual system share sheet **Save to Files** action wrote `b347bc45-45db-4dcd-b397-bfd586220a21.pdf` into a local QA folder. The system picker restored a previous test folder, so the observed destination is explicitly nested:

```text
On My iPhone/
  atepdf-beta-743ef2f5-e142-4e7e-b848-4c259d6c6958/
    atepdf-beta-b347bc45-45db-4dcd-b397-bfd586220a21/
      b347bc45-45db-4dcd-b397-bfd586220a21.pdf
```

atepdf was terminated and relaunched to a fresh session; the original result no longer appeared. Read-only host inspection found the surviving copy in that independent local Files provider. The new `tests/native/ios/verify-saved-export.mjs` opened that exact real path with PDF.js: **3,100 bytes, three pages A1/A2/B1, complete matching text, page boxes and rotation**. SHA-256: `4ae158da5e4f1576d9842141faaf65b17502327d42815844973b8ee5a48ab8c0`. The authoritative full digest is in [the independent reader evidence](evidence/native/beta-iphone-saved-copy-independent.json).

A bounded separate public-UI follow-up selected those exact two folders and the exact UUID-named PDF through Files, then opened it in the independent system Preview app. It passed **1/1 in 32.353 seconds**. The first foreground snapshot was still transitioning and was not accepted as render proof. A subsequent read-only simulator screenshot clearly showed the matching `b347bc45…` document title, the complete **Project brief / A1** page and the following **Working notes / A2** page. Both the agent and parent visually inspected it. PDF.js supplies the separate all-three-page structural/text check; this screenshot is not an every-page visual inspection. No file injection, new PDF job, paid request or customer document was used for the reopen.

The earlier combined test attempts failed system navigation assumptions after saving; they are not a single all-green save/reopen suite. Hidden browsing-root containers survive folder changes, Browse can expose a sidebar, and inline folder creation automatically enters the new folder. The reusable test now follows the actual visible parent controls, verifies a direct local-root destination, and explicitly selects **On My iPhone** in Files. The final retained flow then compiled successfully and ran once. It **failed in 27.231 seconds**, before creating a folder or saving, at the guarded system picker parent-label assertion: the visible control was labelled **Back**, while the visible title identified the prior b347 QA folder. No retry followed. See [the final retained-test build and failure](evidence/native/beta-iphone-export-retained-result.json). The complete reusable flow is therefore not accepted; the earlier actual save and separate exact-copy reopen remain independently evidenced. The one-off exact-copy test is preserved only as executed evidence, not retained as a reusable device-dependent test.

Earlier candidate-source exports and discovery-created empty QA folders remain separately identified; they were not substituted for this original-source copy. No unrelated Files entries were modified or cleaned up. The [follow-up acceptance record](evidence/native/beta-iphone-export-acceptance.json) links the final source/build, actual save, passing exact-copy reopen and [rendered system Preview](evidence/native/beta-iphone-export-reopened-preview.png).

## Remaining acceptance boundaries

Physical iPhone/iPad installation, on-device memory pressure, device Files-provider behavior, interruption behavior, and keyboard/accessibility combinations still require physical acceptance. The simulator save/restart/reopen evidence above does not establish physical-device success. This pass does not validate the native planner, TLS, billing, signing, TestFlight, or production distribution. Use [physical-device acceptance](BETA_DEVICE_ACCEPTANCE.md) for those device-side PDF steps.

## 29 September public software-keyboard probe

Production source remains `7935daa`; the [one-off probe built successfully in Release](evidence/native/ux-keyboard-settings-build.json). It attempted the documented public Settings → Accessibility → Touch → AssistiveTouch route on the dedicated iPhone simulator. The actual Accessibility page exposes no Touch/AssistiveTouch row. The test stopped before reading or mutating either switch and before any PDF operation; this is unavailable simulator configuration, not proof of an app keyboard defect. [Result](evidence/native/ux-keyboard-settings-result.json), [screenshot](evidence/native/ux-keyboard-settings-01-assistive-keyboard-row-unavailable-Touch.png), [hierarchy](evidence/native/ux-keyboard-settings-01-assistive-keyboard-row-unavailable-Touch-hierarchy.txt) and [failed trace](evidence/native/ux-keyboard-settings-01-test.log) are retained.

No retry or private/global preference workaround followed. The executed one-off source is retained only as evidence; the reusable workflow test was restored byte-for-byte to `7935daa`. The original fully workflow-tested app was then [restored to the same simulator](evidence/native/ux-keyboard-settings-app-restoration.json) with a public install and exact executable/bundle/plist checks; no uninstall, data erase or new launch occurred. No default or AssistiveTouch-configured software-keyboard clearance is claimed. The remaining supported routes are a physical device or simulator keyboard UI when desktop interaction is authorized. Mac UI remains deferred.
