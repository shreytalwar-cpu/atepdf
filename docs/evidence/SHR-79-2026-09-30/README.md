# SHR-79 evidence — consumer AI service, provider data policy and operating budget (30 September 2026)

**Source:** `origin/main` `7853973`.  **Decision record:** [ADR 0014](../../adr/0014-consumer-ai-service.md), approved by Shrey on 30 September 2026 (AI-1 to AI-10; revision 2 with Vercel + Supabase, GPT-6 Luna and a Supabase-based identity model). Revision 1 was numbered ADR 0013. That number now belongs to SHR-49's approved complex-PDF decision.

| File | Content |
|---|---|
| [service-protocol-cases.json](service-protocol-cases.json) | 44 mock protocol and failure cases (S01–S44) for SHR-80/81/82. They cover authentication, installation linking, schema/class-H denial, idempotency without stored bodies, concurrency leases, allowance vs technical vs budget refusals, provider errors, timeouts, invalid output, cancellation, late responses, relaunch, offline, key/host pinning, the exact Luna request shape with explicit prompt caching, Supabase exposure and privileges, and an end-to-end log canary. Synthetic identities and hosts only. |
| [recipient-disclosures.json](recipient-disclosures.json) | Draft ADR 0012 `RecipientDisclosure` records for the atePDF service, Vercel, Supabase and OpenAI. **All `incomplete`**; each lists its `unknownFields`. Supabase is marked as off the instruction route. Production transfer stays blocked until the unknowns are resolved and verified against live configuration. |
| [cost-model.json](cost-model.json) | Measured payload sizes, documented prices and cache rules, estimate assumptions, and the expected Luna production cost. Sol is recorded separately as contingency/eval cost. Also lists the approved ceilings and the fixed platform fees. Every value is labelled MEASURED / DOCUMENTED / ESTIMATE. |

## Measurements (MEASURED)

A temporary, uncommitted script imported `packages/planner/src/schema.ts` and `packages/planner/src/generated/product-knowledge.ts` with `tsx`. It ran on Node `v24.19.0` using the locked, already-installed `node_modules`; nothing was installed. It measured the character length of:
- the system prompt;
- the embedded product knowledge;
- the three strict tool schemas as sent;
- four synthetic request bodies in the current DTO shape;
- three representative outputs.

It made no network access and no provider call, and it was deleted afterwards. The repository contains **no** measured token counts, latency or cost for any planner call, so token counts in the ADR are ESTIMATES from these character counts.

## Validation

- **Consistency check** (scratch script, not committed). It checks that:
  - case IDs run S01–S44 in order;
  - every recipient record is `incomplete` with listed unknowns, and Supabase is off the instruction route;
  - the three JSON files parse;
  - the ADR has sections 1–22 and AI-1 to AI-10 marked approved;
  - the ADR's provider request uses `prompt_cache_options` and does not set `prompt_cache_retention`;
  - relative links in the ADR and this README resolve;
  - no file still links to the revision-1 ADR path;
  - `DECISIONS.md` has the 0014 row, keeps SHR-49's ADR 0013 and has no conflict markers.
- **Planner regressions:** see the PR description for the latest run. No code changed, and no provider calls were made.

## Primary sources (retrieved 30 September 2026)

Pages were retrieved with WebFetch or curl. Pages marked "search snippet" could not be fetched (HTTP 403 bot challenge on `openai.com` and `help.openai.com`). Their facts are lower confidence and must be rechecked in a browser before any public statement. No account was signed into, and nothing was accepted.

**OpenAI**
- Models list and model pages: `https://developers.openai.com/api/docs/models`, `/models/gpt-6-luna`, `/models/gpt-6.1-sol`.
  - Luna efforts run `none` to `max`, and EU residency is available with Standard, Flex and Batch.
  - Sol: "The none and minimal reasoning efforts are not supported".
- Pricing: `https://developers.openai.com/api/docs/pricing`. Covers the standard, batch, flex and fast tiers. On data residency: "Regional processing (data residency) endpoints are charged a 10% uplift for models released on or after March 5, 2026".
- Data controls: `https://developers.openai.com/api/docs/guides/your-data`.
  - No training unless the organisation opts in.
  - Abuse-monitoring logs are kept up to 30 days.
  - Responses keeps 30-day application state unless `store` is false.
  - ZDR and MAM are "subject to prior approval".
  - Non-US residency needs approval.
  - On caching: "Prompt caching may store encrypted key/value tensors in GPU-local storage as application state".
  - Default human review is **not stated**, and neither is the default log region.
- Prompt caching: `https://developers.openai.com/api/docs/guides/prompt-caching`. The raw markdown was downloaded and read in full. For GPT-5.6 and later:
  - Explicit and implicit modes are set by `prompt_cache_options.mode`, with `prompt_cache_breakpoint` marking breakpoints.
  - "Top-level `instructions` cannot contain an explicit breakpoint".
  - In explicit mode, content after the last breakpoint is billed uncached with no cache write.
  - `prompt_cache_options.ttl`: "The only supported value, `30m`, is also the default … though OpenAI may retain it longer".
  - `prompt_cache_retention` (`in_memory` / `24h`) is for earlier models only. The migration step reads "Replace `prompt_cache_retention` with `prompt_cache_options.ttl`".
  - `prompt_cache_key` is optional.
  - The minimum cacheable prefix is 1,024 tokens.
  - Cache writes cost 1.25×. Reads cost 0.1×, or 0.05× on GPT-6.1 Sol.
- API reference: `store` defaults to true; `safety_identifier` is limited to 64 characters. `https://developers.openai.com/api/docs/guides/safety-best-practices` says to hash identifiers.
- Production best practices and rate limits: `/guides/production-best-practices` and `/guides/rate-limits`. Per-project spend limits exist, and a hard limit returns 429.
- Codex and ChatGPT availability: `https://developers.openai.com/codex/models`, which redirects to `learn.chatgpt.com/docs/models`.
- DPA v.010126: `https://cdn.openai.com/pdf/openai-data-processing-addendum.pdf`.
- Search snippet only: the data-sharing programme for complimentary tokens, and restricted-key scopes.

**Vercel**
- `https://vercel.com/docs/logs/runtime`, read directly:
  - captured fields: request method, path, search params, status, host, user agent, region, firewall, function metadata, outgoing requests and console output;
  - retention: Pro 1 day, or Pro with Observability Plus 30 days.
- `https://vercel.com/docs/observability/observability-plus`, read directly. It says "For teams created or upgraded to Paid Pro on or after April 3, 2026, Observability Plus is enabled by default", and that projects can be excluded.
- Via the research agent:
  - `/docs/limits/fair-use-guidelines`: Hobby is "restricted to non-commercial personal use only".
  - `/docs/plans/pro-plan` and `/docs/functions/usage-and-pricing`.
  - `/docs/fluid-compute`.
  - `/docs/spend-management`: production pause, with a lag of several minutes.
  - `/docs/environment-variables/sensitive-environment-variables`.
  - `/docs/deployment-protection`.
  - `/docs/vercel-firewall/vercel-waf/rate-limiting`.
  - `/docs/functions/configuring-functions/region` and `/docs/regions`: `iad1` default and regional rerouting.
  - `/docs/drains/reference/logs`: `proxy.clientIp`, `proxy.path` with query.
  - `https://vercel.com/legal/dpa`, `https://security.vercel.com/subprocessors`.
  - The March 2026 terms changelog on AI-training data preferences.

**Supabase** (docs source in `github.com/supabase/supabase`, plus supabase.com pages)
- Pricing: Pro from $25; Free pauses after a week of inactivity.
- Auth:
  - `auth-anonymous`: 30 anonymous sign-ins per hour per IP; CAPTCHA recommended; no automatic cleanup; manual linking needed for conversion.
  - `social-login/auth-apple`: native `signInWithIdToken`; no secret rotation for native-only use.
  - `auth-smtp`: the built-in mailer is not for production and allows 2 emails per hour.
  - `auth-email-passwordless` and `sessions/pkce-flow`.
  - `signing-keys` (ES256 JWKS) and `sessions`.
  - `rate-limits` and `audit-logs`: 7 days on Pro.
- Database and logs:
  - `database/connecting-to-postgres`: transaction pooler on port 6543, no prepared statements.
  - `getting-started/api-keys`.
  - `observability/log-field-reference`: the gateway logs path, query string and IP, with no body fields.
  - `database/postgres/postgres-log-config`: `log_min_error_statement = error`.
  - `platform/backups`: 7 days on Pro.
  - `platform/regions`.
- Legal and accounts:
  - `auth/managing-user-data`: `deleteUser` cascade.
  - `https://supabase.com/legal/dpa`: the entity is Supabase Pte. Ltd.
  - Subprocessor list PDF dated 1 June 2026.

**Apple**
- `https://developer.apple.com/documentation/devicecheck/dcappattestservice/issupported`, from the documentation JSON: "If you read `isSupported` from an app running on a Mac device, the value is false. This includes Mac Catalyst apps".
- `/documentation/devicecheck/dcdevice`: macOS 10.15 and Mac Catalyst 13.1; runtime support on a Mac is unverified.
- `https://developer.apple.com/help/account/reference/supported-capabilities-macos`, parsed from the page. **Sign in with Apple and In-App Purchase are ticked only under the App Store program column, not Developer ID.** This corrects revision 1, which said Developer ID also had Sign in with Apple.

**Anthropic and Google** (provider comparison; unchanged from revision 1)
- `platform.claude.com` model, pricing, structured outputs, data retention, data residency, workspaces and rate-limit pages; `anthropic.com/legal/commercial-terms`; `privacy.claude.com`.
- `ai.google.dev/gemini-api` models, pricing, terms, ZDR, usage policies, logs, billing and rate-limit pages.

**Cloudflare** (the hosting alternative B/C in section 9; revision 1 research)
- `developers.cloudflare.com` pages on Workers pricing, limits, secrets, the rate-limit binding, Durable Objects, Workers Logs, AI Gateway and data localisation.

## What was not done

- No provider, Vercel or Supabase account or project was created or signed into.
- No terms were accepted, and no key or secret was created.
- No live model call was made, nothing was deployed and nothing was spent.
- No runtime behaviour, test or product copy changed.
