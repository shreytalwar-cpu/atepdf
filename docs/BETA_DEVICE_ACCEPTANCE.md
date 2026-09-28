# Physical-device beta acceptance

Status: **procedure only; no physical-device pass is claimed here.** Procedure began at source `63e5127`; the current candidate adds private TLS pairing under ADR 0009. Record its final commit and binary before acceptance. Run this against the actual candidate binary on a physical iPhone, physical iPad and Mac separately. Simulator, helper and browser results do not fill these rows.

The beta is session-only: ordinary backgrounding can retain the conversation while the process survives, but termination, a crash or OS process reclamation starts a fresh session. Save wanted results before leaving. This procedure does not introduce persistent document history, recovery, production authentication or a new retention policy.

## Record the candidate

For each device record: model, OS version, candidate build/version, source commit, installation method, tester/date, available local storage, and pass/fail/not-run for each section below. Keep only synthetic screenshots and outputs. Do not record device identifiers, credentials, pairing codes or customer documents.

Use an already approved development installation. Signing, provisioning, notarization and distribution approval are separate gates. The private beta connection requires explicit same-Wi-Fi setup on the Mac and a fresh pinned pairing code; a device cannot reach the Mac through its own localhost. First finish these local-processing checks with AI disconnected. Test pairing separately using the procedure in INTERNAL_BETA.md and the approved request allowance.

Create a new test-output folder on the Mac and a local **On My iPhone / On My iPad** folder in Files. Use a local Mac folder outside cloud-synced locations. If the local destination is unavailable, record that limitation; a cloud-provider save is a different test and must not silently substitute for this local test.

## Inputs and independent expectations

Use only the tracked synthetic files in `tests/fixtures/`. Transfer copies to the device before testing; finish the local tests offline. The first workflow also has the same two bundled samples, but test the real Files picker at least once.

| Input | Expected content |
| --- | --- |
| `brief.pdf` | 2 pages, A1 then A2 |
| `appendix.pdf` | 1 page, B1 |
| `mixed-text-and-scan.pdf` | 3 pages, digital A1, raster S1, digital B1 |
| `image-heavy.pdf` | Synthetic JPEG-heavy compression input; compare its page count, text and appearance before/after |

Exact source hashes and OCR targets for the handoff fixtures are in `tests/fixtures/expectations.json`. The scan must become searchable for **Paperwork made simple** and **DEMO-0042**. A visually readable raster alone is not OCR success.

## Real import → save → reopen → remove → undo

1. Open the candidate with no AI connection. Choose files, cancel once, and choose files again. Import `brief.pdf` first, then `appendix.pdf` in a second selection so the order is explicit. Confirm 2 originals and 3 total pages. Reopening the picker after cancellation must work.
2. Select **Merge**. Wait for a validated 3-page result. Open the inline preview and inspect every page: A1, A2, B1. Header scale, margins, page bounds and text must match the input pages; inspect both Fit and Zoom. Close the preview.
3. Select **Save PDF**, cancel the dialog, then retry. On Mac expect cancellation rather than a saved receipt. On iOS the neutral share-sheet-closed receipt is expected; it must not be interpreted as a completed destination save. The result must remain previewable and Save must become usable again.
4. Save a copy to the local output folder as `merged.pdf`. On iPhone/iPad choose **Save to Files**, explicitly select the local folder, complete the system save, and inspect that folder in Files. Do not treat merely opening or closing the share sheet as success. On Mac complete the system export panel into the fresh local folder.
5. Open the saved file **from its destination**, outside atepdf. On device use Files/Quick Look. Inspect all 3 pages and their A1/A2/B1 order. Transfer that exact saved copy to the Mac and open it in macOS Preview; do not generate a replacement export from the browser.
6. Return to the same atepdf session. Type `remove page 2`; verify the exact composer text before Send. The new result must have 2 pages. Save it separately as `removed.pdf` and independently reopen it: A1 then B1, with A2 absent.
7. Type `undo`. The current result must return to 3 pages. Save separately as `undo.pdf`. Independently reopen A1/A2/B1 and compare the SHA-256 of `undo.pdf` with `merged.pdf`; they must be identical. On Mac, from the fresh output folder, `shasum -a 256 merged.pdf undo.pdf` provides this comparison without sending files anywhere.
8. Reopen the two imported source files from their original local folder. Confirm A1/A2 and B1 remain unchanged. Transfer these same source copies back to the Mac and compare their hashes with the tracked originals/fixture manifest; an app receipt or a screenshot is not an immutability check.

Keep the actual saved PDFs, page-order notes and hash output with the device record. Fail the candidate for a missing output, wrong page/order, changed original, nonidentical undo, truncated/unreadable saved PDF, misleading success receipt, or a save/picker action that remains stuck after cancellation.

## OCR and compression

1. Start a fresh session after saving wanted results. Import `mixed-text-and-scan.pdf` and `image-heavy.pdf`, in that order. Merge and save the 4-page baseline as `chain-before.pdf`.
2. Select **Make searchable**. Save the validated result as `chain-searchable.pdf`. Transfer the actual export to the Mac and open it in Preview. Search for **Paperwork made simple** and **DEMO-0042**, then select/copy the recognised text. Confirm the search highlights align with the words on physical page 2; confirm digital A1 and B1 remain searchable on pages 1 and 3. Visually compare every page with the baseline for scale, crop, layout and missing content.
3. Select **Compress** and explicitly choose the proposed optimised copy. Save as `chain-final.pdf`. Record exact file byte counts before/after from the actual exports. Reopen all pages, repeat the two search checks, and compare small text and image details. Never infer a successful reduction from a spinner or an operation label. A truthful “no useful reduction” outcome can be valid for arbitrary PDFs; this image-heavy fixture is intended to exercise the real JPEG codec.
4. Keep the baseline, searchable and compressed exports together. Passing these synthetic documents is not a guarantee for every PDF, OCR language or image-quality requirement.

## Interruption and interface checks

- With a saved 3-page result still open in atepdf, background the app, lock/unlock the device, and return. If the same process survives, the result and its preview should remain usable. While OCR or another sufficiently long local operation is running, repeat background/return and press Stop if it is still running. Accept either a fully validated result that completed before Stop or a cancellation that preserves the prior result; reject a partial/new unvalidated result, false cancellation claim, stuck busy state or changed original. If the work finishes too quickly, mark the active-work interruption case **not exercised**, not passed.
- Open a picker/save sheet, background and return, then cancel and retry. Record whether the sheet and application remain usable. On iPad repeat in portrait and landscape. Complete at least one real local save after the interruption.
- After saving outputs, explicitly terminate and relaunch atepdf. Expect a fresh conversation and no restored native pairing. Reopen the previously saved PDFs from Files/Preview and verify that they still exist and open correctly. Loss of unsaved in-session work is the current policy; loss of an independently saved file is a failure.
- On iPad, test landscape with the software keyboard and, if available, a hardware keyboard. The composer, Send/Stop, latest-message control and preview navigation must remain reachable. Test ordinary typing/backspace, empty Send disabled state, large text, VoiceOver reading/button labels, and Reduce Motion. Record each configuration actually exercised.
- Run the agreed synthetic larger-file corpus on each physical device and record its actual sizes, operation duration and any OS termination. Browser/desktop acceptance above 20 MB does not prove mobile memory safety. Do not reintroduce a SaaS upload cap as a substitute for device evidence; record a failed device workload accurately.

## Pass record

| Device / candidate | Local picker + cancel/retry | Actual save + independent reopen | Remove + byte-identical undo | OCR + compression | Background + cancel/return | Terminate/relaunch policy | Keyboard/accessibility | Larger files |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Physical iPhone | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Not run |
| Physical iPad | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Not run |
| Mac candidate | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Not run |

Attach the exact candidate identity, saved synthetic outputs, independent-reader observations and failures to each completed row. Earlier Mac or simulator evidence remains historical until the current candidate is checked. Network privacy capture, physical signing, production authentication and actual billing sandbox verification remain separate gates; this document does not claim them.
