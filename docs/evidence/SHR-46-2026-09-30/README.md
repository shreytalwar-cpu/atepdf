# SHR-46 — repeatable compatibility matrix evidence

Recorded 30 September 2026. Verification/harness work only; no PDF engine, product routing, admission, limit, confirmation or UI behavior changed.

## Source and isolation

- Baseline: current fetched `origin/main` / SHR-45 merge `524af243e125ffe0c41421a6cc5c1b4415fc7744`.
- Tested harness source: `d2d67d5b3d8083d24799dfda40f12276237897c8`. The later evidence commit changes only this evidence directory. Runtime/runner/schema hashes and corpus-manifest hash are in [matrix.json](matrix.json).
- Dedicated managed worktree: `/Users/shrey/.codex/worktrees/shr46-compatibility-matrix/atepdf`; branch `shreytalwar/shr-46-run-the-corpus-through-a-repeatable-compatibility-matrix`.
- Owner checkout stayed clean on its existing local `main` at `4c22232b67345be7a19712c46fe6b49e1a43505a`; it was not switched, updated or used to run/build the application. No owner server/session was restarted or replaced.
- `prototype-v0` remains the existing annotated tag: object `e8aca4aa8317ea4f25d3898c0dc75c13197e2862`, peeled commit `5a6c0c542603cdb2a72bcdb2a91958ef3b6f12ab`.
- Existing installed dependencies were reused through a temporary worktree `node_modules` symlink, removed before handoff. No installation/upgrade or live/paid model call. Fixtures are the unchanged canonical synthetic SHR-45 inputs.
- Node `v24.19.0`; Chrome `154.0.8037.58`; macOS arm64; PDF.js `6.3.289`; pdf-lib `1.17.1`; Tesseract `7.0.0`; Poppler `26.05.0`. Chrome and Node helper evidence is not native app acceptance.

## Results

The [generated summary](summary.md) lists every record and reason; [matrix.json](matrix.json) records fixture/input hashes, expected count/order/features, parameters, policy basis, executor, admission/execution, saved-result hashes/metadata, expected/actual observations, original-preservation checks, visual status and evidence location.

| Classification | Cases |
| --- | ---: |
| SUPPORTED | 27 |
| SAFELY_REJECTED | 16 |
| FAILED | 3 |
| FIDELITY_MISMATCH | 0 |
| UNVERIFIED | 3 |
| NOT_IMPLEMENTED | 1 |
| NOT_RUN | 7 |

**49 executed of 57 recorded scenarios:** 46 browser service scenarios plus three isolated damaged-input admission checks. The 16 refusals and three failures stay in the 49-case denominator. Seven single-page removal scenarios cannot retain a valid output page and are `NOT_RUN`; the future encrypted unlock case is `NOT_IMPLEMENTED`. Registry inventory separately identifies four current executors and 11 absent handlers, without approving extra tools.

**30 generated PDFs were saved temporarily and independently reopened with PDF.js:** 27 passed the declared structural checks; three encoded/declared JPEG-dimension cases remain `UNVERIFIED`. Every recorded original-preservation and no-partial-promotion check passed, using freshly computed in-memory original byte hashes and unchanged fixture disk hashes. Five representative output PNGs are retained under [renders](renders/), with per-reference hashes in the matrix. All visual verdicts remain `NOT_RUN`; renderability/count/text/resource checks do not establish complete visual fidelity or OCR placement.

Supported observations include all four operations on ordinary brief, hybrid and geometry/font inputs; merge/OCR/compress on ordinary appendix, scanned note and image-heavy inputs; merge/remove/compress on blank/noisy scans; and remove/OCR/compress at the current 100-page boundary. OCR used actual local Tesseract and known synthetic scan markers; existing-text OCR paths preserve existing text. Compression used actual browser encoding or the existing no-benefit path, as recorded in result notes.

Safe refusals cover interactive and tagged documents, unreliable blank/noisy OCR, the 101-page input, a merge exceeding the current 100-page output limit, and damaged-input admission. Damaged input was processed only in a 128 MiB / five-second / 4 KiB-output child; its page-count refusal demonstrates the shared admission boundary, not a transform or complete damage diagnosis.

The three `FAILED` cases are encrypted-input merge/OCR/compress: the unchanged worker returns the generic sanitized message, “This PDF could not be safely processed. It may be encrypted or damaged. Your original is unchanged.” No output was promoted and originals stayed intact, but this is not a sufficiently specific deliberate encrypted-input refusal to earn `SAFELY_REJECTED`. These are observed baseline gaps, not new runtime behavior. No verified structural mismatch occurred in this corpus. The three JPEG mismatch cases remain unresolved rather than silently supported. See [prioritized gaps](gaps.md).

Three complete runs agreed on case IDs, input hashes and classifications, including the final run after original-byte checks were strengthened. Output metadata/hashes may vary across runs; deterministic output bytes are not claimed. The unchanged SHR-45 corpus regeneration regression passed from distinct source paths.

## Exact commands and results

All commands ran from the dedicated worktree with installed dependencies. Absolute runtime aliases used below:

```sh
NODE=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
PYTHON=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3
RENDERER=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdftoppm
export PATH=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH

ATEPDF_MATRIX_RENDERER="$RENDERER" "$NODE" --import tsx tests/compatibility/run.mts --output-dir docs/evidence/SHR-46-2026-09-30

ATEPDF_CORPUS_PYTHON="$PYTHON" "$NODE" --import tsx --test tests/regressions/*.test.ts

./node_modules/.bin/tsc --noEmit -p tests/compatibility/tsconfig.json
./node_modules/.bin/tsc --noEmit -p apps/universal/tsconfig.json
./node_modules/.bin/tsc --noEmit --tsBuildInfoFile /tmp/atepdf-shr46-source-bound-web.tsbuildinfo -p apps/web/tsconfig.json

git diff --check
```

| Check | Actual result / preserved log |
| --- | --- |
| Matrix command, isolated adapter/production-worker bundles, JSON schema | Exit 0; 57 records / 49 executed, categories above; [matrix-run.log](matrix-run.log) |
| Full core/planner/PDF/corpus/harness regression suite | **126/126 passed, zero failures/skips**; [regressions.log](regressions.log) |
| Harness TypeScript | Exit 0; [harness-typescript.log](harness-typescript.log) is empty because no diagnostics |
| Universal/shared TypeScript | Exit 0; [shared-typescript.log](shared-typescript.log) is empty |
| Web TypeScript with isolated build cache | Exit 0; [web-typescript.log](web-typescript.log) is empty |
| Diff whitespace | Passed |

The full suite includes **11 matrix self-tests**, **6 corpus validation tests** (including distinct-path byte regeneration), and existing workflow/admission/planner tests. The focused run also passed **34/34**:

```sh
ATEPDF_CORPUS_PYTHON="$PYTHON" "$NODE" --import tsx --test tests/regressions/compatibility-matrix.test.ts tests/regressions/pdf-corpus.test.ts tests/regressions/local-workflow.test.ts tests/regressions/content-admission.test.ts
```

Self-tests deliberately corrupt/truncate output, swap/remove pages and alter crop geometry; they also test specific versus generic refusal, missing/unrun executors, incomplete verification, denominator accounting, schema guards and non-overwriting evidence destinations. Harness development initially exposed a CJS/top-level-await loader error and harness-only typing errors; those were corrected before the recorded committed-source run. No unrelated regression was skipped or weakened. Routine matrix browser requests stayed local: **zero external requests attempted**.

## Acceptance and limits

- Source-bound, versioned, extensible per-operation/per-reader matrix and repeatable existing-runner command: met.
- Saved-output independent reopen, expected order/original hashes, distinct structural/visual checks and representative rendering references: met within the explicit corpus/service bounds.
- Generated human matrix and prioritized gaps; refusals/failures retained, absent/unrun excluded from passes: met.
- Harness failure/corruption/order/count/refusal/absence self-tests and relevant regression/TypeScript checks: met.
- Existing corpus, runtime engines, admission/JobController guards and historical evidence remain unchanged.

Actual Mac-app/native execution, native helpers, full application UI workflows/confirmation interaction, full web/iOS exports and app release builds were **not run**: this change is confined to verification tests/docs, and the matrix builds and exercises the affected browser services directly. No Chrome result is presented as Mac acceptance. Post-transform appearance comparison, OCR placement, arbitrary complex-PDF resource graphs, password-aware import/Unlock, and production promotion identity guarantees remain later work. Supplementary resource checks use pdf-lib, the writer's library, and are not independently parsed twice. No customer file, private upload, credential, paid call, deployment or compatibility fix was used.
