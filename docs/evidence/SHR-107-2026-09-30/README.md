# SHR-107 orchestration benchmark evidence

Recorded 30 September 2026. Evaluation infrastructure only. No production prompt,
model/provider, application behavior, PDF engine/tool or generated product knowledge
changed; no customer content, live/paid calls, deployment, optimization or merge.

## Source and isolation

Started from fetched `origin/main` at `37e970025eaff9be35a2b8d5fa0291d9c7eef0a5`.
Tested harness checkout: `ca052694c178c68c9d61b5fb39b16df7363dbd84`; subsequent
commit contains evidence only. The JSON report includes runtime/harness/corpus
hashes, split version and exact selected-case hashes. Source identity uses this
tested checkout, not the shared remote ref that another worker advanced meanwhile.

Dedicated branch `codex/shr-107-orchestration-evals`, managed worktree
`/Users/shrey/.codex/worktrees/shr-107-orchestration-evals/atepdf`.
Owner checkout stayed clean at `4c22232b67345be7a19712c46fe6b49e1a43505a`; no owner
session/server was switched, reloaded or stopped. `prototype-v0` remains the same
annotated tag object `e8aca4aa8317ea4f25d3898c0dc75c13197e2862`, peeled commit
`5a6c0c542603cdb2a72bcdb2a91958ef3b6f12ab`.

Existing dependencies were reused through a temporary worktree symlink. No
successful install or upgrade occurred. The bundled package runner attempted an
automatic dependency check/install and was stopped by the filesystem sandbox;
we used the documented direct Node command, without changing dependency settings
or retrying the install. No lockfile/dependency mutation was committed.

## Baseline

[Generated summary](summary.md); [machine-readable results](results.json).
**64 scenarios / 71 turns**, 41 dev and 23 held-out, covering 14 categories.
The report deliberately omits held-out per-case answers/diagnostics.

| Metric | Dev | Held-out |
| --- | ---: | ---: |
| Passing scenarios | 35/41 | 20/23 |
| Overall score | 85.4% | 87.0% |
| Scripted exact plans | 16/16 | 10/10 |
| Planner-tool accuracy | 97.7% | 100% |
| Invoked-tool accuracy | 95.5% | 100% |
| False / missed clarification | 0 / 0 | 0 / 0 |
| Correct clarification / direct action | 8 / 15 | 2 / 10 |
| Invalid proposals / hallucinated tools | 0 / 0 | 0 / 0 |
| Privacy violations | 1 | 0 |
| Unnecessary / missing provider calls | 4 / 1 | 3 / 0 |
| Unnecessary tool calls | 2 | 0 |
| Stale admissions | 0 | 0 |
| Allowance bypasses | 1 | 0 |

Clarification precision/recall are 1.0 on these scripted cases. Tokens, provider
latency and cost are unavailable. Two full runs from the tested commit produced
byte-identical reports, including source/corpus hashes and metrics.

**This is not empirical live-model accuracy.** Provider responses are synthetic,
scripted fixtures authored separately from the keys. The adapter exercises current
projection/gateway/SDK/controller boundaries and records actual mock service calls;
its bounded UI preparation/control representation is not Mac UI acceptance. Fake
engine inspection buffers are not PDF-fidelity evidence. The original prompt is
unchanged, and the corpus has not been used for production prompt tuning.

## Exposed gaps and limits

- Enabled-AI quick actions still compile locally rather than using intentional AI
  orchestration (D-04/CONV-01; later SHR-82 ownership).
- Quick work bypasses the existing gateway allowance. Production commercial
  admission is not integrated; this is an approved-target probe, not billing proof.
- The current gateway has no command-consent admission input; the absent-consent
  fixture still sends a command and invokes Merge. No real outbound request occurs.
- Typed unsupported/refusal/explanatory cases still invoke the mocked provider
  where the benchmark requires a local response. The replies themselves are scripted.
- Only four operations have current executors. Rotation, collections, Extract Text,
  Protect and private semantic selectors are refusal coverage today, not completed
  target capabilities. Protect-last and collection order graders are negative-tested.
- SHR-35/36 receipts and outbound enforcement remain replaceable grader contracts;
  matching an eval receipt does not authorize a cloud capability or content transfer.

These failures stay in the denominator and are not fixed or optimized in SHR-107.
Held-out keys are accessible to repository readers; isolation is practical, not
cryptographic. Repeated fine-grained validation scores can contaminate the split.

## Validation

| Check | Result |
| --- | --- |
| Harness/CLI negative self-tests | 23/23 passed, zero skipped |
| Full regressions, including existing planner/controller/clarification/privacy/secrets | 149/149 passed, zero skipped |
| Full eval | 64 cases; metrics above; expected baseline gaps retained |
| Repeated full eval | Byte-identical JSON |
| Eval TypeScript | Passed |
| Universal/shared TypeScript | Passed |
| Web TypeScript with isolated incremental cache | Passed |
| Diff whitespace and changed-file scope | Passed |

Logs are stored beside this file. The first restricted regression run passed
147/148 and failed only on loopback `listen EPERM`; the subsequent authorized
local-server runs passed, including the final 149-case suite. The preserved
`regressions-sandbox-first.log` is an environment failure, not the final result.
Final additional self-test code accounts for the later 149-case denominator.

Node v24.19.0 and existing pinned repository dependencies were used. Reproduction
with the bundled runtime on this host:

```sh
export PATH=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
node --import tsx tests/evals/orchestration/run.mts --set full --output-dir /tmp/atepdf-orchestration-run
node --import tsx --test tests/regressions/orchestration-eval.test.ts
ATEPDF_CORPUS_PYTHON=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 node --import tsx --test tests/regressions/*.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tests/evals/orchestration/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit -p apps/universal/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --tsBuildInfoFile /tmp/atepdf-shr107-web.tsbuildinfo -p apps/web/tsconfig.json
```

See the [suite README](../../../tests/evals/orchestration/README.md) for dev/held-out
filters, per-scenario controls, dev-only tuning export, candidate injection,
comparison gates, split-contamination rules and synthetic regression additions.
SHR-108 may vary system/developer prompt, tool descriptions, clarification policy,
model, effort and routing through a test adapter. No optimization loop or live
transport is implemented; live spending remains separately authorized work.
