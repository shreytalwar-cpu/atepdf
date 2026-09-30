# SHR-46 — PR #92 update after main advanced

Bounded branch update only. Latest fetched main was `5abde38401e8754a923ab18e5a42f9986e1cace2` (merged SHR-105 / PR #91). It was merged into existing SHR-46 head `07b274b0703d65086f43dc505e4b974a0d45c02b`, preserving both histories without rebase, force push or conflict resolution. The tested merge source is `6dbf6a565746a6fd26455dbc53633769790bb31b`. The subsequent evidence commit adds only this directory.

Preservation checks passed: every original SHR-46 runner/schema/test/matrix/evidence file is byte-identical to the previous head; all incoming `docs/DECISIONS.md`, `docs/DESIGN_SYSTEM.md` and `docs/design/` files exactly match main. Runtime code, canonical fixtures, original historical evidence and `prototype-v0` (peeled commit `5a6c0c542603cdb2a72bcdb2a91958ef3b6f12ab`) are unchanged. No PDF compatibility finding was fixed, no other PR reviewed and no other issue started. The owner checkout/session was not changed.

## Rerun results

| Check | Result |
| --- | --- |
| Focused matrix/corpus/workflow/admission tests | **34/34 passed**, zero skips; [focused.log](focused.log) |
| Full regressions | **126/126 passed**, zero failures/skips; [regressions.log](regressions.log) |
| Harness TypeScript | Exit 0; [harness-typescript.log](harness-typescript.log), no diagnostics |
| Shared/universal TypeScript | Exit 0; [shared-typescript.log](shared-typescript.log), no diagnostics |
| Web TypeScript with isolated cache | Exit 0; [web-typescript.log](web-typescript.log), no diagnostics |
| Matrix/schema + temporary adapter/worker bundles | Exit 0; [matrix-run.log](matrix-run.log), [matrix.json](matrix.json), [generated summary](summary.md) |
| Source hashes, unchanged input/classification comparison and diff check | Passed |

Matrix: **49 executed / 57 records**; 27 SUPPORTED, 16 SAFELY_REJECTED, 3 FAILED, 0 FIDELITY_MISMATCH, 3 UNVERIFIED, 1 NOT_IMPLEMENTED, 7 NOT_RUN. Case IDs, inputs and classifications match the original run exactly. Thirty saved PDFs independently reopened; five representative output renders retained; original byte checks and no-partial-promotion checks passed; zero external requests. Existing encrypted-input generic refusals remain FAILED and JPEG dimension mismatch remains UNVERIFIED. No newly introduced failure was observed.

Node `v24.19.0`, Chrome `154.0.8037.58`, macOS arm64. Installed dependencies reused through a temporary symlink, removed after checks; no install, paid call or credential use. Native/Mac-app acceptance, full UI workflows and visual/OCR-placement acceptance remain NOT_RUN, as in the original SHR-46 evidence. Rendering references do not establish complete visual fidelity.

## Exact commands

All commands ran from `/Users/shrey/.codex/worktrees/shr46-compatibility-matrix/atepdf`. Logs/results were first written to a new temporary location, then copied into this new evidence directory without replacing the original evidence.

```sh
git fetch origin main
git merge --no-edit origin/main

NODE=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
PYTHON=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3
RENDERER=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdftoppm
export PATH=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH

ATEPDF_MATRIX_RENDERER="$RENDERER" "$NODE" --import tsx tests/compatibility/run.mts --output-dir /tmp/atepdf-shr46-main-update-6dbf6a5/matrix
ATEPDF_CORPUS_PYTHON="$PYTHON" "$NODE" --import tsx --test tests/regressions/compatibility-matrix.test.ts tests/regressions/pdf-corpus.test.ts tests/regressions/local-workflow.test.ts tests/regressions/content-admission.test.ts
ATEPDF_CORPUS_PYTHON="$PYTHON" "$NODE" --import tsx --test tests/regressions/*.test.ts
./node_modules/.bin/tsc --noEmit -p tests/compatibility/tsconfig.json
./node_modules/.bin/tsc --noEmit -p apps/universal/tsconfig.json
./node_modules/.bin/tsc --noEmit --tsBuildInfoFile /tmp/atepdf-shr46-main-update-6dbf6a5/web.tsbuildinfo -p apps/web/tsconfig.json

git diff 07b274b0703d65086f43dc505e4b974a0d45c02b HEAD --exit-code -- tests/compatibility tests/regressions/compatibility-matrix.test.ts docs/TESTING.md docs/evidence/SHR-46-2026-09-30
git diff origin/main HEAD --exit-code -- docs/DECISIONS.md docs/DESIGN_SYSTEM.md docs/design
git diff origin/main HEAD --exit-code -- apps packages tests/fixtures
git diff --check
```

Original scope/gaps remain in [the original evidence](../SHR-46-2026-09-30/README.md). SHR-46 remains In Review; PR #92 is not merged.
