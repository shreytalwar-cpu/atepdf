# atePDF orchestration evals — SHR-107

Version 1.0.0 contains **64 synthetic scenarios: 41 dev and 23 held-out**, across
14 categories. This issue builds scenarios, deterministic grading, splitting,
offline execution, baseline reporting and negative self-tests. It performs no
planner optimization, model/provider change, PDF-tool implementation or deployment.

Run from the repository root with the repository's existing Node/dependencies:

```sh
node --import tsx tests/evals/orchestration/run.mts --set full --output-dir /tmp/atepdf-orchestration-run
```

The command emits machine-readable JSON and writes `results.json` plus a concise
`summary.md`. Choose a new output directory for each run; existing report files
are never overwritten. `node --import tsx tests/evals/orchestration/run.mts` is also available
as the `eval:orchestration` package script. The direct command does not trigger
package-manager dependency checks or installation.

```sh
node --import tsx tests/evals/orchestration/run.mts --set dev
node --import tsx tests/evals/orchestration/run.mts --set held-out
node --import tsx tests/evals/orchestration/run.mts --set full --category multi_step
node --import tsx tests/evals/orchestration/run.mts --set dev --scenario O107-012
node --import tsx --test tests/regressions/orchestration-eval.test.ts
```

Unknown options, unmatched cases, malformed inputs/observations, mismatched keys
and missing replay fixtures are errors. Expected current-product quality failures
are report data, so the baseline run exits successfully. Candidate comparison
can fail CI with `--baseline <results.json> --fail-on-regression`.

## Data contract and authority

`scenario.schema.json` is the closed, source-controlled input schema.
`expectation.schema.json` is the independent answer-key schema. The loader
validates both and checks ID, reference and turn consistency. Each input has an
ID, independent family ID, category, description, version, local context and
ordered user turns. Context carries opaque aliases, synthetic names/text,
metadata, source/workspace revisions, selected originals, result history,
capabilities and local selector outputs with revision/uncertainty/evidence.
Optional prior conversation remains local; it is not forwarded as a transcript.
Turns can submit, invoke explicit quick actions, use local controls, replace
context, mutate a request for adversarial boundary tests or advance the workspace
revision after planning. Multi-turn continuations retain actual pending state
created by the previous adapter response, not by the answer key.

Consent has hosted-instruction permission and an optional eval-only content
receipt binding operation, purpose, all recipients, refs/pages, content revision
and data categories, with revocation. This is a replaceable grader input, **not an
approved SHR-35 implementation contract**. Entitlement fixtures distinguish the
existing gateway request allowance from the still-unintegrated production billing
controls. No prices, quotas or commercial policy defaults are invented.

Keys separately specify status/refusal reasons, whether clarification is necessary,
acceptable choices/question topic, provider-call count, admission, tools actually
invoked, exact plan graph, selected refs/pages/parameters, forbidden tools, quality
confirmation and ordering constraints. Metadata labels `current_contract` versus
`approved_target`; passing a refusal for an absent capability does not implement
that capability or pass its v1 acceptance gate. PRODUCT_V1.md remains authoritative.

| Category | Coverage |
| --- | --- |
| single_tool | Merge, physical removal, OCR, Compress; negation, order, missing OCR and unavailable rotation |
| multi_step | Merge/remove/compress, merge/OCR/compress, original-page removal before merge; OCR/extract refusal |
| follow_up | Actual pending-answer binding, file correction, current vs original, new result targeting, Undo, filename aliases |
| ambiguity | Multiple files, unspecified page, duplicate invoice filename |
| clarification | Necessary attachment/file/page questions; direct actions with explicit targets |
| stale_revision | Changed file/workspace, superseded result, changed focus, stale selector evidence |
| safe_controls | Cancel, Start Over, Undo, request replacement and refusal to remove every page |
| unsupported | Editing, signing, redaction, chronological semantic sorting, no partial supported subset |
| local_selectors | Synthetic invoice, blank and scanned-page candidates; private evidence, uncertainty and runtime refusals |
| collections | Ordered Split/PDF-to-images requests safely unavailable under the current single-result contract |
| protect_last | Whole-workflow refusal today; constraints forbid protection before content changes in future proposals |
| quality_permission | Quality confirmation, safe local actions, content/secret/nested canaries, absent/stale/mismatched permission |
| entitlement | Actual gateway exhaustion; preserved safe controls; approved-target quick-action bypass probe |
| no_work | Local Help/Privacy controls and a simple explanation that should avoid unnecessary work |

The current runtime executes only merge_pdf, select_pages/remove with explicit
physical pages, whole-document English OCR and single-document Compress. The
historical registry/canonical JSON schema is broader; it is not the executable
catalogue. Rotation, extraction, Protect, collections and semantic selectors are
represented by refusals and negative grader probes, without enabling them.

## Adapter and what the baseline means

`current-adapter.ts` uses the existing `privateInstruction`, request projection,
clarification helpers, development gateway, `planWithOpenAI` through its injected
fetcher, complete schema/semantic/revision validation and `JobController`.
Provider HTTP responses are source-controlled **synthetic scripted fixtures**.
No live model authored or chose these responses. No current prompt is tuned.
Core execution requires no credentials and never loads owner gateway settings.

The controller executes synthetic transform services over encoded inspection
fixtures. We record actual service invocations, admission, result focus/revision,
pending task and the actual SDK request body. This is controller/projection and
fixture-response integration evidence; it is not a real-PDF or native-Mac test.
Quick actions call the actual `controller.quick()`. Help/Privacy and the preparation
sequence are bounded harness representations of current UI routing, not UI
interaction proof. The harness reproduces the current quality-confirmation branch
and withholds engine execution until the scenario approves quality loss.

All scripted plan/refusal/clarification scores describe deterministic fixtures,
not empirical language-understanding accuracy. A 100% plan score can coexist with
routing/consent failures. Tokens, model latency and cost are `null` with an explicit
unavailable note; wall-clock test durations are not relabelled as provider latency.
Known source/target gaps remain failures; do not weaken keys to make a baseline green.

## Graders and equivalence

`graders.ts` inspects raw proposals even when local admission rejects them, plus
actual invocation traces. It checks planner status/tool choice, complete sequence,
refs/graph, pages, parameters, final result order, clarification status/topic/choices,
canonical schema plus runtime semantics, stale-target admission, capability
hallucinations, forbidden operations, provider-count/trace agreement, quality
permission and allowance bypass. Wrong refs report e.g. `expected merge_pdf refs
[A,B], got [B,A]`. Failures have turn indices and stable diagnostic groups.

`normalize.ts` sorts object keys and alpha-renames produced outputs/step labels.
Opaque input refs map to the same scenario aliases. Explicit removal indices are
sets, so their order may differ; duplicates still fail schema validation. Tool
order, input order, output dependency, all other arrays and collection result order
remain exact. No dropped step, wrong tool, orphaned result or altered parameter is
accepted as formatting equivalence. Clarification wording may vary if it is safe,
asks the required topic and preserves the required choices/reason; these checks do
not certify arbitrary natural-language equivalence.

Clarification metrics include false, missed, correct and correct direct-action
counts, plus precision/recall (`null` when there is no denominator). Every needless
clarification fails. Reports separately count exact-plan accuracy, planner-tool
accuracy, invoked-tool accuracy, invalid proposals, privacy violations, hallucinations,
unnecessary/missing provider calls, unnecessary tools, stale admissions and allowance
bypasses. Hard failures remain visible even if aggregate quality improves.

`privacy-grader.ts` exposes a `PrivacyPolicy` callback for later SHR-35/36 policy.
It detects nested synthetic canaries, recognized secrets, non-allowlisted command
projection, missing/revoked consent and scope/revision/purpose/recipient mismatch.
Scenario keys deny outbound content by default even with a matching receipt.
A matching content-receipt self-test tests the comparison interface only; it does
not authorize or implement a cloud processing service. The current adapter never
sends content even when a test receipt exists. Detection is not a guarantee of
anonymizing arbitrary free text; the suite is limited to its synthetic cases.

## Held-out protection and SHR-108 integration

`split.json` is an explicit, deterministic family manifest, versioned with the
corpus and a fixed seed identifier. There is no random resplit on each run. Cases
have distinct request/context/constraint families rather than a shared prompt with
only file names changed. This small hand-authored corpus is not a statistical
sample of customers and does not claim distribution-level generalization.

Dev inputs/keys are under `scenarios/`; dev fixtures are under `fixtures/`.
Held-out inputs are separate from `held-out/scoring/keys.json` and its scripted
response fixtures. Candidate adapters never receive either keys or replay fixtures.
The scoring runner collects observations before loading answer keys. Default
held-out output contains aggregate/category metrics only, with no per-case
expected/actual messages, prompt text or IDs. Explicit `--held-out-details` opts
into per-case grading diagnostics; `--scenario` deliberately requests a per-case
score. Detailed diagnostics reveal information about the key and must not be fed
back into optimizer prompts as routine tuning data.

```sh
node --import tsx tests/evals/orchestration/run.mts --export-dev /tmp/atepdf-dev-tuning.json
node --import tsx tests/evals/orchestration/run.mts --set full --adapter /absolute/path/candidate.mts \
  --config /absolute/path/candidate-config.json --baseline /absolute/path/baseline/results.json \
  --fail-on-regression --output-dir /tmp/atepdf-candidate-run
```

The dev exporter reads only dev inputs/keys and refuses held-out export options.
The candidate module default-exports the `Adapter` interface in `types.ts`:
`{name, async evaluate(scenario, config) -> Observation}`. A separate bounded child
process receives **only** the scenario and configuration JSON. Candidate config
can inject `systemPrompt`, `developerPrompt`, `toolDescriptions`,
`clarificationPolicy`, `model`, `effort` and `routingPolicy`; the module is
responsible for applying them to a test-only planner. The fixed current adapter
rejects config overrides. This issue implements no optimization loop.

The worker strips credentials/settings from its environment and disables normal
fetch/HTTP/socket APIs before loading a candidate. Candidate errors suppress
prompt-bearing stderr. Use trusted offline adapters only: this is not an OS
security boundary and arbitrary local code could bypass it or read the repo.
Future real-provider scoring requires separate bounded provider/data/spend authority
and a reviewed transport adapter; this core command does not authorize live calls.

Comparison requires matching corpus contents, split and exact selected case IDs.
Dev and held-out scores are compared independently; safety-count increases or
plan/tool/overall accuracy regressions reject a candidate. It produces a comparison,
not a production configuration selection. SHR-108 may vary the listed parameters
and supply offline candidate observations; source-connected selector/consent/billing
adapters can be introduced later by their separately authorized issues.

These controls are practical leak prevention, **not cryptographic protection**.
Anyone with repository read access can inspect keys; repeated fine-grained scores
can reveal answers. See `held-out/AGENTS.md`. Restrict optimizer context to the dev
export and aggregate scoring results. After a validation case is disclosed to an
optimizer, move that family to dev and add a new independent validation family in
a versioned corpus before claiming independent held-out improvement.

## Adding a regression

1. Reproduce the bug locally and invent a synthetic request/document/context with
   the same causal failure. Never copy customer transcripts, document contents,
   filenames, screenshots, paths, secrets or private files into the corpus.
2. Add a unique ID and family to dev by default. Put its input and expected result
   in separate files. A deliberately reserved future held-out family belongs only
   in the scoring area and must not be used while tuning.
3. Set requirement refs, current-contract/approved-target basis, exact targets,
   provider behavior and forbidden actions. Add an independent replay fixture if
   the current offline adapter needs one; do not derive fixture replies at runtime
   from the key. Add a negative grader self-test for any new rule.
4. Bump corpus/split versions and update the manifest/schema version constants
   together. Do not move a family across splits without recording contamination.
5. Run the self-tests and full suite, save source-bound results in a new evidence
   directory and compare only identical version/content/selection baselines.

The baseline is under `docs/evidence/SHR-107-2026-09-30`. Its runtime/harness/corpus
hashes and source heads identify the exact tested inputs; later evidence-only
commits do not retroactively alter a run.
