# SHR-49 — bounded complex-PDF preservation investigation

30 September 2026; source `37e970025eaff9be35a2b8d5fa0291d9c7eef0a5` (latest fetched origin/main at start). Decision: [ADR 0013](../../adr/0013-first-complex-pdf-preservation-slice.md), proposed, pending owner approval.

This directory holds **investigation evidence**, not a new regression suite, production support or Mac-app acceptance. Runtime/admission code and corpus bytes were unchanged. All documents are synthetic SHR-45 fixtures or temporary derivatives; no network PDF, customer content, dependency installation, cloud conversion or paid model call.

## Evidence inventory

| File | What it establishes |
| --- | --- |
| `source.json` | Source revision and hashes of relevant unchanged sources, corpus, matrix, Mac envelope and installed writer source/license; Node version |
| `current-guard.json` | Unchanged current shared preflight refuses interactive/tagged inputs, corroborating SHR-46. No transformation or app acceptance implied |
| `probe.json` | Twelve input/output observations with PDF.js 6.3.289, pdf-lib 1.17.1, saved-byte hashes and immutable original hashes |
| `independent.json` | Strict pypdf 6.10.0 inspection of saved files: exact URI string bytes/rects, catalog roots, fields and **actual output page-tree membership** of destination and `/P` references |
| `render-comparison.json` | Poppler 26.05.0, four sampled pairs, 900-pixel maximum dimension; identical decoded pixels for those pairs only |
| `interactive-merge-page2.png` | Reviewed representative rendering: apparently intact highlight/note/widgets despite lost form catalog and invalid destination/page bindings |
| `probe.mjs`, `guard-probe.cjs`, `independent.py`, `render.py` | Reproduction of these bounded experiments, not production code or compatibility implementation |

`probe.mjs` directly calls the installed library's existing `copyPages` and save APIs. It **never calls a transform with weakened preflight**. Temporary URI-only inputs remove other families from a loaded interactive fixture only to isolate copying behavior; this stripping is not proposed for users. The added `/P` variant starts with a valid reference to its source page. No reconstruction/rebinding fix is implemented in these probes.

PDF.js reported page index 1 for internal destinations whose objects were outside the output page tree. The independent membership result is decisive; a reader-returned number or unchanged pixels cannot override it. The interactive Merge output has no AcroForm/Outlines root; the tagged Merge has no StructTreeRoot/MarkInfo. These files are intentionally **not** promoted into the corpus as supported outputs.

## Reproduce without installing anything

Use a clean checkout of the investigated revision and **already installed** pinned repository packages plus Python pypdf/Pillow/Poppler. A separate dependency checkout is accepted so worktrees need no dependency installation or node_modules mutation. Node must support this pinned PDF.js release (the observed run used the bundled Node recorded in `source.json`).

From the checkout root, with paths set to your existing runtimes/dependency checkout:

```sh
# NODE and PYTHON are paths to existing executables; DEPS is a checkout whose
# node_modules already contains pdf-lib 1.17.1, pdfjs-dist 6.3.289 and esbuild.
# OUT is a fresh disposable directory outside the checkout.
export SHR49_SOURCE="$(git rev-parse HEAD)"
"$NODE" --max-old-space-size=256 docs/evidence/SHR-49-2026-09-30/probe.mjs "$PWD" "$OUT" "$DEPS"
"$NODE" --max-old-space-size=256 docs/evidence/SHR-49-2026-09-30/guard-probe.cjs "$PWD" "$OUT" "$DEPS"
"$PYTHON" docs/evidence/SHR-49-2026-09-30/independent.py "$OUT"
"$PYTHON" docs/evidence/SHR-49-2026-09-30/render.py "$OUT"
```

The evidence scripts are added by this documentation PR, after the investigated revision. They can be run against that revision by passing its clean checkout root as the first argument, or against the PR head with its unchanged runtime/corpus hashes confirmed. Record the actual source, runtime versions and dependency hashes for a rerun. Output hashes may change with new-document metadata timestamps; compare semantic observations and decoded pixel hashes, not promise deterministic output files.

Twelve small PDFs (at most 3 pages each) were generated in a disposable `/private/tmp` directory. Node probes used a 256 MiB heap bound; Poppler calls used a 15-second subprocess timeout and capped raster dimensions. The deliberately damaged/resource fixtures were not processed. Temporary PDF/bundle/PNG intermediates were removed after retaining these JSON records and one representative PNG. No device, minimum macOS, Intel runtime, click behavior or signature authentication test was performed.
