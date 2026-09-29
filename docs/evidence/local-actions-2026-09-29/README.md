# Explicit local quick actions — scoped evidence, 29 September 2026

Owner-authorized correction only; existing F03/F04/F05/F06/F07/F09 task mapping. No general re-audit or other recommendation was implemented.

## Source boundary

- Start and end branch: `codex/atepdf-chat-workflows`; HEAD `05bd7b126e7d0e5d4df97bf18a7f29af627ed2ca`. Starting working tree clean. Ending change is uncommitted; no push, merge, publication or deployment.
- Annotated `prototype-v0` tag object `e8aca4aa8317ea4f25d3898c0dc75c13197e2862`, peeled source `5a6c0c542603cdb2a72bcdb2a91958ef3b6f12ab`, unchanged. Two subsequent commits (`06539eb`, `05bd7b1`) only changed audit/documentation/instructions. No application change since the audited source before this task.
- Final application/test SHA-256 and emitted web/iOS bundle SHA-256 are in `ending-build-identity.json`. `source-and-docs.patch` captures the tracked diff; the new regression is `tests/e2e/local-actions.spec.ts` in the repository. The baseline web bundle is identified in `logs/baseline-web-build-retry.log` as `index-630012e833bbef46f5441d9899bb7fda.js`.

## Change and guard review

`apps/universal/App.tsx`: remove the planner dispatch branch from explicit `action()`; keep its existing quality confirmation and `execute()` → `executeLocal()` → `controller.quick()` path. Correct the privacy description of button dispatch. No layout/branding change. `submit()` and natural-language planner behavior are unchanged, including existing typed-command fallback when AI is disabled.

`quickPlan()` validates the complete local envelope; `JobController.execute()` repeats schema/semantic/revision checks, validates actual capability and file facts, rejects replay, and runs the unchanged local engines with staging and independent inspection before commit. Current focus, original input order, cancellation, export and Undo paths are unchanged. No new shortcut, operation or parameter inference.

`tests/e2e/planner.spec.ts`: only the old quick-action model-use expectation changes: Merge now makes zero planning requests; the following product question still makes one. Unrelated assertions remain. New `local-actions.spec.ts` directly counts intercepted planner requests and status requests, checks all three existing PDF buttons and their quality choice, checks recovery after provider errors, and refuses missing/ambiguous inputs. The pending-status case starts a separate status request and leaves it held while local jobs finish.

Canonical updates: `ARCHITECTURE.md`, `DECISIONS.md`, `IMPLEMENTATION_STATUS.md`, `PRIVACY.md`. Historical audit reports remain unchanged.

## Isolation and exact commands

A fresh temporary source copy was made from `git ls-files` (excluding historical `docs/evidence`), with `node_modules` symlinked to already-installed dependencies. `.local`, owner build outputs and owner sessions were not copied. Temporary root is recorded in `starting-identity.json`. All commands below ran there. Existing scripts were read before execution. Outputs/evidence produced by hardcoded test paths stayed in the temporary copy and selected new records were copied here.

The shell initially lacked `node` on PATH. The bundled `pnpm` wrapper attempted its automatic dependency check/install and aborted before module removal with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; no installation or upgrade completed. Subsequent commands used the installed runners directly. No dependency repair was attempted. The first isolated Metro build could not resolve packages outside its watch folders through the symlink; only the temporary Metro config added the real installed `node_modules` directory to watch folders (`isolated-metro.config.cjs`). These are harness setup failures, not application regressions.

Each successful shell used:

```sh
export PATH=<local-home-path>
```

Baseline and final:

```sh
node --import tsx --test tests/regressions/*.test.ts
./node_modules/.bin/tsc --noEmit --incremental false -p apps/universal/tsconfig.json
node tests/native/apple/run.mjs
```

Build preparation and baseline web export (the first three scripts ran once in the isolated copy):

```sh
node scripts/contracts.mjs
node scripts/assets.mjs
node scripts/build-gateway.mjs
cd apps/universal
EXPO_NO_TELEMETRY=1 ../../node_modules/.bin/expo export --platform web --output-dir dist-web
```

The final web export used that same Expo command after copying the changed App.tsx. Final additional checks:

```sh
./node_modules/.bin/tsc --noEmit --incremental false -p apps/web/tsconfig.json
# From apps/universal:
EXPO_NO_TELEMETRY=1 ../../node_modules/.bin/expo export --platform ios --output-dir dist-native
```

Isolated host, using only the empty temporary `.local` and the temporary export:

```sh
ATEPDF_PORT=43219 node scripts/serve-expo.mjs
```

Browser commands from temporary source root:

```sh
# Baseline: 18/18
ATEPDF_BASE_URL=http://localhost:43219 ./node_modules/.bin/playwright test tests/e2e/workflow.spec.ts tests/e2e/planner.spec.ts
# Before application edit: all four fail on invocation count, as expected
ATEPDF_BASE_URL=http://localhost:43219 ./node_modules/.bin/playwright test tests/e2e/local-actions.spec.ts --grep 'healthy|local recovery' --output=../red-results --reporter=list
# Final complete affected set
ATEPDF_BASE_URL=http://localhost:43219 ./node_modules/.bin/playwright test tests/e2e/workflow.spec.ts tests/e2e/planner.spec.ts tests/e2e/local-actions.spec.ts
```

One first post-fix run was interrupted after ten new cases passed: the new missing-input test mistakenly tried the empty-state sample button after a chat error had hidden it. The test was corrected to use the existing file picker and same synthetic fixture files. The focused corrected case passed (`logs/input-check.log`) and the entire affected set was rerun. This was a new test setup mistake, not a weakened guard or application repair; the interrupted attempt is retained in `logs/final-browser.log` and `logs/first-final-browser-results.json`.

## Results and evidence limits

- Baseline and final core: **72/72**, no skips. Includes invalid/missing refs, stale revisions, capability inflation, malformed/incomplete plans, cancellation, failed independent validation, atomic commits, immutable originals, removal and Undo.
- Baseline and final universal/shared TypeScript: **pass**; final web TypeScript: **pass**.
- Baseline and final web export: **pass** after isolated Metro configuration. Final iOS Hermes bundle: **pass**.
- Baseline affected Chrome workflows: **18/18**; final: **29/29**, including 11 new cases. No unrelated test skipped or weakened.
- Red reproduction: healthy Merge expected zero planner calls, observed **one**. After mocked 401/429/503 free-form failure, Merge expected total one call, observed **two**. `logs/red-browser.log` and `red-results/` retain the failures.
- Final routing count attachments show **zero model-planning calls** for Merge, Make searchable, confirmed Compress and Undo in seven AI/status modes. Each failure-recovery case makes exactly one call for the free-form request and **zero additional calls** for Merge. Therefore these actions never reach gateway request reservation/provider allowance. No real provider contact was needed.
- Baseline and final Apple helper: **pass**, real PDFKit/Vision/ImageIO plus shared writer/controller. Includes OCR, compression, merge/removal/Undo and unchanged original checksums. This is host helper execution, not native app acceptance.
- Actual browser-downloaded `merged.pdf` independently reopened by PDF.js: **3 pages, A1/A2/B1**. `removed.pdf`: **2 pages, A1/B1**. `undo.pdf`: byte-identical SHA-256 to saved merge. Existing workflow checks the actual saved/downloaded bytes. Fixture originals and in-memory immutable originals are covered by unchanged core/native regressions. These count/text/geometry checks are **not complete visual-fidelity guarantees**.

No live/paid model checks, owner key/allowance reads or changes, owner server restart, deployment, or dependency upgrade. Mock endpoints and synthetic files only. Temporary absolute paths and machine identity in this evidence copy have been redacted. The verification commands used the bundled Node runtime; set `BUNDLED_NODE_RUNTIME` to its local installation before replaying. The temporary host was stopped after verification.

Not run: Xcode app build, iPhone/iPad simulator UI, Mac app UI, physical devices, Android runtime, Safari/Firefox/Edge, optional Next production host build and unrelated browser suites. Shared code was checked via typechecking, iOS bundling and the native helper without replacing an owner app/session. Chrome and mocks do not establish native runtime acceptance. Android/Mac interaction remain deferred; no new infrastructure was installed to force broader checks.

Remaining relevant limits: typed requests retain existing AI behavior; connection controls can still fail separately; existing history-size bounds and local PDF support restrictions remain. Clarification continuation, sample-fetch cancellation, hosting, JPEG dimension handling and other audit findings were not changed. No production-readiness claim.
