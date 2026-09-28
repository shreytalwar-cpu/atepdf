# 04 | Cloud planner and typed operation protocol

## Final v3 interpretation and integration note
Use the AI SDK on the server behind the existing planner protocol. A model ID and price in this dated document are research candidates, not proof of access or a pinned production choice. Reconfirm official availability and parameters with the actual API project. Final environment defaults keep live planning disabled until an approved credential and budget are configured. Do not require a local LLM. The provider output, gateway binding and local executor remain separate.

## Model choice
Use a low-cost hosted instruction interpreter, not an on-device model. Begin with `gpt-5.6-luna` as a benchmark candidate because current official documentation lists function calling, structured outputs and a no-reasoning mode [S01]. Compare with a cheaper candidate such as `gpt-5-nano` only through the same accuracy/latency suite [S02]. Do not assume the cheapest model delivers the best completed-job cost.

Set the chosen model and supported parameters in server configuration. No model name is a permanent architecture dependency. Provider availability and supported parameters must be verified with the actual project credentials before enabling the live path. No user-visible model picker or automatic upgrade to an expensive frontier model.

Initial API mode: foreground Responses request, constrained structured response, no provider file uploads, no hosted tools, no web search, no code interpreter, no remote MCP execution, no embeddings. Use the provider's supported `store:false` setting and a minimal input context; this is not a zero-retention claim [S03, S04].

## Illustrative model budget
Verified on 27 September 2026: GPT-5.6 Luna lists $0.20 per million input tokens and $1.20 per million output tokens [S01].

Example planning budget: 2,500 input tokens and 450 billed output tokens gives `(2500×0.20 + 450×1.20)/1,000,000 = $0.00104` per call, or $104 per 100,000 calls. This is an assumption, not measured spend. Full schemas, long sessions, retries, reasoning tokens, pricing changes and taxes alter the result. Record real token/cost usage without storing instruction text. Infrastructure, store fees and support are separate.

Normal job: one planning call. Quick action or saved validated recipe: no model call. One bounded retry may repair schema/provider formatting failures; do not use endless model loops or repeatedly pay to restate a valid plan. Business ambiguity should ask the user, not trigger a bigger model by default.

## Data sent to the planner
Allowed request fields are defined by `contracts/planner-request.schema.json`:
- schema/protocol version, opaque workspace revision and request identifier;
- user-entered instruction after deterministic local alias substitution where possible;
- file/version IDs, generic media type, byte count and page count if known;
- current selection/focused-result/original refs and a bounded, typed previous plan without secrets;
- tested capability IDs and available OCR language IDs for this runtime.

Not allowed: bytes/base64, text extraction, OCR, thumbnails, full paths, filenames as manifest fields, local checksums, passwords, signature data or full chat history. User-typed text itself is sent and may contain sensitive data; explain this honestly. File-name mentions should be converted locally to visible reference chips when resolvable. Do not claim perfect PII filtering for arbitrary user text.

## File addressing and context
Use stable anonymous version refs within a workspace, e.g. `file_a` and `out_01`. Do not derive IDs from customer names. Display labels are resolved locally after the response arrives.

“these” = explicit selection; otherwise visible inputs in their displayed order.
“that result” = focused completed result when unambiguous.
“originals” = the immutable original refs for the active job lineage.
“each separately” = `per_file` semantics, never implicit merge.
“same again” = validated previous recipe re-bound to current inputs after local preflight. For an altered repeat such as “same again but separately”, send the typed `previousPlan` (steps and result refs only) so the planner can recover parameters as well as action names. `previousActionIds` are lightweight hints, not enough to reconstruct an entire prior job. A previous plan is context only, never automatically executed.

Request includes current workspace revision. Response is accepted only for the matching request/revision and the same validated file bindings. Adding/removing/reordering files during interpretation invalidates the old proposal.

## Response contract
The included planner response has a top-level object with `status` (`plan`, `clarify`, `unsupported`), `steps`, `resultRefs` and `clarification` (nullable). It is intentionally not executable code. Each operation has its own typed parameters. Unknown fields/operations are rejected.

Each step names its input refs and new output ref. Refs must exist as inputs or prior step outputs. Batch outputs may be ordered collections; output types must be checked. IDs may not collide with original refs. Set a small step cap and limit all cardinalities.

Compiler validates the candidate and expands selectors such as `last` using the relevant step's actual page count. Page selectors always target the immediate input to that step, not a different pre-merge version. “Remove page 2 from the second original, then merge” therefore requires removal before merge, bound to the second file.

Root response, per-operation JSON shapes and sample fixtures are provided. Provider-specific schema support is a separate build task: compile/test the schema subset supported by the selected API, while keeping the full local contract validator authoritative [S03].

## Local compiler owns safety
The model cannot decide that a dangerous operation is safe. The compiler enforces:
- scope exclusions and current runtime capabilities;
- actual file types and secret prerequisites;
- valid page ranges, output count, plan ordering and stale-request rejection;
- memory/size/CPU budgets;
- preservation rules for signed/forms/tagged/complex PDFs;
- quality review when a result would cross the configured degradation policy;
- encrypted output only with a local secret bound to the step;
- independent validation before result promotion.

Do not accept `confidence:0.99` as permission. Do not use LLM self-reported success, guessed durations or predicted final file sizes as measured facts.

## Clarifications
Ask one focused question when inputs, sequence or referents truly cannot be resolved. Prefer local controls: file selection, page ranges, order chips, size choice. Safe defaults should be declared compactly, not interrogated every time.

Examples:
- “Merge” with one input -> “Add another file to combine.”
- “Delete the last page” with two unfocused outputs -> “Which result?”
- “Make it smaller” -> balanced compression, not a settings questionnaire.
- “Sort by invoice date” -> unsupported content-dependent ordering in core V1, or explicit local date-entry/order control; never guessed filesystem order.
- “Protect it” -> plan plus local secure password prerequisite, not a request to type a password into chat.
- “Make it under 50 KB without any quality loss” -> attempt safe optimisation and return measured target-not-met where appropriate; never promise impossibility away.

## Result narrative
Use deterministic templates populated by engine events and artifact metadata. Example: “Combined 3 files. 38 pages. 4.6 MB.” Do not call the model to narrate every progress or success event. Expose warnings and partial completion in the result card.

## Gateway operational contract
- Accept small JSON requests only; example starting cap 64 KiB total and 4,000 instruction characters, both configurable after measurement.
- Validate before provider call. Reject unknown fields, binary encodings, invalid IDs and malformed capability sets.
- Client capability claims are intersected with server-known valid IDs; the local runtime remains authoritative about actual execution.
- Authenticate/limit guest traffic, rate-limit by session and relevant abuse signals, cap retries and concurrency, set daily spend ceiling and circuit breaker.
- Return typed, user-safe errors for offline, timeout, rate limit, invalid response, unsupported schema and provider outage.
- Do not log request/response bodies in proxy, traces, analytics or crash reports. Log duration, status, operation category, token usage and anonymous request IDs only.
- Server never fetches a URL supplied in an instruction and never runs local file operations.
- Local jobs already underway continue when the gateway becomes unavailable.

## Runtime parameter capabilities
`ocrLanguages` contains only installed or explicitly available local OCR language assets for the current runtime. A requested language outside that list must be rejected or resolved by a permitted local asset download before replanning, never silently substituted. Extend parameter-level capability constraints through versioned contracts as formats/engine limits expand; the local compiler remains authoritative. The typed `previousPlan` contains no filenames, secret values or document content and is bounded by the same step schemas. Never echo it into analytics.
