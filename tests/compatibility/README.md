# Repeatable PDF compatibility matrix (SHR-46)

Run from the repository root with the already installed Node dependencies and Google Chrome:

```sh
node --import tsx tests/compatibility/run.mts --output-dir /tmp/atepdf-matrix-new-run
```

The output directory must not exist. The command emits schema-validated `matrix.json` and a generated `summary.md`. Current runs use schema v2, adding explicit production page-identity gate status/receipts for Merge and Remove Pages. Missing required receipts cannot count as supported. Historical v1 schemas/results remain unchanged and do not claim this later gate passed. For representative output PNG references, also set `ATEPDF_MATRIX_RENDERER` to an already installed Poppler `pdftoppm` executable. No dependency is installed or downloaded. The [original source-bound run](../../docs/evidence/SHR-46-2026-09-30/README.md) and [SHR-47 gate evidence](../../docs/evidence/SHR-47-2026-09-30/README.md) distinguish these source versions.

The runner builds the current browser worker and a small test adapter into a temporary directory. It copies the pinned PDF.js/Tesseract/English assets from installed dependencies, starts its own random-port loopback listener and blocks every external browser request. It uses the existing `JobController`, `LocalFileStore`, validated local plan compiler and browser `runWorker/inspect/recognize` services. Real Tesseract recognition and browser JPEG encoding run; no recognition words or encoder outputs are mocked. This verifies those services without entering the application UI or model planner.

All 14 canonical SHR-45 fixtures are considered against the four current operations. Merge uses the fixture followed by the ordinary appendix; the appendix case uses the ordinary brief as its second input. Removal removes physical page 2 when at least two pages exist. Single-page removal is explicitly `NOT_RUN` because no valid output can retain a page. OCR preserves existing text and recognizes only text-empty pages. Compression uses the existing balanced preset. Existing confirmations are outside this service harness; it does not change the application's confirmation behavior.

Damaged fixtures never enter the normal browser/transform path. A separate Node child runs admission only with a 128 MiB heap, five-second deadline and 4 KiB captured-output cap. Its rows identify that narrower executor. An admission refusal is evidence for that operation's shared input boundary, not proof of its transformation. No transform is attempted after rejection. Other cases use the product worker/controller's existing time bounds; this is not a hard upper bound on all upstream parser allocations.

For every produced PDF, the runner writes a temporary saved copy, reads it back, and independently reopens it with PDF.js. It compares page count, ordered digital text, visible page boxes/rotations, image paint counts and annotations. Supplementary pdf-lib comparisons check media/crop origins, direct image XObject bytes where re-encoding is not requested, and embedded simple-font streams. These resource checks cover the present admitted corpus; they do not recursively fingerprint arbitrary nested forms or descendant-font graphs. Those supplementary checks use the writer's library and are explicitly labelled; they are not a second independent parser. Known synthetic OCR phrases are checked separately from the words reported by the recognizer. A compression result must not be larger than its input. Fixture disk hashes, freshly computed store-original byte hashes and absence of partial promotion are recorded. Temporary PDFs, bundles, language copies, workers, browser and server are cleaned up. Only matrix metadata and requested representative PNGs remain.

| Classification | Meaning |
| --- | --- |
| SUPPORTED | This exact service scenario produced a saved, independently readable result and passed the declared structural checks. The visual status remains separate. |
| SAFELY_REJECTED | A deliberate, allowlisted application refusal with intact originals and no result promotion. Refused scenarios remain in the executed denominator. |
| FAILED | An unexpected failure, unreadable result, missing result, changed original, or refusal whose specificity/safety cannot be established. A generic sanitized error alone is not safe-refusal proof. |
| FIDELITY_MISMATCH | The output opens, but a checked count/order/text/geometry/resource property differs from the expected result. |
| UNVERIFIED | Execution produced a readable result but a required input-specific property remains unresolved. Encoded/declared JPEG-dimension mismatch currently uses this category; it is not counted as supported. |
| NOT_IMPLEMENTED | No active executor. The encrypted fixture's future unlock case is explicit, and the full registry inventory records absent handlers. |
| NOT_RUN | No execution evidence for this scenario, with a reason. No absent/unrun case is a pass. |

The registry inventory describes current code, including historical scaffolding; it does not approve extra v1 tools. Policy expectations are copied from the corpus manifest without replacing approved policy with an observed outcome.

Output hashes identify the measured saved artifacts, not a promise of deterministic PDF metadata across runs. Input hashes, source-file hashes, Git identity, runtime versions, scenarios and classifications make runs comparable. Tesseract results can vary across runtime/platform versions. SHR-47 adds structural page identity/order/geometry to Merge/Remove promotion. Post-transform visual fidelity, OCR placement and actual Mac-app acceptance remain SHR-48 and later platform work. Representative PNGs are rendering references, not an appearance-comparison verdict.

Harness self-tests:

```sh
node --import tsx --test tests/regressions/compatibility-matrix.test.ts
./node_modules/.bin/tsc --noEmit -p tests/compatibility/tsconfig.json
```

The self-tests mutate known-good PDFs to detect corruption, reordered/missing pages and changed crop geometry. They also test deliberate versus generic refusal, missing executors, unrun/incomplete verification, denominator accounting, schema guards and preservation of an existing evidence destination.
