# SHR-79 evidence — consumer AI service, provider data policy and operating budget (30 September 2026)

**Source:** `origin/main` `ff3e291`.  **Decision record:** [ADR 0013](../../adr/0013-consumer-ai-service.md) (proposed; pending owner decisions AI-1 to AI-10).

| File | Content |
|---|---|
| [service-protocol-cases.json](service-protocol-cases.json) | 40 mock protocol and failure cases (S01–S40) for SHR-80/81/82: authentication, schema/class-H denial, idempotency, concurrency, allowance vs technical vs budget refusals, provider errors, timeouts, invalid output, cancellation, late responses, relaunch, offline, key/host pinning and the provider request shape. Synthetic identities and hosts only. |
| [recipient-disclosures.json](recipient-disclosures.json) | Draft ADR 0012 `RecipientDisclosure` records for the atePDF relay, Cloudflare and OpenAI. **All `incomplete`**; each lists its `unknownFields`. Production transfer stays blocked until they are resolved and verified against live account configuration. |
| [cost-model.json](cost-model.json) | Measured payload sizes, documented prices, estimate assumptions and the resulting per-call and per-user-month estimates, each labelled MEASURED / DOCUMENTED / ESTIMATE. |

## Measurements (MEASURED)

A temporary, uncommitted script imported `packages/planner/src/schema.ts` and `packages/planner/src/generated/product-knowledge.ts` with `tsx` (Node `v24.19.0`, the locked, already installed `node_modules`; nothing installed). It measured the character length of the system prompt, the embedded product knowledge, the three strict tool schemas as sent, four synthetic request bodies built in the current DTO shape and three representative outputs. No network access and no provider call. The script was deleted afterwards; `git status` was clean apart from this evidence.

The repository contains **no** measured token counts, latency or cost for any planner call (confirmed by a source search: no code reads provider `usage`; `docs/evidence/planner/live-test.json` stores request bodies only). Token counts in the ADR are therefore ESTIMATES from these character counts.

## Validation

- Consistency check (scratch script, not committed): **PASS**. It checks that the case IDs are S01–S40 in order, that every recipient record is `incomplete` with listed unknowns, that the three JSON files parse, that the ADR has sections 1–22 and AI-1 to AI-10, that relative links in the ADR and this README resolve, and that `DECISIONS.md` has the 0013 row and no conflict markers.
- Existing planner regressions (no code changed; no provider calls): `node --import tsx --test tests/regressions/planner.test.ts tests/regressions/protocol-conformance.test.ts tests/regressions/native-planner.test.ts` → **31 passed, 0 failed** on `ff3e291` plus this documentation.

## Primary sources (retrieved 30 September 2026)

Retrieved with WebFetch/curl. Pages marked "search snippet" could not be fetched (HTTP 403 bot challenge on `openai.com` and `help.openai.com`); their facts are lower confidence and must be rechecked in a browser before any public statement. No account was signed into; nothing was accepted.

**OpenAI**
- Models list and model pages: `https://developers.openai.com/api/docs/models`, `/models/gpt-6.1-sol`, `/models/gpt-6-luna` (IDs, context, efforts: Sol "The none and minimal reasoning efforts are not supported"; Luna Chat Completions tools only with effort none; data residency; rate limits).
- Pricing: `https://developers.openai.com/api/docs/pricing` (standard/batch/flex/fast; "Regional processing (data residency) endpoints are charged a 10% uplift for models released on or after March 5, 2026").
- Data controls: `https://developers.openai.com/api/docs/guides/your-data` (no training unless opt-in; abuse logs up to 30 days; Responses 30-day application state unless `store` false; ZDR/MAM "subject to prior approval"; non-US residency needs approval; default human review **not stated**; default log region **not stated**; no legal-hold statement).
- Prompt caching: `https://developers.openai.com/api/docs/guides/prompt-caching` (KV tensors in GPU-local storage; `in_memory` ~5–10 min up to 1 h; extended up to 24 h; 1,024-token minimum; cache read 0.05× for GPT-6.1 Sol; write 1.25×).
- API reference (`store` defaults to true; `safety_identifier` ≤ 64 chars; `user` deprecated) and `https://developers.openai.com/api/docs/guides/safety-best-practices` (hash identifiers).
- Production best practices and rate limits: `https://developers.openai.com/api/docs/guides/production-best-practices`, `/guides/rate-limits` (per-project spend limits; hard limit returns 429; usage tiers Free/Build/Launch/Grow).
- Codex/ChatGPT availability: `https://developers.openai.com/codex/models` → `learn.chatgpt.com/docs/models` (GPT-6.1 Sol in Work and Codex, not in Chat).
- DPA v.010126: `https://cdn.openai.com/pdf/openai-data-processing-addendum.pdf` (OpenAI OpCo, LLC; OpenAI Ireland Ltd for EEA/CH; subprocessor list URL; §2.11 return/delete).
- Search snippet only: data-sharing for complimentary daily tokens (`help.openai.com/en/articles/10306912-…`), restricted-key scopes (`help.openai.com` article 8867743).

**Anthropic**
- `https://platform.claude.com/docs/en/about-claude/models/overview`, `/about-claude/pricing`, `/build-with-claude/structured-outputs`, `/manage-claude/api-and-data-retention`, `/manage-claude/data-residency`, `/manage-claude/workspaces`, `/api/rate-limits`, `/api/service-tiers`, `/api/messages/create`.
- `https://www.anthropic.com/legal/commercial-terms`; `https://privacy.claude.com/en/articles/7996866`, `/7996890`, `/15425996`; `https://support.claude.com/en/articles/11174108` (Development Partner Program).
- Conflict recorded: the Privacy Center says 30-day deletion, while the API data-retention page says "not retained by default" except Covered Models.

**Google**
- `https://ai.google.dev/gemini-api/docs/models`, `/pricing`, `/function-calling`, `/zdr`, `/usage-policies`, `/logs-policy`, `/billing`, `/api-key`, `/rate-limits`; `https://ai.google.dev/gemini-api/terms` (last modified 2026-04-28).

**Hosting and Apple**
- Cloudflare: `https://developers.cloudflare.com/workers/platform/pricing/`, `/workers/platform/limits/` ("There is no hard limit on duration for HTTP-triggered Workers"), `/workers/configuration/secrets/`, `/workers/runtime-apis/bindings/rate-limit/`, `/durable-objects/`, `/durable-objects/platform/pricing/`, `/durable-objects/reference/data-location/`, `/workers/observability/logs/workers-logs/`, `/ai-gateway/observability/logging/`, `/ai-gateway/features/spend-limits/`, `/data-localization/`; `https://www.cloudflare.com/cloudflare-customer-dpa/`.
- Supabase: `https://supabase.com/pricing`, `/docs/guides/functions/limits`, `/docs/guides/functions/logging` (invocation logs capture headers and body), `/docs/guides/auth/auth-anonymous`, `/docs/guides/functions/regional-invocation`, `/docs/guides/functions/examples/rate-limiting`.
- Vercel: `https://vercel.com/docs/functions/limitations`, `https://vercel.com/pricing`.
- Apple: `https://developer.apple.com/documentation/devicecheck/dcappattestservice/issupported` (value is false in an app on a Mac, including Mac Catalyst; verified from the documentation JSON), `/documentation/devicecheck/dcdevice` (macOS 10.15, Mac Catalyst 13.1; runtime support on a Mac unverified), `https://developer.apple.com/help/account/reference/supported-capabilities-macos`, App Review Guideline 4.8.

## What was not done

No provider or hosting account was created or signed into, no terms were accepted, no key or secret was created, no live model call was made, nothing was deployed and nothing was spent. No runtime behaviour, test or product copy changed.
