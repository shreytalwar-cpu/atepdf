> **v7 source rule:** Work in the new independent atepdf repo. Attenlo PDF is read-only learning reference. Read `fresh-start/README.md` from the handoff root; never clone or modify the old app wholesale.

# Shadcn integration specification
**Selected path. This is an implementation contract, not a second product roadmap.**

Read [the stack decision](../STACK_DECISION.md), [architecture](../docs/02_ARCHITECTURE.md) and [protocol](../docs/04_AI_AND_PROTOCOL.md). Keep the new local controller independent. Inspect old controller/engine approaches read-only and selectively reuse only evidence-backed, isolated helpers with provenance.

## 1. Bootstrap the owner-approved fresh repository
Start a new Next.js + React + TypeScript project with shadcn/ui and AI SDK, fresh compatible pinned dependencies and new tests. Do not copy the old app router, lockfile or state hierarchy. In later sessions preserve and extend the NEW atepdf implementation. Review current upstream docs before selecting versions.

Inspect `components.json` and installed primitives. Run the applicable shadcn inspection/documentation command before adding/updating components. Avoid two primitive bases or competing design-token systems. Copying reusable source carries licence/notice obligations. Record upstream commit and the files used. Do not execute an unreviewed starter install script against the app.

Default components: existing Button, InputGroup/Textarea, Dialog/Sheet, Alert, Progress, Tooltip, accessible options and toast primitives; conversation-specific composer/scroller/question controls from the minimal template where useful. Express the approved palette through semantic tokens, not a generic black/grey theme. Keep interactive labels and controls code-native.

## 2. Logical modules
Adapt locations to the real repository; do not create duplicates just to match these paths.

```text
features/workspace/
  Workspace.tsx                 composition only
  FileDropArea.tsx               local import and empty state
  PromptComposer.tsx             draft, send, keyboard, local file chips
  ClarificationCard.tsx          single necessary question
  JobProgressCard.tsx            measured local events
  ResultCard.tsx                 validated artifact + preview/save/share
  ReadOnlyPreview.tsx            lazy local viewer
  WorkspaceController.ts        selection, focus and request revision
services/planner/
  PlannerClient.ts              outgoing allowlist and response binding
  PlannerTransport.ts           JSON/envelope or thin SDK adapter
services/jobs/
  JobController.ts              local job lifecycle
  LocalArtifactStore.ts         original/output bytes, ref resolution
workers/pdf/                    local engines, no model invocation
server/planner/                 secrets, schema/rate/entitlement gates
```

Do not serialize instances of File, Blob, handles, data URLs, object URLs, extracted text or display names from a store spread. Construct outbound objects explicitly. A schema rejecting additional keys is necessary but free-form instructions can still contain user-entered sensitive content; disclose and handle secure input accordingly.

## 3. Transport boundary
The public protocol remains the included JSON request plus gateway envelope. A simple bounded POST is acceptable and preferred for the first slice. The AI SDK stays useful on the server even if a custom frontend fetch is simpler than mapping the entire protocol into `useChat`.

When reusing `useChat`, use its version-matched custom transport/request builder. Only sanitised planner fields cross the wire. Never let the default full message list become the document database. Responses can become a typed data event containing the validated envelope. Presentation streams are not permission to execute incomplete operations.

Normal workflow:
1. Preflight files and capability set locally; capability failure occurs before a paywall or expensive model call.
2. Confirm prior AI consent. Typed password patterns trigger secure local entry where detectable; do not promise perfect secret detection.
3. Capture immutable request ID, workspace revision, selected refs, focused result and relevant prior plan.
4. Reserve one intent allowance with idempotency; enforce provider-call cost limits independently.
5. Gateway validates input, chooses server-side model, sends minimal context, returns a bound envelope.
6. Client checks schema, request/revision, file identities/order, actual capabilities and plan semantics.
7. Executor runs local steps and validates final output before promotion.
8. Commit the visible job allowance on accepted completion; reconcile failures/lost responses. Browser clients are not cryptographic proof of successful PDF processing, so backend abuse controls remain necessary.
9. Display measured result locally. No model call merely to narrate success.

One ordinary plan call is a default, not a ban on a genuinely necessary clarification. Bound all automatic retries. Keep model-request token accounting separate from successful user-job accounting.

## 4. Two independent lifecycles
Planner: idle -> requesting -> plan/clarify/unsupported/error/cancelled.

Local job: created -> preflight -> ready -> executing -> validating -> completed/partial/target_not_met/failed/cancelled.

The UI derives its state from both. `useChat.status === ready` does not mean a PDF finished processing. Pressing Stop during planning aborts the pending request and invalidates its binding. Pressing Stop during PDF work cancels the local worker/native operation, clears unpublished temp outputs and preserves prior committed versions. Never start execution inside a result renderer or an effect that can re-run on remount.

## 5. Resource ownership and repeatability
One job ID and a local job lock protect against double clicks/replayed callbacks. Keep a local ledger of promoted outputs and idempotent step application; do not claim exactly-once delivery from a browser/network alone. After restart, restore only verifiable local state. If no artifact survives, ask for reimport rather than displaying phantom files.

Original file refs do not change. Output refs identify versions. Undo changes the focused committed version. A new request while busy remains a draft or requires a clear stop-and-change action; do not silently execute on half-written output. Multi-output references require explicit focus or a concise clarification.

Release object URLs only when all preview/export consumers are done. Clean app-owned temporary files on cancellation/expiry according to policy. User-saved files and original picker sources are never removed by cleanup. Browser save initiation is not evidence of completed persistent save.

## 6. Production endpoint hardening
The minimal template's public route is demonstration code, not an approved public gateway. Add request-size, instruction-length, step-count, retry, output-token, deadline, session/IP abuse, concurrency and total-cost controls. Keep credentials server-side. CORS alone is not authentication. Validate guest/session and entitlement identifiers independently of client claims.

Never accept arbitrary tool names, external URLs to fetch, model names, provider credentials, code or filesystem paths. Reject unknown JSON fields and unsupported content types before model invocation. Do not log request or response bodies at proxies, SDK telemetry, crash reporting, traces or analytics. Use safe error codes and sanitized operational counters.

Public endpoints fail closed when required secrets/budget configuration are missing; do not fallback to an unbounded demo model. Local quick actions continue where supported. A template's demo web-search tool must not remain registered behind an invisible button.

## 7. Cost and dependency budget
Lazy-load PDF preview, OCR languages and WASM engines. Do not bundle every parser or markdown renderer into the opening screen. Shared worker loading must not trigger on every React render. Handle phone background/suspension honestly; no promise of indefinite background OCR.

Use exact pinned package versions after compatibility checks. Inspect use of unstable/internal APIs; prefer stable equivalents. Do not add Assistant Cloud, Vercel Blob, a hosted agent service or a document-storage bucket by default. The AI SDK does not mandate a hosting vendor in this architecture.

## 8. Native interfaces
SwiftUI and Kotlin clients consume the same application protocol and conformance fixtures, not React message objects. Share source where feasible and behaviour everywhere. Keep secure file access, native share/picker, keyboard/safe areas and cancellation native. No React Native migration is implied.

## 9. Completion evidence
Use [stack acceptance cases](STACK_ACCEPTANCE_CASES.jsonl) plus existing planner/growth suites. Capture actual app screenshots and outgoing request allowlists using synthetic canaries. Record implemented components versus borrowed components, lockfile/version pins, commands run, fixtures used and failures. Never turn a successful Python handoff check into a claim that TypeScript UI or native engines were tested.
