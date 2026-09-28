# Bounded source audit — 2026-09-28
New root: `/Users/shrey/Documents/ChatGPT/atepdf`. Read-only reference: `/Users/shrey/Documents/attenlo/attenlo-docs`. Both real paths, distinct/non-nested Git common directories, no parent Git repository. New Git already initialized and unborn; no recreation. Old Git also unborn, so source-snapshot.json pins inspected files.

Old source is outside writable roots. Only file reads and git --no-optional-locks identity/status reads used. No old installs, scripts, builds, migrations or tests. No source code ported. No credentials/customer documents accessed. Project Bill Box was excluded after shallow identity discovery.

Evidence: pdf.ts copies pages and saves through pdf-lib; worker.ts executes engine calls off the UI thread. These are source-reviewed, not runtime-reproduced. result-preview.test.ts inspects source with regex assertions: a useful intention, not output-integrity proof. workflows.test.ts describes partial-batch cancellation. CODE_AUDIT.md reports unsaved selected inputs omitted by some predicates (documented-only issue, not reproduced). RELEASE_STATUS.md describes Ready-to-save copy and says OCR remains disabled (dated documentation, not a current capability conclusion).

Keep concepts: immutable copied pages, worker cancellation, honest save state, independent reader validation. Avoid old tool navigation, assuming source assertions prove PDF output, assuming recognition alone produces searchable PDFs. OCR/compression implementation is fresh and bounded; no runtime legacy claims.
