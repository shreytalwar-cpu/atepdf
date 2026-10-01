# Dogfooding the SHR-106 build

A 10-minute pass on the real Mac app, with no Terminal needed. This build is ready for feedback, **not** owner-approved.

## Open the right build

1. In Finder, choose **Go ▸ Go to Folder…** and paste the build folder from the PR handoff (it looks like `/private/tmp/atepdf-mac-…/`).
2. Open **atePDF.app**. If macOS warns that it's from an unidentified developer, Control-click it and choose **Open**. This is a development build with an ad-hoc signature.
3. You'll see a black icon with the Iris 8 in the Dock, and an empty workspace that says **Drop PDFs here**.

There are two builds:
- **Normal build** (`dev.atepdf.fresh.mac`): uses your normal atePDF workspace on this Mac.
- **Synthetic build** (`dev.atepdf.synthetic.mac`): isolated test data; its workspace isn't saved.

Use the synthetic build if you don't want to touch your real workspace.

## Files to use

Click **Try with sample PDFs**. This adds two synthetic PDFs: `brief.pdf` (2 pages) and `appendix.pdf` (1 page). No customer PDFs are needed. For OCR, use any scanned PDF of your own that you're comfortable processing locally. Nothing leaves the Mac unless the AI connection is set up.

## The journey to try

1. **Combine:** click **Combine 2 PDFs**. You should get *Merged PDF · 3 pages · Current · Verified*.
2. **Remove a page:** type `remove page 2` and press Return. Watch the activity row ("Removing page 2…") and the new result.
3. **Undo:** click **Undo** on the card. The earlier result comes back marked *Restored*.
4. **Make smaller:** click **Make smaller**, then **Create Copy**. The samples have no photos, so expect the truthful "No smaller version was possible" outcome.
5. **Make searchable:** on the samples it finishes at once ("no scanned pages needed OCR"). Try a scanned PDF to see real progress.
6. **Quick Look:** open it, page through, then close it.
7. **Save:** choose **Save…**, pick a folder you'll remember and check the file is there. Tell us if it isn't.
8. **Errors:** type `remove page 9`. You should see "Page 9 doesn’t exist. This PDF has 3 pages (1–3)…" and an **Edit Request** button.
9. **Settings and start again:** open **⋯ ▸ Settings** (try Dark), then **⋯ ▸ Start Over…**.

Try the window narrow (around 640 pt), normal (around 1024 pt) and wide. The Files panel docks at 1120 pt and wider.

## Not available yet

- ⌘ shortcuts in the Mac menu bar (SHR-75); use the ⋯ menu and the Actions button.
- Shift+Return for a new line (paste multi-line text instead).
- Dropping files from Finder (SHR-73); use Choose Files… instead.
- An exact-file save destination and reopening saved files are not verified yet (SHR-74).
- Final onboarding (SHR-77), plus pricing and accounts.

## Most useful feedback

- Were you ever unsure **which file is current** or what your next request would apply to?
- Was any wait unclear, too long or too jumpy?
- Did atePDF ask anything it didn't need to?
- Was any action hard to find?
- Did the conversation get too dense after several steps?
- Did any motion feel awkward, slow or distracting?
- Where did it feel generic, or unlike atePDF?

Screenshots with a sentence each are perfect.
