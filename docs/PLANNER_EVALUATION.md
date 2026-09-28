# Planner and protocol evaluation — 2026-09-28

Scope: fresh atepdf repository, shared protocol/compiler and the local development planner gateway. No old checkout was executed or changed. This pass made **zero model calls**, did not read the owner's saved credential, and did not change the exhausted paid allowance. The two earlier owner-approved live cases remain the entire live-model evidence set.

## Changes

- Executable plans and non-executable clarifications now pass the complete envelope schema and request/revision binding. Extra top-level fields, partial JSON and stale responses fail before acceptance.
- The compiler independently checks local manifest shape, supported PDF type, encryption state, page counts, duplicate references and selection/original/focus references. OCR additionally requires the requested English asset to appear in the runtime language manifest.
- Quick removal, OCR and compression no longer guess the first file when multiple originals are selected without a focused result. A single selected PDF or an existing focused result is required; merge retains explicit selection order.
- Privacy guards cover quoted paths, native URI schemes, several encoded-path forms, hidden directional/control characters and JSON-shaped secret assignments. Unicode-normalized known filenames are aliased locally. Outgoing data still uses positive projection.
- Private configuration reads check directory ownership as well as file ownership/permissions; accepted key syntax is consistent between save and status. The persistent call budget, shared reservation lock and no-retry behavior remain intact.
- The gateway retains an empty OCR language list on runtimes that do not advertise OCR; it no longer inserts English regardless of the device manifest.

## Evidence

`node --import tsx --test tests/regressions/planner.test.ts tests/regressions/protocol-conformance.test.ts`: **23 tests passed, zero failures**.

The protocol tests exercise all **21 retained adversarial fixtures** in `packages/contracts/corpus/invalid_plan_cases.jsonl`. They also accept **25 explicitly selected golden responses** from the retained 118-row development seed corpus: SEED-001, 004–011, 014, 017, 043–050, 052–055, 069 and 070. These cover merge order, exclusions/negation represented in the supplied plans, numeric byte targets, lossless/balanced parameters, English OCR and remove-before-merge versus merge-before-remove. Seven unsupported golden cases explicitly fail closed: SEED-002, 003, 018, 051, 073, 074 and 117. No second roadmap or replacement corpus was introduced.

Additional synthetic checks cover ambiguous quick-action targets, current-result precedence, physical pages relative to the immediate input, repeated/zero/fractional/out-of-range/all-page removal, missing refs, duplicate step IDs, hidden terminal outputs, four-step limits, unavailable OCR language, undo/clear revision invalidation, opaque output remapping, partial JSON, aborted responses and clarification binding.

Gateway checks use an injected fake provider and isolated temporary credential files only. They cover hostile origins/hosts/fetch context, tokens, content type/body bounds, duplicate requests, concurrency, deadline/cancellation, failed-call budget consumption, invalid allowances, no automatic retry and sanitized provider errors for HTTP 401/403/404/429/500. A mocked HTTP test invokes the actual AI SDK adapter and verifies the fixed endpoint, structured output, `store:false`, 2,000 output-token cap and absence of tools/uploads/telemetry. It makes no external request.

`pnpm typecheck`: **passed** for the shared/web TypeScript project. `git diff --check`: **passed** at the end of this patch. These checks are not an application build, native binary run or release certification. The integration session owns the final application builds and browser/native checks.

## Shared controller follow-up

The native integration review additionally found and fixed mutable references across asynchronous work. The store snapshots bytes and inspection before hashing; commits finish all metadata/buffer copies before exposing a batch. The controller snapshots accepted recipes/context, checks the adapter's actual operation list again at execution, and binds page/byte facts to local artifacts. Quick plans copy input-reference lists instead of sharing the request's array.

Four focused orchestration tests in `tests/regressions/core-integrity.test.ts` cover mutation during hashing, a failed batch copy, mutation while a native-style engine yields, and capability/manifest inflation. These tests use synthetic fake-engine bytes to isolate controller behavior; they are not native-engine conformance evidence. The first complete regression run exposed the quick-plan array alias; after fixing it, `node --import tsx --test tests/regressions/*.test.ts` passed **36/36 tests**, including the existing real-PDF merge/remove/undo and large-file tests.

The follow-up native lifetime review added an optional release hook for native picker copies while retaining compatibility with ordinary browser `File` objects. Controller cleanup now runs for every selection, including unread copies after failure, cancellation or a busy rejection. Two additional orchestration tests pass for these paths and successful imports. Cleanup failures remain best effort and cannot erase a completed local result. Native startup cleanup covers the app's dedicated work, preview and document-picker cache directories. Preview creation handles storage errors inside the component's error boundary, and partial scratch writes are cleaned. A successful system share retains its disposable copy until the next startup so destinations can finish reading; the UI only confirms that the share sheet closed. None of these Node tests is claimed as a native lifecycle test.

## Limits

Golden-response tests establish deterministic compiler behavior; they do **not** measure whether the model interprets those instructions correctly. The remaining development seed rows and independent held-out model evaluation are not claimed as passed. No further paid evaluation is authorized by this work.

Regex and known-text matching cannot reliably identify arbitrary sensitive prose, transformed document excerpts or every possible filename/secret encoding. Instructions typed by the user are sent on Send after the implemented guards; the owner removed the repeated outgoing-instruction review screen. Privacy details remain available in the header. The claim supported here is positive metadata projection plus rejection of specified synthetic canaries, not perfect PII removal or a broad guarantee about anything a person might type.

The local gateway remains a single-user development service. Loopback/origin/token checks and local filesystem permissions do not establish production authentication, account authorization, secure storage on every platform or protection from other already-trusted local code. Native engines must advertise only the operations and OCR languages their tested adapters actually provide.


Later owner authorization: after reporting $10 account credit, the owner requested AI enabled. The existing bounded local setup now permits 20 requests, still capped at 2,000 output tokens each with no retries and direct planning on Send. No new paid evaluation call occurred. Current status: evidence/native/planner-budget-current.json; the zero-allowance evidence above is historical.
