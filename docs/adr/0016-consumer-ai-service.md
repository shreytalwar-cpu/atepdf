# ADR 0016 — Consumer AI service, provider data policy and operating budget (SHR-79)

**Status:** **Approved** by Shrey on 30 September 2026 (AI-1 to AI-10, section 21). Revision 2: Shrey changed AI-1 to Vercel + Supabase, AI-2 to GPT-6 Luna, and reshaped AI-5 around Supabase Auth, then approved all ten. **Revision 3 (30 September 2026, owner-authorized cross-review corrections S79-01 to S79-07):** renumbered from ADR 0014 to **ADR 0016** under the coordinated scheme (0013 SHR-49, 0014 SHR-85, 0015 SHR-51, 0016 SHR-79); atomic allowance holds and a bounded provider-spend envelope (section 11); server-side session revocation and one installation/account lifecycle shared with ADR 0014 (section 4); adoption of the already-approved SELL-3/SELL-4 login policy (section 4.5); single-region Vercel execution with no function failover (sections 7 and 9); OpenAI cache-retention and hard-limit wording refreshed from primary sources. These are engineering corrections inside the approved AI-1 to AI-10 outcomes, not new owner decisions. **Independent-verification corrections (30 September 2026, owner-authorized, inside the same approved outcomes):** B1 a revoked binding is final for its Supabase session (section 4.3 steps 3 and 5, section 4.4); B2 an offline sign-out completes server-side before any guest request, and a binding whose session no longer exists counts as revoked (section 4.3 steps 3–4, section 4.4), with a guest-token sign-out by installation proof when the account session is lost; N1 the Sol eval row allows one provider attempt (sections 11.2 and 14); N2 an existing hold is found by `workflowId` on whichever subject created it (section 11.1); N3 the ADR 0014 citation status below. Until PR #103 merges, ADR 0014's sections and cases cited here exist only on that PR's branch; SELL-3/SELL-4 approval is recorded on SHR-85. This is an architecture contract. Nothing here is implemented, provisioned or configured. It creates no account, accepts no terms, makes no provider call and spends nothing. **Production transfer stays blocked** until every recipient record in section 7 is complete and verified against live configuration (ADR 0012 PRIV-7).  **Source:** `origin/main` `7853973` (30 September 2026; ADR 0013 is SHR-49's approved complex-PDF decision).  **Authority:** `PRODUCT_V1.md` D-03/D-04/D-06/D-07/D-08, CONV-02/07/08/09, PRIV-01–11, BILL-01–09, ARCH-02–04, MEASURE-03/04, OPEN-09; [SHR-79](https://linear.app/shrey-talwar/issue/SHR-79/decide-the-consumer-ai-service-provider-data-policy-and-operating) (parent SHR-27); approved [ADR 0012](0012-pre-send-privacy-consent.md) (data classes, `RecipientDisclosure`, retry and log rules); approved [ADR 0011](0011-mac-launch-envelope.md) (macOS 14, Universal). ADR 0014 (SHR-85, PR #103) owns seller, purchase and cross-channel policy; its approved SELL-3/SELL-4 account and login policy is adopted in section 4.5. This ADR is the primary owner of the identity, installation and session interface (section 4); ADR 0014 references it and defines no second authentication scheme.  **Evidence:** [docs/evidence/SHR-79-2026-09-30](../evidence/SHR-79-2026-09-30/README.md): primary sources with retrieval dates, draft recipient disclosures, the cost model and 80 mock protocol/failure cases (S01–S80).

This ADR fixes the **smallest** production service that lets a consumer Mac use atePDF's hosted planner without an API key. **Vercel** runs a thin atePDF API that holds the OpenAI key, admits requests, calls the model and validates the answer. **Supabase** holds identity and service state (Auth and Postgres). **OpenAI GPT-6 Luna** proposes the plan. **The Mac** does all document work. It is not a general backend, an agent platform or a document service (ARCH-02).

**Labels used for numbers.** **MEASURED** = measured in this repository. **DOCUMENTED** = read from the vendor's primary documentation on 30 September 2026 (source in the evidence README). **ESTIMATE** = derived from stated assumptions; not measured. **UNKNOWN** = not verifiable today; blocks production where ADR 0012 requires the field.

## 1. Current source (what exists today)

| Item | Fact (source) |
|---|---|
| Provider transport | One outbound path: local gateway → OpenAI Responses API via Vercel AI SDK `generateText` (`packages/planner/src/provider.ts:8-24`). `MODEL='gpt-6-luna'` hard-coded; `reasoningEffort:'none'`, `store:false`, `strictJsonSchema:true`, `toolChoice:'required'`, `maxRetries:0`, telemetry off. No `maxOutputTokens` (ADR 0007 removed the earlier 2,000 cap). The system prompt goes in top-level `instructions`. |
| Tools | Three strict tools: `run_local_pdf_workflow`, `undo_last_change`, `reply_in_chat`; exactly one call required, re-validated and bound by `bindResponse` (`schema.ts:37-50`). |
| Payload | `JSON.stringify(request)` of the projected DTO (`request.ts:15`): instruction ≤ 1,000 chars, ≤ 40 files with **exact** `sizeBytes` and page counts for all retained artifacts (ADR 0012 gap G1). |
| Gateway | Single-user local development gateway (`gateway.ts`): loopback only, per-process token or one-use native pairing, one request at a time, 1.5 s minimum interval, 24,000-byte body cap, duplicate `requestId` rejection, ≤ 200 requests per process, file-lock request allowance, 30 s provider deadline, fixed error messages, no logging of bodies. |
| Key | Developer key in `.local/openai-key` (0600). `OPENAI_BASE_URL` in the environment can redirect traffic (ADR 0012 G7). |
| Accounting | **None.** No code reads provider `usage`; no token, cost or latency is recorded anywhere. |
| Accounts/entitlements | None. `packages/commerce` is synthetic and disabled (`COMMERCE_ENABLED=false`); it already uses an opaque `subject_<32 hex>` reference. |
| Measured tokens/latency | **None recorded.** `docs/evidence/planner/live-test.json` holds 2 request bodies and no usage. |

**Payload sizes (MEASURED, offline, no provider call).** Fixed prefix sent on every call: system prompt 2,269 chars + embedded product knowledge 8,196 chars + tool schemas 3,929 / 76 / 542 chars = **15,012 chars**. Representative request bodies: simple merge 724; follow-up with 14 retained artifacts 2,030; clarification answer 1,117; four-step request 1,003. Representative outputs: one-step plan 302; four-step plan 1,350; clarification 140.

**Gaps against the target (for Linear triage, not fixed here).** G-A: `PRIVACY_TEST_REPORT.md:25`, `PLANNER_EVALUATION.md:24,45` and `docs/evidence/native/planner-budget-current.json` still describe a 2,000-token cap the code no longer sets; the JSON records `gpt-5.6-luna`. G-B: Swift client timeouts (35 s request / 40 s resource, `AtepdfPlannerTransport.swift:171`) are shorter than the approved 45 s client deadline (section 11). G-C: the model is a code constant, not server configuration bound to a disclosure version. G-D: the system prompt is sent as top-level `instructions`, which cannot carry an explicit prompt-cache breakpoint (section 3.4).

## 2. Architecture

```
 Mac (atePDF app)                      atePDF API (Vercel Function, Node.js, iad1)            OpenAI (Responses API)
 ─────────────────────────────         ──────────────────────────────────────────           ────────────────────────
 local documents, PDF engines,   TLS   verify JWT + live session → validate schema/H    TLS   gpt-6-luna, store:false,
 local understanding, secure   ──────► → ADR 0012 checks 1–7 → admit (Postgres)    ──────►   strict tools, explicit
 password field, workspace       (1)   → call model → validate → complete → reply    (3)     cache breakpoint before
 ADR 0012 OutboundGate + UI    ◄──────                                              ◄──────   the user message
 plan validation + JobController                 │ (2) pooled Postgres, IDs and counters only
        │                                        ▼
        │ (4) Auth only: anonymous       Supabase (us-east-1): Auth (anonymous installation users,
        └──────────────────────────────► accounts) + Postgres (installations, accounts, links,
          sign-in, refresh, account      entitlement state, allowance ledger, idempotency,
          sign-in/linking                concurrency leases, usage/cost counters, budget, flags)

 (1) class H + relay-only identity   (2) opaque IDs, counters, states — never instruction text
 (3) class H context only + HMAC safety identifier   (4) Supabase Auth API — no document or instruction data
```

| Responsibility | Mac client | Vercel atePDF API | Supabase | OpenAI |
|---|---|---|---|---|
| Documents, bytes, pages, OCR/extracted text, local-understanding outputs, file names, document metadata, paths | **Owns, never sends** (class C/N) | Never receives | Never receives | Never receives |
| Passwords/secrets | Secure field only (D-14) | Never receives | Never receives (no password auth) | Never receives |
| Instruction and clarification text (class H) | Builds after local guards | Holds **in memory only** for the request | **Never receives or stores** | Receives, to plan |
| Outbound privacy gate | ADR 0012 checks 1–10 before every write/retry | Mirrors checks 1–7 + route pinning | — | — |
| Disclosure and consent UX | Class-A disclosure, destination indicator, local-only mode | Returns its `disclosureVersion` | — | — |
| Identity | Generates installation ID and installation key; keeps the guest and account Supabase sessions in the Keychain (section 4) | Verifies JWTs, live session and installation binding on every admission; maps principal → subject | **Auth** (anonymous + account users) and identity, binding and revocation tables | Sees only an HMAC |
| Entitlement / allowance | Shows state; never proof (BILL-06) | Enforces via Postgres functions | **Holds** entitlement state and allowance ledger (rules: SHR-84; purchase recognition: SHR-85/86) | — |
| Idempotency, concurrency, rate, spend | One request per logical attempt | Calls admit/complete | **Holds** records, leases, counters, budget ledger, kill switch | Own rate limits; project hard budget as backstop |
| Provider key | Never present | **Only holder** (Sensitive env var) | Never holds it | Issues/revokes |
| Planning | Context projection; validates response vs revision | Chooses model/prompt version from server config; validates structure | — | Proposes exactly one tool call |
| Execution, verification, Undo | **Owns** | Never | Never | Never |

**Why this split.** Vercel is good at stateless request handling with a long outbound wait, has a conventional Git deploy flow, and keeps the provider key off every client. Supabase gives atePDF a conventional Auth + Postgres foundation for the parts that genuinely need durable, transactional state: guest installations, accounts, guest→account linking, entitlement recovery and cross-channel purchase recognition (SHR-85), the allowance ledger (SHR-84/86) and exact spend and concurrency accounting. The Mac keeps everything that concerns documents. OpenAI sees only the approved class-H planning payload.

**Not in the service:** document upload endpoints, Supabase Storage, file or page storage, response caching, prompt/instruction storage, conversation history, analytics, Vercel AI Gateway, Supabase Edge Functions, Supabase Data API access from the relay, vector stores, background jobs, a second provider, a general proxy.

## 3. Production request contract

### 3.1 Transport

`POST https://<api-host>/v1/plan` over TLS 1.2+. The host name is **UNKNOWN** until the owner registers a domain; it becomes a pinned value in the recipient record. Headers: `Authorization: Bearer <Supabase access token>` (N-04: transport, not payload), `Content-Type: application/json`, `Atepdf-Build: <app build>`. No cookies. **No query strings** on any atePDF API route (Vercel logs query strings, section 17). Body ≤ 24,000 bytes (unchanged). The installation endpoints (`/v1/installations`, `/challenge`, `/link`, `/rebind`, `/sign-out`) and the account session endpoints use the same rules; their installation proof is a signature in the JSON body, never a query string or a logged header (section 4).

### 3.2 `PlanRequest/2` (class H, aligned with ADR 0012 PRIV-1)

```ts
type PlanRequest = {
  schema: 'atepdf.plan-request/2';
  requestId: string;              // 'req_' + 32 hex, random per logical request; also the idempotency key
  attempt: 1 | 2;                 // transport attempt of the same requestId (AUTO_RETRY_LIMIT hosted = 1)
  supersedes: string | null;      // requestId of an earlier attempt whose response was lost ("Try again")
  installationId: string;         // 'inst_' + 32 hex, generated on the Mac (section 4); relay-only
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

**Excluded by schema (default deny, ADR 0012 check 1):** document bytes, rendered pages, file names (full or partial), paths, OCR/extracted text, local-understanding outputs, embeddings and hashes, embedded document metadata, exact sizes and dates, history artifacts outside the active projection, previous plans, device or hardware identifiers, IP-derived data, model/endpoint choice, free-form "debug" or "metadata" fields. An unknown key is `400 unclassified_field`.

**Relay-only fields** (`attempt`, `supersedes`, `installationId`, `disclosureVersion`, `policyVersion`, the bearer token) are H-09. They are **never** forwarded into model context. `requestId` is not forwarded either; the relay binds the response to it. Only `requestId`, `installationId`, `attempt`/`supersedes` linkage and outcome counters are written to Postgres; **no field of `context` is ever written to Supabase.**

**ADR 0012 field-class amendment (approved with AI-5/AI-8).** `attempt`, `supersedes`, `installationId`, `disclosureVersion`, `policyVersion` → H-09 (relay only). `artifacts[].role`, `artifacts[].order` → H-03. `lastOutcome` → H-08. `sizeBucket` → H-07 (already approved as buckets).

### 3.3 `PlanResponse/2` and errors

```ts
type PlanResponse = {
  schema: 'atepdf.plan-response/2';
  requestId: string; workspaceRevision: number;     // echoed; the client rejects any mismatch
  disclosureVersion: string;                          // service's current version; mismatch blocks the next send
  planner: PlannerResponse;                           // existing shape: plan | clarify | answer | unsupported | undo
  service: { modelConfigId: string; admission: 'ok' };  // contentless; no cost or token data to the client
  entitlement: EntitlementState;                      // defined by SHR-84/85; commercial only
};
type ServiceError = {
  schema: 'atepdf.service-error/1'; requestId: string | null;
  code: 'auth_required' | 'token_expired' | 'session_revoked' | 'account_session_required' | 'identity_blocked'
      | 'installation_not_linked' | 'request_too_large'
      | 'unclassified_field' | 'never_transfer' | 'disclosure_changed' | 'client_outdated' | 'already_completed'
      | 'in_progress' | 'concurrency_limit' | 'rate_limited' | 'request_too_expensive' | 'allowance_exhausted'
      | 'service_paused' | 'provider_busy' | 'provider_timeout' | 'provider_unavailable' | 'provider_config_error'
      | 'invalid_model_output' | 'cancelled' | 'internal';
  retryable: boolean; retryAfterSeconds: number | null;
};
```

Error bodies never echo request content, provider error bodies or secrets (N-10). Only `allowance_exhausted` (HTTP 402) may lead to upgrade copy; every technical or budget refusal uses non-commercial copy (BILL-07).

### 3.4 Relay → OpenAI request (the only thing the provider receives)

`POST https://<pinned OpenAI host>/v1/responses` with:

| Field | Value |
|---|---|
| `model` | `gpt-6-luna` (from the server's approved-model table; section 6) |
| `reasoning.effort` | `none` (lowest supported; must be validated by SHR-107, section 6) |
| `tools` | The three strict tools, pinned tool-description version; `tool_choice: required`; `parallel_tool_calls: false` |
| `input[0]` | **Developer message** containing the pinned system prompt + product knowledge as one `input_text` block carrying `prompt_cache_breakpoint: { "mode": "explicit" }`. Top-level `instructions` is **not** used, because it "cannot contain an explicit breakpoint" (DOCUMENTED) |
| `input[1]` | User message: the JSON of `context` only. It sits **after** the last breakpoint |
| `prompt_cache_options` | `{ "mode": "explicit", "ttl": "30m" }` |
| `store` | `false` |
| `max_output_tokens` | 4,000 (section 14) |
| `safety_identifier` | `HMAC-SHA256(PROVIDER_ID_SALT, subject)` truncated to 32 hex (section 4) |

**Prompt caching under current OpenAI terms (DOCUMENTED, prompt-caching guide, GPT-5.6 and later).** For GPT-5.6 and later models, which include GPT-6 Luna and GPT-6.1 Sol, the lifetime control is `prompt_cache_options.ttl`; its "only supported value, `30m`, is also the default". A cached prefix "remains eligible for reuse for 30 minutes after its most recent write or reuse, though OpenAI may retain it longer". The older `prompt_cache_retention` parameter (`in_memory` / `24h`) applies only to earlier models, and the migration guide says to "Replace `prompt_cache_retention` with `prompt_cache_options.ttl`". In explicit mode, "Content after the last selected breakpoint is processed at the uncached input-token rate without a cache-write charge", so atePDF's cache writes end at its own fixed prompt and the user's message is not written to the prompt cache. The data-controls page describes what a cache entry is and bounds it: "Prompt caching may store encrypted key/value tensors in GPU-local storage as application state. This data is stored on the local GPU machines and is not retained after the 24-hour expiration", and "For GPT-5.6 models and later model families, `prompt_cache_options.ttl` controls the minimum cache lifetime, not this maximum application-state retention period" (DOCUMENTED, retrieved 30 September 2026). So `30m` is the minimum eligibility window and **24 hours is the documented maximum** for cached application state; revision 2's "upper bound UNKNOWN" is superseded. `prompt_cache_key` is optional on these models and is not set (no per-user cache accounting is needed, and only atePDF's fixed prompt is cached). The cacheable prefix is everything **before** the breakpoint as the provider sees it: the tool definitions and the developer message, not the developer string alone. SHR-80/108 verify the behaviour with synthetic requests: `usage.input_tokens_details.cache_write_tokens` must never exceed the token count of that whole visible fixed prefix (tools + developer message + framing, counted with the pinned tokenizer, section 11.2), and a synthetic usage fixture alone does not prove real provider routing or cache behaviour.

**Never set:** `instructions`, `prompt_cache_retention`, `prompt_cache_key`, `metadata`, `previous_response_id`, `conversation`, `background`, built-in tools (web search, file search, code interpreter), Files, Batch, vector stores. An endpoint override (`OPENAI_BASE_URL` or similar) makes the relay refuse to start (case S34).

## 4. Identity, installation and session lifecycle (Supabase)

Guest-first (BILL-01, UX-01). This section is the **single** identity, installation and session interface for atePDF's hosted services. ADR 0014 (SHR-85) references it for guest identity, account linking, sign-out, remote sign-out, account deletion and reinstall, and defines no second relay authentication scheme. The approved SELL-3/SELL-4 account and login policy is adopted in section 4.5. None of these identities is a device or hardware identifier (N-07), and none reaches model context. Revision 3 replaces revision 2's in-place conversion of the anonymous user (S79-04) and adds server-side revocation (S79-03).

### 4.1 Identities and credentials

| Identity or credential | What it is | Where it lives | Who sees it |
|---|---|---|---|
| **Installation** | `inst_<32 hex>`, generated randomly on the Mac at first hosted use | Keychain (this device only, not synced); `installations` row | Mac, Vercel API, Supabase Postgres |
| **Installation key** | A P-256 signing key pair generated on the Mac with the installation. It proves "this is installation I" by signing a single-use server challenge (4.3). It is **not** a bearer credential and is never sent on `/v1/plan` | Private key: Keychain, this device only, never exported or sent anywhere (Secure Enclave where SHR-82 finds it available). Public key: `installations.proof_public_key` with a `key_version` | Private key: the Mac only. Public key and signatures: Vercel API, Postgres (H-09, relay only) |
| **Guest subject** | Opaque `subject_<32 hex>` (the `packages/commerce` format), created with the installation row. A durable ledger record owned by the **installation**, not by any Auth user: it survives sign-out, account deletion and replacement of the guest principal | Postgres | Vercel API, Supabase |
| **Guest principal** | A Supabase **anonymous** Auth user created with `signInAnonymously()`. Its session authenticates the installation's guest requests. Replaceable through re-binding (4.3 step 7) | Anonymous session in the Keychain under its own storage key | Mac, Vercel API, Supabase Auth |
| **Account** | A **separate** permanent Supabase Auth user created by email one-time code (SELL-4) only when needed (SELL-3), with its own `subject_…` | Supabase Auth + `accounts` row; account session in the Keychain under a second storage key | Mac, Vercel API, Supabase, the custom SMTP provider (email address) |
| **Session binding** | `{installation_id, auth_user_id, auth_session_id, kind: guest or account, state: active or revoked, created_at, revoked_at}`: which Supabase session may act for which installation | Postgres | Vercel API, Supabase |
| **Provider end-user identifier** | `HMAC-SHA256(PROVIDER_ID_SALT, subject)` → 32 hex, sent as OpenAI `safety_identifier` (≤ 64 chars; OpenAI: "Hash … to avoid sending us any identifying information") | Computed per request; the salt is a Vercel secret | OpenAI only. Never the installation ID, account ID, auth user ID, email or IP |

**Rules.**
- The anonymous guest principal is **never converted in place** into a permanent account. Supabase converts an anonymous user by attaching an email (`updateUser`) or OAuth identity (`linkIdentity`) to that same user, and an anonymous user "can't access their account if they sign out" (DOCUMENTED). Converting would leave the installation with no authenticated way back to its consumed guest subject. An account is therefore always a separate Auth user linked to the installation (4.3 step 3). The user-facing steps (enter email, enter code) are unchanged, and no extra signup is introduced.
- The Mac keeps two independent Supabase client sessions under separate Keychain storage keys: the guest session (always present once registered) and at most one account session.
- The app holds only the Supabase **publishable** key. No `service_role`/`sb_secret_…` key, OpenAI key, database credential or HMAC salt is ever in the app (S77).
- Only signatures and the public key leave the Mac; the private installation key is Keychain key material and never leaves it (ADR 0012 N-02). Challenge signatures are H-09: relay only, never logged, never in Supabase Auth, never in model context.

### 4.2 Server records and what survives deletion

| Record | Keyed by | Removed when |
|---|---|---|
| `installations` `{installation_id, guest_subject, guest_user_id (FK → auth.users ON DELETE SET NULL), proof_public_key, key_version, linked_account (nullable), channel, app_build, created_at, last_seen_at}` | installation | Installation deletion or SHR-95's idle-installation period (4.3 step 9). **Not** by account deletion or by deletion of the guest principal |
| Guest allowance ledger (holds, consumption) | guest subject | Only with its installation. It survives account deletion, so deleting an account never manufactures a new guest allowance |
| `accounts`, the account subject's ledger, holds and purchase links (ADR 0014/SHR-86) | account subject (FK → auth.users ON DELETE CASCADE) | Account deletion, except records SHR-95 must keep by law or for accounting |
| `session_bindings` | (installation, auth session) | Revoked on sign-out, remote sign-out, re-binding and account deletion; revoked rows purged after SHR-95's period |
| `installation_challenges` `{nonce, installation_id, purpose, expires_at, used_at}` | nonce | Used, or expired after 60 s |
| `requests`, `attempts`, `allowance_holds`, spend buckets | request / workflow | Section 11 and section 17 retention |

### 4.3 Lifecycle

**Installation proof.** `POST /v1/installations/challenge` (authenticated by the presenting Supabase token) returns a 128-bit nonce bound to `{installationId, purpose ∈ {register, link, rebind, rotate, sign_out}}`, single use, valid 60 s. The Mac signs `atepdf-installation-proof/1 ‖ purpose ‖ installationId ‖ nonce ‖ auth user ID of the presenting token` with the installation key. A replayed, expired, wrong-purpose or wrong-user signature is refused and counts toward the identity-block rule (section 13).

1. **First hosted use.** The Mac generates `inst_…` and the installation key, calls `signInAnonymously()` (guest principal U), then `POST /v1/installations` with U's token, the public key and a `register` signature. `register_installation` creates the installation, its guest subject and an active guest binding for U's session in one transaction, subject to the global new-guest cap. It refuses (`409`) an installation ID that already exists or a guest principal that already owns an installation, so **registration never tops up allowance** (S69). The guest allowance attaches to the guest subject (amount and reset: SHR-84).
2. **Guest planning.** `/v1/plan` carries U's access token and `installationId`. Admission requires the checks in 4.4. The acting subject is the guest subject.
3. **Account sign-in, new or existing account (one path).** The user enters an email; the account client calls `signInWithOtp` (creating the user if new) and `verifyOtp` with the emailed code (SELL-4). The Mac then calls `POST /v1/installations/link` with the **account** token and a `link` signature. `link_installation` locks the installation row, then both subjects' ledger rows in a fixed order, verifies the signature and the account session (4.4), refuses (`401 session_revoked`) any `session_id` that has a revoked binding (step 5), sets `linked_account` and creates an active **account** binding for that session. **Linking never grants allowance** (D-07, SELL-3): consumed guest usage stays consumed on the guest subject; any carry-over rule (ADR 0014's "keep the lower remaining guest allowance", its case G03) is applied inside this transaction by SHR-84/86, counting active holds as consumed (S50, S71). While an account binding is active, the installation acts as the account subject and admission refuses the guest token for planning (`403 account_session_required`), so no parallel guest pool exists (S76). An account binding counts as active only while its session still exists in `auth.sessions` (step 4). Each new sign-in on an installation calls `link` again, which binds the new session.
4. **Sign-out on this Mac.** `POST /v1/installations/sign-out` with the account token revokes the account binding and clears `linked_account`; the Mac then calls Supabase `signOut({ scope: 'local' })` and discards the account session. It continues with its guest session: authenticated as the **original guest subject** with its already-consumed allowance, **without the account's paid authority and without a new allowance** (S70). A guest subject's own verified App Store entitlement (ADR 0014 case A01) is not affected. Offline, the Mac stops using the account session at once but keeps it in the Keychain marked sign-out-pending; at the next contact it calls `POST /v1/installations/sign-out` with it before any guest request, then `signOut({ scope: 'local' })`, and deletes it (a `session_revoked` answer means the binding is already revoked). An account binding whose session no longer exists in `auth.sessions` counts as revoked: admission revokes it and clears `linked_account`, so a guest request is never refused because of it. If the Mac no longer holds the account session of an active binding (for example its Keychain item was lost while the session is still live), `POST /v1/installations/sign-out` also accepts the guest token with a `sign_out` installation proof and revokes that binding the same way; it only removes authority, so the guest is never locked out (S70, S76).
5. **Selected-session and global remote sign-out.** Settings lists the account's active bindings by channel, app version and last-seen date, with no device names (SELL-7, N-07). "Sign out" on one revokes that installation's account binding and clears its `linked_account`; the underlying Supabase session is also ended where the platform permits (mechanism verified in SHR-80). Admission does not depend on that second step, because it requires an active binding (4.4). A revoked binding is final for its Supabase session: `link_installation` refuses (`401 session_revoked`) any `session_id` that has a revoked binding, so a signed-out installation regains account access only through a fresh email one-time code (a new session). Every other atePDF route that accepts an account token (for example the session list, remote sign-out, account deletion, and ADR 0014's purchase linking and checkout) refuses such a session the same way, and on `session_revoked` the Mac calls `signOut({ scope: 'local' })` and deletes that session (S62). "Sign out everywhere" revokes every account binding and calls `signOut({ scope: 'global' })`. Guest principals are separate users and are not affected; each signed-out installation falls back to its own guest subject (S62, S64).
6. **Account deletion** (in-app in the Store and direct builds; SELL-3, App Review 5.1.1(v)). A separate server path, **not** the relay role, holds the Supabase admin key (section 10). In one transaction it revokes every binding of the account and clears `linked_account` on every installation, then deletes account-owned rows; it then calls `auth.admin.deleteUser`, which removes the account's sessions and refresh tokens. **Survives:** every installation row, guest subject and guest allowance ledger (consumed usage stays consumed), and records SHR-95 must retain. **Deleted:** the account row, the account subject's ledger, holds and links, and its bindings (revoked, then purged). An old account JWT is refused at once (S63). Commerce effects (for example cancelling a direct renewal) are ADR 0014 section 14. Deleted rows persist in Supabase's daily backups until those expire (7 days on Pro, DOCUMENTED).
7. **Lost guest principal.** If the guest session cannot be refreshed (for example refresh-token reuse detection revoked it, or idle anonymous-user cleanup deleted U) but the installation key is present, the Mac calls `signInAnonymously()` (V) and `POST /v1/installations/rebind` with V's token, a `rebind` signature and a new public key signed by the old key. `rebind_guest_principal` replaces U with V, revokes U's bindings, creates an active guest binding for V's session, rotates the key and keeps the **same** guest subject and ledger. No allowance changes. Rate-limited per installation (S72).
8. **Reinstall.** macOS normally keeps Keychain items when an app is deleted, so a reinstall normally keeps the installation ID, installation key, guest session and any account session (to be verified on device in SHR-82; ADR 0014 records the same expectation). A revoked or expired account session found after reinstall fails at admission or refresh, and the app falls back to its guest session (S74). If the Keychain items are gone, the Mac registers a new installation and guest subject under the global new-guest cap: the accepted imperfection of anonymous use (BILL-06). Purchases are unaffected (ADR 0014 section 12) (S73).
9. **Idle cleanup.** SHR-80 deletes idle, never-linked installations, their guest subjects and anonymous users after the period SHR-95 publishes. A later first use is a new guest, bounded by the caps.

**Key custody and rotation.** The installation key is created once per installation, rotated on every re-binding and on demand through a `rotate` challenge signed by the old key, and never backed up or synced. The server stores only the public key and `key_version`. A suspected compromise is handled by the owner blocking the installation (`identity_blocked`). Loss of the Keychain item is not rotation: it is a new installation (step 8).

### 4.4 Request authentication and revocation (every admission)

1. **Token.** Verify the Supabase JWT locally against the cached JWKS (asymmetric ES256 keys): signature, issuer, audience and expiry. This alone never authorizes anything.
2. **Live session.** Inside the `admit_request` transaction (section 11), the token's `session_id` claim must match a live row in `auth.sessions` for the token's `sub`. Supabase: every access token "contains a `session_id` claim", which "you can correlate … with the primary key of the `auth.sessions` table", and signed-out sessions "are removed from the database entirely" (DOCUMENTED, sessions guide).
3. **Installation binding.** An **active** `session_bindings` row must exist for `(installationId, sub, session_id)`. A guest token acts only for the installation whose guest principal it is, and only while no account binding is active (an account binding whose session no longer exists in `auth.sessions` is revoked at that admission, 4.3 step 4); an account token acts only for installations bound to that session.
4. **Fail closed.** The relay does not cache session validity. If either lookup cannot be made, admission fails closed (`service_paused`, no provider call); signature and expiry alone never admit (S67).
5. **Effect.** An unexpired JWT of a signed-out, remotely signed-out or deleted account session is refused with `401 session_revoked` at its next admission and cannot be re-linked (4.3 step 5), while the account's other active sessions keep working (S62–S64). A captured JWT presented for another installation gets `403 installation_not_linked`; after expiry it gets `401 token_expired` (S65). A refresh after sign-out fails at Supabase and the app falls back to its guest session (S66). Admission is the authorization point: a request admitted before a revocation commits may complete; nothing is admitted after it (S68).
6. Installation-changing calls (`register`, `link`, `rebind`, `rotate`, and a sign-out presented with the guest token) additionally require the installation proof (4.3). Races between link, sign-out, remote sign-out, re-binding and admission serialize on the installation row lock (S75).

### 4.5 Login methods (approved SELL-3 and SELL-4, ADR 0014)

This adopts the owner's approved SELL-3/SELL-4 policy from ADR 0014; it is not a new decision.
- **Email one-time code** is the required, common login for every channel that has atePDF accounts. Supabase `signInWithOtp` + `verifyOtp` with a short code in the email template (the passwordless-email guide). **No magic links** in v1 and **no passwords**. Codes are short-lived, single-use and rate-limited per email and per installation (ADR 0014 section 14).
- **Custom SMTP gate.** Supabase's built-in mailer is "not meant for production use" and is limited to 2 emails an hour (DOCUMENTED). Production email sign-in ships only after a custom SMTP provider is configured **and** its `RecipientDisclosure` record (it receives email addresses; conditional record `email-otp-provider`) is complete and disclosed (SHR-95).
- **No atePDF account is required to buy through Apple** (SELL-3); an account is required for a direct purchase, cross-channel linking and recovery that needs server identity. The Setapp build has no atePDF accounts (SELL-6).
- **Sign in with Apple is optional and deferred; v1 must not depend on it** (SELL-4). Facts for when SHR-91 revisits it: Apple's macOS capability table lists Sign in with Apple under the App Store program only, not Developer ID, so the **native** capability is unavailable to a Developer ID direct build; Supabase supports native `signInWithIdToken` for a Store build. A **web-based** Sign in with Apple flow for the direct build (Services ID, client secret rotated at least every 6 months) is a separate, unassessed option and is not categorically excluded. If ever adopted, it attaches as another identity of the same separate account user and needs its own recipient record.

### 4.6 Abuse bounds without fingerprinting

Supabase anonymous sign-ins are rate-limited per IP (default 30/hour, adjustable; to be lowered to 10/hour). The IP is seen by Supabase Auth, not stored by atePDF tables. The Vercel API enforces the global new-guest cap per day (section 13). Supabase's documentation recommends CAPTCHA for anonymous sign-ins. A web CAPTCHA does not fit a native first run, so v1 relies on the IP limit, the global guest cap, one installation per guest principal, the installation proof and the money caps; residual risk is accepted (BILL-06). App Attest is not available ("If you read `isSupported` from an app running on a Mac device, the value is false. This includes Mac Catalyst apps", DOCUMENTED). DeviceCheck is documented for macOS 10.15+/Mac Catalyst 13.1+, but runtime support is **UNKNOWN**; it stays off unless an on-device test succeeds and the owner adds Apple as a recipient.

## 5. Provider options (primary sources, 30 September 2026)

All prices are USD per 1M tokens, standard tier, short context (DOCUMENTED). "Structured" = strict schema-constrained tool calls.

| | **OpenAI GPT-6 Luna (v1 default)** | OpenAI GPT-6.1 Sol (eval benchmark) | Anthropic Claude Sonnet 5.5 | Anthropic Claude Opus 5.5 | Google Gemini 3.8 Flash (Developer API) |
|---|---|---|---|---|---|
| API ID | `gpt-6-luna` | `gpt-6.1-sol` | `claude-sonnet-5-5` | `claude-opus-5-5` | `gemini-3.8-flash` |
| Positioning | "most efficient model for focused, high-volume tasks" | "near-Astra performance at a lower cost" | Mid tier | Anthropic's default recommendation | Stable Flash; Pro is preview only |
| Input / cached / output | $0.10 / $0.01 / $0.50 (cache write $0.125) | $2.00 / $0.10 / $10.00 (write $2.50) | $2 / $0.20 hit / $10 | $4 / $0.20 / $20 | $0.75 / $0.075 / $3.75 until 31 Dec 2026, **then $1.50 / $0.15 / $7.50** |
| Reasoning | `none` … `max` | `low` … `max`; **`none`/`minimal` not supported** | Adaptive | Adaptive, always on | low/medium/high thinking |
| Structured tools | Yes (strict) | Yes (strict), Responses API | Yes (`strict: true`, GA) | Yes | `validated` function calling |
| Context / max output | 1.05M / 128K | 1.05M / 128K | 1M / 128K | 1M / 128K | 1.05M / 65K |
| Rate limits (lowest paid tier) | 500 RPM / 500K TPM | 500 RPM / 500K TPM | Start: 1,000 RPM | same | UNKNOWN (dashboard only) |
| Training on API data | No by default ("unless you explicitly opt in") | same | No ("may not train models on Customer Content") | same | Paid tier: no. **Free tier: yes, with human reviewers** |
| Default retention | Abuse-monitoring logs up to 30 days; Responses app state 30 days unless `store:false` | same | 30 days per the Privacy Center (the API docs say "not retained by default"; conflict UNKNOWN); flagged content up to 2 years | same | Abuse monitoring 55 days |
| Zero/limited retention | ZDR or Modified Abuse Monitoring by sales approval | same | ZDR by sales; flagged content still up to 2 years | same | **None on the Developer API** |
| Region | Data-residency projects (US without approval; others need approval); **+10%** for models released after 5 Mar 2026; Luna: EU residency with Standard/Flex/Batch | Sol: US and EU only | `inference_geo: "us"` (+10%); storage US only | same | No region selection |
| End-user ID | `safety_identifier` (≤ 64) | same | `metadata.user_id` | same | None found |
| Spend control | Project budgets: alerts, or hard limit returning 429 | same | Workspace monthly limits | same | Project caps "experimental" |
| Contracting entity | OpenAI OpCo, LLC (non-EEA); OpenAI Ireland Ltd (EEA/CH) | same | Anthropic, PBC; Anthropic Ireland (EEA/CH/UK) | same | "Google" per Cloud terms (entity UNKNOWN) |

Excluded: Claude Fable 5.1 (mandatory 30-day retention, not ZDR-eligible), Claude Haiku 4.5 (retirement possible from 15 October 2026), GPT-6 Astra (no benefit for a four-tool planner), Gemini free tier (trains on and human-reviews data), Gemini 3.1 Pro (preview only).

**Why OpenAI.** It keeps the existing strict-tool transport, prompt and 118-case corpus; it offers the cheapest credible planner (Luna) and a stronger benchmark (Sol) behind **one recipient with one set of retention terms**; it supports an opaque safety identifier, project hard budgets, a definite US data-residency project and a ZDR/Modified Abuse Monitoring path. Anthropic remains a credible alternative. The Gemini Developer API fails ADR 0012 expectations today (55-day abuse retention, no ZDR or region choice).

## 6. Model configuration (AI-2)

**Production default: `gpt-6-luna`.** The planner is intentionally narrow. It understands one instruction, selects from a bounded tool list, binds opaque file/page references, asks for clarification when genuinely needed and returns a strict structured plan. It does no PDF processing, document understanding, coding, research or open-ended autonomous work.

| Setting | Value |
|---|---|
| Provider / API | OpenAI Responses API, US data-residency project (AI-4) |
| Model | `gpt-6-luna` |
| Reasoning effort | `none`, the lowest Luna supports. It must pass the SHR-107 hard gates and held-out threshold. If it does not, `low` is the next setting to evaluate; that is a configuration change within Luna, not routing |
| Tools | Three strict tools, `tool_choice: required`, `parallel_tool_calls: false` |
| Caching | Explicit breakpoint after the fixed developer prefix; `ttl: 30m` (section 3.4) |
| Output ceiling | `max_output_tokens` 4,000 (section 14) |
| `store` | `false` |
| Routing | **None.** No automatic Luna/Sol routing or escalation in v1 |

**GPT-6.1 Sol's role.** An evaluation benchmark, a debugging/reference model and a possible future replacement **only** if Luna fails measured acceptance. It is a public API model (`gpt-6.1-sol`, Responses/Chat Completions/Batch, DOCUMENTED); it is also offered in Codex and "Work" but not in ChatGPT chat. Behaviour in Codex is not assumed to match the API, because Codex applies its own harness and defaults. Sol has no `none`/`minimal` effort, so every call spends reasoning tokens and latency.

**Promotion rule.** Luna remains the production model unless held-out evaluations show it fails an approved quality or safety threshold. If Luna fails, the work returns to the owner **with the measured failure cases** before any model change is proposed. SHR-107/108 still compare Luna with stronger candidates (Sol, other efforts, prompt and tool-description variants) and report quality, latency, tokens and cost.

## 7. Recipient disclosures (ADR 0012 section 9)

Machine-readable drafts: [`recipient-disclosures.json`](../evidence/SHR-79-2026-09-30/recipient-disclosures.json). **Every record is `status: incomplete`.** Some required fields can only be verified against live accounts that do not exist yet, and some policy facts are not published. Under ADR 0012 PRIV-7 the gate therefore **denies all production transfer** until each UNKNOWN below is resolved from a primary source or a written provider statement, and the record is verified against the real configuration.

Class-A route for the instruction: **atePDF API (Vercel) → OpenAI**. Supabase is **not** on the instruction route. It receives identity and service-state data only (H-09) and appears in the disclosure as the place atePDF keeps account and usage records.

| Field | R-1 atePDF service (operator) | R-2 Vercel (API host) | R-3 Supabase (identity/state) | R-4 OpenAI (model provider) |
|---|---|---|---|---|
| Legal entity | **UNKNOWN**: the seller/operator entity is open (ADR 0014 SELL-1 pending, awaiting Apple and Setapp responses; OPEN-04) | Vercel Inc. (Delaware; processor under the DPA for Pro) | **Supabase Pte. Ltd.** (Singapore; processor under the DPA) | OpenAI OpCo, LLC (non-EEA users); OpenAI Ireland Ltd (EEA/CH) |
| Role | Controller of service records; operates API code | Processor; terminates TLS and runs the API code | Processor; Auth and Postgres for identity/state | Processor of API customer content |
| Endpoint / route | `https://<api-host>/v1/*` (**host UNKNOWN**) | Same host (Vercel custom domain) | `https://<ref>.supabase.co/auth/v1/*` from the Mac; pooled Postgres from Vercel (**project ref UNKNOWN**) | Pinned OpenAI host of the US data-residency project (**exact host UNKNOWN**) |
| Parties able to read plaintext | atePDF API code (memory only) | Vercel infrastructure (on AWS) | Supabase (IDs and counters only) | OpenAI and its subprocessors |
| What it receives | Class H + H-09 | Class H + H-09 in transit/memory | H-09 only: installation/account/subject IDs, installation public keys, session bindings, request IDs, states, counters, timestamps; the account email address (email one-time code); Supabase Auth also sees the client IP and user agent on auth calls | Class H `context` + HMAC `safety_identifier` |
| Data region | Function execution pinned to `iad1` (US East) only, with **no function-region failover** (section 9) | **Ingress:** a request reaches the Vercel point of presence nearest the user, which routes it over Vercel's private network to the nearest Vercel region, and "the Vercel region the request is routed to handles TLS encryption and decryption" (DOCUMENTED, regions page). That ingress region, and CDN-layer rerouting during a regional outage, can be outside the US, so the instruction transits it in memory. **Execution:** the Function runs only in `iad1`. Node.js Function failover is an Enterprise feature that a team must enable (Function Failover toggle or `functionFailoverRegions`, DOCUMENTED); atePDF never enables it, so an `iad1` outage makes the API unavailable (fail closed, AI-3). The deployed configuration is a production gate | `us-east-1` project (fixed at creation); backup location: **UNKNOWN** (S3) | US data-residency project; region of abuse-monitoring logs by default: **UNKNOWN** |
| Stored state | **No payload.** Postgres rows listed in section 4/13 | None written by atePDF code except logs below | Identity, entitlement, ledger, idempotency, lease, counter, budget rows; **no instruction, plan or document data** | `store:false` → no Responses application state. Prompt cache holds KV tensors of **atePDF's fixed prefix only** (explicit breakpoint): at least 30 minutes after last use, "OpenAI may retain it longer"; cached application state "is not retained after the 24-hour expiration" (DOCUMENTED maximum; `ttl` is the minimum) |
| Abuse-monitoring retention | None | None known | None known | "up to 30 days, unless longer retention is required by law" (removed only with approved ZDR or Modified Abuse Monitoring) |
| Log retention | atePDF's own contentless line per request (section 17) | Runtime logs: request method, path, query string, status, host, user agent, client IP, region, outgoing sub-request metadata and anything the code prints. **1 day on Pro** with the project excluded from Observability Plus (which is on by default for Pro teams created after 3 April 2026 and keeps **30 days**). Request-body capture: **UNKNOWN** (not documented either way) | API/Postgres logs 7 days, Auth audit logs 7 days (Pro); gateway logs include path, query string and client IP; Postgres logs failing statement text (`log_min_error_statement = error`) | Abuse logs as above |
| Backup retention | — | UNKNOWN | Daily backups 7 days (Pro) | UNKNOWN |
| Training use | None | Paid Pro is opted out of Vercel's AI-training data use by default (changelog, March 2026; **verify in Team Settings → Data Preferences**) | None stated (processor) | Not used "unless you explicitly opt in"; data-sharing programme **off** |
| Human review | No content retained | UNKNOWN | UNKNOWN | Default organisation: **UNKNOWN** (not stated); classifier-flagged content may be retained and reviewed (Safety Retention) |
| Subprocessors | Vercel, Supabase, OpenAI; the custom SMTP provider for email one-time codes (SELL-4) before email sign-in ships; Apple only if Sign in with Apple is later adopted | security.vercel.com/subprocessors (includes AWS and several AI providers); which touch runtime data: **UNKNOWN** | supabase.com/legal/customer-resources/subprocessor-list (June 2026 PDF; includes AWS, Cloudflare, Google, Fly.io, Vercel, Upstash, Sentry, OpenAI); which touch this project's data: **UNKNOWN** | platform.openai.com/subprocessors, contents **UNKNOWN** (not reviewed) |
| Deletion | Account/installation deletion removes rows (policy: SHR-95) | Per DPA ("commercially reasonable timeframe" after termination) | `deleteUser` cascade; backups age out after 7 days | No per-request deletion of abuse logs; return/delete at contract end (DPA §2.11) |
| Outage / failover | No secondary host | No Function failover; ingress-only CDN rerouting (above); `iad1` outage = unavailable | None | **No failover** to another provider, model or region (AI-3) |
| End-user identifier | Holds IDs | Sees IDs in transit | Holds IDs | HMAC `safety_identifier` only |
| Source / date | This ADR, 30 Sep 2026 | vercel.com/docs (evidence README), 30 Sep 2026 | supabase.com and its docs source, 30 Sep 2026 | developers.openai.com data controls, prompt caching, pricing, model pages; OpenAI DPA v.010126; 30 Sep 2026 |

**Unavoidable processor-level behaviour (documented here per AI-8).** Vercel records request metadata for every invocation and cannot switch runtime logs off. atePDF therefore never puts content in paths or query strings and never prints bodies. Supabase Auth records the client IP and user agent in its auth and audit logs (7 days on Pro); these contain no document or instruction data. Supabase's API-gateway logs would record query strings; the API avoids the Data API entirely.

**Resolution path for UNKNOWNs** (owner, SHR-80 or SHR-95; not this issue): register the API domain and legal entity; ask OpenAI in writing about default human review and log region; ask Vercel in writing whether Function request bodies are ever retained (including at the ingress region), and confirm it with a synthetic canary test (case S43); confirm from the deployment summary that the Function has one region and no failover region (case S80); check the Vercel training opt-out and the Observability Plus exclusion in the dashboard; review all three subprocessor lists; confirm Supabase backup location; apply for Modified Abuse Monitoring/ZDR (AI-4); then verify every field against live settings and bump `disclosureVersion`.

**Class-A disclosure values** (ADR 0012 §7.1), valid only once R-1, R-2 and R-4 are complete: relay = "atePDF AI (hosted on Vercel)"; provider = "OpenAI"; retention = "up to 30 days for abuse monitoring" (or the approved ZDR/MAM wording); training = "not used to train models"; prompt cache = not mentioned as user retention, because only atePDF's fixed instructions are cached. Account and usage records at Supabase are disclosed in the billing/account disclosure (SHR-95).

## 8. Optional data sharing for free tokens (AI-10)

| Programme | Status (30 Sep 2026) | What it would share | Benefit | Decision |
|---|---|---|---|---|
| OpenAI "share inputs and outputs" for complimentary daily tokens | Appears active (help-centre search snippets; the page itself was not fetchable): 250K/day at low tiers up to 1M/day; listed models include `gpt-6-luna`; end date, retention and ZDR compatibility **UNKNOWN** | All API inputs and outputs of the organisation or project, for model improvement | At Luna prices, 1M tokens/day ≈ $0.10/day | **Off (approved).** Violates PRIV-09; would change every disclosure to "used for training" |
| Anthropic Development Partner Program | Claude Code traffic only | — | None for atePDF | Not applicable |
| Gemini free tier | Free usage in exchange for product-improvement use and human review | All prompts/responses | Free | Disqualified |
| Vercel AI-training data use | Paid Pro opted out by default | Aggregate traffic stats and code | None | Keep opted out |

The production OpenAI organisation keeps every data-sharing setting **off**; SHR-80's deployment checklist verifies it. Any future opt-in needs a separate owner/privacy decision, new disclosure copy and user permission (PRIV-09).

## 9. Hosting options (AI-1)

| | **A. Vercel (API) + Supabase (Auth/Postgres) — approved** | B. Cloudflare Workers + Durable Objects | C. Cloudflare Workers + Supabase | D. Supabase only (Edge Functions) |
|---|---|---|---|---|
| Fixed cost | Vercel Pro **$20/month** (includes $20 usage credit); Supabase Pro **$25/month** (includes Micro compute) | Workers Paid $5/month | $5 + $25 | $25 |
| Relay compute | Fluid compute; I/O wait not billed as CPU but memory is; default max duration 300 s | No duration limit while connected; wait not billed | same as B | 400 s wall clock; 150 s idle timeout |
| Accounts, guest→account linking, recovery | **Built in** (Supabase Auth: anonymous users, email one-time code, sessions table for revocation; optional Apple ID token later) | Must be built (custom tokens, custom account system) | Built in (Supabase) | Built in |
| Entitlement / ledger / idempotency | **Postgres transactions** (row locks); conventional SQL, migrations, backups | Durable Objects (strongly consistent; non-SQL API; custom) | Postgres | Postgres |
| Rate limiting | Exact per subject in Postgres; optional Vercel WAF IP rules (per region) | Binding (per location) + DO | Postgres + binding | Postgres only |
| Default logging of the relay | Metadata (method, path, query, status, UA, client IP) + printed output; **cannot be disabled**; 1 day (Pro, Plus excluded) or 30 days (Plus default) | Invocation logs capture headers; **can be disabled** | same as B | Docs: invocation logs capture "headers, body" |
| Region | Execution pinned to `iad1`, no Function failover (fail closed); global CDN ingress | Global edge | Global edge + US DB | 16 regions |
| Solo-founder burden | Two dashboards; conventional stack; Git deploys and preview environments; no custom identity code | One dashboard; custom identity and state code | Two dashboards; custom-free identity | One dashboard; body logging conflict |
| Lock-in | Low for the API (plain Node); moderate for Auth | Moderate (DO API) | Moderate | Moderate |

**Decision: A.** atePDF needs real accounts, entitlement recovery, guest→account linking and App Store/direct/Setapp purchase recognition (SHR-85/86). Supabase provides these as conventional Auth + Postgres instead of a custom identity system on Durable Objects. Vercel keeps the relay a small stateless Node function. B remains technically viable and cheaper, but it moves identity and ledger code into atePDF. C is a reasonable hybrid with no decisive advantage over A for a solo founder, and it adds a second, less conventional compute platform. D is excluded: its relay logging documents request bodies, and the owner excluded Edge Functions for the relay.

**Configuration rules for A.**
- **Vercel.** A separate project (`atepdf-api`) containing only the `/v1` routes, not the web app. Functions pinned to **exactly one region, `iad1`** (`regions: ["iad1"]`); **Function Failover off and no `functionFailoverRegions`** at project or function level. Vercel documents Node.js multi-region failover as an Enterprise feature that a team enables; atePDF does not enable it on any plan, because AI-3 forbids region failover and the recipient record discloses one execution region. An `iad1` outage therefore makes the API unavailable (section 12). The deployment summary must show no failover region before production (case S80; production gate). **Project excluded from Observability Plus** (or Plus disabled). No log drains. No Vercel AI Gateway. Secrets as **Sensitive** environment variables scoped to Production only; Preview uses separate non-production values or none; Deployment Protection on previews; Git fork protection on. Spend management set to **pause production deployments** at an on-demand amount above the included credit (it lags "several minutes"; OpenAI and Postgres caps remain the primary controls). Paid Pro only: Hobby is "restricted to non-commercial personal use only".
- **Supabase.** A Pro project in `us-east-1`. The Vercel API connects through the **shared pooler in transaction mode (port 6543)** with a dedicated least-privilege role that can only `EXECUTE` a handful of `SECURITY DEFINER` functions (`issue_installation_challenge`, `register_installation`, `link_installation`, `rebind_guest_principal`, `sign_out_installation`, `revoke_binding`, `admit_request`, `begin_attempt`, `complete_request`, `budget_status`). `reap_abandoned` runs from a Supabase scheduled job (section 11.2), not from the relay role. Account deletion runs in a separate server path with its own credentials (section 10). **No Data API access** from the relay; atePDF tables live in a schema not exposed through the Data API, with RLS enabled and no `anon`/`authenticated` grants. The Mac uses Supabase only for Auth endpoints with the publishable key. `log_statement = 'none'` for the relay role. Asymmetric JWT signing keys (ES256). Access-token lifetime 15 minutes (Supabase advises not going below 5); refresh-token reuse detection on. Anonymous sign-ins on; email one-time code on; magic links, passwords and manual identity linking off (the anonymous user is never converted, section 4.1). Custom SMTP before email sign-in ships. Spend cap on.

## 10. Keys, secrets and configuration (key custody)

- **OpenAI key.** Only as a Vercel **Sensitive** environment variable (`OPENAI_API_KEY`), Production scope only. Never in the app, repository, CI logs, Linear, chat, evidence files, Supabase or crash reports (N-03).
- **Least privilege.** One OpenAI **project per environment** (`atepdf-dev`, `atepdf-staging`, `atepdf-prod`); a **service-account** key restricted to Responses (restricted-key scopes from search snippets; confirm in the dashboard); organisation policy "allow only service-account keys"; a key expiry date. Vercel egress IPs are dynamic, so the OpenAI IP allowlist is not relied on.
- **Supabase secrets.** Vercel uses a dedicated Postgres role and password (`SUPABASE_DB_URL`) with EXECUTE-only rights. No `sb_secret_…` key is needed by the relay (it does not call the Data API or Admin API). The admin/secret key needed for account deletion (`auth.admin.deleteUser`, section 4.3 step 6) lives only in a separate server path with its own credentials, one key per component, as Supabase advises; never in the relay role, the app or the Mac.
- **Environment separation.** Separate Vercel projects or environments, separate Supabase projects (dev/staging/prod), separate OpenAI projects, separate HMAC salts. Development and eval traffic never uses production keys or budgets.
- **Rotation.** OpenAI key every 90 days and on any suspicion: create new → update the Sensitive variable → redeploy → health check → revoke old → record the date (no value). Supabase JWT signing keys rotate with "No downtime", but allow ≥ 20 minutes for JWKS caches. Database role password rotated on the same cadence.
- **Incident.** Kill switch on (section 14) → revoke the OpenAI key → rotate → review usage aggregates → re-enable. Vercel, Supabase and OpenAI owner accounts use hardware-key 2FA.

| Name | Where | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | Vercel Sensitive, Production | Provider key |
| `SUPABASE_DB_URL` | Vercel Sensitive | Pooled connection for the EXECUTE-only relay role |
| `SUPABASE_JWKS_URL`, `SUPABASE_ISSUER` | Vercel env | JWT verification |
| `PROVIDER_ID_SALT` | Vercel Sensitive | HMAC salt for `safety_identifier` |
| `PROVIDER_HOST` | Vercel env | Pinned OpenAI host; anything else refuses start |
| `MODEL_TABLE` | Vercel env (JSON) | Approved `{modelConfigId, model, effort, promptVersion, toolsVersion, tokenizerVersion, maxInputTokens, maxOutputTokens, maxProviderAttempts, maxRequestCostMicros, priceTableVersion}`; unlisted models refuse start (S40); a row whose attempt envelope exceeds its `maxRequestCostMicros` refuses start (S61) |
| `DISCLOSURE_VERSION`, `POLICY_VERSION`, `MIN_CLIENT_BUILD` | Vercel env | Binding to ADR 0012 records |
| `LIMITS` | Vercel env (JSON) | Section 13/14 constants |
| `ai_enabled` | Postgres `service_flags` row (+ `AI_ENABLED` env) | Kill switch without a redeploy |
| `ALERT_WEBHOOK` | Vercel Sensitive | Contentless owner alerts |

## 11. Request lifecycle

| # | Stage | Where | Rule | Timeout |
|---|---|---|---|---|
| 1 | Client admission | Mac | Hosted AI on; class-A ack current; controller validates refs/revision/capabilities; allowance state shown (BILL-05) | — |
| 2 | Privacy gate | Mac | ADR 0012 checks 1–6 for class H; payload built by positive projection | — |
| 3 | Token check | Vercel | Verify Supabase JWT (ES256 via cached JWKS): signature, issuer, audience, expiry (section 4.4 step 1). Never sufficient on its own | — |
| 4 | Validation | Vercel | ≤ 24,000 B; schema `plan-request/2`; unknown field → deny; mirrors ADR 0012 checks 1–7 (never-transfer patterns, disclosure/policy version, `MIN_CLIENT_BUILD`); input-token count of the exact provider request ≤ `maxInputTokens` (11.2) | — |
| 5 | Admission | Postgres `admit_request` (**one transaction**) | Kill switch; live session and active installation binding (4.4); idempotency (insert the request row); workflow resolution; in-flight lease per installation/account; rate windows; **allowance hold** (11.1); **attempt-envelope spend reservation** against the per-request ceiling, per-subject daily backstop and global daily/monthly caps (11.2). Any refusal rolls back everything, so no hold or reservation outlives a refused admission | ≤ 2 s |
| 6 | Provider attempt | Postgres `begin_attempt`, then Vercel `fetch` | The attempt row is committed **before** the send (11.2); section 3.4 body; aborted if the client disconnects | 30 s per attempt |
| 7 | Structured validation | Vercel | Exactly one tool call; strict schema; ref set ⊆ request refs; ≤ 32 KB; not truncated; no forbidden steps | — |
| 8 | Completion | Postgres `complete_request` | Book each attempt's cost (11.2); release the lease and the unused envelope; record the outcome; hand the allowance hold to SHR-84's settle/release interface (11.1). The plan is returned only after this commits | ≤ 2 s |
| 9 | Response | Vercel | `plan-response/2` | API total deadline **40 s** |
| 10 | Local plan validation | Mac | Revision/requestId binding, full schema, semantic, capability, ref, resource and consent checks (CONV-02) | Client deadline **45 s** |
| 11 | Local deterministic execution | Mac | JobController, staged commit, verification, Undo | Local |

**Leases.** An in-flight slot is a row with `lease_expires_at = now() + 60 s` (longer than the 40 s deadline). Lease expiry frees the **concurrency slot only**; it is not evidence that provider spend or allowance use vanished (11.2).

**Cancellation.** The client aborts the HTTP request; the function's upstream `fetch` is aborted; `complete_request` records `cancelled` and releases the lease. Any attempt already sent stays booked at its worst case unless usage arrived (S54). A late provider result is discarded (S27). A cancelled or restarted workspace never applies a late response (CONV-07).

**Idempotency.** `requestId` is the key, random 128-bit, unique across the service and bound to the installation and subject that first presented it. Request rows are kept 30 days (section 17): `{state: in_progress|completed|failed|cancelled|abandoned, workflowId, lease, envelope, attempts}`. **No digest or copy of the body is stored.** A repeat while in progress → `409 in_progress`; a repeat of a closed key (completed, failed, cancelled or abandoned) → `409 already_completed`, meaning "this request is closed", with **no** provider call, **no** second hold and **no** second reservation (the response is not stored, so it is not replayed). A client that reuses a key for a different body gets the recorded state for that key; this happens only through a client bug (S11–S13, S46, S59).

**Retries.** Client: at most **1** automatic transport retry of the same `requestId` (ADR 0012 `AUTO_RETRY_LIMIT` hosted = 1), only when no response arrived and only while the user is still in the flow; never after relaunch. API: at most **1** retry to the **same provider, model, endpoint and disclosure route**, only for connection failure or 5xx before any response body, and only if ≥ 15 s of the deadline remain and `begin_attempt` succeeds inside the reserved envelope. No retry on 4xx, 429, timeout, invalid output or cancellation. Retries never change payload, route or model (ADR 0012 §8; AI-3). **"Try again"** after a lost response or an interruption is a **new** `requestId` with `supersedes`; it is new provider spend with its own envelope, but it continues the same workflow and its allowance hold (11.1, S29, S55).

### 11.1 Allowance holds (logical workflows)

The commercial allowance is held **atomically at admission**, not merely checked. Unit, balance, reset and the charging event are SHR-84's; this section sets no amount and no charging policy (BILL-03, BILL-08).

- **Workflow identity is server-derived.** A request with neither `supersedes` nor `pendingClarification` starts a new workflow (`workflowId` = its `requestId`). A request with `supersedes = K` ("Try again") or `pendingClarification.originalRequestId = K` (a clarification answer) continues K's workflow, but only if K was admitted for the same installation; otherwise it is refused (`403 installation_not_linked`) and reuses nothing (S51).
- **Hold.** Inside `admit_request`, after locking the acting subject's ledger row (`SELECT … FOR UPDATE`): if a hold or settled charge already exists for `workflowId` (on whichever subject created it), it is reused and no new unit is held (continuations and retries, S46–S47, including a continuation admitted after linking, S50). Otherwise available = SHR-84 balance − active holds; if it is below one unit the request gets `402 allowance_exhausted`, else an `allowance_holds` row `{subject, workflowId, state: held, created_at, expires_at}` is inserted. Hold, request row, lease and spend reservation commit together or not at all.
- **Races.** Two devices on one account, one unit left: both admissions serialize on the subject row; exactly one gets the hold and the other gets `402` (S45). Linking (4.3 step 3) takes the same subject locks in the same order; a hold stays on the subject that created it and is settled or released there; nothing is copied or duplicated (S50).
- **Settle/release (SHR-84 interface).** `settle_hold(workflowId)` converts the hold into consumption and `release_hold(workflowId)` returns it; both are idempotent and a hold is resolved **exactly once**. SHR-84 decides which outcomes settle. The contract expectations it must confirm or replace: cancellation before any result releases (S48, consistent with S27); a completion that cannot be recorded returns no plan and leaves the hold for the recovery sweep, which resolves it once under SHR-84's rule for workflows that returned nothing (S49); a clarification keeps the hold open for its continuation (S47); a hold past SHR-84's hold lifetime is resolved by the sweep.
- **Separation.** Provider cost (11.2) is separate from the allowance: an internal retry, clarification or invalid model output never consumes a second unit (BILL-07, BILL-08).

### 11.2 Provider-spend envelope and reconciliation

Aggregate **potential** provider billing must fit the reserved per-request, per-subject and global limits regardless of retry, cancellation, response loss, crash or day rollover.

- **Enforced input ceiling.** Each `MODEL_TABLE` row has `maxInputTokens` (Luna provisional **12,000**, revision 2's estimate now enforced) and a pinned `tokenizerVersion`. Before any attempt the relay counts the input tokens of the exact provider request: tool definitions, developer message, user message and a fixed per-request framing allowance. Above the ceiling → `413 request_too_expensive`, no provider call (S60). If the tokenizer is unavailable, the request fails closed. After an attempt, provider `usage.input_tokens` above the counted value raises an alert, is booked at actual cost, and pauses admission for that model row (`service_paused`) until the counting method is corrected. A character-to-token ratio is never the bound.
- **Per-attempt worst case** W = (`maxInputTokens` × the highest input rate in the pinned price row, which is the cache-write rate + `max_output_tokens` × output rate) × the regional uplift. Luna: (12,000 × $0.125 + 4,000 × $0.50) / 1M × 1.1 = **$0.00385** (prices DOCUMENTED; arithmetic, not an estimate).
- **Envelope.** E = W × `maxProviderAttempts` (Luna 2: the first attempt plus the one permitted relay retry; the Sol eval row sets 1, so it has no relay retry, section 14). Luna: **$0.0077**, within the approved `maxRequestCostMicros` of $0.01. A row whose E exceeds its `maxRequestCostMicros` refuses to start (S61). `admit_request` reserves the **whole** envelope against the per-subject daily backstop and the global daily and monthly caps, so a permitted retry never needs a new reservation and is never stopped by the budget mid-request. (Incremental top-up before a retry was considered and not chosen: it adds a second budget decision inside the deadline.)
- **Attempt ledger.** `begin_attempt(requestId, n)` commits an attempt row booked at W **before** the request is sent; no row, no send (S58). `complete_request` books each attempt from provider-reported `usage` at the pinned price. An attempt without usage (5xx before a body, connection reset after send, timeout, cancellation after send, lost API response, function crash) stays booked at **W permanently** in atePDF's ledger (S19, S52–S54). OpenAI organisation usage reports may be compared for drift alerts, but a booked unknown attempt is lowered only by per-attempt usage evidence, such as a late `complete_request` that carries it (S56). The unused part of the envelope (attempts never begun) is released at completion.
- **Abandoned requests.** When a lease expires without `complete_request`, the request becomes `abandoned`: its concurrency slot is freed, begun attempts stay booked at W, the unbegun remainder is released and the allowance hold is resolved by the sweep (11.1). Lease expiry never releases potential spend (S53, S56).
- **Recovery owner.** `reap_abandoned()` runs every minute from a Supabase scheduled job (pg_cron) and is implemented by SHR-81, which also alerts if it has not run for 5 minutes. `admit_request` additionally reaps expired leases of the installation and subject it locks, so concurrency recovery never depends on the job.
- **UTC day and month rollover.** Every reservation, attempt charge and actual cost is attributed to the UTC day and UTC month of the request's **admission**. Reconciliation adjusts that same bucket, never the current one; a new day or month starts at zero and earlier reservations stay in their own bucket (S57). The OpenAI project hard budget ($55 against the $50 monthly cap) absorbs boundary drift and OpenAI's own enforcement lag.
- **Ledger unavailable.** No admission, no attempt and no provider call. If `complete_request` cannot commit after an attempt, the plan is **not** returned (`internal`, not retryable; the client shows "Interrupted. Nothing changed."), its attempts stay booked at W and the sweep resolves the request (S49, S58).
- **Repeated request IDs** never reserve, hold or begin more than `maxProviderAttempts` attempts per key, however often they are sent (S59).

**Stale revision.** The service does not know workspace truth. The client discards any response whose `requestId` or `workspaceRevision` does not match current state ("Files changed. Ask again."); nothing executes and nothing is resent automatically (S28).

**Provider error mapping.** 5xx/connection → one retry within the envelope, then `provider_unavailable`; 429 → `provider_busy` + `Retry-After`, no retry; 400/401/403/404 → `provider_config_error`, alert, no retry; timeout → `provider_timeout`; malformed, truncated, multiple or zero tool calls → `invalid_model_output`, no partial plan (S19–S26). Supabase unavailable → fail closed (`service_paused`/`internal`); no provider call without a reservation and an attempt row.

## 12. Offline and outage policy (AI-9)

**New AI-routed PDF operations cannot be started offline or while atePDF AI is unavailable.** D-04/CONV-01 make AI the orchestration layer, D-08/BILL-02 forbid an unlimited manual-tool escape, and hosted metering is server-side (BILL-06). There is no silent local or cloud fallback (D-06).

| Condition | Detection | What the user sees | What still works |
|---|---|---|---|
| Mac offline | Reachability / connection failure before send | "You're offline. atePDF AI needs a connection to start new work. Nothing was sent." | Existing originals/results, previews, save/export, Undo to retained results, deletion, privacy and subscription settings, help (CONV-08, BILL-04) |
| atePDF API unreachable or 5xx (including an `iad1` outage; there is no Function failover) | Connection error after one retry | "atePDF AI isn't reachable right now. Nothing changed." + Try again | Same |
| Supabase unavailable | API fails closed | Same as above | Same; a signed-in session stays usable locally |
| Provider unavailable | `provider_unavailable` | "atePDF AI is having trouble right now. Nothing changed." + Try again | Same |
| Provider or API rate limit | `provider_busy` / `rate_limited` + `Retry-After` | "atePDF AI is busy. Try again in a minute." | Same |
| Global spend cap or kill switch | `service_paused` | "atePDF AI is temporarily paused. Your files are safe." (**never** "upgrade") | Same |
| Allowance exhausted (commercial) | `allowance_exhausted` | Approved exhaustion copy | Same |
| Disclosure unverified / changed | Gate or `disclosure_changed` | ADR 0012 §7.3 copy; class-A disclosure again | Same |

"Nothing was sent" is used only for a failure known to precede sending; an ambiguous timeout or connection loss never claims that nothing was transmitted. "Nothing changed" refers to the user's local files and results, not to provider receipt or billing.

No queued model work; no background retry after the user leaves the flow; no automatic replay after relaunch (STATE-02); no provider, model or region failover (AI-3); no manual processing path that bypasses intentional AI orchestration. Undo is a local restore to a retained result and stays available.

## 13. Technical concurrency and abuse limits (AI-6)

**Technical safety limits**, separate from the commercial allowance (SHR-84). Refusals never mention upgrading (BILL-07). Values live in one `LIMITS` constant; SHR-81 may tighten them with measurements. Enforcement is exact per subject inside the Postgres `admit_request` transaction (row locks and time-bucket counters), not in per-region edge counters.

| Limit | Provisional value |
|---|---|
| In-flight requests per installation | **1** |
| In-flight requests per account (all devices) | **2** |
| Minimum interval per subject | 1 s |
| Requests per subject | **10/minute, 120/hour, 400/day** |
| Request body | ≤ 24,000 B; instruction ≤ 1,000 chars; ≤ 40 artifacts; ≤ 3 clarification answers; ≤ 6 choices |
| Provider response body | ≤ 32 KB (a four-step plan is ~1.4 KB MEASURED) |
| Timeouts: provider attempt / API deadline / client deadline | 30 s / 40 s / 45 s |
| Anonymous sign-ins per IP (Supabase Auth) | 10/hour (default 30) |
| New installations registered globally per day | 200 during LEAN (alert at 80%) |
| Optional coarse IP limit on `/v1/*` (Vercel WAF, per region) | 120/minute per IP |
| Installation proof | Challenges single-use, valid 60 s; `rebind`/`rotate` rate-limited per installation (value in `LIMITS`, SHR-81) |
| Blocked subject | Manual owner action, or automatic after 3 `never_transfer`/schema-abuse denials or invalid installation proofs in 10 minutes (24 h block) |

## 14. Spend protection (AI-7)

Internal operating-budget controls, never presented as product limits. Recalculated for Luna with headroom for abnormal cases; they do not constrain normal use.

| Layer | Approved control |
|---|---|
| Per request: tokens | `max_output_tokens` **4,000** (includes any reasoning). Input **enforced** at `maxInputTokens` **12,000**, counted with the pinned tokenizer over the whole provider request before sending (section 11.2). A truncated output is invalid and never partially executed. This is a runaway ceiling ~8× above the largest expected output (~450 tokens), distinct from the 2,000-token cap removed in ADR 0007 |
| Per request: cost | `maxRequestCostMicros` per model row: **Luna $0.01**, which covers the reserved two-attempt envelope of **$0.0077** (per-attempt worst case $0.00385 at the cache-write input rate with the residency uplift; section 11.2); Sol eval row $0.10 with `maxProviderAttempts` 1 (envelope $0.077) |
| Per subject per day | Provider-cost backstop: guest **$0.25**, account **$1.00** (≈ 540 and ≈ 2,100 Luna `low`-effort calls, so the 400/day rate limit always binds first); crossing it → `rate_limited` until the next UTC day and an alert |
| Per account concurrency | 2 in flight (section 13) |
| Global daily cap | **$5**, reservation-based in Postgres at admission, on the UTC day of admission |
| Global monthly cap | **$50**, reservation-based on the UTC month of admission; fail closed if the ledger is unavailable |
| Provider backstop | OpenAI production project **hard budget $55/month** (hard limit returns 429, DOCUMENTED). It is a backstop, not an exact ceiling: "Enforcement is not instantaneous, so recorded spend can slightly exceed the configured amount" (DOCUMENTED, spend-limits guide). The Postgres reservations are the primary control |
| Platform backstops | Vercel spend management with production pause; Supabase spend cap on |
| Kill switch | `service_flags.ai_enabled = false` (takes effect on the next admission, no deploy) or `AI_ENABLED=false` env → every request `service_paused` |
| Alerts | 50/80/100% of daily and monthly caps; hourly spend > 3× the trailing 7-day hourly mean; any `provider_config_error`; new guests > 80% of the daily cap. Contentless, to the owner |
| Reservation semantics | Reserve the whole attempt envelope at admission; book every begun attempt at its worst case before sending; reconcile to actual `usage` where the provider reports it; an attempt with unknown usage stays booked at worst case permanently; lease expiry frees concurrency only; buckets are the UTC day and month of admission; a duplicate `requestId` never reserves twice (section 11.2) |

The $50/$5 caps cover **AI provider spend**. Fixed platform subscriptions are separate and do not scale with beta usage: Vercel Pro $20/month and Supabase Pro $25/month (DOCUMENTED list prices), plus the custom SMTP provider that email one-time codes require (not yet chosen; cost UNKNOWN).

## 15. Cost model

Assumptions (ESTIMATE unless marked): fixed prefix **4,200 tokens** (15,012 chars MEASURED at ~3.6 chars/token; range 3,700–5,000); variable input from the MEASURED request sizes; output from the MEASURED plan sizes; reasoning tokens 0 at Luna `none`, 200–800 per call at `low` (UNKNOWN; not published); the fixed prefix is cached (explicit breakpoint) with an 80% hit rate; a miss is priced at the cache-write rate (1.25×); the user message is always uncached; +10% data-residency uplift; mix 45% simple, 25% follow-up, 20% clarification, 10% multi-step; 1.5 planner calls per workflow. Prices DOCUMENTED. Details: [`cost-model.json`](../evidence/SHR-79-2026-09-30/cost-model.json).

**Expected production cost — GPT-6 Luna, effort `none`:**

| Call type | Input tok | Output tok | $/call (before the +10% uplift) |
|---|---|---|---|
| Simple request | ~4,500 | ~110 | ~$0.00022 |
| Follow-up | ~5,000 | ~150 | ~$0.00029 |
| Clarification question | ~4,600 | ~60 | ~$0.00021 |
| Multi-step (4 steps) | ~4,600 | ~450 | ~$0.00040 |
| **Blended over the call mix (incl. +10% residency)** | | | **~$0.00028** |

These are expected, no-retry estimates, not guarantees and not the enforced bound. The enforced per-request bound is the reserved attempt envelope in section 11.2 ($0.0077 on Luna).

| Profile (illustrative workflow counts; allowances are SHR-84's) | Calls/month | Luna `none` | Luna `low` |
|---|---|---|---|
| Active guest (10 workflows) | 15 | ~$0.004 | ~$0.007 |
| Pro light (20) | 30 | ~$0.01 | ~$0.014 |
| Pro normal (100) | 150 | ~$0.04 | ~$0.07 |
| Pro heavy (500) | 750 | ~$0.21 | ~$0.35 |

At the approved caps, $50/month covers ~177,000 Luna `none` calls (~108,000 at `low`), and $5/day covers ~17,700. Provider cost is negligible next to fixed platform fees at beta scale.

**Contingency and eval cost — GPT-6.1 Sol, effort `low`** (not a production default): blended ~$0.0089 per call (~32× Luna), ~$1.34 per normal Pro user-month and ~$6.70 per heavy one; worst case ≈ $0.077 per request. If a measured Luna failure ever led to Sol, $50/month would cover only ~5,600 calls, so the budget would return to the owner with that proposal. SHR-107/108 eval runs use the dev project and a separate eval budget.

## 16. Operating budget (AI-7)

**Approved: LEAN** — $50/month and $5/day of AI provider spend; OpenAI project hard budget $55; 200 new guests/day; kill switch; alerts at 50/80/100%. Suitable for an owner-invited private beta. OpenAI's lowest paid usage tier (Build, $500/month limit) suffices.

| Later option (not approved) | Monthly / daily cap | When |
|---|---|---|
| NORMAL | $300 / $20 | Public beta, after two weeks of real cost and call data |
| GROWTH | $1,500 / $75 | After conversion data (MEASURE-02, SHR-84) |

On Luna, these caps are unlikely to bind in normal use. They exist to stop runaway loops, abuse and misconfiguration. Raising them is an owner decision.

## 17. Observability and platform logging (AI-8)

One structured, contentless log line per request, written by atePDF code. Vercel keeps it with its runtime logs (1 day on Pro with the project excluded from Observability Plus). Aggregates go to Postgres.

| Allowed field | Example |
|---|---|
| `ts`, `requestId`, `attempt`, `supersedes` | opaque IDs |
| `subject` | `subject_…` (opaque internal subject for metering and abuse) |
| `modelConfigId`, `model`, `effort`, `promptVersion`, `disclosureVersion` | config identifiers |
| `outcome` / error `code`, HTTP status, `retryCount` | enums/ints |
| `latencyMs` (API total, provider), `inputTokens`, `cachedTokens`, `cacheWriteTokens`, `outputTokens`, `reasoningTokens` | numbers |
| `costMicros` (estimated at admission, actual at completion), `priceTableVersion` | numbers |
| `admission` (ok/allowance/rate/concurrency/budget/paused), `entitlementOutcome` | enums |
| `appBuild` | version |

**Never logged or stored:** instruction or clarification text, model output text, file names, refs mapped to anything, page counts or size buckets per file, selector results, PDF content, OCR/extracted text, request or response bodies, provider error bodies, tokens, keys, passwords, secrets. IP addresses are never written by atePDF code.

**Platform defaults reviewed (DOCUMENTED) and the chosen configuration.**

| Platform | Automatic capture | Can it be disabled? | Configuration |
|---|---|---|---|
| Vercel runtime logs | Method, path, **query string**, status, host, user agent, client IP, region, firewall result, function metadata, **outgoing sub-requests**, every `console.*` line. No documented header or body field; body retention **UNKNOWN** | No. Observability Plus (30-day retention) is **on by default** for Pro teams created after 3 April 2026; a project can be excluded | Exclude the API project from Plus (1-day retention); no drains; no query strings; never print bodies, headers or provider responses; one allowlisted line per request |
| Vercel Firewall observability | Traffic by IP, user agent, path, ASN, JA4, country | — | Accept (metadata only) |
| Supabase Auth logs / audit logs | Events incl. user ID, email, IP, user agent; 7 days (Pro) | Database copy can be toggled off; service logs have no documented off switch | Turn off the `auth.audit_log_entries` database copy; accept 7-day service logs (identity metadata only) |
| Supabase API gateway (Data API) logs | Path, **query string**, IP, headers allowlist, JWT subject; 7 days | No documented off switch | **Not used by the relay**; the Mac calls Auth endpoints only |
| Supabase Postgres logs | DDL; text of **failing** statements; 7 days | `log_statement` per role | Relay role `log_statement = 'none'`; statements carry IDs and numbers only, never content |
| OpenAI | Abuse-monitoring logs (section 7) | Only by ZDR/MAM approval | Applied for (AI-4) |

Retention: log lines 1 day (Vercel); `requests` rows 30 days, then folded into daily aggregates (counts, tokens, cost per model and outcome; no subject) kept 400 days for cost accounting; per-subject counters for the metering period plus 30 days (SHR-84/95 set the final periods). Access: the owner only.

## 18. Failure and recovery

"Hold" is the commercial allowance hold (11.1); "spend" is provider cost (11.2). They are resolved independently.

| Event | Behaviour | Allowance | Provider spend |
|---|---|---|---|
| Provider timeout | Abort upstream; `provider_timeout`; Try again | Hold resolved once under SHR-84 (never charged on a timeout) | Attempt stays booked at worst case (no usage) |
| 5xx before a body, then a successful retry | One retry within the envelope (S19) | One hold | First attempt at worst case permanently; second at actual |
| Client transport retry | Same `requestId`: `in_progress`/`already_completed`, or admitted if no record exists | No second hold | No second reservation |
| Response lost after completion; user taps Try again | New `requestId` with `supersedes` = old (S29, S55) | Same workflow, same hold: at most one unit | New envelope (it is a new provider call) |
| Cancel | Upstream aborted; `cancelled` (S27, S48, S54) | Released under SHR-84's rule | Sent attempts at worst case unless usage arrived |
| App closes mid-request | Request aborted on disconnect; lease expires; nothing resumes on relaunch; "Interrupted. Nothing changed." | Resolved once by the sweep | Begun attempts at worst case |
| Late response | Client discards by binding; server already recorded `cancelled`, `completed` or `abandoned` | Unchanged | A late usage report may lower an attempt to actual (S56) |
| Invalid structure from the model | `invalid_model_output`; no retry | Not a second unit | Counted as internal cost |
| Vercel function crash or redeploy mid-request | Client's one retry with the same key gets `in_progress`, or `already_completed` once the lease expired and the request is `abandoned` (S31, S53) | Resolved once by the sweep | Begun attempts at worst case; unbegun remainder released |
| `complete_request` cannot commit | No plan returned; `internal` (S49) | Left for the sweep; resolved once | Attempts at worst case |
| Supabase outage | Fail closed before any provider call (S58) | None held | None reserved |
| Session revoked or account deleted mid-flow | Admitted request may finish; next admission `session_revoked` (S68) | Unchanged | Unchanged |

## 19. Eval integration (SHR-107/108)

- **Candidate configuration** = one versioned row: `{provider, model, effort, promptVersion, toolsVersion, routingPolicy, maxOutputTokens, priceTableVersion}` → `modelConfigId`. Production runs only rows listed in `MODEL_TABLE`; the v1 row is `gpt-6-luna` / `none`.
- **SHR-107** runs a candidate through the same request builder and API validation code (mocked, or against the dev project with separate authorisation) and records per case: hard-gate results, plan/tool accuracy, clarification errors, invalid plan rate, input/cached/cache-write/output/reasoning tokens, latency and cost from the pinned price table.
- **SHR-108** compares model, effort, prompt, tool descriptions and routing on dev and held-out sets, with Luna as the incumbent and Sol as the benchmark.
- **Promotion rule (approved).** Luna stays unless held-out results show it fails an approved quality or safety threshold. Hard gates may never regress: privacy/consent, unsupported-tool invention, schema-invalid plans, stale-target execution, unnecessary provider calls. Dev-set gains alone never qualify. Any proposed change returns to the owner with the measured failing cases, and a provider change also needs a complete new recipient record and a fresh class-A disclosure.
- Eval traffic uses synthetic fixtures, the dev project and its own budget, never the production key or budget.

## 20. Security and privacy implications

- The instruction route has two recipients besides atePDF (Vercel, OpenAI); Supabase holds identity/state only. All records must be complete before production traffic (ADR 0012 PRIV-7).
- Neither Vercel nor Supabase receives PDF bytes, rendered pages, file names, OCR or extracted text, local-understanding outputs, document metadata, local paths or passwords. Supabase never receives instruction text. The only instruction-bearing hops at atePDF's side are Vercel's ingress region (in transit, TLS termination) and the `iad1` function's memory (section 7).
- Vercel's automatic logging of request metadata (including client IP and user agent) and Supabase Auth's logging of IP and user agent are unavoidable processor behaviour, disclosed in section 7; they contain no document or instruction content.
- The user's message is not written to OpenAI's prompt cache (explicit breakpoint after atePDF's fixed prefix); it is still subject to OpenAI's 30-day abuse-monitoring retention unless ZDR/MAM is granted. No zero-retention claim is made until then.
- No device identifiers, IP storage by atePDF, or fingerprinting. Provider sees only an HMAC.
- Supabase JWTs are short-lived (15 minutes) and verified locally, **and** every admission checks the live `auth.sessions` row and an active installation binding, failing closed if either is unavailable; revocation takes effect at the next admission, not at token expiry (section 4.4). The relay's database role can only execute a few functions; no Data API exposure of atePDF tables.
- The installation key never leaves the Mac; only single-use challenge signatures and the public key do. The app holds only the Supabase publishable key; no privileged key is ever in the app (section 4.1).
- Commercial allowance holds and provider-spend envelopes are reserved atomically at admission and resolved exactly once; lease expiry never releases potential spend (section 11).
- Provider host and model are server-pinned; client overrides are rejected (closes G7 for production).
- Budget exhaustion and the kill switch fail closed without upgrade copy.

## 21. OWNER DECISIONS — approved 30 September 2026

Shrey approved AI-1 to AI-10 on 30 September 2026 after revising AI-1, AI-2 and AI-5. Approval authorises SHR-80/81/82 implementation against mocks and local services. It does **not** authorise account creation, terms acceptance, deployment, paid calls, production secrets or spending; each of those needs its own authority.

| ID | Decision | Approved outcome |
|---|---|---|
| **AI-1** | Service hosting | **Vercel + Supabase.** Vercel hosts the thin atePDF API: holds the OpenAI key, validates, admits, calls the model, validates the structured response and returns the plan. No document processing, no PDF storage. Supabase provides Auth and Postgres for installations, accounts, linking, entitlement state, allowance ledger, purchase-linkage state, idempotency and technical usage/cost counters. **No Supabase Edge Functions for the relay.** Configuration per section 9. (Revision 1 recommended Cloudflare Workers + Durable Objects; not adopted.) |
| **AI-2** | Model/provider | **OpenAI, `gpt-6-luna`, lowest reasoning effort that passes SHR-107 (starting at `none`), no routing.** GPT-6.1 Sol is an eval benchmark, debugging reference and contingency only. Luna stays unless held-out evals show it fails an approved threshold; any change returns with measured failures first. (Revision 1 proposed Sol as the provisional default; not adopted.) |
| **AI-3** | Failover | **No automatic provider, model or region failover.** One bounded transport retry to the same provider, model, endpoint and disclosure route; otherwise an unavailable state. |
| **AI-4** | Retention/training | **OpenAI standard API controls for private beta**, provided ADR 0012's disclosure gate is satisfied: data-sharing/training opt-in off; `store:false`; abuse-monitoring retention (up to 30 days) disclosed accurately; prompt caching disclosed from current docs (`prompt_cache_options`, explicit breakpoint, `ttl: 30m`); US data-residency project; no zero-retention claim unless MAM/ZDR is granted; apply for MAM/ZDR; unresolved mandatory fields keep blocking production transfer. |
| **AI-5** | Identity | **Guest-first with Supabase Auth.** Random local installation ID + Supabase anonymous user; guest allowance on the installation's guest subject; an account only when needed (Pro purchase/access, restore, cross-channel entitlement, recovery); linking never grants another allowance; no password auth; no fingerprinting; the provider sees only an HMAC subject identifier. Includes the ADR 0012 field-class amendment in section 3.2. **Login method: the owner's approved SELL-3/SELL-4 policy in ADR 0014** (email one-time code as the required common login; Sign in with Apple optional and deferred, v1 not dependent on it; no atePDF account needed to buy through Apple; no accounts in the Setapp build), adopted in section 4.5. *Reference updated in revision 3 (30 September 2026): the approved row originally recorded "preferred login options Sign in with Apple and email magic link" pending SHR-85; this points it at the owner's later SELL-4 choice and is not a new decision.* The lifecycle mechanics (separate account user, installation key, session bindings, revocation) are revision-3 engineering corrections in section 4 |
| **AI-6** | Technical limits | **Approved in principle** as provisional technical limits, enforced in Postgres: 1 in flight per installation, 2 per account, 10/min, 120/hour, 400/day, bounded registration abuse controls and 30/40/45 s timeouts (section 13). Not commercial limits. |
| **AI-7** | Budget and spend | **LEAN: $50/month and $5/day** of AI provider spend, kill switch, alerts at 50/80/100%. Expected-case economics on Luna; Sol kept as contingency/eval cost. Per-request and per-subject ceilings recalculated around Luna with headroom (section 14). |
| **AI-8** | Observability | **Minimal contentless observability** (section 17): request ID, opaque subject, model, status, latency, token counts, estimated/actual cost, retry count, entitlement/allowance decision, timestamps. Never retain prompt/instruction text, file names, PDF content, OCR/extracted text, selector outputs, provider response bodies, passwords or secrets. Vercel and Supabase defaults reviewed; mitigations and unavoidable processor behaviour documented in sections 7 and 17. |
| **AI-9** | Offline/outage | **No new AI-routed work offline.** Existing files, previews, results, save/export, Undo, deletion and privacy/settings keep working. No queued model work, no automatic replay after relaunch, no manual processing escape hatch. |
| **AI-10** | Data sharing | **Off.** No OpenAI data-sharing/free-token programme. |

## 22. Consequences

- SHR-80 implements the Vercel API and the Supabase schema/functions against mocks and local Supabase, using sections 3, 4 and 11 and the 80 protocol cases, including transactional evidence for holds, envelopes and revocation (S45–S80). SHR-81 implements sections 11.2 and 13–16, including `reap_abandoned`. SHR-82 connects the Mac (two Keychain-held sessions, installation key) and section 12's states. SHR-84 supplies the unit, balance and settle/release rules for section 11.1's holds. SHR-86 implements ADR 0014's ledger on the section 4 identities; ADR 0014 (SHR-85) references section 4 and defines no second authentication scheme.
- Production traffic remains blocked by ADR 0012 until every recipient record is complete and verified against live configuration, and SHR-36/37 land.
- **Acceptance case map** ([`service-protocol-cases.json`](../evidence/SHR-79-2026-09-30/service-protocol-cases.json); acceptance mappings, not executed tests): transport, authentication and validation (sections 3, 4.4 and 11) S01–S10, S33, S35; idempotency, concurrency and rate (sections 11 and 13) S11–S15, S46, S59; commercial, budget and registration refusals S16–S18, S36; provider errors, output validation, cancellation, late and lost responses (sections 11 and 18) S19–S31; offline (section 12) S32; host, model and Supabase exposure pinning (sections 9 and 10) S34, S40–S42; provider identifier, request shape and caching (sections 3.4 and 4.1) S38, S39, S44; log canary (section 17) S43; allowance holds (section 11.1) S45–S51; spend envelope (section 11.2) S52–S61; session revocation (section 4.4) S62–S68; installation/account lifecycle (sections 4.1–4.3) S37, S69–S77; login (section 4.5) S78–S79; single-region execution (sections 7 and 9) S80. ADR 0014's shared lifecycle cases I01–I07 name the matching cases here (S37, S62–S64, S69–S74).
- Settles OPEN-09's service architecture, model, outage policy and budget. It changes no runtime behaviour, test, `PRODUCT_V1.md` requirement or public copy.
