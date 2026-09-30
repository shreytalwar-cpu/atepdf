# SHR-45 synthetic PDF corpus

This is a **test-input corpus**, not an atePDF support statement or a compatibility matrix. The [versioned manifest](manifest.json) is the source of fixture IDs, repository-relative paths, SHA-256 hashes, page order, visible markers, provenance, structural features and operation expectations. [Its JSON Schema](manifest.schema.json) fixes the v1 shape so SHR-46 can add operation-by-fixture results without changing engines in this issue. `approved_product_policy` means preserve the structure or refuse specifically; it never means that today's engine supports the input. `unknown` awaits testing or a later compatibility decision. No new fixture is labelled observed-supported merely because an independent parser can open it.

Fourteen distinct PDFs are indexed. Five are **reused in place** from existing synthetic fixture sets, without copying or changing their bytes; nine are newly generated. The existing startup `brief.pdf`/`appendix.pdf` pair is not duplicated in the manifest because the neutral usability pair already supplies ordinary, order-sensitive multi-import samples with a retained generator.

| Fixture ID | Pages | Purpose |
| --- | ---: | --- |
| ordinary-brief, ordinary-appendix | 2, 1 | Neutral digital text, ordered imports, simple and multi-page cases |
| raster-note, hybrid-note | 1, 3 | Existing image-only scan and digital/raster/digital sequence |
| image-heavy | 1 | Existing large synthetic JPEG-based page |
| geometry-font | 3 | Text plus image, embedded Bitstream Vera, portrait/landscape, rotation, nonzero MediaBox/CropBox origins |
| interactive | 2 | URI and internal GoTo links, nested outlines, filled text/check fields, real highlight and note annotations |
| tagged | 1 | Marked content, MCID, StructElem, ParentTree and `StructParents` connected to the page |
| blank-noisy-scans | 2 | Near-blank and noisy raster pages without text layers |
| encoded-dimension-mismatch | 1 | DCT XObject declares 40×24 while JPEG SOF encodes 32×24; both dimensions are tiny |
| encrypted-aes256 | 1 | AES-256, known **fixture-only** user/owner passwords and wrong-password case |
| boundary-100, boundary-101 | 100, 101 | Small real page trees on both sides of the prototype's present page-count boundary; not a v1 limit decision |
| damaged-missing-page | declared 1 | Finite malformed page tree whose child object is absent; it is never a normal transform input |

Every row's detailed source and generation instruction is in the manifest. The two retained startup scan PDFs came from the synthetic handoff; **their original generator was not retained**. Their tracked commit and exact-byte recovery command are recorded rather than inventing a generator. The image-heavy input has its existing generator in `scripts/make-compression-fixture.py`. The neutral pair has `tests/fixtures/usability/generate.mjs`. The nine new inputs come from `generate.py`, locally authored with ReportLab 4.4.9, pypdf 6.10.0 and Pillow 12.3.0 already available on the authoring machine. The embedded Bitstream Vera font is covered by [its redistribution license](bitstream-vera-license.txt). No customer, private upload, paid model or network source was used. The schema and tests constrain provenance and fixture paths, but automatic checks cannot prove the absence of arbitrary private content; provenance review remains required for additions.

To regenerate the new fixtures with those local libraries from the repository root:

```sh
python3 tests/fixtures/corpus/generate.py --output-dir /tmp/atepdf-shr45-regenerated
```

The eight non-encrypted outputs are byte-deterministic at these generator versions, including when regenerated from a different checkout path. The geometry fixture passes the source image bytes to ReportLab so its PDF resource name does not depend on the image's absolute path. AES salt and IV are intentionally random; retain the committed encrypted file and its manifest hash for routine tests. The test-only password appears only in fixture generation/metadata and test code. Never enter it into ordinary atePDF chat or send it to a provider.

Routine corpus validation uses the repository's existing Node dependencies and no network access:

```sh
node --import tsx --test tests/regressions/pdf-corpus.test.ts
```

For an additional local byte-regeneration check, set `ATEPDF_CORPUS_PYTHON` to a Python that already has the three generator libraries, then run the same test. That test regenerates the eight deterministic files from both the repository and a separate temporary source path, comparing bytes and manifest hashes. The damaged fixture is opened **only in a child process** limited to 128 MiB, five seconds and 64 KiB of captured output; it is never fed to a normal app/engine workflow by this corpus test. The 100/101-page fixtures are small bounded page trees, not memory bombs.

Independent inspection on the committed inputs used Poppler `pdfinfo` 26.05.0, pypdf 6.10.0 and PDF.js 6.3.289; the corpus test repeats PDF.js page/order checks and actual structural checks. Representative results:

| Input | Independent observation |
| --- | --- |
| geometry-font | Poppler: 3 pages; page 2 Letter landscape, rotation 90°; page 3 MediaBox `[20 30 620 830]`, CropBox `[40 50 600 780]`. PDF.js extracted all three ordered markers. |
| interactive | Poppler: 2 pages, AcroForm. pypdf found filled text and checked checkbox fields; PDF.js found URI/GoTo links, Highlight/Text/Widget annotations and nested outline entries. |
| tagged | Poppler: `Tagged: yes`; PDF.js found a `/P` structure node linked to marked content, not an empty dictionary. |
| encrypted-aes256 | Poppler with fixture-only password: 1 page, AES-256 encrypted. Without it, Poppler returned incorrect-password; PDF.js wrong-password check also rejects. |
| raster-note, hybrid-note, blank-noisy-scans | PDF.js: 1/3/2 pages. The scanned pages have no extractable text layer. Poppler raster inspection showed the existing synthetic note and the new blank-looking/noisy pair. |
| encoded-dimension-mismatch | Poppler: readable 1-page container; direct JPEG SOF inspection confirmed 32×24 encoded versus 40×24 declared. Rendering/admission policy is unclassified. |
| boundary-100, boundary-101 | Poppler: exactly 100 and 101 pages. PDF.js independently extracted numbered markers in physical order. |
| damaged-missing-page | Poppler reported a missing child object and a declared page count of 1; bounded PDF.js child could not fetch page 1. A parser's ability to read `/Count` is not valid-page support. |

Representative pages were rendered to temporary files and reviewed for fixture construction (including the scan, noisy scan and highlighted heading). Those temporary images are not saved as acceptance artifacts. These checks establish fixture facts, **not** preserved visual fidelity after a transformation.

The remaining work is deliberately separate: SHR-46 records supported/safely refused/failed outcomes per operation, saved output and platform; SHR-47 adds page identity/order/geometry promotion checks; SHR-48 adds bounded rendering and OCR-placement checks; SHR-49 chooses a finite complex-PDF support expansion from the matrix. This corpus does not add an engine, change refusal rules or decide a v1 page limit.
