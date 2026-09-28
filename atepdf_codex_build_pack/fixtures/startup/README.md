# Startup fixture pack

These are synthetic inputs, not customer files and not precomputed app results.

- `brief.pdf`: two digital text pages, A1 then A2.
- `appendix.pdf`: one digital text page, B1.
- `scanned-note.pdf`: one raster-only page with no text layer.
- `mixed-text-and-scan.pdf`: A1, raster S1, B1.
- `image-input.png`: the same synthetic scanned page as an image.

`expectations.json` contains exact page counts, text markers, file hashes, OCR search targets and network canaries. Merge the first two files through the actual app; remove physical page 2, then undo. Do not ship a stored result in place of processing. The small files may not compress further; build a separate realistic image-heavy corpus for compression tests.

Fixture construction and rendering were checked during packaging. No product engine, browser worker, hosted model or OCR implementation was run by these fixture checks. PDF generation/inspection libraries used to prepare test assets are not mandated application dependencies.
