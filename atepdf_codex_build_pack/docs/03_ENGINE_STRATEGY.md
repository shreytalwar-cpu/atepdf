# 03 | Engines, feasibility spikes and integrity

## Principle
Use existing, well-tested engines behind narrow adapters. Cloud AI selects actions; it does not rewrite PDF bytes. Processing is local on every platform. A browser library that can run in Node does not make server-side execution acceptable.

## Candidate components and boundaries
| Component | Proposed purpose | Important boundary |
|---|---|---|
| PDF.js | Browser rendering, preflight assistance, text extraction and validation. | It is not the whole transformation engine. Review exact release and disable active-content/network behaviour. [S06] |
| pdf-lib | Simple browser page operations and image/PDF assembly. | No supported encrypted-document processing. `ignoreEncryption` does not decrypt. Document-feature preservation must be tested. [S07] |
| qpdf | Structural operations, encryption, stream optimisation and specialist native/WASM bridge candidate. | It is not a renderer or OCR engine; current image optimisation does not resample images. Cross-platform bindings require a real spike. [S08, S09] |
| Tesseract.js / Tesseract | Browser/native OCR recognition and suitable searchable text-layer output. | Tesseract.js does not take PDF inputs directly. Render selected pages first; explicitly build/integrate searchable output. [S10, S11] |
| Apple PDFKit/Vision | Reuse Apple document/recognition functionality. | Recognition results still need correct text-layer construction and verification. Language/OS support must be capability-tested. [S16, S17] |
| Android PdfRenderer + ML Kit | Native preview/rasterisation and local text recognition. | PdfRenderer is not a complete writer. ML Kit script support is limited to documented sets, not “all languages”. [S18, S19] |
| Local image codecs | Downsampling/re-encoding image objects and JPEG/PNG export. | Handle masks, alpha, colour spaces and transitive codec licences. No blanket rasterisation of digital pages. |

Use permissively licensed components where compatible with the exact distribution plan. Reviewed sources currently identify PDF.js/Tesseract/qpdf under Apache-2.0 and pdf-lib under MIT; pin and recheck the actual versions and all transitive dependencies [S06-S11]. This is an engineering review rule, not a legal clearance. MuPDF, Ghostscript, Poppler and third-party ports require explicit licence review before adoption. Do not assume a permissively licensed wrapper changes the underlying engine's obligations.

## Mandatory early spikes
1. **Read-only legacy review and new-engine spike:** inspect the old engine interfaces/tests without executing in that checkout. Prove real merge, split, OCR and compression in the NEW app or an isolated safe scratch test using synthetic inputs. Distinguish source-only claims from reproduced behaviour. No old whole-app import.
2. **Browser compression spike:** produce a genuinely smaller file from representative scans and image-heavy PDFs without losing searchable text or silently flattening all content.
3. **Browser OCR spike:** generate searchable output, search it in an independent reader, verify page geometry and multilingual text extraction.
4. **Android writer spike:** prove local merge and save through a maintained or self-built qpdf/native bridge. Do not assume a rendering library writes PDFs.
5. **Native/WASM specialist spike:** build selected engine under the required ABIs, measure bundle size, initialization, peak memory, crashes and licence obligations. Apple builds must work on device as well as simulator.

Run these early enough to influence the schedule. An unproven qpdf WASM wrapper cannot become a hidden critical dependency. Prefer controlled builds from audited upstream sources; retain existing adapters when they pass the same tests. A documented paid local SDK is an alternative only after owner approval, not an automatic purchase.

## Adapter interface
Each operation advertises exact input/output types, limits, required local assets, supported languages, preservation properties and availability. Handler accepts local file handles and typed parameters, cancellation token and event sink; returns actual artifacts, measurements, warnings and validation data. It does not accept an arbitrary command string.

Registry statuses: `not_implemented`, `experimental`, `tested`, `disabled`. Only tested capabilities appear in the production planner manifest. File-specific preflight can further reduce this set.

## Merge/page tools
- User-facing page numbers are one-based physical page positions by default. Convert to zero-based indexes only inside the adapter.
- Existing PDF page labels may differ; ambiguous references to Roman numeral/front-matter labels require a local clarification.
- Merge order is the visible attachment order unless explicitly changed. Do not infer chronological order from filesystem timestamps.
- Remove all pages must be rejected. Reorder requires an exact permutation unless the user explicitly requests duplication/extraction.
- Split returns a result collection with ordered members. Per-file versus combined actions must be explicit.
- Preserve page dimensions, rotation, crop boxes, text, images and supported document features. Validate link/bookmark destinations after structural changes.
- Detect signed, complex form/XFA, tagged/portfolio and damaged documents. For launch, refuse transformations where integrity cannot be preserved and explain why. Read-only preview may still work. Do not present this as signature editing.

## Compression is a controlled optimisation process
Do not implement “compression” as save/load with a lower quality label. Run actual optimisations and measure candidate bytes.

1. Inspect structure locally: image-heavy scan, mixed content or digitally generated document.
2. Attempt safe stream/object optimisation; never promise substantial reduction for an already compressed file.
3. Where a tested object-level implementation exists, downsample/re-encode suitable image objects while preserving text/vector content and geometry. Respect masks, alpha and colour profiles; do not re-encode unsupported image types blindly.
4. For genuinely scan-only pages, a reviewed scan-specific path may rebuild from optimised images if dimensions and quality are preserved. Detect and preserve any existing text layer. Do not route a digital page through this path.
5. Generate bounded candidates, keeping the smallest valid output that meets the quality policy. Limit attempts and CPU time.
6. If requested size cannot be reached, return `target_not_met` with actual best candidate size and a clear next choice. Never truncate, remove pages or invent a success status.

Size semantics: MB is 1,000,000 bytes; MiB is 1,048,576. “Under 5 MB” is strictly below 5,000,000; the local compiler may reserve a small safety margin. Compare against actual final bytes, including OCR layers and encryption overhead. Optimising before OCR may improve speed, but final size must be rechecked after OCR and any reorder must be proven semantics-preserving.

qpdf can optimise certain image encodings and streams but does not provide generic image downsampling in its documented optimisation path [S09]. Treat a target-size feature as atepdf orchestration around tested image/structural engines, not one qpdf flag.

When the best output is larger, say no useful reduction was found and keep the original available. “Smaller” must not silently mean grayscale, deleted attachments, removed text, flattened annotations or degraded readability.

## Searchable OCR
- Detect whether each page already contains useful text. Do not add duplicate OCR layers to digital pages by default.
- Render only needed pages locally at an appropriate bounded resolution; release each page buffer promptly.
- Recognise text and word/line geometry. Language assets are bundled or downloaded from controlled static sources, never customer pages.
- Write an invisible text layer with correct transforms, page rotation/crop handling, Unicode mapping and font/encoding strategy. Tesseract's text-only PDF output may be composed with source pages where the chosen build supports it [S11].
- Preserve the page's original visual content when possible. A scanned PDF with invisible text is valid; a newly rasterised digital PDF is not an acceptable default.
- Validate search/copy using independent extraction, and compare render before/after. A nonempty OCR string alone is not a pass.
- Capture confidence and failures locally; do not claim certainty or send recognised text to the planner.

Start with English as the full-parity test language. Add Hindi/Devanagari and other languages per tested engine support. Do not silently substitute Latin OCR for unsupported scripts or invent support on every Apple OS. Language availability is a runtime capability, not just a menu option.

## Conversion boundaries
JPEG/PNG to PDF and PDF to page images are deterministic local transformations. Preserve ordering, EXIF orientation, page sizing and image colour handling. Export text with explicit per-page separators and disclose that exact layout is not retained.

Office conversions are not equivalent to these simple operations. Do not use an OS preview that happens to display DOCX as proof of editable, high-fidelity conversion. Do not upload to external converters to fill a gap. A future local conversion engine needs fixtures for fonts, tables, formulas, charts and pagination before being advertised.

## Protection/cleanup
Use tested PDF encryption, preferably modern AES settings verified against readers, and secure local password entry. The planner specifies an action requiring a local secret; it never sees the secret or a password-derived value. Known-password unlock is not password cracking. Respect the declared permitted use and do not add bypass functionality.

Scoped metadata cleanup removes documented Info/XMP fields, including handling modification dates explicitly. It does not remove names inside page content, attachments, comments or images. Do not label it “anonymise”, “redact” or “client-safe” without a separate capability the current scope excludes.

## Validation layers
1. Structural reopen with a reader different from the writer where feasible.
2. Expected page count/order/rotation/size and output type.
3. Text retention on digital inputs; OCR searchability where requested.
4. Visual comparison of relevant pages and all small-test-corpus pages; sample large production files with clear coverage limits.
5. Preservation checks for links, tags, annotations and other preflight features when the engine claims support.
6. Target size and quality policy. OCR confidence is not a guarantee of source accuracy.

Validation failures keep originals and prevent normal success status. Do not silently serve corrupt output. A safe partial output must be explicitly labelled and only offered with measured limitations.
