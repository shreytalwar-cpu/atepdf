# SHR-70 — provider destination and response admission

Task: [SHR-70](https://linear.app/shrey-talwar/issue/SHR-70/constrain-ai-provider-destinations-and-transport-response-size), parent SHR-25. Started 1 October 2026 from fetched `origin/main` **fd74961b0e282503bb9986e40f07633687c2f673**. SHR-70 was Backlog, unassigned, without a matching branch/worktree or open PR; SHR-16, SHR-36, SHR-79 and SHR-90 were Done. Work is isolated on `codex/shr-70-transport-security`. SHR-106, UI behavior, model selection, accounts, local engines, release/distribution and historical audit records are unchanged.

## Current-main reproduction, not an old audit assumption

SHR-36 already pins the SDK base URL and rejects inherited `OPENAI_BASE_URL` overrides. Production disclosure is incomplete and blocks all hosted writes. The historical environment-override vulnerability therefore **does not reproduce on this main**.

The remaining credential-routing gap is the **unbound fourth-argument fetch injection** in `planWithOpenAI`. With synthetic privacy authority, main passes Authorization, its positive H instruction envelope and Idempotency-Key to any injected writer. An intercepted writer reconstructed that request at `http://127.0.0.1:3999/v1/responses`. It used no socket and no real credential. The regression asserted zero protected bytes and failed:

| Counter | Main | Fixed source |
|---|---:|---:|
| Authorization bytes at unapproved intercepted target | 34 | 0 |
| Provider payload bytes | 16,647 | 0 |
| Request-metadata bytes | 36 | 0 |
| Specific refusal | absent | `destination_not_allowed` |

Command: `node --import tsx --test tests/regressions/provider-transport-repro.test.ts`. Pre-fix exit **1**, one intended failure; fixed exit **0**. Pre-fix regression commit: `efc779b`. This is an in-process injection/configuration boundary; no deployed remote exploit or missing production privacy approval is claimed.

A second reproduction exports the exact main SHA and runs `response-reproduction.mts` from that snapshot. Main accepts valid Responses JSON followed by whitespace, reads **2,097,152 bytes**, and does not cancel. Fixed source refuses `response_too_large` after **1,114,112 observed bytes** (1 MiB plus the first crossing 64 KiB chunk), cancels, and retains no crossing chunk/tail. The identical script is red on main and green on the fixed implementation. It records counts/outcomes only, never request or response contents.

## Destination contract and credential custody

Canonical configuration: `packages/contracts/transport-policy.json`; shared admission: `packages/planner/src/transport.ts`.

| Class/path | Admission |
|---|---|
| Current provider transport pin | Exactly normalized `https://api.openai.com/v1/responses`; HTTPS, exact host, default/explicit 443, exact path, no query/fragment/userinfo. Normalization accepts hostname/scheme case and default port. Whitespace, backslashes, percent-encoded forms, absent/repaired authorities and malformed URLs are refused. No suffix/wildcard matching. |
| Production disclosure | **No production hosted destination is enabled.** Transport pinning is necessary but SHR-36's independent positive H/C/N projection, complete recipient registry, hosted acknowledgement and grant checks remain necessary. Its real registry remains empty. Vercel, Supabase, US-residency OpenAI hosts and future relay destinations are not admitted. |
| Environment/base URL | Missing setting uses the pinned SDK base. An explicitly supplied setting must normalize to `https://api.openai.com/v1`; empty, malformed or alternate values fail closed. No fallback to the inherited value. |
| Synthetic provider injection | Explicit `test`/`development` capability made by `createSyntheticTransport`, bound by a private WeakMap to one exact destination and writer. Only the exact non-secret sentinel `atepdf-synthetic-transport-only` can be attached. A raw writer, forged capability, changed writer, wrong role or different credential fails before disclosure. |
| Synthetic destinations | Intercepted provider pin, or exact HTTP loopback (`localhost`, `127.0.0.1`, `[::1]`), explicit port 1024–65535, path `/v1/responses`. No arbitrary external test host. Physical synthetic delivery substitutes a fixture transport only; the logical provider H route still passes the unchanged SHR-36 pin/disclosure checks. |
| Browser | Fixed same-origin `/api/planner*` routes on HTTP/HTTPS loopback. Browser origin supplies the exact scheme/host/port; no configurable provider URL. Explicit fake local writers require a separately bound `local` capability, exact `/api/planner` loopback endpoint, and the fixed synthetic local token. Real local tokens cannot be passed into injected writers. |
| Native | Existing release default deny remains. DEBUG permits existing HTTP loopback ports 3210–3212 or exactly pinned HTTPS loopback with explicit port 1024–65535 and a 64-hex fingerprint; no userinfo/path/query/fragment. LAN beta disclosure remains denied by SHR-36. No provider key ever goes to native/browser transports. |

Production (`NODE_ENV=production`) rejects creation **and consumption** of synthetic capabilities. A missing/unknown mode or authority is refused. Native release is compiled without DEBUG and makes zero pairing/planner writes. The factory is an explicit trusted fixture/development-code interface, not a user-facing setting or an environment switch. Compromised in-process code/global fetch replacement is outside this configuration boundary; approved synthetic writers are trusted code and must use synthetic requests.

Provider Authorization and Idempotency-Key are reconstructed only after destination and privacy admission. Caller/SDK headers are not forwarded. Native endpoint admission precedes attaching the bearer. All provider/browser redirects are manual and refused, including same-origin redirects; native URLSession rejects redirection in its delegate. No redirect chain or scheme/port/host change is followed. A transport that reports an already-redirected or mismatched response is rejected before its body is read.

## Byte limits and derivation

| Boundary | Bytes | Derivation |
|---|---:|---|
| Planner JSON envelope / gateway output / browser / native | **524,288 (512 KiB)** | Active execution and provider schema admit at most four steps. Conservatively budget four 10,000-entry page-index arrays (7 bytes/entry including commas = 280,000), four 100-ref arrays (72 bytes/ref = 28,800), up to 100 result refs (7,200), plus IDs/parameters/framing. Even that schema-sized overestimate is under 330 KiB; 512 KiB leaves substantial serialization headroom. Actual active projection/page bounds are smaller. A worst-shape regression checks the calculation. |
| Raw provider Responses JSON | **1,048,576 (1 MiB)** | Planner arguments are a JSON string within provider JSON; the additional escaping, tool-call/status/usage/response metadata need independent headroom. Twice the planner cap bounds that wrapper without changing model output-token policy. Unexpected reasoning/extra metadata also shares this cap. |
| Status/pairing/key/disconnect control responses | **8,192 (8 KiB)** | Existing bounded 64-character pairing/session values, expiry, model, booleans, counters and short errors are under 1 KiB. 8 KiB gives ample control-protocol framing headroom, never permission to carry a plan/content body. |

These are technical serialized transport limits, **not** product allowances, prices or model-token quotas. The model and its output-token configuration are unchanged. Future unsupported tools/schemas require a separately reviewed policy update. Swift constants are generated in place from the canonical JSON by `scripts/transport-policy.mjs`, included in `scripts/contracts.mjs --check`. Clean failure verification mutates the canonical policy and proves stale native constants fail.

Content-Length supplies early refusal only. Actual UTF-8 bytes are counted while reading; absent/misleading lengths and chunked responses cannot bypass the cap. Oversized headers cancel before a read; a crossing chunk is refused before decoding/retaining it, then the reader is cancelled. Native streams one byte at a time into bounded Data and invalidates the session. Exact-cap bodies remain accepted. Compressed bodies use the decoded-byte cap and do not confuse compressed Content-Length with decoded length. Truncated transport/JSON, malformed JSON/UTF-8 and oversized errors are safe refusals. No partial plan is admitted. SDK JSON is parsed once, after bounded admission; native bridge JSON parse errors are replaced with safe errors. The web transport and mandatory byte reader load together before a request. Shared safe error types stay lightweight; the screen imports its unchanged fallback message independently. This restores the existing startup budget without changing rendering or raising its threshold.

Stable reasons: `destination_not_allowed`, `redirect_not_allowed`, `response_too_large`, `response_truncated`, `provider_response_invalid`. Gateway and SHR-36's error sanitizer preserve only validated contentless transport reasons/status. Raw body, credential, instruction, document data and paths are never added to the new errors/diagnostics. Existing live-evidence redaction was inspected and retained.

## Traced paths

- Browser shared client → same-origin development gateway: bounded receiving for planner and controls, positive H projection and injection admission.
- Node gateway → shared OpenAI SDK adapter → guarded fetch → raw Responses JSON: fixed destination, no redirect, synthetic-only injections, pre-SDK byte cap; schema/binding validation and bounded gateway output before host forwarding.
- Next local gateway, standalone Expo hosts and beta host: all construct the same gateway; no separate provider override exists. Their `response.text()` forwarding reads the already-bounded gateway output.
- Private native TLS companion: positive inbound auth/header projection into the same gateway; forwarded output is bounded there. No external provider route exists in the companion.
- Swift URLSession → native module → native JS client: destination/pin admission, no redirect, canonical planner/control caps, safe truncation and safe bridge JSON parsing. Existing cancellation/disconnection/privacy checks remain.
- Local config stores keys/budgets, not URLs. Browser has no provider/base-URL option. Native pairing carries only the constrained local endpoint; test-only override callbacks were audited and updated explicitly.

## Attack matrices and verification

`tests/regressions/provider-transport.test.ts` records per-target Authorization, H payload and request-metadata counters, as well as stream-read/cancel counters. Destination cases include exact normalized pin, wrong scheme/host, attacker suffix, sibling/subdomain, wrong port, userinfo, IP literal, IDNA/punycode lookalikes, trailing dot, query/fragment/path, percent/backslash confusion, repaired authority, malformed URL, loopback with/without capability, forged/mismatched capability, production-mode refusal and credential refusal. Owned loopback servers prove zero redirected requests/credentials/bodies and no chain following.

Response cases include all three caps at -1/exact/+1, valid exact-cap provider JSON, declared under/exact/over length, misleading/missing length, chunked overrun with read-stop, UTF-8 multi-byte splits, compressed-length handling, opaque browser redirects, interrupted transfer, truncated/malformed JSON/UTF-8, excessive trailing data and oversized 200/400/500 bodies. Browser errors and gateway receipts exclude raw canaries. Native fixtures independently test destination zero-writes, redirect zero-writes, exact/+1, early length refusal, missing length, chunked/error bodies and transfer truncation; existing DEBUG, release-denial and certificate/pinning suites pass.

Focused command: `node --import tsx --test tests/regressions/provider-transport*.test.ts tests/regressions/outbound-privacy.test.ts tests/regressions/planner.test.ts tests/regressions/orchestration-eval.test.ts` — **179 passed, zero failures**. Historical response script — **one passed** after the fix.

Native command: `node tests/native/planner/run.mjs` — DEBUG transport, release zero-write and pinned TLS execution **passed**, synthetic fixtures only. TypeScript web/universal/orchestration and generated-policy checks passed. Source-bound clean core (397 passed, one existing optional Python fixture skipped), browser (45 passed), eight intentional failure-injection refusals plus restored checks, and Sonar results are recorded in `verification.json`. Native suites and all four TypeScript targets passed. The final PR checks bind the later evidence-only head. The clean export totals 2,191,088 raw / 499,266 computed gzip startup bytes, under the unchanged 2,500,000 / 500,000 byte limits. Initial budget and old parser-error assertion failures were corrected without suppressions or weakened gates. No new dependency is introduced.

## Limits of this evidence

This is synthetic transport/shared-code verification, not real-provider, full Mac GUI, signing, distribution, production-region/DNS/provider-account or independent human security acceptance. Release remains blocked by the existing incomplete disclosure/service work. Native malformed JSON is safely rejected in the JS bridge after its bounded transport read; native transfer truncation is independently refused in Swift. Platform HTTP/TLS/decompression buffers and the already-allocated crossing chunk are outside application read control; bounded retained data and prompt read cancellation are observed, not a claim of zero OS/network allocation. A trusted writer that intentionally ignores its destination cannot be secured against itself; it is admitted only with non-secret sentinel credentials and synthetic fixture authority. Independent security review remains required on the PR; the builder has not self-certified it.

No real provider call, real credential, paid model usage, provider account, production relay/auth/billing, merge, Done transition or next issue was used/started.
