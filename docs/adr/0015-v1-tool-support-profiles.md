# ADR 0015 — v1 tool support profiles and output settings (SHR-51)

**Status:** **Approved** by Shrey Talwar on 30 September 2026 (TOOLPROF-1 to TOOLPROF-9; section 13). This is an approved target support contract, not implemented support. Nothing here is implemented, and no runtime capability, tool description or public claim changes until each implementing SHR passes its acceptance map (section 9).  **Source:** `origin/main` `ff3e291` (30 September 2026), re-validated after merging `7853973` (SHR-49, documentation only; no source change).  **Authority:** `PRODUCT_V1.md` D-12/D-13/D-15, TOOL-01–15, PDF-01–08, UNDERSTAND-02–04, STATE-05/07, BILL-07, UX-02–04, OPEN-07; [SHR-51](https://linear.app/shrey-talwar/issue/SHR-51/approve-v1-tool-support-profiles-and-output-settings) (parent SHR-22); ADR 0004 (no byte caps), ADR 0011 (Mac envelope), ADR 0012 (privacy classes); SHR-45 corpus; SHR-46 matrix. ADR 0013 (SHR-49; CPDF-1–5 approved and merged) governs linked and signed PDFs. SHR-52 (encryption engine/profile) is in progress and is **not** decided here.  **Evidence:** [docs/evidence/SHR-51-2026-09-30](../evidence/SHR-51-2026-09-30/README.md).

This ADR defines the v1 support contract for the 13 approved tools: which inputs each tool supports, which settings it exposes, what it refuses safely, what counts as success, and how that is proved. It adds no features. Where the evidence is thin, it records the value as **pending** and names the SHR that must measure or prove it. It does not supply an attractive default.

## 1. Rules for reading this ADR

1. **Observed vs approved target.** Section 2 describes what the code does today. Sections 3–8 describe the approved v1 launch contract. An approved item is not a support claim until its implementing SHR passes section 9.
2. **Mac is the claim platform.** The claims are for the native Mac Catalyst build: PDFKit/CoreGraphics reading, Vision OCR, ImageIO and the shared pdf-lib writer. Web and iPhone behaviour is preserved but is not the basis for these claims. The SHR-46 OCR evidence came from the web Tesseract path, so Vision OCR on the Mac has **no** matrix evidence yet.
3. **Technical limits are not commercial limits** (BILL-07). Section 6 keeps them apart.
4. **Pending means pending.** A value marked *pending SHR-78* or *pending SHR-64* has no approved number. Current prototype constants remain as **provisional safety guards**, not published claims.
5. **Excluded everywhere:** standalone ZIP, duplicate-page features, arbitrary semantic sorting, editing (D-17), batch "per file" processing, and permission-only restriction bypass. The schema entries `export_zip`, `reverse_pdf` and `select_pages.action=extract` are not separate v1 capabilities; see section 10, gap G10.

## 2. Current source (observed capability, `ff3e291`)

**Executors.** The contract registry (`packages/contracts/schemas/operation-registry.json`) defines 15 operations. Only 4 have executors (`packages/contracts/src/protocol.ts:11`). The SHR-46 `operationInventory` agrees: 4 implemented and 11 not implemented.

| Tool | Executor today | Observed restriction |
|---|---|---|
| Merge | pdf-lib `copyPages` into a new document (`packages/web-pdf/src/engine.ts:35-40`) | At least 2 inputs; `ordering: as_provided` only |
| Remove Pages | `select_pages`, new document keeping the remaining pages (`engine.ts:41-47`) | `remove` + `explicit` indices only (`protocol.ts:61`); refuses when no page would remain |
| Compress | JPEG re-encode + object streams (`engine.ts:69-94`) | `balanced`/`lossless`, `single` only (`protocol.ts:66`); details in section 5.6 |
| OCR | Mac: Vision `.accurate`, `["en-US"]`, language correction off (`AtepdfPDFEngine.swift:152-155`). Web: tesseract.js `eng` | English only, `single` only (`protocol.ts:65`); text-empty pages only; ≤15 such pages; unrotated, origin-aligned crop; average confidence ≥0.45 per page, otherwise the **whole job** is refused; **ASCII-only** text writer (`engine.ts:54`) |
| Split, Reorder, Rotate, Images to PDF, PDF to Images, Protect, Unlock, Extract Text, Remove Metadata | **None** | Schema only (`operation-registry.json`) |

**Shared admission and limits.** None of these values has been measured on a Mac. All are provisional.

| Guard | Value | Source |
|---|---|---|
| PDFs per session | 1–20 | `packages/core/src/job-controller.ts:64` |
| Pages per input and per result | 1–100 | `packages/web-pdf/src/types.ts:10`; `protocol.ts:17,68` |
| Decoded pixels per image or raster | 12,000,000 | `types.ts:10`; `AtepdfPDFEngine.swift:50` |
| Page size | 10–4000 pt per side | `engine.ts:15` |
| OCR pages needing recognition, per job | 15 | `AtepdfPDFEngine.swift:142` |
| Job / native call / worker deadline | 240 s / 120 s / 120 s | `job-controller.ts:54`; Swift 364; `client.ts:11` |
| Plan steps | 4 | `protocol.ts:44` |
| Byte size | **No cap** (ADR 0004) | — |
| Encrypted input | Refused | `engine.ts:8`; Swift 57/237 |
| Complex input | Refused if the catalog has `AcroForm`, `StructTreeRoot`, `Collection`, `Outlines`, `Names`, `OpenAction`, `AA` or `Perms`, or any page has `Annots` or `AA` | `engine.ts:10-13` |

**Outputs.**
- **Single result only.** Each plan has one terminal `resultRef`; the controller commits one artifact named `atepdf-result.pdf` (`job-controller.ts:130`). Collections do not exist yet (SHR-54).
- **Verification.** Page count; per-page width, height and rotation; text preserved on pages that had text; OCR words re-extracted (`job-controller.ts:107-120`). SHR-47 is adding identity, order and box checks.
- **Metadata.** Merge and Remove create new documents, so pdf-lib writes `Producer`/`Creator` = "pdf-lib (https://github.com/Hopding/pdf-lib)" and fresh dates, and source Info/XMP is dropped. OCR and Compress save the loaded input, so its Info/XMP passes through unchanged. atePDF never writes its own producer.
- **Inputs.** Only PDFs can be picked or dropped (`runtime.native.ts:64`, `runtime.web.ts:8`). There is no image import and no HEIC handling. There is no page-range parser; the planner emits structured 1-based selectors.
- **Settings.** There is no tool settings UI. Compress (balanced) asks for a quality confirmation (`App.tsx:209-211`).

**SHR-46 matrix (executed 49 of 57):** 27 SUPPORTED, 16 SAFELY_REJECTED, 3 FAILED (encrypted input got the generic error), 0 FIDELITY_MISMATCH, 3 UNVERIFIED (encoded/declared JPEG dimension mismatch), 1 NOT_IMPLEMENTED (unlock), 7 NOT_RUN. Visual verdicts NOT_RUN. Native Mac NOT_RUN.

**Platform probe (this ADR, host macOS 27.0 arm64, not the macOS 14 minimum):**
- Vision `.accurate` revision 3 lists 33 recognition languages; `.fast` lists 6 (en, fr, it, de, es, pt).
- ImageIO decodes JPEG, PNG, HEIC/HEIF, TIFF, GIF, BMP, WebP, AVIF, JPEG 2000, JPEG XL and RAW formats.

These lists show what the OS offers. They are **not** accuracy or support evidence, and the macOS 14 lists were not probed.

## 3. Shared contract (all 13 tools)

### 3.1 Admission

- **Complex PDFs.** Every tool keeps the current complex-PDF refusal until a bounded decision expands it. The only approved expansion is ADR 0013 (CPDF-1): simple absolute HTTP/HTTPS URI links during **Merge only**. Public support stays withheld until SHR-50 implements and verifies it (CPDF-5). This ADR does not broaden linked-PDF support beyond ADR 0013. Refusals stay specific (UX-02 "Unsupported structure").
- **Encrypted PDFs.** Refused by every tool except **Unlock**. When Unlock ships, the refusal offers it: *"This PDF is password-protected. I can unlock it first — you'll enter the password in a secure field."* atePDF never unlocks automatically, never keeps the password (PDF-07) and never guesses.
- **Signed or certified PDFs, and PDFs with signature fields.** Refused for every content-changing tool, per ADR 0013 CPDF-4 (approved). atePDF explains possible signature or certification invalidation and asks for an unsigned copy. Read-only tools (Extract Text, PDF to Images) are refused today by the shared `AcroForm` guard. Admitting them later needs its own evidence.
- **Malformed input.** Damaged structure and encoded/declared image mismatch are refused at admission with a specific message, not a generic failure.

### 3.2 Page selector grammar (TOOLPROF-5)

The planner keeps emitting the structured selector already in the schema: `all`, `explicit`, `first N`, `last N`, `odd`, `even`. The local validator is the authority. The grammar below is the **canonical human form**. atePDF uses it to echo a resolved selection back ("pages 2–4, 7"), to phrase clarifications and to write tests. Users may phrase requests naturally.

```
selection := "all" | "odd" | "even" | ("first" | "last") N | list
list      := item ("," item)*
item      := N | N "-" M | N "-" "end"
N, M      := positive integer (1-based PHYSICAL page number), N <= M
```

| Rule | Behaviour |
|---|---|
| Numbering | Physical page position, 1-based. Printed page labels (roman numerals, "page 5" printed on the 7th sheet) are not interpreted. If the user's number could be a label, the assistant asks. |
| Ranges | Inclusive. A reversed range (`5-2`) is refused with a clarification, not reinterpreted. |
| Duplicates | Set tools (Remove, Rotate, Split ranges, PDF to Images, Extract Text) merge duplicates and echo the resolved set. Reorder refuses duplicates (section 5.4). |
| Out of range | Refused, naming the page count: *"This PDF has 12 pages. Choose pages from 1 to 12."* |
| Empty result | Refused, for example `even` on a 1-page PDF. |
| Semantic selectors | `blank page candidates`, `scanned pages` and similar resolve **locally** (UNDERSTAND-04, SHR-66/67) to an explicit set, which is shown for confirmation when uncertain. They are never passed to an engine unresolved. |
| Bounds | ≤ the provisional page limit (section 6). The explicit list keeps the schema cap of 10,000 indices. |

### 3.3 Outputs and collections

- **Single-file tools** create one new result. The original stays immutable (PDF-01).
- **Split and PDF to Images** return a **collection** (TOOL-14, SHR-54) with a count, names, order, per-item size and save state. Collections export to a user-chosen folder with collision handling. There is no ZIP.
- **Extract Text** returns one `.txt` result (section 5.12).
- **No-benefit outcomes create no new result.** A Compress run that is not smaller is reported, and the current file stays current (section 5.6).
- **Batch "per file" is out of v1.** One source document per job for Compress, OCR, Rotate, Reorder, Remove, Protect, Unlock, Extract Text and Remove Metadata. A multi-step plan may chain tools (for example Images to PDF → Merge).

### 3.4 Verification baseline (PDF-04/05)

Every tool verifies its output with an independent reader before promotion: PDFKit on the Mac, pdf.js on web. The checks are:
- structure and readability;
- expected page count and **identity/order** (SHR-47);
- boxes and rotation;
- text preserved where the operation should not change it;
- the tool-specific checks in section 8.

Rendering comparison is a separate check (SHR-48). A page-count match alone is never success.

### 3.5 Metadata that atePDF writes on outputs (part of TOOLPROF-6)

| Output kind | Approved policy |
|---|---|
| Single-source transformations (Remove, Reorder, Rotate, Compress, OCR, Protect, Unlock) | Preserve the source's existing Info and XMP. Do not add a library producer string. |
| Newly constructed documents (Merge, Split parts, Images to PDF) | Do not copy unrelated source metadata. Do not write a library-identifying `Producer`/`Creator`. |
| Remove Metadata | Writes no Info or XMP at all (section 5.13). |
| All outputs | Do **not** add `Producer: atePDF`; it has no product value. |

Today, Merge and Remove write the pdf-lib producer string and drop the source title (gap G6).

## 4. Approved 13-tool support table (TOOLPROF-9)

"Launch claim" is the approved public statement. It is withheld until the implementing SHR passes section 9 (TOOL-15).

| # | Tool | Supported input | Files | Selectors | Exposed settings | Output | Launch claim (approved; withheld until verified) |
|---|---|---|---|---|---|---|---|
| 1 | Merge | Admitted PDFs | 2 to session limit | Whole documents; order explicit | Order (conversational) | 1 PDF | "Combine PDFs in the order you choose. Page sizes and orientations are kept." |
| 2 | Split | 1 admitted PDF, ≥2 pages | 1 | `each page`, `every N pages`, `ranges` (3.2) | Split mode | Collection of PDFs (a single range yields one file) | "Split a PDF into single pages, equal parts or page ranges, saved as a set of files." |
| 3 | Remove Pages | 1 admitted PDF | 1 | Full grammar; confirmed local semantic selectors | Pages | 1 PDF, ≥1 page | "Remove the pages you choose. At least one page must remain." |
| 4 | Reorder | 1 admitted PDF | 1 | Complete permutation; "move X to Y", "reverse" | New order | 1 PDF | "Put pages in any order you specify." |
| 5 | Rotate | 1 admitted PDF | 1 | Full grammar | 90° / 180° / 270° clockwise (left = 270°) | 1 PDF | "Rotate selected pages by quarter or half turns." |
| 6 | Compress | 1 admitted PDF | 1 | Whole document | Profile (Lossless / Balanced); optional target size | 1 PDF, or no new result | "Reduce file size without changing quality, or by slightly reducing image quality. Size targets are best effort." |
| 7 | OCR | 1 admitted PDF with scanned pages | 1 | Whole document (text-empty pages) or explicit pages | None at launch (language fixed; TOOLPROF-1) | 1 PDF | "Make scanned pages searchable in English. The pages look the same; existing text is left as it is." |
| 8 | Images to PDF | TOOLPROF-3 formats, single-frame | 1 to image limit | Order explicit | Page size (Fit image / A4 / Letter) | 1 PDF | "Turn JPEG, PNG and HEIC images into a PDF, one image per page, in the order you choose." |
| 9 | PDF to Images | 1 admitted PDF | 1 | Full grammar | Format (PNG default / JPEG), resolution (72 / 150 default / 300 dpi, or a stated 72–300 integer) | Ordered collection of images | "Save pages as PNG or JPEG images at 72, 150 or 300 dpi." |
| 10 | Protect | 1 admitted, unencrypted PDF | 1 | Whole document | Password (secure field only) | 1 encrypted PDF | "Require a password to open a PDF." (profile from SHR-52) |
| 11 | Unlock | 1 encrypted PDF of a supported profile (SHR-52) | 1 | Whole document | Password (secure field only) | 1 unencrypted PDF | "Remove a password you know from a PDF. atePDF can't recover forgotten passwords." |
| 12 | Extract Text | 1 admitted PDF | 1 | Full grammar | None (OCR is a separate, visible step) | 1 `.txt` (UTF-8) | "Save a PDF's text as a plain-text file, page by page. Layout and formatting aren't kept." |
| 13 | Remove Metadata | 1 admitted PDF | 1 | Whole document | None | 1 PDF | "Remove the document properties and XMP metadata listed below. Remove Metadata is not anonymisation." |

## 5. Per-tool profiles

### 5.1 Merge (existing; stabilise, do not rebuild)

- **Inputs.** 2 to the session file limit (currently 20, provisional). The total output stays within the page limit (currently 100, provisional). Each input is used once. A repeated input is refused, unless a future feature explicitly supports duplication.
- **Order.** The default is the order added. The user can name an order, or a locally resolved selector can set it ("invoice first", UNDERSTAND-02), with confirmation when uncertain. The receipt states the order used.
- **Mixed geometry.** Each page keeps its own MediaBox/CropBox, size and `/Rotate`. Nothing is normalised. SHR-46 shows geometry-font merge SUPPORTED.
- **Linked or complex inputs.** Refused today. ADR 0013 approves preserving simple absolute HTTP/HTTPS URI links during Merge. Public support is withheld until SHR-50 implements and verifies it. Every other structure stays refused (CPDF-2).
- **Encrypted inputs.** Refused with the Unlock offer (3.1). SHR-46 currently records these as FAILED with the generic message (gap G2).
- **Verification.** Output page sequence equals the concatenated source identities, boxes and rotation are unchanged, and text is preserved.

### 5.2 Split (SHR-55, collections SHR-54)

- **Modes.**
  - `each_page`: one file per page.
  - `fixed_size N`: every N pages; the last part may be shorter. N must be ≥1 and < the page count.
  - `ranges`: one file per range, in the order given.
- **Ranges.** Overlapping ranges are refused, since they would duplicate pages. Pages not covered by any range are **not** output, and the receipt lists them ("Pages 9–12 weren't included"). A single range yields one file; this covers "extract pages 2–4".
- **Refusals.** A 1-page PDF; an empty, reversed or out-of-range selection; a split that would reproduce the whole document as one part.
- **Naming.** `<source stem>-pages-<a>-<b>.pdf` for a range and `<source stem>-page-<n>.pdf` for a single page, using physical page numbers. Numbers are zero-padded to the digit width of the source page count so Finder sorts them correctly. Export collisions need an explicit choice (PDF-01).
- **Verification.** Each part's identity/order equals its source slice, and the collection is complete (count and names).

### 5.3 Remove Pages (existing; stabilise)

- **Selectors.** The full grammar. Semantic selectors (for example blank-page candidates, SHR-67) only after local resolution and user confirmation (CONV-05).
- **Minimum.** At least 1 page must remain. Removing every page is refused before execution.
- **Complex PDFs.** Refused. Linked PDFs stay refused for Remove Pages under ADR 0013 CPDF-2.
- **Verification.** The remaining pages equal the source minus the selection, in the original order (SHR-47 detects a swapped same-size page).

### 5.4 Reorder (SHR-56)

- **Order.** The engine receives a **complete permutation** of 1…N.
- **Partial requests** ("move page 5 to the front", "swap 2 and 3", "reverse") are resolved locally into a complete permutation and echoed before execution when more than a simple move is involved.
- **Refused.** Duplicate pages (duplication is excluded). Missing pages: the assistant says that Remove is a separate step. Out-of-range numbers. Semantic sorting within a document ("sort by date"), which is excluded.
- **Geometry.** Every page keeps its boxes, rotation, resources and content untouched.
- **Verification.** The output identity at position i equals source page `order[i]` for all i.

### 5.5 Rotate (SHR-57)

- **Angles.** 90, 180 or 270 degrees **clockwise, relative** to how the page currently displays. "Left" or "counter-clockwise" means 270. Other angles are refused. Absolute or automatic orientation ("make everything upright") is **not** a v1 claim; the assistant asks for a direction.
- **Normalisation.** The new `/Rotate` is (old + delta) mod 360. Content streams, MediaBox and CropBox are unchanged.
- **Verification.** Selected pages have the expected `/Rotate`, and every other page is byte-identical in its geometry.
- **Caveat.** The current OCR refuses rotated pages, so "rotate, then make searchable" is refused at planning until SHR-64 supports rotated pages.

### 5.6 Compress (existing; SHR-65 hardens) — TOOLPROF-2

| Profile | What it does (observed engine) | Quality | Confirmation |
|---|---|---|---|
| **Lossless** ("without changing quality") | Rewrites the structure with object streams. Images and content are untouched. | Unchanged | None |
| **Balanced** ("reduce image quality slightly") | Re-encodes eligible images (8-bit DeviceRGB JPEG with no mask, decode array or alternates) as JPEG at **original dimensions**. A re-encoded image is kept only if it is under 95% of its original. Plus Lossless. | Changes image quality | One-line quality confirmation (D-15), as today |
| Smaller (downsampling) | **Not in v1.** The schema preset is unimplemented. Any future downsampling profile needs separate measured evidence and owner approval. | — | — |

- **Target size.** Best effort. atePDF runs the approved profile once, reports the actual size and says whether the target was met (UX-02). It never escalates to a stronger quality loss without asking again, and never predicts a size in advance.
- **No benefit (both profiles).** If the output is not smaller, **no new result is created**: *"This PDF is already about as small as I can make it without lowering quality further. I kept your current file."* (Today a copy is committed; gap G4.)
- **Image-heavy files.** Only eligible JPEG images change. CMYK, grayscale, masked, JPEG 2000, JBIG2 and Flate images are left untouched, and the receipt says so ("Some images were left as they were"). SHR-46 shows image-heavy 7,571,813 → 269,048 bytes.
- **Malformed images.** An encoded/declared dimension mismatch is refused with a specific message until SHR-65/48 verifies pass-through. The 3 SHR-46 cases are UNVERIFIED.
- **Wording.** Always "best effort" and actual numbers. Never "guaranteed" or "up to X%".

### 5.7 OCR (existing; SHR-64 brings it to profile) — TOOLPROF-1

- **Language.** English only at launch (Vision `en-US`, `.accurate`). This is the only language with any evidence, and that evidence is from Tesseract on web; SHR-64 must add Mac Vision matrix evidence.
- **Characters.** SHR-64 must replace the **ASCII-only writer** before launch. Today a single "café", "£" or curly apostrophe refuses the whole job. The writer must be Unicode-capable: accented Latin characters, curly quotes, typographic punctuation (’ “ ” – — € £) and normal UTF-8 text must embed correctly.
- **Scan-only vs hybrid.**
  - Only pages **with no text layer** are recognised.
  - Pages with an existing text layer are preserved. Digital text is never silently re-OCR'd.
  - Hybrid *documents* (some scanned pages) are supported page by page.
  - A hybrid *page* (a text layer plus a scanned region) is not recognised. This caveat is disclosed.
- **Overlay.** Invisible text over the page, aligned to word boxes. Appearance must be unchanged: rendering comparison, SHR-48.
- **Confidence and review.**
  - Per-page success replaces today's all-or-nothing behaviour. Pages that pass may be committed. Pages that fail the confidence or reliability checks are left without added text and listed for review. The job is refused only if no page can be safely recognised.
  - The receipt shows per-page status: recognised / low confidence / not recognised.
  - A readable review surface ("Review text") shows the recognised text per page in a selectable, VoiceOver-readable view (MAC-03).
  - Floor and low-confidence thresholds are **pending SHR-64 calibration**; the current floor is 0.45 average confidence. The final OCR page limit is pending SHR-64/SHR-78.
- **Unsupported.**
  - Other languages and scripts: CJK, Arabic/RTL, Cyrillic, Thai, Devanagari and others. Vision lists them on the host, but overlay placement, encoding and RTL/vertical order are unverified.
  - Rotated scanned pages and offset crop boxes, until separately evidenced.
  - French, German, Spanish, Italian and Portuguese are **not** in the launch promise. They may be added later only after fixture and Mac evidence.
  - Handwriting: no claim.
- **Resource.** Pages needing OCR per job: currently 15, provisional, **pending SHR-78**. The render budget is the shared decoded-pixel limit.

### 5.8 Images to PDF (SHR-58) — TOOLPROF-3

- **Formats.** JPEG, PNG and HEIC/HEIF, single-frame only. ImageIO decodes all three on the host probe. HEIC decode on Intel must be measured (ADR 0011).
- **Refused.**
  - Multi-frame images: animated GIF, HEIC sequences, multi-page TIFF.
  - RAW, PSD, SVG, AVIF, JPEG XL and any format not listed.
  - Truncated or corrupt images, and images whose declared and decoded sizes disagree.
  - Images above the decoded-pixel budget.
- **Orientation.** Apply EXIF/TIFF orientation so the page matches Photos and Finder.
- **Resolution.**
  - No downsampling, and no upsampling of pixels.
  - JPEG bytes are embedded unchanged where the writer supports them.
  - PNG is embedded losslessly.
  - Ordinary photos are not resized.
  - HEIC has no PDF filter and must be transcoded. HEIC conversion may use high-quality JPEG and must be disclosed on the result ("HEIC photos were converted to JPEG"). The quality value is set by SHR-58 measurement, not by this ADR.
- **Page size.**
  - *Fit image* (default): the page has the image's aspect ratio. Its size comes from embedded DPI when that DPI is usable, meaning it gives 10–4000 pt per side. When usable DPI is unavailable, the image is fitted proportionally with a maximum long edge of 842 pt.
  - *A4* / *Letter*: the image is scaled to fit inside the page, centred, aspect preserved, with no crop and no margins. The page orientation follows the image.
- **Transparency.** Alpha is preserved where applicable, as a soft mask over the white page.
- **Not in the launch profile.** TIFF, WebP, BMP and GIF.
- **Ordering.** The order added, or an explicit order the user gives. Natural file-name order is resolved locally, and names are never sent (ADR 0012 C-10).
- **Decoded-pixel budget.** The current 12,000,000-pixel budget **refuses a standard 12 MP iPhone photo** (4032×3024 = 12,192,768 px) and every 48 MP photo. SHR-78 must set a measured image budget before this tool ships. **Approved requirement:** the measured envelope must support at least 4032×3024, and a normal 12 MP iPhone photo must not be rejected solely because of the current 12,000,000-pixel prototype constant (gap G7).
- **Verification.** Page count equals image count, order is correct, each page's aspect ratio equals the oriented image's, and each image is rendered present.

### 5.9 PDF to Images (SHR-59, collections SHR-54) — TOOLPROF-4

- **Formats.** PNG (default: lossless and sharp for text) or JPEG (on request, "smaller" or "for photos"). The JPEG quality is automatic.
- **Resolution.** Presets 72, 150 (default) and 300 dpi. A user-requested integer from 72 through 300 is also accepted if the implementation stays simple and within measured resource bounds.
  - The requested resolution is **never silently reduced**. If a page would exceed the technical workload envelope, the assistant explains why and asks the user to choose a lower dpi, naming the highest that fits.
- **Pages.** The full grammar. The collection is ordered by ascending physical page.
- **Naming.** Deterministic and ordered: `<stem>-page-<n>.<png|jpg>`, using the physical page number, zero-padded to the digit width of the source page count.
- **Background.** Opaque white where transparency is not meaningful (PDF pages), with no alpha channel. Colour is sRGB. No document text or source metadata is written into image metadata.
- **Verification.** Image count and names match the selection, pixel dimensions equal page size × dpi (within rounding), each image decodes, and a representative render matches (SHR-48).

### 5.10 Protect (SHR-60; engine and profile SHR-52; secure input SHR-53)

This section is contract only. The actual encryption algorithm/profile, handler revision, interoperability and owner-password policy come from SHR-52. Password entry uses secure local input only.

- **Password.** Protect sets an **open password**, entered twice in the dedicated secure field and never in chat or model context (PDF-06, ADR 0012 N-01). Rules:
  - The password must be non-empty and both entries must match.
  - The maximum length is whatever limit the SHR-52 profile has (for AES-256 in PDF 2.0, 127 UTF-8 bytes).
  - No strength scoring is claimed.
- **Permissions.** Open password only. v1 has no permission or restriction configuration. The receipt never implies that restrictions are unbreakable (TOOL-10).
- **Refused.** Already-encrypted input (unlock first); signed input (3.1); Protect placed anywhere except the last step of a plan.
- **Verification.** An independent reader refuses to open the file without the password, opens it with the password, and pages and text match the pre-encryption result.

### 5.11 Unlock (SHR-61; profile SHR-52; secure input SHR-53)

- **Known password only.** The password is entered in the secure field. There is no guessing, dictionary, cracking or retry automation. A wrong password produces a specific message and no partial import (PDF-06).
- **Supported encryption.** The handler/revision list comes from SHR-52. Public-key/certificate security and unknown handlers are refused.
- **Owner-password-only (permission-restricted) PDFs.** Treatment is decided in SHR-52. The provisional contract is that atePDF does not remove restrictions without the owner password (no undisclosed bypass).
- **Output.** An unencrypted working copy, stored per PDF-07 and ADR 0010. The receipt says that an unlocked copy is kept, and export is an explicit action.
- **Verification.** The output opens without a password, and its page identity and text equal the decrypted source.

### 5.12 Extract Text (SHR-62)

- **Source.** Only the digital text layer, as the independent reader extracts it (PDFKit on the Mac).
- **Scans.** OCR is **never implicit**. If selected pages have no text layer, the assistant says which ones and offers "Make them searchable first". That becomes an explicit OCR step whose result is itself kept, so `ocrIfNeeded` is set only by an agreed plan.
- **Output.**
  - One UTF-8 (no BOM) `.txt` file with LF line endings.
  - Each page is introduced by a line `--- Page n ---`, using the physical page number.
  - Pages with no text keep their marker, and the receipt counts them.
- **Reading order.** The reader's extraction order. Multi-column layouts, tables, headers/footers, footnotes and rotated text may come out of order. Headings, tables, lists and styles are **not** preserved. The receipt caveat says so.
- **Privacy.** The extracted text is class C content (ADR 0012). It is a local file and is never placed in model context.
- **Verification.** The file is valid UTF-8, the page markers match the selection, and each page's text equals an independent extraction (normalised whitespace).

### 5.13 Remove Metadata (SHR-63) — TOOLPROF-6

- **Guaranteed removed (approved profile B):**
  - The entire document Info dictionary: `Title`, `Author`, `Subject`, `Keywords`, `Creator`, `Producer`, `CreationDate`, `ModDate`, `Trapped` and **any custom key**.
  - **All XMP streams and copies that can be identified under the approved rewrite**: the catalog `/Metadata` and any `/Metadata` on pages, images, fonts or other objects.
- **How the output is written.**
  - A full rewrite, with no incremental-update revisions.
  - With no orphaned objects that still hold the removed dictionaries or streams. pdf-lib writes every object in its context, so deleted objects must be removed from the context, not just unreferenced.
  - No newly added Producer, Creator or date metadata (pdf-lib `updateMetadata:false`).
- **Not removed and not guaranteed** (stated in the receipt and help):
  - visible document content;
  - content streams, including hidden content;
  - annotations, form values, bookmarks and their titles, page labels;
  - embedded files and JavaScript;
  - **EXIF/GPS inside embedded images**, unless separately processed;
  - font names, the trailer `/ID`, and application private data (`/PieceInfo`);
  - forensic remnants;
  - Finder/file-system attributes of copies outside atePDF;
  - other user or personal data contained in the actual document content.

  The tool says clearly: **"Remove Metadata is not anonymisation."** It is also not redaction or sanitisation (TOOL-13).
- **Refused.** Signed input (3.1); complex input (shared guard).
- **Verification.** The output must independently verify that the intended metadata is gone.
  - The saved file's trailer has no `/Info`.
  - No object carries `/Type /Metadata` or `/Subtype /XML`, and a raw-byte scan finds no residual Info keys or `<x:xmpmeta`.
  - Pages, identity and text are unchanged.

## 6. Resource envelopes: technical safety vs commercial (TOOLPROF-7)

**Philosophy.**
1. **Technical limits protect the Mac and the result.** They are measured by SHR-78 on the minimum supported hardware (8 GB Apple Silicon; Intel if ENV-2 acceptance passes). They are expressed in **workload units**, not raw file bytes (ADR 0004): page count, decoded image pixels/megapixels, OCR page count, image count, file count, processing time, and memory/resource pressure where measurable.
2. **Refuse early and specifically.** When a job is predictably over a limit, the assistant says so before starting and explains the actual resource limitation. Where possible it offers a practical next step: split the job, choose fewer pages, or use a lower resolution. Deadlines and cancellation are safety nets, not quotas.
3. **Commercial limits are separate** (BILL-07). Guest allowance and Pro limits (OPEN-02/03) are unknown and not set here. A technical refusal **never** says "upgrade". Pro does **not** raise technical limits. A commercial limit is never disguised as a safety limit.
4. **SHR-78 establishes launch numbers** on the minimum supported Mac. Until then, current prototype values stay provisional, unpublished and safety guards only. New tools inherit the shared guards plus the tool units below. Every value marked *pending* must be set by measurement and approved before its public claim.

| Tool | Workload units | Current provisional guard | Launch value |
|---|---|---|---|
| All | Pages per input and result; page size; decoded px per image; plan steps; job deadline | 100 pages; 10–4000 pt; 12 MP; 4 steps; 240 s | Pending SHR-78 (100 pages is not a researched limit) |
| Merge | Input files; total output pages | 20 per session; 100 | Pending SHR-78 |
| Split | Output files (≤ pages) | — (inherits 100 pages) | Pending SHR-78 |
| Remove / Reorder / Rotate / Protect / Unlock / Remove Metadata | Pages | 100 | Pending SHR-78 |
| Compress | Eligible images; total decoded MP re-encoded | 12 MP per image | Pending SHR-78 / SHR-65 |
| OCR | Pages needing recognition; render MP per page | 15 pages; 12 MP | Pending SHR-78 / SHR-64 |
| Images to PDF | Images per job; decoded MP per image; total decoded MP | None (tool absent) | Pending SHR-78; **approved minimum:** must support a normal 4032×3024 image (G7) |
| PDF to Images | Output images; render MP per image; total output bytes vs free disk | Preview only (4096 px max) | Pending SHR-78 / SHR-59 |
| Extract Text | Pages; OCR sub-limit if chained | — | Pending SHR-78 |

## 7. Settings philosophy (TOOLPROF-8)

atePDF has **no traditional tool-settings panel** in v1. The Settings sheet (OD-7) holds privacy, retention and account settings, not tool defaults. A choice is exposed, as a clarification or choice chip, **only when the user's requested task genuinely requires one**, for example Balanced vs Lossless, PNG vs JPEG, a requested dpi, or A4/Letter/Fit image. Defaults handle ordinary requests. Batch "per file" processing is out of v1.

| Class | Settings |
|---|---|
| **Exposed** (asked for, or accepted when the user states them) | Page selection; merge/image order; split mode; rotation angle; compression profile (Lossless/Balanced) and optional target size; image page size (Fit/A4/Letter); export format (PNG/JPEG) and resolution (72/150/300, or a stated 72–300 integer); password (secure field only) |
| **Automatic** (fixed, disclosed in the receipt when relevant) | OCR page choice (text-empty pages) and language (English); output naming; metadata policy (3.5); EXIF orientation; HEIC → JPEG; alpha handling; white render background; JPEG quality values; object streams |
| **Hidden / internal** (internal safety thresholds; never user-adjustable) | Confidence thresholds; pixel, page and file budgets; deadlines; 95% re-encode acceptance; content-admission bounds; verification tolerances |

A setting becomes exposed only when an approved decision says so. Unsupported options never appear executable (TOOL-15).

## 8. Success and refusal language

A generic "Something went wrong" is never an acceptable refusal. Every refusal says what was refused, why, and that the original or current file is unchanged.

| Tool | Success (all include independent verification, 3.4) | Safe refusal conditions | Example refusal wording |
|---|---|---|---|
| Merge | Output = concatenation of sources in the stated order; geometry preserved | <2 inputs; repeated input; over limits; complex/encrypted/signed input | "This file has form fields I can't safely keep when merging yet. I haven't changed anything." |
| Split | Complete collection; each part equals its slice; names/order correct | 1-page PDF; empty/reversed/overlapping/out-of-range ranges; one part equal to the whole | "Those ranges overlap at page 4. Should page 4 go in the first part or the second?" |
| Remove Pages | Remaining pages = source minus selection, order kept | All pages selected; out of range; unconfirmed uncertain selector | "That would remove every page. A PDF needs at least one page — which should I keep?" |
| Reorder | Position i holds source page order[i] | Duplicate/missing/out-of-range pages; semantic sort | "Page 3 is listed twice. I can't duplicate pages — where should page 3 go?" |
| Rotate | Selected pages' `/Rotate` = old + delta mod 360; others identical | Non-quarter angle; absolute "upright" without a direction | "I can rotate by 90°, 180° or 270°. Which way should these pages turn?" |
| Compress | Output smaller than input and valid; actual size reported; target met/missed stated | Malformed image data; complex input. (Not smaller → no new result, which is not an error.) | "One image in this PDF is encoded inconsistently, so I can't safely recompress it. I haven't changed the file." |
| OCR | Text added only to text-empty pages; appearance unchanged; per-page status shown | No recognisable page; unsupported language/script; rotated scan; over page limit | "I can only recognise English text so far. This page looks like it's in Japanese, so I left it unchanged." |
| Images to PDF | One page per image, in order, orientation correct, aspect kept | Unsupported/multi-frame/corrupt image; over pixel budget | "IMG_0042 is an animated GIF. I can only use single images — could you pick one frame or another file?" |
| PDF to Images | Complete, ordered, correctly named image set at the stated resolution | Resolution over budget (asks); out-of-range pages | "Page 3 is very large, so 300 dpi would be too big to render safely. The most I can do is 180 dpi — use that?" |
| Protect | Reader refuses without the password and opens with it; content unchanged | Already encrypted; signed; not the last step | "This PDF already has a password. Unlock it first, then I can protect it with a new one." |
| Unlock | Opens without a password; content equals the decrypted source | Wrong password; unsupported encryption; restrictions without the owner password | "That password didn't open the PDF. Nothing was changed — try again in the secure field." |
| Extract Text | Valid UTF-8 `.txt`; page markers; text per page matches independent extraction | Complex/encrypted input; (pages without text → offer OCR, not an error) | "Pages 2 and 5 are scans with no text layer. Should I make them searchable first?" |
| Remove Metadata | No Info, no XMP, no residue; content unchanged | Signed/complex input | "This PDF is digitally signed, and changing it would break the signature. Can you use an unsigned copy?" |

## 9. Fixture and test acceptance map

The SHR-45 fixtures are in `tests/fixtures/corpus/manifest.json`. Every implementing SHR extends the SHR-46 harness (`tests/compatibility/`) with its own operation. NOT_IMPLEMENTED and NOT_RUN never count as passes.

| Tool (SHR) | Existing SHR-45 fixtures | SHR-46 coverage today | Required new fixtures / tests before the claim |
|---|---|---|---|
| Merge (stabilise; SHR-47, SHR-50, SHR-83) | ordinary-brief, ordinary-appendix, geometry-font, image-heavy, raster-note, hybrid-note, interactive, tagged, encrypted-aes256, boundary-100/101, damaged-missing-page, encoded-dimension-mismatch | 7 SUPPORTED, 5 SAFELY_REJECTED (incl. damaged admission), 1 FAILED, 1 UNVERIFIED | 3+ input order; repeated input refusal; specific encrypted refusal (fix FAILED); signed fixture; Mac native run |
| Split (SHR-55, SHR-54) | ordinary-brief, hybrid-note, geometry-font, boundary-100 | NOT_IMPLEMENTED | Each mode; overlap/reversed/uncovered/1-page refusals; names; collection export with collisions |
| Remove (stabilise; SHR-47, SHR-67) | ordinary-brief, hybrid-note, geometry-font, boundary-100, blank-noisy-scans | 5 SUPPORTED, 2 SAFELY_REJECTED, 7 NOT_RUN | Swapped same-size page detection; all-pages refusal; confirmed semantic selector |
| Reorder (SHR-56) | hybrid-note (A1/S1/B1 distinguishable), geometry-font, boundary-100 | NOT_IMPLEMENTED | Full permutation, move, reverse; duplicate/missing refusal; same-size scan swap |
| Rotate (SHR-57) | geometry-font (page 2 already 90°; offset boxes), raster-note | NOT_IMPLEMENTED | All three angles; cumulative normalisation (270+180→90); boxes unchanged; rotate→OCR refusal |
| Compress (SHR-65) | image-heavy, ordinary-brief/appendix (no benefit), raster-note, hybrid-note, geometry-font, boundary-100, encoded-dimension-mismatch | 8 SUPPORTED, 4 SAFELY_REJECTED, 1 FAILED, 1 UNVERIFIED | CMYK/gray/masked/JPEG 2000 images left untouched; target met/missed; no-new-result on no benefit; mismatch refusal |
| OCR (SHR-64) | raster-note, hybrid-note, blank-noisy-scans, ordinary-brief, geometry-font, boundary-100 | 7 SUPPORTED, 5 SAFELY_REJECTED, 1 FAILED, 1 UNVERIFIED — **Tesseract web only** | **Mac Vision** run; accented-Latin/typographic scan; partial-confidence document; >15-page scan; rotated scan; non-Latin refusal; placement check (SHR-48) |
| Images to PDF (SHR-58) | `tests/fixtures/image-input.png` only | NOT_IMPLEMENTED | JPEG with EXIF orientation 6/8; HEIC 4032×3024; PNG with alpha; 16-bit PNG; grayscale; CMYK JPEG; animated GIF/multi-page TIFF refusal; truncated image; dimension bomb; RAW/PSD refusal; Intel HEIC decode |
| PDF to Images (SHR-59, SHR-54) | ordinary-brief, geometry-font, raster-note, image-heavy, boundary-100 | NOT_IMPLEMENTED | 72/150/300 dpi dimensions; over-budget page asks; naming; white background; collection export |
| Protect (SHR-60, SHR-52, SHR-53) | ordinary-brief; encrypted-aes256 (already-encrypted refusal) | NOT_IMPLEMENTED | Independent open/deny proof; Unicode/127-byte password; signed refusal; last-step rule |
| Unlock (SHR-61, SHR-52, SHR-53) | encrypted-aes256 (correct and wrong password) | 1 NOT_IMPLEMENTED | Owner-password-only fixture; legacy RC4/AES-128 per SHR-52; public-key refusal; PDF-07 storage check |
| Extract Text (SHR-62) | ordinary-brief, ordinary-appendix, hybrid-note, raster-note, geometry-font | NOT_IMPLEMENTED | Multi-column order caveat; non-Latin digital text (UTF-8); ligatures; empty-page markers; OCR offer path |
| Remove Metadata (SHR-63) | ordinary-brief/appendix (Title, Author, Producer); corpus fixtures (Title, Author) | NOT_IMPLEMENTED | Metadata-rich fixture: all Info keys + custom key, catalog and object XMP, orphaned Info from an incremental update, JPEG with EXIF GPS (documents non-removal); raw-byte residue scan; signed refusal |

**Corpus gaps shared across tools.** Signed/certified PDF, owner-restricted-only encryption, non-Latin text (scanned and digital), a PDF with page labels, a metadata-rich PDF, a multi-column layout, image-input formats, and large page counts (for example 250 and 500 pages) for SHR-78 measurement. This ADR does not add fixtures.

## 10. Observed gaps recorded for triage (not fixed here)

| # | Gap | Contract section |
|---|---|---|
| G1 | OCR writer is ASCII-only; one accented character refuses the whole job (`engine.ts:54`) | 5.7 |
| G2 | Encrypted input gets a generic "encrypted or damaged" error on web and likely pdf-lib's raw developer message on native (`runtime.native.ts:37-49` does not sanitise); SHR-46 counts 3 FAILED | 3.1, 5.1 |
| G3 | The web worker's safe-message list omits the inline-image refusal, so users see the generic message | 8 |
| G4 | Compress commits an identical copy as a new result when there is no benefit | 5.6 |
| G5 | OCR refuses the whole job when one page is unreliable; there is no per-page review | 5.7 |
| G6 | Merge/Remove write the pdf-lib `Producer`/`Creator` and drop the source title | 3.5 |
| G7 | 12,000,000-pixel budget is below a standard 12 MP iPhone photo (12,192,768 px) | 5.8, 6 |
| G8 | No Vision OCR evidence in the SHR-46 matrix (Tesseract only); native Mac NOT_RUN | 1, 5.7 |
| G9 | `TESTING.md` difficult-PDF table predates the SHR-46 results | 9 |
| G10 | The registry and schema still carry `export_zip`, `reverse_pdf`, `select_pages.extract`, `compress.smaller` and `batchMode: per_file`, none of which is a v1 capability (TOOL-15) | 1, 4 |

## 11. Downstream contract

- Each implementing SHR (54–65) takes its row from sections 4, 5, 8 and 9 as acceptance. SHR-83 checks all 13 together through the planner.
- Owner-approved values become **single named constants**, for example `OCR_LANGUAGES`, `COMPRESSION_PROFILES`, `IMAGE_INPUT_TYPES`, `EXPORT_DPI_PRESETS` and `METADATA_REMOVAL_FIELDS`. The runtime catalogue, planner capability list, assistant knowledge and UI read from them (TOOL-15).
- Runtime-facing `AI_PRODUCT_KNOWLEDGE.md` changes only when a tool passes its row.
- Values marked pending are **not** filled in by implementers. They stay behind their provisional guard until SHR-78, SHR-64 or SHR-65 measures them and the owner approves.

## 12. Dependencies and still open (validation, not approval)

- **SHR-52:** the actual encryption algorithm and profile, supported Unlock handlers, owner-password-only policy, engine and licensing. Sections 5.10–5.11 are contract only.
- **ADR 0013 / SHR-49:** approved (CPDF-1–5) and merged. It governs linked and signed PDFs. Its Merge web-link support stays publicly withheld until SHR-50 implements and verifies it. This ADR does not broaden linked-PDF support beyond it.
- **SHR-78:** every *pending* resource value, including the image decode budget, which must support at least 4032×3024 (G7).
- **SHR-47 / SHR-48:** identity/geometry checks and rendering comparison, which are prerequisites for the verification in section 8.
- **SHR-64:** OCR confidence thresholds, final OCR page limit (with SHR-78), the Unicode-capable writer and Mac Vision evidence.
- **SHR-65:** compression hardening. Any future downsampling profile needs separate measured evidence and owner approval.
- **SHR-53:** secure local password handle shared by Protect and Unlock.
- **ADR numbering:** 0013 is on `main` (SHR-49) and 0014 is used by SHR-85 (PR #103), so SHR-51 is **0015**. Open PRs #98 (SHR-79) and #99 (SHR-52) still name 0013 and must renumber themselves.

## 13. Owner decisions (approved 30 September 2026)

Shrey Talwar approved TOOLPROF-1 to TOOLPROF-9 on 30 September 2026, in the owner review of PR #101 at head `9204109a815086ca6a1f20932533634b02c2c62e`. The approval renumbered this ADR from 0014 to 0015. Sections 3–9 above record the approved contract. The items below are the approval record.

**TOOLPROF-1 — OCR launch profile. APPROVED: option A.**
- English only, using Mac Vision OCR.
- Recognise only pages with no existing text layer. Preserve existing text layers, and do not silently re-OCR digital text.
- A Unicode-capable writer is required before launch: accented Latin characters, curly quotes, typographic punctuation and normal UTF-8 text.
- Per-page success and review replace today's all-or-nothing behaviour. Pages that pass may be committed. Pages that fail the confidence/reliability checks are listed for review. Refuse only if no page can be safely recognised. Provide a readable review surface.
- Rotated scans and unsupported/non-Latin OCR remain refused until separately evidenced.
- Thresholds and final OCR page limits remain pending SHR-64/SHR-78.
- French, German, Spanish, Italian and Portuguese are **not** in the launch promise. They can be added later after fixture and Mac evidence.

**TOOLPROF-2 — Compression profiles. APPROVED: option A.**
- **Lossless:** no quality-changing image recompression and no quality confirmation. If the file does not get smaller, no new result is created.
- **Balanced:** may re-encode eligible JPEG images, preserves dimensions, and requires explicit quality-change confirmation. Target size remains best effort, with no silent escalation.
- No stronger "Smaller" profile in v1. Any future downsampling profile needs separate measured evidence and owner approval.

**TOOLPROF-3 — Images to PDF launch formats. APPROVED: option A.**
- JPEG, PNG and HEIC/HEIF, single-frame only.
- Respect EXIF orientation. Do not resize ordinary photos. Preserve transparency where applicable.
- HEIC conversion may use high-quality JPEG and must be disclosed on the result.
- Fit Image is the default; A4 and Letter remain available.
- **Fallback sizing approved:** when usable DPI is unavailable, fit the image proportionally with a maximum long edge of 842 pt.
- The measured resource envelope **must** support at least 4032 × 3024 pixels. A normal 12 MP iPhone photo must not be rejected solely because of the current 12,000,000-pixel prototype constant.
- TIFF, WebP, BMP and GIF are **not** in the launch profile.

**TOOLPROF-4 — PDF to Images. APPROVED: option A.**
- Formats PNG and JPEG. Default PNG at 150 dpi. Presets 72, 150 and 300 dpi.
- A user-requested integer dpi from 72 through 300 is allowed if the implementation remains simple and within measured resource bounds.
- Never silently reduce the requested resolution. If a page would exceed the technical workload envelope, explain it and ask the user to choose a lower dpi.
- Use an opaque white background where transparency is not meaningful.
- Deterministic ordered naming: `<stem>-page-<n>`.

**TOOLPROF-5 — Canonical page selection. APPROVED: option A.**
- Physical page positions, 1-based: `all`, `odd`, `even`, `first N`, `last N`, lists, inclusive ranges and `N-end`.
- Reversed ranges are refused. Out-of-range pages are refused.
- Set-like tools may collapse duplicates. Reorder must refuse duplicate or missing page identities.
- Printed PDF page labels are **not** interpreted in v1. There is no page-label interpretation in v1.
- Ambiguous natural-language references trigger clarification.
- Semantic selectors resolve locally before execution.

**TOOLPROF-6 — Remove Metadata. APPROVED: option B.**
- Remove the entire PDF Info/properties dictionary: all standard fields and custom Info keys.
- Remove all XMP streams and copies that can be identified under the approved rewrite.
- Add no new Producer, Creator or date metadata.
- The output must independently verify that the intended metadata is gone.
- The tool must say clearly: **"Remove Metadata is not anonymisation."**
- The not-removed contract includes:
  - visible document content;
  - annotations;
  - embedded files;
  - content streams;
  - EXIF/GPS inside embedded images, unless separately processed;
  - other user data contained in the actual document content.

**Output metadata policy — APPROVED.**
- Single-source transformations preserve the source's existing Info/XMP, except Remove Metadata.
- Newly constructed documents do not copy unrelated source metadata and do not add a library-identifying Producer/Creator string.
- Do **not** add `Producer: atePDF`. There is no product value in it.

**TOOLPROF-7 — Technical resource limits. APPROVED.**
- Measured in workload units, not raw file bytes: page count, decoded image pixels/megapixels, OCR page count, image count, processing time, and memory/resource pressure where measurable.
- SHR-78 establishes launch numbers on the minimum supported Mac.
- Current prototype values stay provisional, unpublished and safety guards only.
- A technical refusal must explain the actual resource limitation, must offer a practical next step where possible, and must never say "upgrade". Pro must not raise a technical safety ceiling.
- Images to PDF must support at least a normal 4032×3024 image.

**TOOLPROF-8 — Settings. APPROVED.**
- No traditional tool-settings panel.
- Expose a choice only when the user's requested task genuinely requires one, for example Balanced vs Lossless, PNG vs JPEG, a requested dpi, or A4/Letter/Fit image.
- Defaults handle ordinary requests.
- Internal safety thresholds are not user-adjustable.
- Batch "per file" processing remains out of v1.

**TOOLPROF-9 — Per-tool claims, profiles, success and refusal definitions. APPROVED.**

Sections 4, 5 and 8 are approved. Each launch claim stays withheld until its implementing SHR passes section 9. Specific approved constraints:

| Tool | Approved constraint |
|---|---|
| Merge | Each input used once. Explicit ordering. A repeated input is refused unless a future feature explicitly supports duplication. |
| Split | Every page, every N pages, or explicit ranges. Overlapping ranges refused. Uncovered pages omitted and listed. Collection output. |
| Remove Pages | At least one page remains. |
| Reorder | Resolves to a complete permutation. Duplicate or missing pages refused. |
| Rotate | Relative 90/180/270-degree turns only. No "auto-upright" feature in v1. |
| Compress | Lossless/Balanced only. No benefit creates no new result. |
| OCR | English-only launch profile. Text-empty pages only. Per-page review. |
| Images to PDF | JPEG/PNG/HEIC only. |
| PDF to Images | PNG/JPEG. Ordered collection. |
| Protect | Open password only. No permission or restriction configuration in v1. Secure local input. The actual encryption algorithm/profile comes from SHR-52. |
| Unlock | Known password only. No guessing or cracking. |
| Extract Text | UTF-8 text result. No silent OCR; OCR is offered explicitly for scanned pages. No claim of preserving semantic or layout structure. |
| Remove Metadata | Approved full Info/XMP profile. Explicitly not anonymisation. |

**Linked PDFs (ADR 0013).** Use the approved Merge simple HTTP/HTTPS-link contract. Public support remains withheld until SHR-50 implements and verifies it. Linked-PDF support is not broadened beyond ADR 0013.

Approval does not implement any tool, change runtime claims, merge this PR or mark SHR-51 Done. SHR-51 stays In Review until PR #101 merges.

## 14. Consequences

- The 13 tools have approved, bounded and testable contracts. Implementing SHRs (54–65) take their rows from sections 4, 5, 8 and 9 as acceptance, and do not guess formats, languages, selectors or wording.
- Launch claims stay narrow: English OCR, three image input formats, two compression profiles. Each can widen only through evidence and a new owner decision.
- Current behaviours that conflict with the approved contract are recorded as gaps G1–G10 for triage. Nothing is fixed here.
- Resource numbers stay unpublished until SHR-78. This ADR changes no guard, dependency, test or runtime behaviour.
