# ADR 0013 — Consumer AI service, provider data policy and operating budget (SHR-79)

**Status:** **Proposed — pending owner decision** (AI-1 to AI-10, section 21). Nothing here is approved, implemented, provisioned or configured. It creates no account, accepts no terms, makes no provider call and spends nothing.  **Source:** `origin/main` `ff3e291` (30 September 2026).  **Authority:** `PRODUCT_V1.md` D-03/D-04/D-06/D-07/D-08, CONV-02/07/08/09, PRIV-01–11, BILL-01–08, ARCH-02–04, MEASURE-03/04, OPEN-09; [SHR-79](https://linear.app/shrey-talwar/issue/SHR-79/decide-the-consumer-ai-service-provider-data-policy-and-operating) (parent SHR-27); approved [ADR 0012](0012-pre-send-privacy-consent.md) (the data classes, `RecipientDisclosure`, retry and log rules this ADR must satisfy); approved [ADR 0011](0011-mac-launch-envelope.md) (macOS 14, Universal).  **Evidence:** [docs/evidence/SHR-79-2026-09-30](../evidence/SHR-79-2026-09-30/README.md): primary sources with retrieval dates, draft recipient disclosures, the cost model and 40 mock protocol/failure cases.

This ADR chooses the **smallest** production service that lets a consumer Mac use atePDF's hosted planner without an API key: a thin, authenticated relay that holds the provider key, admits requests, bounds spend and forwards one class-H request to one model provider. It is not a general backend, an agent platform or a document service. Documents, local understanding, secrets and PDF execution stay on the Mac (ARCH-02).

**Labels used for numbers.** **MEASURED** = measured in this repository today. **DOCUMENTED** = read from the vendor's primary documentation on 30 September 2026 (source in the evidence README). **ESTIMATE** = derived by stated assumptions; not measured. **UNKNOWN** = not verifiable today; blocks production where ADR 0012 requires it.

## 1. Current source (what exists today)

| Item | Fact (source) |
|---|---|
| Provider transport | One outbound path: local gateway → OpenAI Responses API via Vercel AI SDK `generateText` (`packages/planner/src/provider.ts:8-24`). `MODEL='gpt-6-luna'` hard-coded; `reasoningEffort:'none'`, `store:false`, `strictJsonSchema:true`, `toolChoice:'required'`, `maxRetries:0`, telemetry off. No `maxOutputTokens` (ADR 0007 removed the earlier 2,000 cap). |
| Tools | Three strict tools: `run_local_pdf_workflow`, `undo_last_change`, `reply_in_chat`; exactly one call required, re-validated and bound by `bindResponse` (`schema.ts:37-50`). |
| Payload | `JSON.stringify(request)` of the projected DTO (`request.ts:15`): instruction ≤ 1,000 chars, ≤ 40 files with **exact** `sizeBytes` and page counts for all retained artifacts (ADR 0012 gap G1). |
| Gateway | Single-user local development gateway (`gateway.ts`): loopback only, per-process token or one-use native pairing, one request at a time, 1.5 s minimum interval, 24,000-byte body cap, duplicate `requestId` rejection, ≤ 200 requests per process, file-lock request allowance, 30 s provider deadline, fixed error messages, no logging of bodies. |
| Key | Developer key in `.local/openai-key` (0600). `OPENAI_BASE_URL` in the environment can redirect traffic (ADR 0012 G7). |
| Accounting | **None.** No code reads provider `usage`; no token, cost or latency is recorded anywhere (security audit; code map). |
| Accounts/entitlements | None. `packages/commerce` is synthetic and disabled (`COMMERCE_ENABLED=false`). |
| Measured tokens/latency | **None recorded.** `docs/evidence/planner/live-test.json` holds 2 request bodies and no usage. |

**Payload sizes (MEASURED, offline, no provider call).** Fixed prefix sent on every call: system prompt 2,269 chars + embedded product knowledge 8,196 chars + tool schemas 3,929 / 76 / 542 chars = **15,012 chars**. Representative request bodies: simple merge 724; follow-up with 14 retained artifacts 2,030; clarification answer 1,117; four-step request 1,003. Representative outputs: one-step plan 302; four-step plan 1,350; clarification 140. Method in the evidence README.

**Gaps against the target (for Linear triage, not fixed here).** G-A: `PRIVACY_TEST_REPORT.md:25`, `PLANNER_EVALUATION.md:24,45` and `docs/evidence/native/planner-budget-current.json` still describe a 2,000-token cap the code no longer sets; the latter records `gpt-5.6-luna`. G-B: Swift client timeouts (35 s request / 40 s resource, `AtepdfPlannerTransport.swift:171`) are shorter than the proposed relay deadline (section 11). G-C: the model is a code constant, not server configuration bound to a disclosure version.

## 2. Architecture

```
 Mac (atePDF app)                         atePDF relay (Cloudflare Workers)                 Model provider (OpenAI)
 ───────────────────────────────          ─────────────────────────────────────           ─────────────────────────
 local documents, PDF engines,            Worker (stateless, per request):                  Responses API, pinned host,
 local understanding, secure       TLS    authenticate → validate schema/class H   TLS     store:false, strict tools,
 password field, workspace   ───────────► → ADR 0012 checks 1–7 → admit      ──────────►  one model from the approved
 ADR 0012 OutboundGate + UI     (1)       → call provider → validate → reply       (2)     table; no other tools
 plan validation + JobController ◄───────                                   ◄──────────
                                          Durable Objects (SQLite, US jurisdiction):
                                          • Subject object: concurrency slot, idempotency
                                            records, rate/cost counters, allowance hook
                                          • Budget ledger: global daily/monthly spend,
                                            kill switch
                                          Secrets: provider key, token-signing key, HMAC salts
 (1) carries class H + relay-only identity; (2) carries class H only + an opaque HMAC safety identifier
```

| Responsibility | Mac client | atePDF relay | Model provider |
|---|---|---|---|
| Documents, bytes, OCR, local understanding, file names, paths | **Owns, never sends** (class C/N) | Never receives | Never receives |
| Password/secret input | Secure field only (D-14) | Never receives | Never receives |
| Outbound privacy gate | ADR 0012 checks 1–10 before every write and retry | Mirrors checks 1–7 + route pinning (defence in depth) | — |
| User-visible disclosure and consent | Class-A disclosure, destination indicator, local-only mode | Reports its `disclosureVersion` on every response | — |
| Installation/account identity | Generates and guards the installation key | Registers installations, issues short-lived tokens, links accounts | Sees only an opaque HMAC |
| Entitlement/allowance | Shows state; never proof (BILL-06) | Enforces server-side via the SHR-84 interface | — |
| Idempotency, concurrency, rate, spend | Sends one request per logical attempt | **Owns** | Its own rate limits and project budget as backstop |
| Provider key | Never present | **Only holder** (secret) | Issues/revokes |
| Planning | Builds context projection; validates response against revision | Chooses model/prompt version from server config; validates structure | Proposes exactly one tool call |
| Execution and verification | **Owns** (JobController, local engines, Undo) | Never | Never |
| Logs | Local contentless log, 7 days (ADR 0012 PRIV-6) | Contentless operational log (section 17) | Provider abuse-monitoring logs (section 7) |

**Not in the relay:** document upload endpoints, file storage, response caching, conversation storage, analytics, AI Gateway, vector stores, background jobs, a second provider, a general proxy.

## 3. Production request contract

### 3.1 Transport

`POST https://<relay-host>/v1/plan` over TLS 1.2+ (the host name is **UNKNOWN** until the owner registers a domain; it becomes a pinned value in the recipient record). Headers: `Authorization: Bearer <access token>` (N-04: transport, not payload), `Content-Type: application/json`, `Atepdf-Build: <app build>`. No cookies. Body ≤ 24,000 bytes (unchanged from today).

### 3.2 `PlanRequest/2` (class H, aligned with ADR 0012 PRIV-1)

```ts
type PlanRequest = {
  schema: 'atepdf.plan-request/2';
  requestId: string;              // 'req_' + 32 hex, random per logical request; also the idempotency key
  attempt: 1 | 2;                 // transport attempt of the same requestId (AUTO_RETRY_LIMIT hosted = 1)
  supersedes: string | null;      // requestId of an earlier attempt whose response was lost ("Try again")
  disclosureVersion: string;      // hostedDisclosureVersion the user acknowledged (ADR 0012 §4 A)
  policyVersion: string;
  context: {                      // the only part forwarded to the model
    workspaceRevision: number;    // H-04
    locale: string;               // BCP-47 from an allowlist (today 'en-IN')
    instruction: string;          // H-01, ≤ 1,000 chars after local guards (ADR 0012 §6)
    artifacts: Array<{            // ACTIVE projection only (PRIV-1): current result, selected originals,
      ref: string;                //   pending-clarification targets; ≤ 40; opaque 'file_'/'out_' + 32 hex (H-03)
      kind: 'pdf';
      role: 'selected' | 'focused' | 'original' | 'pending_target';
      order: number;              // user order within the selection
      pageCount: number;          // H-06
      sizeBucket: '<1MB' | '1-10MB' | '10-50MB' | '>50MB';   // H-07 FILE_SIZE_BUCKETS, never exact bytes
    }>;
    pendingClarification: null | {  // H-02, bounded as today
      originalRequestId: string; originalInstruction: string;
      question: string; choices: string[];            // model-authored, ≤ 6
      answers: Array<{ question: string; answer: string }>;  // ≤ 3 earlier user answers
    };
    lastOutcome: null | { status: 'completed' | 'failed' | 'cancelled' | 'undone'; outputPageCount: number | null }; // H-08
    capabilities: string[];       // H-04 operation vocabulary for this build
    selectors: string[];          // H-05 abstract selector vocabulary (capabilities, never results)
    ocrLanguages: string[];
  };
};
```

**Excluded by schema (default deny, ADR 0012 check 1):** document bytes, rendered pages, file names (full or partial), paths, OCR/extracted text, local-understanding outputs (labels, blank/scan flags, dates, amounts, vendors, summaries), embeddings and hashes, embedded document metadata, exact sizes and dates, history artifacts outside the active projection, previous plans, device or hardware identifiers, installation/account IDs, IP-derived data, model/endpoint choice, free-form "debug" or "metadata" fields. An unknown key is `400 unclassified_field`.

**Relay-only fields** (`attempt`, `supersedes`, `disclosureVersion`, `policyVersion`, and the bearer token) are H-09 and are **never** forwarded into model context. `requestId` is not forwarded either; the relay binds the response to it.

**ADR 0012 amendment requested with this ADR.** Section 3 of ADR 0012 requires an amendment before a new field is admitted. On approval of AI-5 and AI-8 the following are classed: `attempt`, `supersedes`, `disclosureVersion`, `policyVersion` → H-09 (relay only); `artifacts[].role`, `artifacts[].order` → H-03; `lastOutcome` → H-08; `sizeBucket` → H-07 (already approved as buckets). If AI-5 adopts DeviceCheck, its token is H-09 relay-only and is forwarded only to Apple's DeviceCheck service (section 7, record R-4).

### 3.3 `PlanResponse/2` and errors

```ts
type PlanResponse = {
  schema: 'atepdf.plan-response/2';
  requestId: string; workspaceRevision: number;     // echoed; the client rejects any mismatch
  disclosureVersion: string;                          // relay's current version; mismatch blocks the next send
  planner: PlannerResponse;                           // existing shape: plan | clarify | answer | unsupported | undo
  service: { modelConfigId: string; admission: 'ok' };  // contentless; no cost or token data to the client
  entitlement: EntitlementState;                      // defined by SHR-84; commercial only
};
type ServiceError = {
  schema: 'atepdf.service-error/1'; requestId: string | null;
  code: 'auth_required' | 'token_expired' | 'identity_blocked' | 'request_too_large' | 'unclassified_field'
      | 'never_transfer' | 'disclosure_changed' | 'client_outdated' | 'already_completed' | 'in_progress'
      | 'idempotency_mismatch' | 'concurrency_limit' | 'rate_limited' | 'request_too_expensive'
      | 'allowance_exhausted' | 'service_paused' | 'provider_busy' | 'provider_timeout'
      | 'provider_unavailable' | 'provider_config_error' | 'invalid_model_output' | 'cancelled' | 'internal';
  retryable: boolean; retryAfterSeconds: number | null;
};
```

Error bodies never echo request content, provider error bodies or secrets (N-10). Only `allowance_exhausted` (HTTP 402) may lead to upgrade copy; every technical or budget refusal uses non-commercial copy (BILL-07).

### 3.4 Relay → provider request (the only thing the provider receives)

`POST https://<pinned OpenAI host>/v1/responses` with: `model` from the server's approved-model table; `instructions` = the pinned system prompt version; `input` = the JSON of `context` only; the three strict tools with the pinned tool-description version; `tool_choice: required`; `parallel_tool_calls: false`; `store: false`; `reasoning.effort` from config; `max_output_tokens` ceiling (section 14); `safety_identifier` = opaque HMAC (section 4); `prompt_cache_key` = prompt version ID (not per user); `prompt_cache_retention: in_memory` where the model accepts it (UNKNOWN for `gpt-6.1-sol`; see R-3). **Never set:** `metadata`, `previous_response_id`, `conversation`, `background`, built-in tools (web search, file search, code interpreter), Files, Batch, vector stores. Endpoint overrides (`OPENAI_BASE_URL` or similar) make the relay refuse to start (case S34).

## 4. Identity

Three distinct identities. None is a device or hardware identifier (N-07), and none reaches model context.

| Identity | What it is | Where it lives | Who sees it | Lifetime |
|---|---|---|---|---|
| **Installation** (guest) | A P-256 key pair generated on first hosted use, plus a random `inst_` ID **issued by the relay** at registration | Private key in the Data Protection Keychain (Secure Enclave-backed where the Mac has one); `inst_` ID in the protected workspace settings | Relay only | Until the user resets it, the Keychain item is removed or the relay blocks it |
| **Account** | Relay `acct_` ID linked to a login method chosen later (BILL-09/OPEN-04; Sign in with Apple is available on macOS 10.15+ for both App Store and Developer ID, DOCUMENTED) | Relay | Relay; the login provider | Until account deletion |
| **Provider end-user identifier** | `HMAC-SHA256(PROVIDER_ID_SALT, subjectId)` truncated to 32 hex, sent as `safety_identifier` (OpenAI: ≤ 64 chars, "hash … to avoid sending us any identifying information", DOCUMENTED) | Computed per request; salt is a relay secret | OpenAI | Stable per subject while the salt is unchanged |

**Registration and tokens.** `POST /v1/installations` with the public key → relay stores `{inst_, publicKey, createdAt, status}` and returns `inst_`. `POST /v1/token` signs a relay nonce with the installation key → a **15-minute** access token (Ed25519-signed by the relay, audience `plan`, subject `inst_` or `acct_`). No refresh tokens; a new token is one signature away. Tokens are memory-only on the Mac.

**Why not App Attest.** Apple's `isSupported` page states the value is false in an app on a Mac, including Mac Catalyst apps (DOCUMENTED). Hardware attestation is not available to atePDF v1.

**Abuse bounds without fingerprinting.**
- Registration rate limit per network address: 5 new installations per hour (Cloudflare Rate Limiting binding, per location, coarse). The address is only the limiter key; it is never logged or stored.
- Global new-guest registrations per day capped by budget option (section 16), with alert.
- Each guest can spend at most its allowance (SHR-84) and at most the per-subject daily technical ceiling (section 14); global caps bound the total.
- Optional, **only if an on-device test proves it works on a Catalyst Mac app** (runtime support UNKNOWN; the class is documented for Mac Catalyst 13.1+ and macOS 10.15+ without a Mac exclusion note): Apple DeviceCheck two bits to record "a guest allowance was started on this device", which survives reinstall without atePDF seeing a device identifier. Apple becomes a recipient of an ephemeral token (record R-4). Default: **off** until tested and approved.
- Accepted residual risk (BILL-06): a determined user can reset guest identity by deleting the Keychain item. Persistence of the Keychain item across app reinstall must be verified on device.

**Upgrade.** Account sign-in links `inst_` → `acct_` server-side. The guest allowance state moves with it; it is not reset or topped up (D-07, case S37). Pro entitlement is verified by the relay from the channel's server-side record (StoreKit / direct payment, SHR-84/OPEN-04), never from a client claim.

## 5. Provider options (primary sources, 30 September 2026)

All prices are USD per 1M tokens, standard tier, short context (DOCUMENTED). "Structured" = strict schema-constrained tool calls.

| | **OpenAI GPT-6.1 Sol** | **OpenAI GPT-6 Luna** | Anthropic Claude Sonnet 5.5 | Anthropic Claude Opus 5.5 | Google Gemini 3.8 Flash (Developer API) |
|---|---|---|---|---|---|
| API ID | `gpt-6.1-sol` | `gpt-6-luna` | `claude-sonnet-5-5` | `claude-opus-5-5` | `gemini-3.8-flash` |
| Positioning | "near-Astra performance at a lower cost" | "most efficient model for focused, high-volume tasks" | Mid tier | Anthropic's default recommendation | Stable Flash; Pro is preview only |
| Input / cached / output | $2.00 / $0.10 / $10.00 (cache write $2.50) | $0.10 / $0.01 / $0.50 (write $0.125) | $2 / $0.20 hit / $10 | $4 / $0.20 / $20 | $0.75 / $0.075 / $3.75 until 31 Dec 2026, **then $1.50 / $0.15 / $7.50** |
| Reasoning | low … max; **`none` and `minimal` not supported** | none … max | Adaptive | Adaptive, always on | low/medium/high thinking |
| Structured tools | Yes (strict), Responses API for tool calling | Yes (strict); Chat Completions tools only with effort `none` | Yes (`strict: true`, GA) | Yes | Function calling `validated` mode |
| Context / max output | 1.05M / 128K | 1.05M / 128K | 1M / 128K | 1M / 128K | 1.05M / 65K |
| Rate limits (lowest paid tier) | 500 RPM / 500K TPM | 500 RPM / 500K TPM | Start: 1,000 RPM | same | UNKNOWN (dashboard only) |
| Training on API data | No by default ("unless you explicitly opt in") | same | No ("may not train models on Customer Content") | same | Paid tier: no. **Free tier: yes, with human reviewers** |
| Default retention | Abuse-monitoring logs up to 30 days; Responses app state 30 days unless `store:false` | same | 30 days (Privacy Center; the API docs say "not retained by default" — conflict UNKNOWN); flagged up to 2 years, classifier scores up to 7 years | same | Abuse monitoring 55 days |
| Zero/limited retention | ZDR or Modified Abuse Monitoring by sales approval | same | ZDR by sales; flagged content still up to 2 years | same | **None on the Developer API** ("use Vertex AI") |
| Human review | Default org: **not stated** on the data-controls page (UNKNOWN); classifier-flagged "Safety Retention" may be human-reviewed | same | Flagged content only, approved reviewers | same | Authorized employees may assess flagged content |
| Region | Data residency per project (US, EU and others; non-US needs approval; **+10%** price for models released after 5 Mar 2026); Sol: US and EU only | US/EU etc. | `inference_geo: "us"` (+10%); storage at rest US only | same | No region selection |
| End-user ID | `safety_identifier` (≤ 64) | same | `metadata.user_id` (opaque) | same | None found |
| Spend control | Project budgets: alerts, or hard limit returning 429 | same | Workspace monthly spend limits | same | Project caps "experimental"; ~10 min overage |
| Contracting entity | OpenAI OpCo, LLC (non-EEA); OpenAI Ireland Ltd (EEA/CH) | same | Anthropic, PBC; Anthropic Ireland (EEA/CH/UK) | same | "Google" per Cloud terms (entity UNKNOWN) |

Excluded: Claude Fable 5.1 (mandatory 30-day retention, not ZDR-eligible, $10/$50), Claude Haiku 4.5 (retirement possible from 15 October 2026, no `inference_geo`), GPT-6 Astra ($10/$50, no benefit for a four-tool planner), Gemini free tier (trains on and human-reviews data; may not be offered to EEA/UK/CH users), Gemini 3.1 Pro (preview only).

**Assessment.** Planner quality is unmeasured for every candidate (SHR-107 has no model results yet). On the facts available:
1. **OpenAI** keeps the existing strict-tool transport, prompt and 118-case corpus, offers the cheapest credible model (Luna) and a stronger model (Sol) behind the **same recipient and the same retention terms**, supports a per-request opaque safety identifier, project-level hard budgets, a definite US data region and a ZDR/Modified Abuse Monitoring path.
2. **Anthropic** is a credible alternative with clear contractual no-training terms and a US-only inference option, at the same list price as Sol for Sonnet 5.5 (its tokenizer produces about 30% more tokens for the same text, DOCUMENTED), but it needs a transport change, a new eval baseline and has conflicting default-retention statements.
3. **Gemini Developer API** fails ADR 0012 expectations today: 55-day abuse retention, no ZDR or region choice, experimental spend caps, and a price doubling on 1 January 2027.

## 6. Model and routing

### 6.1 GPT-6.1 availability (task 5)

| Surface | GPT-6.1 Sol | Evidence |
|---|---|---|
| Public OpenAI API (Responses, Chat Completions, Batch) | **Available**, ID `gpt-6.1-sol` (snapshot has the same name) | Model page and model list (DOCUMENTED) |
| Codex / "Work" (the development environment) | Available | Codex models page: Astra, 6.1 Sol, 6 Sol, 6 Luna are "available in Work and Codex" |
| ChatGPT chat | Not available ("aren't available in Chat") | same |
| Parity between Codex and API behaviour | **Not assumed.** Codex applies its own harness, prompts and effort defaults. Only API measurements under SHR-107/108 count. | — |
| Constraints | No `none`/`minimal` effort, so every call spends reasoning tokens and latency; tools via Responses API; Fast mode not with EU residency | Model page |

### 6.2 Recommendation (AI-2)

- **One provider (OpenAI), one default model per release, no per-request routing in v1.** Routing adds a second failure mode, doubled latency on escalation and a harder eval; the cost difference does not justify it before measurement.
- **Candidate ladder for SHR-108:** (a) `gpt-6-luna` effort `none`; (b) `gpt-6-luna` effort `low`; (c) `gpt-6.1-sol` effort `low`. **Choose the cheapest candidate that passes every hard gate and matches the best candidate's held-out quality within the SHR-108 tolerance**, and meets the latency target (p95 ≤ 10 s per planner call, a proposed target; latency is UNKNOWN for all candidates).
- **Provisional default until SHR-108 reports:** `gpt-6.1-sol`, effort `low`, for any owner-authorised private evaluation, and **budgets are sized on Sol pricing** (section 15). Reliability first: a later move to Luna only lowers cost. Sol's list price is 20× Luna's, but at planner sizes that is about $0.008 versus $0.0003 per call (ESTIMATE).
- Both candidates share one recipient record (OpenAI, same retention/training terms), so switching between approved models does not change the class-A disclosure. It does change `modelConfigId` and must pass the section 19 promotion rule.
- Escalation (Luna first, Sol on invalid output) is an allowed **SHR-108 experiment**, not a v1 default.

## 7. Recipient disclosures (ADR 0012 section 9)

Machine-readable drafts: [`recipient-disclosures.json`](../evidence/SHR-79-2026-09-30/recipient-disclosures.json). **Every record is `status: incomplete`.** Several required fields can only be verified against live account configuration that does not yet exist, and some policy facts are not published. Under ADR 0012 PRIV-7 the gate therefore **denies all production transfer** until each UNKNOWN below is resolved from a primary source or a written provider statement, and the record is re-verified against the real account.

| Field | R-1 atePDF relay (operator) | R-2 Cloudflare (relay host) | R-3 OpenAI (model provider) |
|---|---|---|---|
| Legal entity | **UNKNOWN**: the atePDF legal entity/seller is open (OPEN-04) | Cloudflare, Inc. (self-serve agreement + DPA; processor) | OpenAI OpCo, LLC (non-EEA users); OpenAI Ireland Ltd (EEA/CH) |
| Role | Controller of relay records; operates relay code | Processor; runs the relay code and terminates TLS | Processor (API customer content) |
| Endpoint / route | `https://<relay-host>/v1/plan` (**host UNKNOWN**, pinned once registered) | Same host (Workers custom domain) | Pinned OpenAI API host for the chosen data-residency project (**exact host UNKNOWN** until the project exists; regional hosts follow `eu.api.openai.com`) |
| Parties able to read plaintext | atePDF relay code (in memory) | Cloudflare edge (TLS termination, Worker execution) | OpenAI; its subprocessors per its list |
| Data region | Cloudflare location nearest the user (global edge; regional pinning needs Enterprise Data Localization); Durable Object storage: **US jurisdiction** | same | US data-residency project proposed (AI-4); region of abuse-monitoring logs by default: **UNKNOWN** (not stated) |
| Stored state | **None of the payload.** Durable Objects hold subject ID, counters, idempotency state and a keyed HMAC of the request body for ≤ 15 minutes (conflict detection only) | Only what atePDF code writes (above) | `store:false` → no Responses application state; prompt cache KV tensors in GPU-local storage: `in_memory` "around 5 to 10 minutes … up to one hour", or up to 24 h with extended retention; whether `gpt-6.1-sol` accepts `in_memory`: **UNKNOWN** |
| Abuse-monitoring retention | None | None known | "up to 30 days, unless longer retention is required by law" (without ZDR/MAM) |
| Log retention | Contentless operational log lines, 7 days (Workers Logs, Paid); daily aggregates 400 days | Workers invocation logs **disabled** (they capture headers by default); Workers Logs 7 days for atePDF's own lines | Abuse logs as above |
| Backup retention | None for payload; Durable Object point-in-time recovery for counters: **UNKNOWN** duration | **UNKNOWN** | **UNKNOWN** |
| Training use | None | None (processor) | Not used "unless you explicitly opt in"; data-sharing programme **off** (section 8) |
| Human review | None of content (none stored) | None known | Default org: **UNKNOWN** (not stated); classifier-flagged content may be retained and reviewed under Safety Retention (stated for ZDR/MAM customers) — requires written confirmation |
| Relay logs | Section 17 fields only | — | — |
| Subprocessors | Cloudflare (R-2); OpenAI (R-3); Apple only if R-4 adopted | List at cloudflare.com/gdpr/subprocessors — contents **UNKNOWN** (not reviewed) | List at platform.openai.com/subprocessors — contents **UNKNOWN** (not reviewed) |
| Deletion | No payload to delete; subject records deleted on account/installation deletion (SHR-95) | Per DPA | No per-request deletion for abuse logs; returned or deleted at contract end (DPA §2.11) |
| Outage / failover | No secondary relay host | No failover to another host | **No failover** to any other provider or undisclosed region (AI-3) |
| End-user identifier | Holds `inst_`/`acct_` | Sees them in transit | Opaque HMAC `safety_identifier` only |
| Source / version / date | this ADR, 30 Sep 2026 | developers.cloudflare.com (evidence README), 30 Sep 2026 | developers.openai.com data controls, pricing, model pages; OpenAI DPA v.010126; 30 Sep 2026 |

**R-4 Apple DeviceCheck** (only if AI-5 adopts it): relay → Apple with an ephemeral device token and two bits; no user content. Record not drafted; blocked until adopted and tested.

**Resolution path for UNKNOWNs** (owner or SHR-80 dispatch, not this issue): register the relay domain and legal entity; request written confirmation from OpenAI of default human-review and log-region behaviour; confirm `in_memory` support for the chosen model; review both subprocessor lists; apply for Modified Abuse Monitoring/ZDR (AI-4); then verify every field against the live project settings and bump `disclosureVersion`.

**Proposed class-A disclosure values** (ADR 0012 §7.1), valid only once R-1..R-3 are complete: relay = "atePDF AI (hosted on Cloudflare)"; provider = "OpenAI"; retention = "up to 30 days for abuse monitoring" (or the approved ZDR/MAM wording); training = "not used to train models".

## 8. Optional data sharing for free tokens (task 8)

| Programme | Status (30 Sep 2026) | What it would share | Benefit | Recommendation |
|---|---|---|---|---|
| OpenAI "share inputs and outputs" for complimentary daily tokens | Appears active (help-centre search snippets; the page itself was not fetchable): 250K/day at low tiers up to 1M/day; listed models include `gpt-6-astra`, `gpt-6-sol`, `gpt-6-luna`; `gpt-6.1-sol` eligibility, end date, retention and ZDR compatibility **UNKNOWN** | All API inputs and outputs of the organisation or project, for model improvement/training | At Luna prices, 1M tokens/day ≈ $0.10/day; at Sol ≈ $2–3/day. Negligible versus the privacy cost | **Do not enable.** Violates PRIV-09 and would change every disclosure to "used for training" |
| Anthropic Development Partner Program | Claude Code traffic only; not ordinary API calls; no credit stated | — | None for atePDF | Not applicable |
| Gemini free tier | Free usage in exchange for product-improvement use and human review | All prompts/responses | Free | **Disqualified** (PRIV-09; EEA/UK/CH prohibition) |

Default: the production organisation keeps every data-sharing setting **off**, and SHR-80's configuration check verifies it at deploy time. Any future opt-in needs a separate owner/privacy decision, new disclosure copy and user permission (PRIV-09).

## 9. Hosting options (task 9)

| | **Cloudflare Workers + Durable Objects (recommended)** | Supabase Edge Functions | Vercel Functions |
|---|---|---|---|
| Base cost | Workers Paid **$5/month**: 10M requests, 30M CPU-ms included; "No charge or limit for duration" (waiting on the provider is not billed as CPU) | Pro **$25/month**: 2M invocations included | $20 per seat/month; memory time accrues while waiting |
| Long LLM waits | "No hard limit on duration" while the client is connected | 400 s wall clock (paid), 150 s idle timeout | 300–800 s |
| Strongly consistent counters | **Durable Objects** (SQLite, "transactional, strongly consistent, and serializable") for per-subject slots, idempotency and the budget ledger | Postgres (row locks) — must be built | None comparable |
| Rate limiting | Built-in binding (10 s/60 s windows, per location; coarse abuse only) | None built-in (examples use Upstash Redis) | None built-in |
| Secrets | `wrangler secret`: write-only after set; versioned deploys | `supabase secrets set`; read-back behaviour UNKNOWN | Env vars |
| Auth | Build it: installation key + signed tokens (~150 lines) | Anonymous sign-ins with later linking (built-in; 30/hour/IP; no auto-cleanup) | Build it |
| Default logging | Invocation logs capture request metadata **and headers**; can be disabled; 7-day retention | Docs: invocation logs capture "headers, **body**"; ability to disable **UNKNOWN** | Request logs |
| Region | Global edge; DO storage jurisdiction pinnable (US/EU); full regional execution needs Enterprise | 16 regions, pinnable | Single region default |
| Lock-in | Moderate: DO API is Cloudflare-specific; relay logic is plain TypeScript + `fetch` | Moderate: Postgres portable | Low |
| Solo-founder burden | One deploy tool, no database to operate, no free-tier pausing | Free projects pause after a week idle; database to operate | Seat pricing; state store needed elsewhere |

**Recommendation (AI-1): Cloudflare Workers Paid + SQLite-backed Durable Objects, no AI Gateway, no KV/D1 in v1.** It is the cheapest option that meets the needs, it has the consistent-state primitive that spend and concurrency control require, and it does not log bodies. Supabase's anonymous sign-in is attractive, but its documented default body logging conflicts with ADR 0012 §10 until proven otherwise. AI Gateway is excluded: it logs prompts and responses by default, and its spend limits are "eventually consistent".

Design rule from the pricing: the long provider `fetch` runs in the stateless Worker; Durable Objects are called only for short admit/complete transactions (DO duration is billed as wall-clock time).

## 10. Provider key custody (task 10)

- **Where:** only as Cloudflare Worker secrets (`OPENAI_API_KEY`) per environment. Never in the app, repository, CI logs, Linear, chat, evidence files or crash reports (N-03).
- **Least privilege:** a dedicated OpenAI **project per environment** (`atepdf-dev`, `atepdf-staging`, `atepdf-prod`); a **service-account** key restricted to the Responses capability (restricted-key scopes; DOCUMENTED from search snippets, confirm in the dashboard); organisation policy "allow only service-account keys"; a key expiry date. IP allowlisting is not usable with Workers' shared egress and is not relied on.
- **Environment separation:** separate Workers (`atepdf-relay-dev|staging|prod`), separate secrets, separate Durable Object namespaces, separate token-signing keys and HMAC salts. Development and eval traffic never uses the production project (so its budget and abuse history are clean).
- **Rotation:** every 90 days and on any suspicion: create a new key → set it with a versioned secret deploy → health check → revoke the old key → record the date (no value) in the operations log. Token-signing keys rotate by publishing the new public key before signing with it.
- **Incident:** kill switch on (section 14) → revoke the key at OpenAI → rotate → review usage by `requestId`/subject aggregates → re-enable. Cloudflare and OpenAI accounts use hardware-key 2FA; the Cloudflare API token used for deploys is scoped to Workers for this account only.
- **Configuration requirements** (names only; no values are created here):

| Name | Kind | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | secret | Provider key (per environment) |
| `TOKEN_SIGNING_KEY` | secret | Ed25519 key for access tokens |
| `PROVIDER_ID_SALT` | secret | HMAC salt for `safety_identifier` |
| `REQUEST_DIGEST_KEY` | secret | HMAC key for idempotency conflict detection |
| `PROVIDER_HOST` | var | Pinned provider host; any other value refuses start |
| `MODEL_TABLE` | var (JSON) | Approved `{modelConfigId, model, effort, promptVersion, toolsVersion, maxOutputTokens}` rows; relay refuses a model not listed (S40) |
| `DISCLOSURE_VERSION`, `POLICY_VERSION`, `MIN_CLIENT_BUILD` | var | Binding to ADR 0012 records |
| `LIMITS` | var (JSON) | Section 13/14 constants |
| `AI_ENABLED` | var + DO flag | Kill switch |
| `ALERT_WEBHOOK` | secret | Owner alert destination (contentless) |

## 11. Request lifecycle (task 11)

| # | Stage | Where | Rule | Timeout |
|---|---|---|---|---|
| 1 | Client admission | Mac | Hosted AI on; class-A ack current; the local controller validates refs/revision/capabilities; allowance state shown (BILL-05) | — |
| 2 | Privacy gate | Mac | ADR 0012 checks 1–6 for class H; payload built by positive projection | — |
| 3 | Relay authentication | Worker | Verify token signature, audience, expiry, subject status | — |
| 4 | Relay validation | Worker | Size ≤ 24,000 B; schema `plan-request/2`; unknown field → deny; mirrors ADR 0012 checks 1–7 (never_transfer patterns, disclosure/policy version, `MIN_CLIENT_BUILD`) | — |
| 5 | Admission | Subject DO (one short transaction) | Idempotency lookup; concurrency slot; rate/cost counters; allowance check via SHR-84 interface; worst-case cost estimate ≤ `MAX_REQUEST_COST` | ≤ 1 s |
| 6 | Budget reservation | Budget DO | Reserve worst-case cost against daily and monthly caps; kill switch | ≤ 1 s |
| 7 | Provider request | Worker `fetch` | Section 3.4 body; abort on client disconnect | 30 s per attempt |
| 8 | Structured validation | Worker | Exactly one tool call; strict schema; ref set ⊆ request refs; size ≤ 32 KB; not truncated; no forbidden steps | — |
| 9 | Completion | Subject + Budget DO | Record actual tokens/cost; release slot; reconcile reservation; commercial charging per SHR-84 | ≤ 1 s |
| 10 | Response to client | Worker | `plan-response/2` | Relay total deadline **40 s** |
| 11 | Local plan validation | Mac | Revision/requestId binding, full schema, semantic, capability, ref, resource and consent checks (CONV-02) | Client deadline **45 s** |
| 12 | Local deterministic execution | Mac | JobController, staged commit, verification, Undo | Local |

**Cancellation.** The client aborts the HTTP request; the Worker's upstream `fetch` is aborted with it; the subject DO records `cancelled` and releases the slot. A late provider result is discarded (S27). Local state is authoritative: a cancelled or restarted workspace never applies a late response (CONV-07).

**Idempotency.** `requestId` is the key, scoped per subject. Records live 24 hours: `{state: in_progress|completed|failed|cancelled, reservation, digestHmac (dropped at completion or after 15 min)}`. Same key + same digest while in progress → `409 in_progress`; after completion → `409 already_completed` with **no** provider call and **no** second consumption (the response body is not stored, so it is not replayed); same key + different digest → `422 idempotency_mismatch`.

**Retries.** Client: at most **1** automatic transport retry of the same `requestId` (ADR 0012 `AUTO_RETRY_LIMIT` hosted = 1), only when no response was received and only while the user is still in the flow; never after relaunch. Relay: at most **1** retry to the **same provider, model and host**, only for connection failure or 5xx before any response body, and only if ≥ 15 s of the relay deadline remain. No retry on 4xx, 429, timeout, invalid output or cancellation. Retries never change payload, route or model (ADR 0012 §8).

**Stale revision.** The relay does not know workspace truth. The client discards any response whose `requestId` or `workspaceRevision` does not match current state ("Files changed. Ask again."); nothing executes and nothing is resent automatically (S28).

**Provider error mapping.** 5xx/connection → one relay retry, then `provider_unavailable`; 429 → `provider_busy` + `Retry-After`, no retry; 400/401/403/404 → `provider_config_error`, alert, no retry; timeout → `provider_timeout`; malformed, truncated, multiple or zero tool calls → `invalid_model_output`, no partial plan (S19–S26).

## 12. Offline and outage policy (task 12; AI-9)

**Truthful v1 statement: new AI-routed PDF operations cannot be created offline or while atePDF AI is unavailable.** D-04/CONV-01 make AI the orchestration layer, D-08/BILL-02 forbid an unlimited manual-tool escape, and hosted metering is server-side (BILL-06). There is no silent local or cloud fallback (D-06).

| Condition | Detection | What the user sees | What still works |
|---|---|---|---|
| Mac offline | OS reachability / connection failure before send | "You're offline. atePDF AI needs a connection to start new work. Nothing was sent." | Existing originals/results, preview, save/export, Undo to retained results, deletion, privacy and subscription settings, help (CONV-08, BILL-04) |
| Relay unreachable or 5xx | Connection error after one retry | "atePDF AI isn't reachable right now. Nothing changed." + Try again | Same |
| Provider unavailable | `provider_unavailable` | "atePDF AI is having trouble right now. Nothing changed." + Try again | Same |
| Provider or relay rate limit | `provider_busy` / `rate_limited` + `Retry-After` | "atePDF AI is busy. Try again in a minute." | Same |
| Global spend cap or kill switch | `service_paused` | "atePDF AI is temporarily paused. Your files are safe." (**never** "upgrade") | Same |
| Allowance exhausted (commercial) | `allowance_exhausted` | Approved exhaustion copy (UX table) | Same |
| Disclosure unverified / changed | Gate or `disclosure_changed` | ADR 0012 §7.3 copy; class-A disclosure again | Same |

No queueing of requests while offline; no background retry after the user leaves the flow; no automatic replay after relaunch (STATE-02); no provider, model or region failover (AI-3). Whether Undo itself is "new work" is not an AI question: it is a local restore to a retained result and stays available.

## 13. Technical concurrency and abuse limits (task 13; AI-6)

These are **technical safety limits**, independent of the commercial allowance (SHR-84). Refusals never mention upgrading (BILL-07). All values are proposed defaults held in one `LIMITS` constant; SHR-81 may tighten them with measurements.

| Limit | Proposed | Why |
|---|---|---|
| In-flight requests per installation | **1** | The conversation is sequential; matches today's gateway |
| In-flight requests per account (all devices) | **2** | Two Macs at once is plausible; more is not |
| Minimum interval per subject | 1 s | Today 1.5 s; double-submit protection |
| Requests per subject | 10/minute, 120/hour, 400/day | ~10× a heavy user's expected rate; stops scripts |
| Request body | ≤ 24,000 B; instruction ≤ 1,000 chars; ≤ 40 artifacts; ≤ 3 clarification answers; ≤ 6 choices | Unchanged from current validation |
| Response body from provider | ≤ 32 KB | Four-step plan is ~1.4 KB MEASURED |
| Provider attempt timeout / relay deadline / client deadline | 30 s / 40 s / 45 s | Room for one fast retry; client outlives relay |
| New installations per network address | 5/hour | Guest abuse without fingerprinting |
| New installations globally per day | LEAN 200, NORMAL 1,000, GROWTH 5,000 (alert at 80%) | Bounds guest spend exposure |
| Blocked subject | Manual owner action or automatic after 3 consecutive `never_transfer`/schema-abuse denials in 10 minutes (24 h block) | Bounds probing |

## 14. Spend protection (task 14; AI-7)

Internal operating-budget controls, never presented as product limits.

| Layer | Proposed control |
|---|---|
| Per request: tokens | `max_output_tokens` **4,000** (includes reasoning). Input bounded by the 24 KB request plus the fixed prefix (≤ ~12,000 tokens ESTIMATE); pre-call estimate above that → `request_too_expensive`. A truncated output is invalid and never partially executed. This is a spend ceiling far above the largest observed output (~450 tokens + reasoning), distinct from the 2,000-token cap removed in ADR 0007. |
| Per request: cost | `MAX_REQUEST_COST` **$0.08** worst case (Sol worst case ≈ $0.065–0.07 at list price, ≈ $0.077 with the +10% residency uplift, ESTIMATE) |
| Per subject per day | Guest **$0.25**, account **$2.00** of provider cost (≈ 30 and ≈ 250 Sol calls); exceed → `rate_limited` until the next UTC day, alert |
| Per account concurrency | 2 in flight (section 13) |
| Global daily cap | Budget option (section 16), enforced by reservation in the Budget DO before each call |
| Global monthly cap | Budget option; reservation-based; fail closed if the ledger is unavailable (SHR-81) |
| Provider backstop | OpenAI production project **hard budget** = monthly cap + 10% (hard limit returns 429, DOCUMENTED); usage tier high enough for the chosen option |
| Kill switch | `AI_ENABLED=false` (config) or DO flag set by the owner → every request `service_paused` within seconds; no deploy needed for the DO flag |
| Alerts | 50/80/100% of daily and monthly caps; hourly spend > 3× the trailing 7-day hourly mean; any `provider_config_error`; new-guest registrations > 80% of cap. Delivered contentless to the owner |
| Reservation semantics | Reserve worst case at admission; reconcile to actual `usage` at completion; on timeout/cancel with unknown usage, hold worst case until the day closes (conservative); duplicate `requestId` never reserves twice |

## 15. Cost model (task 15)

Assumptions (all ESTIMATE unless marked): fixed prefix **4,200 tokens** (15,012 chars MEASURED at ~3.6 chars/token; plausible range 3,700–5,000); variable input from the MEASURED request sizes; output from the MEASURED plan sizes; reasoning tokens for effort `low` of 200–800 per call (UNKNOWN; not published); prefix cache hit rate 80%; cache-miss priced at the cache-write rate. Prices DOCUMENTED (standard tier, before any +10% residency uplift). Full table and the script's inputs: [`cost-model.json`](../evidence/SHR-79-2026-09-30/cost-model.json).

| Call type | Input tok | Output tok (Sol incl. reasoning) | **Sol** $/call | Luna (effort none) $/call |
|---|---|---|---|---|
| Simple request | ~4,500 | ~410 | ~$0.007 | ~$0.0002 |
| Follow-up (14 retained artifacts today; smaller after PRIV-1) | ~5,000 | ~450 | ~$0.009 | ~$0.0003 |
| Clarification question | ~4,600 | ~260 | ~$0.006 | ~$0.0002 |
| Multi-step (4 steps) | ~4,600 | ~1,250 | ~$0.016 | ~$0.0004 |
| **Blended average** (45/25/20/10 mix) | | | **~$0.008** | **~$0.0003** |

Per user per month, assuming **1.5 planner calls per workflow** (clarifications and follow-ups; ESTIMATE) and a workflow count that is **not** an approved allowance (SHR-84 decides):

| Profile | Workflows / month | Calls | **Sol** | Luna |
|---|---|---|---|---|
| Active guest (illustrative 10 workflows) | 10 | 15 | ~$0.12 | < $0.01 |
| Pro light | 20 | 30 | ~$0.25 | ~$0.01 |
| Pro normal | 100 | 150 | ~$1.20 | ~$0.04 |
| Pro heavy | 500 | 750 | ~$6 (up to ~$12 if caching fails and reasoning is at the top of the range) | ~$0.20 |

For comparison at the same assumptions: Claude Sonnet 5.5 ≈ Sol before its ~30% tokenizer difference; Gemini 3.8 Flash ≈ $0.003/call in 2026 and ≈ $0.006/call from January 2027. Relay hosting: $5/month covers every option below (10M requests included). The largest uncertainty is reasoning tokens and latency for Sol; SHR-108's first run replaces these estimates with measurements.

## 16. Operating-budget options (task 16; AI-7)

Provider spend caps (excluding the $5/month Workers plan). Capacity figures use the Sol blended estimate with the +10% residency uplift (~$0.009/call); on Luna, capacity would be ~30× higher at the same cap.

| | **LEAN** (recommended start) | NORMAL | GROWTH |
|---|---|---|---|
| When | Owner-invited private beta (≤ 100 users) | Public beta | After conversion data (MEASURE-02, SHR-84) |
| Global monthly cap | **$50** | $300 | $1,500 |
| Global daily cap | **$5** | $20 | $75 |
| OpenAI project hard budget | $55 | $330 | $1,650 |
| New guests per day | 200 | 1,000 | 5,000 |
| Approximate planner calls per month at cap | ~5,500 | ~33,000 | ~165,000 |
| OpenAI usage tier needed | Build ($500/month limit) | Build | Launch ($5,000/month limit) |
| Moving up | Owner decision after 2 weeks of real cost/call data | Owner decision with conversion data | Owner decision |

No budget is enabled by this ADR; the numbers become configuration only after AI-7 approval and SHR-81.

## 17. Observability (task 17; AI-8)

One structured, contentless log line per request from atePDF code, and Workers **invocation logs disabled** (they capture headers by default). No AI Gateway, no Logpush, no third-party APM or analytics.

| Allowed field | Example |
|---|---|
| `ts`, `requestId`, `attempt`, `supersedes` | opaque IDs |
| `subject` | `inst_…`/`acct_…` (for metering and abuse; ADR 0012 §10 allows) |
| `route`, `disclosureVersion`, `modelConfigId`, `model`, `effort`, `promptVersion` | config identifiers |
| `outcome` / error `code`, HTTP status, `retryCount` | enums/ints |
| `latencyMs` (relay total, provider), `inputTokens`, `cachedTokens`, `outputTokens`, `reasoningTokens` | numbers |
| `costMicros` (computed from the price table version), `priceTableVersion` | numbers |
| `admission` (ok/allowance/rate/concurrency/budget), `entitlementOutcome` | enums |
| `appBuild`, `schema` | versions |

**Never logged:** instruction or clarification text, model output text, refs mapped to anything, page counts per file, size buckets, file names, selector results, request/response bodies, provider error bodies, tokens/keys, IP addresses, user agents beyond `appBuild`.

Retention: log lines 7 days (Workers Logs, Paid, DOCUMENTED); daily aggregates (counts, tokens, cost per model and per outcome; no subject IDs) 400 days for cost accounting; per-subject counters only as long as the metering period plus 30 days (SHR-84/95 set the final period). Access: the owner only. Diagnostics shown to users stay local (ADR 0012 §10).

## 18. Failure and recovery (task 18)

| Event | Behaviour | Double charge? |
|---|---|---|
| Request times out at the provider | Abort upstream; `provider_timeout`; reservation reconciled conservatively; user sees Try again | No: commercial consumption happens only on the SHR-84 charging event, never on a timeout |
| Client retries (transport) | Same `requestId`: the relay returns `in_progress`/`already_completed` or admits it if no record exists | No: one record per key |
| Response lost after completion; user taps Try again | New `requestId` with `supersedes` = old one; the relay links them so at most one workflow unit is charged (S29) | No |
| App closes mid-request | Request aborted when the connection closes; nothing resumes on relaunch; the conversation shows "Interrupted. Nothing changed." | No |
| Response arrives late (after cancel/change) | Client discards by binding; relay already recorded `cancelled` or `completed` | No |
| Provider returns invalid structure | `invalid_model_output`; no retry; tokens counted as internal cost only | No |
| Relay/Worker restarts | Durable Object state survives; an in-flight Worker request fails; client makes its one automatic retry with the same key | No |
| Durable Object unavailable | Fail closed: `internal`/`service_paused`; no provider call without a reservation | No |

## 19. Eval integration with SHR-107/108 (task 19)

- **Candidate configuration** is one versioned row: `{provider, model, effort, promptVersion, toolsVersion, routingPolicy, maxOutputTokens, priceTableVersion}` = a `modelConfigId`. Production runs only IDs listed in `MODEL_TABLE`.
- **SHR-107 runner** executes a candidate through the same request builder and the same relay validation code (in mock mode or, with separate authorisation, against the dev project) and records per case: hard-gate results, plan/tool accuracy, clarification errors, invalid plan rate, input/cached/output/reasoning tokens, latency, and cost computed from the pinned price table.
- **SHR-108 compares** model, effort, prompt, tool descriptions and routing against dev and held-out sets and reports quality, p50/p95 latency, tokens and cost per candidate.
- **Promotion rule.** A candidate may become the production default only if (1) zero regressions on hard gates (privacy/consent, unsupported-tool invention, schema-invalid plans, stale-target execution, unnecessary provider calls); (2) held-out quality ≥ the current default within the SHR-108 tolerance (dev-set gains alone never qualify); (3) p95 latency within target; (4) the recipient record is unchanged, or the new record is complete and the class-A disclosure is re-shown; (5) owner approval. Changing provider is never an automatic outcome of hillclimbing.
- Eval traffic uses synthetic fixtures only, the dev project and its own budget; it never shares the production key or budget.

## 20. Security and privacy implications

- Adds three recipients (atePDF relay, Cloudflare, OpenAI) to the class-A disclosure; every one must be complete before any production send (ADR 0012 PRIV-7).
- The relay sees class-H plaintext in memory; it never persists the payload. The only content-derived value stored is a keyed HMAC of the request body for ≤ 15 minutes.
- Instruction text may contain personal data (ADR 0012 §6); with standard OpenAI controls it can be retained up to 30 days in abuse logs. ZDR/MAM would remove that; its approval is uncertain and not assumed.
- No device identifiers, IP storage or fingerprinting. The installation key is the guest identity; its reset risk is accepted and bounded by money caps.
- Bearer tokens are short-lived, audience-bound and never logged; invocation logs that would capture headers are disabled.
- Provider host and model are server-pinned; client-supplied overrides are rejected (closes G7 for production).
- Budget exhaustion and kill switch fail closed without misleading upgrade copy.

## 21. OWNER DECISIONS (pending)

Nothing below is approved. Each needs Shrey's explicit answer. Approval authorises only SHR-80/81/82 implementation against mocks; it does **not** authorise account creation, terms acceptance, deployment, paid calls or spending.

| ID | Decision | Recommendation | Alternatives |
|---|---|---|---|
| **AI-1** | Relay hosting platform | **Cloudflare Workers Paid ($5/month) + SQLite Durable Objects**, invocation logs off, no AI Gateway, DO storage in the US jurisdiction | Supabase Edge Functions (built-in anonymous auth; documented body logging, $25/month); Vercel (no consistent state store) |
| **AI-2** | Primary model/provider strategy | **OpenAI only; one default model per release; no per-request routing.** SHR-108 picks the cheapest of `gpt-6-luna` (none/low) or `gpt-6.1-sol` (low) that meets held-out quality, hard gates and p95 ≤ 10 s. Provisional default for authorised evaluation: `gpt-6.1-sol` low; budgets sized on Sol | Sol fixed as default regardless of evals; Luna fixed as default; Anthropic Sonnet 5.5 as provider (new transport and baseline) |
| **AI-3** | Fallback/failover | **None across providers, regions or models.** One relay retry to the same provider/model/host for connection/5xx only; otherwise a truthful unavailable state. A model switch is a manual config change after the promotion rule | Pre-approved same-provider fallback model (both in the disclosure; automatic on model-specific outage) |
| **AI-4** | Provider retention/training acceptance | **Accept OpenAI standard API controls for private beta:** no training, `store:false`, abuse logs up to 30 days, prompt cache `in_memory` where supported, **US data-residency project (+10%)**; **apply for Modified Abuse Monitoring/ZDR** and use ZDR wording only if approved. Resolve every section 7 UNKNOWN (notably default human review and log region) in writing before any production transfer | Require ZDR before launch (launch depends on OpenAI sales approval); no residency pinning (region stays UNKNOWN → blocked) |
| **AI-5** | Guest/account identity | **Installation key pair (Keychain/Secure Enclave) + relay-issued `inst_` ID + 15-minute signed tokens; account links `inst_`→`acct_` with no allowance reset; provider sees only HMAC `safety_identifier`.** No App Attest (unsupported on Mac). DeviceCheck off unless an on-device test proves it and you approve adding Apple as recipient R-4. Approve the ADR 0012 field-class amendment in §3.2 | Supabase anonymous auth (with AI-1 alternative); DeviceCheck on from day one; no provider identifier at all |
| **AI-6** | Initial concurrency/rate policy | Section 13 table (1 in flight per install, 2 per account, 10/min, 120/h, 400/day, 5 new installs/h per address, 30/40/45 s timeouts) | Tighter for LEAN; looser after SHR-81 measurement |
| **AI-7** | Operating budget and spend limits | **LEAN: $50/month, $5/day**, OpenAI hard budget $55, 200 new guests/day, per-request `max_output_tokens` 4,000 and $0.08 ceiling, per-subject daily $0.25 guest / $2 account, kill switch, alerts at 50/80/100% | NORMAL ($300/$20) or GROWTH ($1,500/$75) |
| **AI-8** | Logging/observability | Section 17: one contentless line per request, invocation logs off, 7-day lines, 400-day contentless daily aggregates, no bodies/text/IPs, owner-only access; relay keeps no payload and a ≤ 15-minute keyed request HMAC | Also disable Workers Logs entirely (only aggregates); longer line retention |
| **AI-9** | Offline/outage behaviour | Section 12: **no new AI-routed work offline or during outages**, truthful "nothing changed" states with Try again, no queueing/background retry/replay, existing files and controls always available, never "upgrade" for technical/budget refusals | A local-only manual mode for new results (conflicts with D-04/D-08 and needs a product-spec change) |
| **AI-10** | Data-sharing/free-token programmes | **Not allowed.** Keep all provider data-sharing off and verify at deploy | Allow (requires a PRIV-09 change, new disclosure and user permission; not recommended) |

## 22. Consequences

- Unblocks SHR-80 (relay against mocks, using the section 3 contract and the 40 protocol cases), SHR-81 (limits and ledger from sections 13–16) and SHR-82 (client connection and section 12 states) once approved. SHR-84 plugs its charging event into sections 11 and 18 without changing them.
- Production traffic remains blocked by ADR 0012 until every recipient record is complete and verified against live configuration, and SHR-36/37 land.
- Settles OPEN-09's architecture, provider strategy, outage policy and budget structure; the exact model is settled by SHR-108 evidence under the AI-2 rule.
- Changes no runtime behaviour, test, `PRODUCT_V1.md` requirement or public copy.
