# ADR 0012 — Pre-send privacy and operation-consent contract (SHR-35)

**Status:** **Proposed — pending owner approval** (PRIV-1 to PRIV-7, section 14). Nothing here is implemented, and nothing here approves a provider, a relay, a cloud document feature or any live traffic.  **Source:** `origin/main` `29f56ea919e73c12cdbd1c36f5f74cf37622347c` (30 September 2026).  **Authority:** `PRODUCT_V1.md` D-05/D-06/D-14, CONV-02/03/09, UNDERSTAND-04/05, PRIV-01–11, PDF-06, STATE-02, MEASURE-03/04, OPEN-08; [SHR-35](https://linear.app/shrey-talwar/issue/SHR-35/decide-the-pre-send-privacy-and-operation-consent-contract) (parent SHR-24); ADR 0010 (SHR-38) for grant/receipt persistence; SHR-71 recognized-secret guard as merged.  **Evidence:** [docs/evidence/SHR-35-2026-09-30](../evidence/SHR-35-2026-09-30/README.md) — machine-readable allow/deny cases.

This ADR defines what atePDF may send off the Mac, when, to whom, why, and with what permission. It is the contract that SHR-36 (enforcement gate), SHR-37 (consent UI and receipts), SHR-79 (service/provider) and SHR-95 (launch privacy/measurement/support) implement or build on. Where a rule needs a value only the owner can choose, the value is a recommendation under section 14 and SHR-36/37 must read it from a single policy constant, not hard-code a different one.

## 1. Principles (restated as enforceable rules)

1. **Default deny.** Every outbound payload is built by positive projection from an allowlisted schema. A field whose data class is unknown is not sent.
2. **Three classes.** Every outbound field is exactly one of: **H** (hosted instruction and minimal context), **C** (document or derived content) or **N** (never transfer). Section 3 assigns them.
3. **H needs disclosure; C needs a per-operation grant; N is refused.** No consent, setting, model output or retry can move an N item into a payload.
4. **Enforcement sits below the model and planner.** The gate runs in the client immediately before each network write and again at the atePDF relay. The planner, model output and UI cannot grant, widen or skip it (CONV-02, CONV-09, PRIV-07).
5. **Unknown disclosure blocks transfer.** A recipient without a complete, verified disclosure record (section 9) receives nothing. Nothing is inferred or filled with a plausible default.
6. **Cancel sends nothing.** Nothing in a proposed C transfer is uploaded, pre-uploaded or staged remotely before Allow.
7. **Grants do not survive change.** Any change in payload, source revision, derivation, purpose, operation or recipient route invalidates a grant (section 5).
8. **Consent is necessary, not sufficient.** A valid grant only permits a C transfer for a purpose that a separately approved feature task has added to the approved-purpose list. **In v1 as approved today that list is empty** (PRIV-11): no C transfer is possible until a feature, its recipient and its support promise are separately approved.

## 2. Current source (what exists today)

Outbound paths in current source: exactly one leaves the machine, the planner request from the local gateway to the OpenAI Responses API (`packages/planner/src/provider.ts:8-14`, `store:false`, `maxRetries:0`, SDK telemetry off). Everything else is loopback (browser/Mac Catalyst → local gateway), the opt-in LAN TLS beta listener (ADR 0009), or user-directed export/share/clipboard.

The planner DTO is a positive projection (`packages/contracts/src/protocol.ts:22-33`), re-projected by `validateRequest` in the client, native bridge and gateway (`packages/planner/src/request.ts`), and key-set checked in Swift (`AtepdfPlannerTransport.swift:99-120`). It carries: `schemaVersion`, `requestId`, `workspaceRevision`, `locale`, `instruction` (≤1000 chars after `privateInstruction`), `files[] {ref, kind, pageCount, sizeBytes, encrypted}` for every retained artifact (originals and up to 40 history results; `packages/core/src/job-controller.ts:82`), `selectionRefs`, `focusedResultRef`, `originalRefs`, `pendingClarification` (original instruction, up to 3 earlier user answers, model-authored question/choices), `previousActionIds` (always empty), `capabilities`, `previousPlan` (null), `ocrLanguages`. No bytes, text, OCR, previews, names, paths or checksums are projected. No end-user identifier is sent to the provider.

Local guards (`packages/planner/src/privacy.ts`): recognized-secret regex (`sk-…`, `password|api key|…: value`, `bearer …`), path/URL/encoding/base64/hex/filename-extension rejection, exact known-filename aliasing to refs, and page-text overlap rejection (whole page ≥ 8 chars or any 5-word window). SHR-71 applies secret exclusion before retention, persistence, clipboard and error receipts.

There is **no** consent state, recipient registry, disclosure versioning or per-operation grant. ADR 0006 removed the per-send confirmation. The "Processed on your device" modal (`apps/universal/App.tsx:404`) states that filenames and document contents are excluded, which the gaps below contradict (already flagged in `PRIVACY.md` and `SECURITY.md`).

**Gaps against this contract, recorded for Linear triage and not fixed here:**

| # | Gap | Contract rule |
|---|---|---|
| G1 | Exact `sizeBytes` and `pageCount` for **all** retained artifacts (including history) are sent on every request, a linkable fingerprint | §3 H-06/H-07, PRIV-1 |
| G2 | A filename without its extension (e.g. `invoice-acme`) passes aliasing and is sent | §3 C-10; §6 |
| G3 | Document excerpts of 1–4 words, and any text from scans without a text layer, pass the overlap check | §6 (disclosed limit) |
| G4 | Secret regex misses common forms (`AKIA…`, `ghp_…`, JWTs, "my password hunter2"); Swift layer has no secret check | §6; defence in depth only |
| G5 | The privacy modal overstates exclusion of filenames/content | §7 disclosure accuracy |
| G6 | `tests/live/planner.live.ts` writes full request bodies to tracked `docs/evidence/planner/live-test.json` | §8 support/evidence |
| G7 | `OPENAI_BASE_URL` inherited under `pnpm dev`/`start` can redirect provider traffic to an undisclosed host | §9 route pinning |
| G8 | No hosted-command disclosure version, no recipient record, no grant/receipt | §4, §5, §9, §11 |
| G9 | Docs drift: `PRIVACY.md`/`SECURITY.md` still describe the pre-SHR-71 raw-secret-in-chat defect; `PRIVACY_TEST_REPORT.md` mentions a removed token cap and disabled native AI | Documentation hygiene |

Validation for this ADR: source inspection plus the existing regression suites that cover the projection and guards. `planner`, `protocol-conformance`, `local-workflow`, `native-planner` and `workspace-persistence` regression files: **73 passed, 0 failed** on `29f56ea` (Node 24.19.0, no provider calls). No runtime behaviour changed.

## 3. Outbound data-flow inventory and data classes

"Metadata" is not presumed harmless. Filenames, PDF titles/authors, exact sizes and content hashes can identify a person, a matter or a specific document.

**Legend.** Class: H = hosted minimal context (disclosure, no per-operation sheet); C = content/derived (per-operation grant **and** an approved purpose); N = never. "Recipient" names roles; concrete parties come only from SHR-79 records (section 9). "Unknown" means transfer is blocked until SHR-79 supplies it.

| ID | Data | Nature | Class | Sender → recipient | Purpose | Retention / training / relays | Permission | Ever allowed? |
|---|---|---|---|---|---|---|---|---|
| H-01 | User instruction text (after local guards) | User-authored; may contain personal data (§6) | H | App → atePDF relay → model provider | Interpret intent, propose a plan | Per SHR-79 record; unknown ⇒ blocked | Hosted disclosure acknowledged | Yes |
| H-02 | Clarification chain: original instruction, ≤3 earlier user answers, model-authored question/choices | Previously sent user text + model text | H | Same | Continue the pending task (CONV-04) | Same | Hosted disclosure | Yes, bounded as today |
| H-03 | Opaque refs (`file_…`/`out_…`), kind, order, selection, focus, originals | Random local identifiers | H | Same | Address files without naming them | Same | Hosted disclosure | Yes |
| H-04 | Capabilities, OCR language codes, locale, schema version, request ID, workspace revision counter | App/protocol metadata | H | Same | Constrain the plan; bind response | Same | Hosted disclosure | Yes |
| H-05 | Abstract selector vocabulary (e.g. `invoice`, `scanned_pages`, `blank_page_candidates`) as **capabilities**, not results | Capability metadata | H | Same | Let the model request local resolution (UNDERSTAND-04) | Same | Hosted disclosure | Yes |
| H-06 | Page count per projected artifact | Structural document metadata | H (recommended) | Same | Validate page ranges in plans | Same | Hosted disclosure | Yes, **only for artifacts in the active projection** (PRIV-1) |
| H-07 | File size | Structural metadata; exact bytes fingerprint a file | H as a coarse bucket (recommended) | Same | Plan compression targets | Same | Hosted disclosure | Bucket only; exact bytes are C (PRIV-1) |
| H-08 | Result metadata returned to the model: status code, output page count, operation outcome enum | App-derived, non-content | H | Same | Continue the conversation | Same | Hosted disclosure | Yes |
| H-09 | Service authentication: guest installation ID or account token, entitlement check, idempotency key | Account/billing identifier | H (relay only) | App → atePDF relay | Metering, abuse control, entitlement (BILL-06) | Relay records per SHR-79/SHR-95 disclosure | Hosted disclosure + billing disclosure | Relay only; **never forwarded into model context**; any provider-side end-user identifier must be an opaque salted value named in the SHR-79 record |
| C-01 | PDF/image bytes (original, result, unlocked copy) | Document content | C | App → named processor | Only an approved content feature | Must be disclosed per record | Per-operation grant | Only for an approved purpose (none in v1) |
| C-02 | Rendered pages, thumbnails, previews, crops | Derived content | C | Same | Same | Same | Grant | Same |
| C-03 | Extracted text, text-layer excerpts of any length | Derived content | C | Same | Same | Same | Grant | Same |
| C-04 | OCR text and OCR confidence/geometry | Derived content | C | Same | Same | Same | Grant | Same |
| C-05 | Local-understanding outputs: labels ("invoice"), per-page blank/scan flags, dates, amounts, vendor, extracted fields, summaries, classifications | Derived content (UNDERSTAND-05) | C | Same | Same | Same | Grant | Same |
| C-06 | Embeddings, perceptual hashes, content hashes/checksums | Derived content | C | Same | Same | Same | Grant | Same |
| C-07 | Embedded document metadata: title, author, subject, keywords, producer, XMP, creation/modification dates, outline titles, annotation text, form field names/values | Document content | C | Same | Same | Same | Grant | Same |
| C-08 | Exact byte size, exact file dates | Identifying metadata | C | Same | Same | Same | Grant | Same |
| C-09 | Pasted document content detected in an instruction (§6) | Document content | C | — | — | — | Grant (and approved purpose) | Blocked in v1; the instruction is not sent |
| C-10 | File display names (full or partial) | Document metadata (PRIV-01) | C | — | — | — | Grant | Same as C-01; H payloads use refs |
| C-11 | Support diagnostics bundle that includes any C item | Derived content | C | App → named support recipient | Support request | Per SHR-95 | Grant + user-initiated export | Only if user explicitly adds it |
| N-01 | Document passwords, secure-field values, secure secret handles and their identifiers | Secret | N | — | — | — | — | **Never** |
| N-02 | Workspace encryption keys, Keychain items, any key material | Secret | N | — | — | — | — | Never |
| N-03 | Provider API keys, company credentials | Secret | N | — | — | — | — | Never (server-side only; ARCH-03) |
| N-04 | Bearer, pairing, refresh and CSRF tokens **as payload or model context** | Secret | N | — | — | — | — | Never in a payload, log or model context (transport `Authorization` to the intended atePDF endpoint is not a payload) |
| N-05 | Recognized secrets typed or pasted in chat | Secret | N | — | — | — | — | Never; the message is withheld (§6) |
| N-06 | Local filesystem paths, usernames in paths, security-scoped bookmarks | Local system identifier | N | — | — | — | — | Never |
| N-07 | Hardware/device identifiers, advertising IDs, device fingerprints | Identifier | N | — | — | — | — | Never (BILL-06 forbids invasive fingerprinting) |
| N-08 | Payment card and bank credentials | Financial secret | N | — | — | — | — | Never to atePDF AI; purchases go directly through StoreKit/the approved payment provider |
| N-09 | Data from other apps or clipboard content not deliberately pasted by the user | Third-party data | N | — | — | — | — | Never |
| N-10 | Raw provider/relay responses or error bodies that contain any N item | Secret | N | — | — | — | — | Never re-sent or logged |
| X-01 | Retries | Re-sends of an H or C payload | As payload | Same route only | Complete the same request | Same | §8 | Never with expanded payload or route |
| X-02 | Operational logs (local and relay) | Operational metadata | See §10 | — | Operate/debug | §10 | §10 | Contentless fields only |
| X-03 | Crash reports | Operational metadata | See §10 | App → Apple (OS setting) | Stability | Apple's terms | macOS "Share with app developers" | Contentless only; no third-party crash SDK |
| X-04 | Product analytics | Behavioural metadata | See §10 | — | — | — | Opt-in, SHR-95 | Off; not approved here |
| X-05 | Support export | Operational metadata ± C | See §10 | User-initiated | Support | SHR-95 | User-initiated review | Contentless by default |
| X-06 | User-directed export, share sheet, clipboard | User action | Outside the gate | User → chosen destination | User's choice | User's destination | The user action itself | Yes, but it is not an atePDF transfer (PRIV-10) |

**Classification rule for anything not listed:** unclassified ⇒ **deny**. A new outbound field needs an ADR amendment assigning its class before SHR-36's allowlist admits it.

## 4. Consent classes

### A — Hosted instruction and minimal context (class H)

* **Disclosure, not per-operation consent** (PRIV-02). Before the first hosted request, show the hosted-command disclosure (section 7) and record a `HostedDisclosureAck`.
* The acknowledgement binds to `hostedDisclosureVersion`, a hash over the ordered route and each recipient's disclosure version, and `policyVersion`. Any change ⇒ show the disclosure again before the next hosted request; until acknowledged, **nothing** is sent.
* **Keep the destination visible**: a persistent indicator near the composer names the current route (for example "Sends your message to atePDF AI · <provider>").
* Declining, or later turning off "Hosted AI", is **local-only mode**: no instruction leaves the Mac. Existing files, preview, export, Undo, deletion, privacy and subscription controls keep working (CONV-08, BILL-04). Whether new local results can be created without AI stays with CONV-08/OPEN-09; this ADR does not decide it.
* No per-send confirmation is needed for class H (this keeps ADR 0006's routine-send decision, limited to class H).

### B — Document and derived-content transfer (class C)

* Requires **all** of: an approved purpose; complete recipient records for every hop; a current class-A acknowledgement for any hosted hop; and a valid, single-operation `ContentTransferGrant` from an affirmative Allow in the pre-send sheet (sections 5 and 7).
* No standing "always allow", per-document or per-session permission in v1 (recommended under PRIV-4).
* An H request never carries a C item "because the user already consented to hosted AI" (PRIV-03).

### C — Never transfer (class N)

* The N rows in section 3. The gate treats N as a hard deny, independent of grants, settings, owner flags or build type. Detection of any N item in a payload fails the request closed and records a local contentless error event.

## 5. Consent record (`ContentTransferGrant`) and validity rules

### 5.1 Schema

Grants are **memory-only** and never checkpointed (ADR 0010, "never checkpoint … reusable content-transfer grants"). A relaunch therefore invalidates every grant. The persistent trace is the receipt (section 11).

```ts
type ContentTransferGrant = {
  schema: 'atepdf.consent-grant/1';
  grantId: string;                  // random, local
  workspaceId: string; deletionEpoch: number;   // ADR 0010 identities
  operation: { kind: string; planId: string; planDigest: string };  // plan the user saw
  purpose: { code: string; approvedPurposeVersion: string };        // must be in approved list
  transfers: Array<{               // one entry per network transfer the plan will make
    transferId: string;
    route: string[];                // ordered recipientIds, first hop first
    items: Array<{
      category: 'pdf_bytes'|'page_raster'|'extracted_text'|'ocr_text'|'understanding_output'
              |'embedding_or_hash'|'document_metadata'|'exact_size_or_date'|'file_name'|'support_bundle';
      sourceRef: string;            // opaque artifact ref
      sourceRevision: number;       // workspace revision the source belongs to
      sourceContentDigest: string;  // local SHA-256 of the source artifact bytes
      pages: number[] | 'all';      // canonical, sorted, 1-based physical pages
      derivation: null | { engine: string; engineVersion: string; paramsDigest: string; runId: string };
      itemDigest: string;           // SHA-256 of the exact bytes to be sent for this item
      byteLength: number;
    }>;
    payloadDigest: string;          // SHA-256 over canonical JSON of items (without byteLength)
  }>;
  recipientDisclosures: Array<{ recipientId: string; disclosureVersion: string }>;
  disclosureDigest: string;         // hash of the exact disclosure text shown
  consentCopyVersion: string; policyVersion: string;
  presentedAt: string; decidedAt: string;       // ISO-8601, from a monotonic-checked clock
  decision: 'allow' | 'cancel' | 'dismissed';
  expiresAt: string;                // decidedAt + GRANT_TTL (PRIV-4)
  state: 'pending'|'granted'|'in_flight'|'consumed'|'cancelled'|'revoked'|'expired'|'invalidated';
  invalidationReason: null | string;            // enum codes in 5.3
  userGesture: 'pointer' | 'keyboard' | 'accessibility';  // proves a user event, not model output
  appBuild: string;
};
```

Digests are **local-only** evidence: they are content hashes (C-06) and are never sent anywhere, including to the relay.

### 5.2 Deterministic validity check

The gate evaluates a proposed transfer in this order and returns the first failing outcome. It runs (a) when the sheet is built, (b) immediately before **each** network write, including every retry attempt, and (c) at the relay for the parts the relay can verify (route, categories, approved purpose, disclosure versions, idempotency).

1. Every field is in the schema allowlist with a declared class. Else **DENY `unclassified_field`**.
2. No N item present (secure handle types, recognized secret, path, key, token in payload). Else **DENY `never_transfer`**.
3. Every recipient in the route exists in the registry with `status: complete` and its current `disclosureVersion`, and the endpoint matches the pinned host. Else **DENY `recipient_undisclosed`** or **`disclosure_incomplete`**.
4. Hosted AI is on. Else **DENY `hosted_off`**.
5. A `HostedDisclosureAck` exists for the current `hostedDisclosureVersion` and `policyVersion`. Else **REQUIRE_DISCLOSURE**.
6. If the payload has no C items: **ALLOW** (class H).
7. The purpose is in the approved-purpose list (empty in v1). Else **DENY `purpose_not_approved`**.
8. A grant exists in state `granted` or `in_flight` for this `transferId`. Else **REQUIRE_CONSENT**.
9. All of the following are equal to their current values: `workspaceId`, `deletionEpoch`, `planDigest`, `purpose`, the transfer's `route`, each `recipientDisclosures[].disclosureVersion`, `disclosureDigest`, `consentCopyVersion`, `policyVersion`. For every item: `sourceRevision`, `sourceContentDigest`, `pages`, `derivation` (including `runId`) and `itemDigest` recomputed from the bytes about to be written; and `payloadDigest`. Else **REQUIRE_RECONSENT** with the first mismatching reason.
10. `decidedAt ≤ now < expiresAt`, and the clock has not moved backwards since `decidedAt`. Else **REQUIRE_RECONSENT `expired`** (or `clock_invalid`).
11. **ALLOW**; set `in_flight`. On completion set `consumed`. A consumed grant never authorises another logical transfer.

**Exact match only.** A strict subset (fewer pages) is a *different* payload and needs a new grant. This avoids subset logic bugs, and a new sheet is cheap.

**Regeneration invalidates.** Re-running OCR, extraction or rendering creates a new `runId`, even if the output is byte-identical. The user approved *that* output.

### 5.3 Invalidation reason codes

`file_changed` (source digest or revision), `pages_changed`, `derivation_regenerated`, `payload_changed`, `plan_changed`, `purpose_changed`, `recipient_changed`, `relay_changed`, `disclosure_changed` (retention, training, storage, region, subprocessors or logging), `copy_changed`, `policy_changed`, `expired`, `clock_invalid`, `workspace_cleared`, `relaunched`, `revoked`, `cancelled`, `hosted_off`.

### 5.4 Multi-step plans

One sheet may cover several transfers in one plan only if **every** transfer (route, items, purpose) is enumerated and shown. The grant carries one `transfers[]` entry per transfer. Any transfer not enumerated needs its own consent (PRIV-05).

## 6. Sensitive instructions (class H text)

Pattern matching is not anonymisation. The product must never say or imply that it removed personal information automatically.

| Signal (local, before send) | Behaviour | Status |
|---|---|---|
| Recognized secret (SHR-71 detector, extended over time) | **Withhold the whole message.** Do not send it, do not retain it, do not echo the value; direct the user to the secure field. No "redact and send": a hole in a sentence still leaks context. | Required (PDF-06) |
| Paths, URLs, encoded blobs, checksums, typed filenames (current `assertInstructionSafe`) | Block with guidance to use refs | Keep |
| Known filename (full, or without extension, or as the display title) | Alias to the ref locally before send. Ambiguous ⇒ ask locally. | Extend to close G2 |
| Overlap with locally extracted/OCR text (≥ 5-word window or whole short page) | Treat as C-09. In v1 (no approved content purpose) **block** with "Describe the change without quoting the document". When a content purpose is later approved, route to the class-B sheet instead. | Keep; threshold is a policy constant |
| Likely personal/financial data: payment card number (Luhn-valid), IBAN (checksum-valid), 9+ digit identifier runs, email addresses | **Inline pre-send check**: "This message looks like it contains <kind>. It will be sent to <route>. [Edit] [Send anyway]". Requires an explicit click; never auto-sends. Not a guarantee of detection. | Recommended (PRIV-5) |
| Instruction length above the limit (1000 chars today) | Block; long pasted text is the likeliest carrier of document content | Keep |
| Anything else | Sent as typed under the class-A disclosure. The disclosure says so plainly. | — |

**Confidence rule.** The gate blocks when it cannot classify a **field**. It does not claim to classify free text. Free text is always treated as possibly sensitive user content and is protected by disclosure, the checks above, a visible destination and local-only mode.

**Local-only mode exists** (section 4 A): the user can keep all text on the Mac by turning hosted AI off.

## 7. Pre-send experience

### 7.1 Hosted-command disclosure (class A)

Shown in onboarding (UX-01) and before the first hosted request, one screen, plain words:

> **Your files stay on this Mac.** When you ask atePDF to do something, your message goes to atePDF AI (<relay>) and <provider> so it can work out the steps. It includes your words, file numbers and page counts, but not your files, their names or their contents. <provider> keeps requests for <retention>; they are <training statement>. Don't type passwords here; use the secure field when asked. [Turn on atePDF AI] [Keep AI off]

Values in angle brackets come only from the SHR-79 record. If any is unknown, the screen says AI is unavailable and nothing is sent. The "Processed on your device" modal must be corrected to this wording (G5; SHR-37).

### 7.2 Content-transfer sheet (class B)

A sheet attached to the conversation, not a separate window. Top to bottom:

1. **Title as the question**: "Send page 3 of *Invoice March.pdf* to <recipient>?" (the local display name is shown locally and not sent).
2. **What leaves**: exact documents/pages and categories ("Page 3 as an image. Text recognised on page 3."), with size.
3. **Why**: one sentence of purpose.
4. **Who receives it**: every material recipient in route order, including the atePDF relay and any party that can see the unencrypted payload.
5. **Storage**: "atePDF doesn't keep it" (or the true statement); provider retention with duration; "Not used to train models" (or the true statement). A "Details" link shows subprocessors, region and deletion behaviour.
6. **If you cancel**: "Nothing is sent. Your files stay as they are." plus the local alternative, if any.
7. Buttons: **Cancel** and **Allow once**. No pre-checked boxes and no "don't ask again". Escape and Cancel both cancel. **Allow has no default-button/Return binding**; it needs a deliberate click, Space on focus, or VoiceOver activation. Initial focus is on Cancel. The whole sheet is VoiceOver-readable in the order above.

Nothing is uploaded or pre-staged while the sheet is open (PRIV-05). If the payload changes while the sheet is open (file changed, selection changed, disclosure updated), the sheet redraws with the change highlighted, and Allow is disabled for one second so the change can't be clicked through by accident.

### 7.3 States

| Situation | Behaviour |
|---|---|
| First time | Class-A disclosure first (if not acknowledged), then the class-B sheet |
| Repeat, identical payload later | New sheet every time. It may say "Same as you allowed at 14:02", but still needs Allow once. |
| Changed payload / pages / regenerated content | Sheet shows "Changed since you last allowed this: <what>" |
| Changed provider or relay | Sheet and, for hosted, the class-A disclosure are shown again, with the old and new recipient |
| Changed retention/training/storage terms | Class-A disclosure shown again with a highlighted difference before any hosted send; class-B sheets show the new terms |
| Revoked | "Turn off atePDF AI" revokes the class-A acknowledgement at once. "Stop" on an in-flight transfer cancels the request. If bytes had already left, say "Some data may already have been sent; atePDF can't recall it" (PRIV-06). Pending grants become `revoked`. |
| Offline / service unavailable | "Can't reach atePDF AI. Nothing was sent." No queueing, no background retry after the user leaves the flow. |
| Disclosure unavailable/unverified | "atePDF AI is unavailable because its privacy details couldn't be confirmed. Nothing was sent." Transfer blocked. |
| Expiry | Grant expires `GRANT_TTL` after Allow (recommend 5 minutes) or on relaunch, workspace Clear or epoch change. The sheet itself doesn't expire while open, but it is revalidated at Allow. |

## 8. Retries, failover and relaunch

| Case | Rule |
|---|---|
| Transport retry of the **same logical transfer** (connection failed, no response) | Allowed under the same grant/ack if checks 1–10 still pass. Same idempotency key, same bytes, same route. Bounded by a policy constant (recommend ≤ 1 automatic retry for H; 0 automatic retries for C). Counts as one use. |
| User taps "Try again" after failure | H: new request, sent if the current ack is valid. C: reuse the grant only if it is still valid, not consumed and unexpired, and the recomputed digests match. Otherwise show the sheet again. |
| Provider or region failover | Allowed only to a route whose recipients are **all** already in the acknowledged class-A disclosure and complete in the registry. For C, the route is part of the grant, so **any failover needs a new sheet**. Automatic failover to an undisclosed recipient is forbidden. |
| Relay changed (new host, new TLS terminator, new subprocessor) | Disclosure version changes ⇒ class-A disclosure shown again; C grants invalid (`relay_changed`/`disclosure_changed`) |
| Payload regenerated between attempts | `derivation_regenerated`/`payload_changed` ⇒ new sheet |
| Retry would add items, pages or recipients | Never; checks 9 and 3 fail |
| App relaunch, crash or restore | No transfer or hosted request resumes (STATE-02, ADR 0010). Grants are memory-only; receipts are inert history. |
| Relay-side retry to the provider | Same route, same payload; the relay may not switch provider unless the route in the request allows it and the disclosure named it |

## 9. Provider and service disclosure record (required from SHR-79)

SHR-35 does not choose a provider. Before **any** recipient receives H or C data, SHR-79 must supply a `RecipientDisclosure` verified from primary documentation **and** the actual account/endpoint configuration, with source links, verification date and verifier. Any `unknown` or missing required field ⇒ `status: incomplete` ⇒ the gate denies.

| Field | H | C | Notes |
|---|---|---|---|
| `recipientId`, legal entity name, display name, role (relay / model provider / processor / support) | ✔ | ✔ | Display name is what the user sees |
| Pinned endpoint hosts, and every party that terminates TLS or can read plaintext (CDN, gateway, proxy) | ✔ | ✔ | Each such party is a material recipient in the route |
| Data region(s) where material to disclosure | ✔ | ✔ | |
| Retention per mechanism: application state (`store`), abuse monitoring, logs, file/object storage, backups — with durations | ✔ | ✔ | `store:false` is not zero retention (PRIV-08) |
| Training/model-improvement use, and any data-sharing programme status | ✔ | ✔ | Optional sharing-for-credits stays off (PRIV-09) |
| Human review / abuse-monitoring access | ✔ | ✔ | |
| Logging by atePDF relay: what fields, retention, access | ✔ | ✔ | Bodies not logged by default (§10) |
| Subprocessors list and its version/URL | ✔ | ✔ | |
| Storage of the payload by atePDF | ✔ | ✔ | Must be "not stored" unless a feature approves otherwise |
| Deletion behaviour and whether per-request deletion is possible | — | ✔ | |
| Outage, retry and failover behaviour, including secondary providers/regions | ✔ | ✔ | Undisclosed secondaries are forbidden |
| End-user identifier sent to provider (none, or opaque salted value and why) | ✔ | ✔ | Never device identifiers |
| `disclosureVersion`, `verifiedAt`, `verifiedBy`, `sources[]`, `status` | ✔ | ✔ | Version changes on any field change |

Records ship with the app build as signed, versioned data. The relay reports its current version on each response; a mismatch blocks the next send until the app has a matching verified record. The app never renders a disclosure fetched from an unverified source.

## 10. Diagnostics, logs, crash reports, analytics and support

| Stream | Default | Allowed fields | Forbidden | Retention | User control |
|---|---|---|---|---|---|
| Local operational log (on the Mac) | On, local only | Timestamp, event/error code, operation kind, counts, durations, app build, per-launch random correlation ID | Instruction text, file names, paths, refs mapped to names, page text, labels, hashes, secrets, provider bodies | Rolling, recommend 7 days; removed by workspace Clear | Clear with workspace; included in support export only after review |
| atePDF relay operational log | On (service operation) | Request ID, timestamp, installation/account ID (for metering), route, model ID, token counts, latency, status/error class, idempotency key | Request/response bodies, instruction text, any C item | Disclosed in SHR-79/95 record; unknown ⇒ blocked | Covered by privacy policy and account deletion |
| Crash reports | Apple OS-level only, per the user's macOS "Share with app developers" setting | Apple's standard crash payload | No third-party crash SDK. Code must not put content, names or instructions in exception messages, thread names or assertions | Apple's terms | macOS setting |
| Product analytics | **Off. Not approved here** | — (SHR-95 decides; if ever added: opt-in, allowlisted events, no prompts, names, content, labels, screenshots or session replay; MEASURE-03) | Everything by default | SHR-95 | Opt-in toggle |
| Support diagnostics | Not sent automatically | User-initiated export generated locally from the local log and app/OS versions; shown in full for review before it leaves; the user sends it by a named channel | Any C item unless the user explicitly adds a document through a class-B sheet; any N item ever | SHR-95 support policy | User starts, reviews and can cancel |
| Test/evidence capture | Synthetic data only | Synthetic instructions and refs | Real user text; live request bodies written to tracked paths without review (G6) | Repository | Reviewer |

## 11. Local privacy receipt

Stored in the protected workspace manifest (ADR 0010 "minimal non-secret privacy receipt metadata"), cleared with the workspace, and never used as authorisation.

```ts
type PrivacyReceipt = {
  schema: 'atepdf.privacy-receipt/1';
  receiptId: string; grantId: string | null;       // null for class-A acknowledgements
  kind: 'hosted_disclosure' | 'content_transfer';
  operationLabel: string;                           // e.g. "Recognise text with <feature>"
  categories: string[];                             // section 5.1 enum, no values
  sources: Array<{ sourceRef: string; sourceRevision: number; pages: number[] | 'all' }>;
  recipients: Array<{ recipientId: string; displayName: string; disclosureVersion: string }>;
  purposeCode: string;
  retentionSummary: string; trainingSummary: string;  // copies of the shown one-liners
  decision: 'allow' | 'cancel' | 'dismissed' | 'acknowledged' | 'revoked';
  outcome: 'sent' | 'partly_sent' | 'not_sent' | 'failed_before_send';
  decidedAt: string; completedAt: string | null;
  bytesSent: number | null;
  consentCopyVersion: string; policyVersion: string;
};
```

Receipts do **not** store transferred bytes, text, digests, secrets, instructions or file names. The receipt view shows local display names by joining `sourceRef` to the live workspace at display time; after the artifact is gone, it shows "Removed file". Cancels are recorded (`not_sent`) so the user can see that nothing left.

## 12. Allow/deny cases for SHR-36/37 tests

Machine-readable form: [`consent-policy-cases.json`](../evidence/SHR-35-2026-09-30/consent-policy-cases.json). Baseline state for every case: hosted AI on; current ack; registry complete for route `[atepdf-relay, provider-a]`; approved purpose `test_purpose` added **only in the test fixture** (v1's real list is empty); grant `G` allowed for transfer `T` over `doc_1` rev 4, page 3, `ocr_text` run `r1`, TTL 5 min, not consumed.

| ID | Change from baseline | Expected |
|---|---|---|
| P01 | H-only request: instruction "merge these", refs, page counts, no C | ALLOW |
| P02 | Exact grant `G` payload, unchanged route/purpose, within TTL | ALLOW |
| P03 | H-only request, no ack for current disclosure version | REQUIRE_DISCLOSURE |
| P04 | Transport retry of P02, same idempotency key and bytes, grant `in_flight` | ALLOW |
| D01 | `doc_1` digest changed (file changed) | REQUIRE_RECONSENT `file_changed` |
| D02 | Pages `[3,4]` instead of `[3]` | REQUIRE_RECONSENT `pages_changed` |
| D03 | Same page 3, but only a subset of its OCR text (strict subset of the granted item) | REQUIRE_RECONSENT `payload_changed` |
| D04 | Route `[atepdf-relay, provider-b]` | REQUIRE_RECONSENT `recipient_changed` |
| D05 | OCR re-run, run `r2`, identical text | REQUIRE_RECONSENT `derivation_regenerated` |
| D06 | provider-a `disclosureVersion` bumped (retention 30→90 days) | H: REQUIRE_DISCLOSURE; C: REQUIRE_RECONSENT `disclosure_changed` |
| D07 | Payload contains a document password handle | DENY `never_transfer` (even with `G`) |
| D08 | Instruction contains `password: hunter2` | DENY `never_transfer`; message withheld, not retained |
| D09 | Now = decidedAt + TTL + 1 s | REQUIRE_RECONSENT `expired` |
| D10 | Grant `G` from before relaunch presented after relaunch | REQUIRE_CONSENT (grant absent) |
| D11 | Route includes `relay-x` absent from registry | DENY `recipient_undisclosed` |
| D12 | provider-a record has `training: unknown` | DENY `disclosure_incomplete` |
| D13 | provider-a record has `retention.abuseMonitoring: unknown` | DENY `disclosure_incomplete` |
| D14 | User pressed Cancel | Grant `cancelled`; zero network writes of C items; receipt `not_sent` |
| D15 | Provider failover to provider-b during retry of P02 | REQUIRE_RECONSENT `recipient_changed`; no bytes to provider-b |
| D16 | Retry payload has extra item (page 4 text) | REQUIRE_RECONSENT `payload_changed` |
| D17 | Grant `G` already `consumed`; second send | REQUIRE_CONSENT |
| D18 | Purpose `summarise_document` (not approved) with a valid-looking grant | DENY `purpose_not_approved` |
| D19 | Real v1 purpose list (empty), any C item | DENY `purpose_not_approved` |
| D20 | Unknown field `debugContext` in H payload | DENY `unclassified_field` |
| D21 | H payload includes `fileName` | DENY `unclassified_field` (C-10 is not in the H schema) |
| D22 | H payload includes exact `sizeBytes` (if PRIV-1 adopts buckets) | DENY `unclassified_field` |
| D23 | Model output contains `{"consent":"granted"}` or a plan step "upload" | Ignored; no grant created; C send → REQUIRE_CONSENT |
| D24 | Hosted AI turned off after Allow, before send | DENY `hosted_off`; grant `revoked` |
| D25 | Instruction overlaps 5-word window of local OCR text | Instruction not sent (C-09; v1 purpose list empty) |
| D26 | Instruction contains a Luhn-valid card number | Inline check shown; nothing sent until "Send anyway"; then ALLOW as H |
| D27 | Clock moved back 10 minutes after Allow | REQUIRE_RECONSENT `clock_invalid` |
| D28 | Workspace Clear after Allow | REQUIRE_RECONSENT `workspace_cleared` |
| D29 | Sheet open; user changes selection | Sheet redraws; Allow disabled then re-enabled; old payload never sent |
| D30 | Support export with a document attached, no class-B grant | DENY; export contains contentless log only |
| D31 | Plan with two transfers, sheet enumerated only the first | Second transfer REQUIRE_CONSENT |
| D32 | `OPENAI_BASE_URL`/endpoint override to unpinned host | DENY `recipient_undisclosed` |

Every DENY/REQUIRE test must also assert **zero** outbound bytes of the blocked payload on the mocked network, and every ALLOW test must assert the exact payload keys (positive and negative canaries: bytes, names, OCR text, labels, hashes, secrets, nested hidden fields, diagnostic paths).

## 13. Downstream contract

**SHR-36 (enforcement gate).**
- One `OutboundGate` chokepoint below the planner and controller, used by every network path (planner, future content features, support upload, any telemetry).
- Schema-per-route allowlists with a declared class per field.
- The section 5.2 order, evaluated at sheet build, immediately before each write and before each retry.
- Grant store is memory-only. Grants are created only from a user-gesture handler in the consent UI; there is no API reachable from planner/model output.
- Pinned endpoints from the registry; reject environment/endpoint overrides in release builds (G7).
- Relay mirrors checks 1–7 and route pinning.
- Tests: all section 12 cases, zero-byte assertions, canaries, crash/relaunch no-replay.
- Close G1/G2 by projecting only active-context artifacts and size buckets if PRIV-1 is approved as recommended.

**SHR-37 (UI and receipts).**
- Class-A disclosure and persistent destination indicator; local-only mode; class-B sheet exactly as section 7.2 (focus, no default Allow, VoiceOver order).
- Changed/repeat/revoked/offline/unavailable states (7.3); correct the privacy modal (G5).
- Receipts per section 11, persisted per ADR 0010, and a receipt list in privacy settings.
- Mac keyboard and VoiceOver verification.
- Mock all recipients. Production copy only from verified SHR-79 records.

**SHR-79 (service/provider).**
- A complete `RecipientDisclosure` for every hop (section 9) from primary documents and actual account settings.
- Named TLS terminators, no undisclosed failover, relay logs without bodies.
- An end-user identifier policy.
- Idempotency and retry bounds compatible with section 8.
- Until this exists, hosted production use stays blocked (OPEN-08/09).

**SHR-71 / SHR-66 / SHR-95.**
- SHR-71's detector feeds §6 and N-05; extending it (G4) is defence in depth, not a promise.
- SHR-66 keeps local-understanding outputs class C and exposes only abstract selectors (H-05).
- SHR-95 owns analytics, support channel and published retention wording, within section 10.

## 14. Owner decisions (pending)

Each has a recommendation. Nothing is approved until Shrey records a decision.

**PRIV-1 — What may be sent without a content-consent sheet?**
*Recommend:* class H only: instruction text after local guards; the bounded clarification chain; opaque refs, kind, order, selection/focus; capability and selector vocabulary; locale/schema/request/revision; result status enums; **page count only for artifacts in the active projection** (current result, selected originals, pending-clarification targets, not all history); **file size only as a coarse bucket** (for example <1 MB, 1–10 MB, 10–50 MB, >50 MB).
*Alternative:* keep today's exact sizes and page counts for all retained artifacts. This is simpler, but it leaves a linkable fingerprint (G1).
*Service-only:* a guest/account identifier goes to the relay only.

**PRIV-2 — What always requires explicit pre-send consent?**
*Recommend:* every class C row: bytes, rasters/previews, extracted and OCR text of any length, local-understanding outputs, embeddings/hashes, embedded document metadata, exact sizes/dates, file names, and support bundles containing any of these. Consent also requires an approved purpose, and v1 has none.

**PRIV-3 — What is never allowed to leave?**
*Recommend:* N-01 to N-10: passwords and secure-field values/handles, encryption keys and Keychain items, provider keys, tokens as payload or context, recognized chat secrets, local paths/bookmarks, device identifiers/fingerprints, payment credentials, unrelated app/clipboard data, and secret-bearing provider responses.

**PRIV-4 — When does consent go stale?**
*Recommend:*
- **Single-use, exact-payload grants, with no standing permissions in v1.**
- TTL of **5 minutes** after Allow.
- Invalid on any section 5.3 reason, on relaunch or on Clear.
- Class-A acknowledgement is stale whenever any route recipient's disclosure version or the policy version changes.

**PRIV-5 — How are sensitive pasted instructions handled?**
*Recommend:*
- Withhold recognized secrets entirely.
- Block document-text overlap in v1.
- An inline "check before sending" confirmation for card numbers, IBANs, long identifier runs and email addresses.
- No automatic anonymisation or redact-and-send.
- A visible destination indicator.
- Local-only mode by turning hosted AI off.

*Alternative:* no warning tier, relying on the disclosure alone. This produces fewer interruptions, but gives weaker PRIV-03 evidence.

**PRIV-6 — What diagnostics and telemetry are on by default?**
*Recommend:*
- A contentless local operational log with 7-day rolling retention.
- Contentless relay operational logs without request bodies.
- Apple OS-level crash reports only, with no third-party crash SDK.
- **No product analytics** (SHR-95 decides any opt-in later).
- Support diagnostics only when the user starts them, reviews them and they are contentless by default.

**PRIV-7 — Which provider disclosures are mandatory before transfer?**
*Recommend:*
- Every field in section 9, for H and C alike. C additionally requires deletion behaviour.
- The record must be verified against the live account configuration, not only public documents.
- Any unknown field blocks transfer.

## 15. Consequences

- The v1 hosted planner can keep working under class A once SHR-79 records exist and SHR-36/37 land. Today's routine send stays, but it becomes disclosed, versioned and gated.
- No document content can leave the Mac in v1 until a separately approved feature adds a purpose. When one does, the consent machinery already exists and is tested.
- Grants are deliberately short-lived and exact, which trades some repeated prompts for deterministic, testable enforcement.
- This ADR does not change `PRODUCT_V1.md`, runtime behaviour, tests or public copy. It supersedes ADR 0006's "no per-send confirmation" only in scope: that decision now applies to class H alone.
