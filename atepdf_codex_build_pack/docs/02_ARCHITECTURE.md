> **v7 source rule:** Work in the new independent atepdf repo. Attenlo PDF is read-only learning reference. Read `fresh-start/README.md` from the handoff root; never clone or modify the old app wholesale.

# 02 | Architecture and repository strategy

## Final v3 web integration decision
Use shadcn/ui + Vercel AI SDK with selective reuse of the minimal shadcn chatbot. assistant-ui is reserved, not installed initially. Read `../STACK_DECISION.md` and `../implementation/SHADCN_INTEGRATION.md`. Build a new Next.js/React/TypeScript web project. Old React/Next.js/Vite code is read-only learning material, not the destination. Native and local-engine boundaries below remain. The platform protocol is the included JSON schema, not a React chat message type.

## New source, read-only learning
The owner explicitly chose a new independent repository. Do not integrate inside Attenlo PDF, clone its whole application or keep its architecture by default. Start from new Next.js/React/TypeScript, SwiftUI Apple and Kotlin/Compose Android source, with the same validated local-processing and planner contracts.

Inspect the old project only through the bounded read-only learning protocol in `../fresh-start/LEGACY_LEARNING_PROTOCOL.md`. Record source/commit and evidence status, successful ideas, rejected coupling and regression tests. The old checkout was not inspected when this pack was made. Missing source access does not block the new scaffold.

Use `../fresh-start/NEW_REPOSITORY_BLUEPRINT.md` as the new layout and isolation guide. Select upstream libraries independently. Port only a self-contained helper or synthetic test with provenance and new-app verification; no old root, lockfile, navigation or production configuration.

## Topology
```text
BROWSER / APP                         MINIMAL AI BACKEND
  selected local files                  authenticated/limited endpoint
           |                                      |
  local import + preflight              request schema + rate limits
           |                                      |
  allowlisted instruction manifest ----> cheap cloud planner
           |                           <---- structured plan only
  schema + semantic validation
           |
  local engine executor
           |
  output validation + version store
           |
  preview / save / user-directed share
```

There is no document-upload endpoint, remote OCR worker, server conversion queue, vector store or cloud PDF bucket. Public static engine/model-language assets may be downloaded; that is distinct from uploading customer files.

## Platform implementation
| Surface | UI and runtime | Local document layer |
|---|---|---|
| Web | New Next.js/React/TypeScript with a client-only workspace and shadcn components. | Dedicated workers, PDF.js preview, tested pdf-lib adapter, optional tested qpdf WASM and Tesseract.js. |
| iOS/iPadOS | SwiftUI, system file picker, Photos picker, share extension if feasible. | New local PDFKit/Core Graphics/ImageIO adapters; Vision OCR and specialist engines after verification. |
| Mac | Shared Apple packages, native SwiftUI window, real menus/keyboard/file access. | Fresh Apple engine adapters with tested upstream/native components; no Python or external executable requirement for customers. |
| Android | Kotlin/Compose, coroutines, Storage Access Framework, share intents. | PdfRenderer or a tested local renderer; tested qpdf/native bridge for transformations; ML Kit or Tesseract OCR adapter. |
| Backend | Small TypeScript API; choose one approved independent hosting target. Cloudflare Worker or existing server route is a deployment option, not a mandatory new service. | None. Only planning, rate limits, optional authentication and entitlements. |

Web APIs expose selected files locally [S14]; workers move CPU-heavy work off the UI thread but do not remove memory limits [S15]. Android's system document access is URI-based, not permission to crawl all storage [S12].

## What is shared
- Versioned JSON schemas and operation IDs.
- Canonical page-number, file-version and batch semantics.
- Planner prompt, request manifest and gateway.
- Design tokens, copy keys and image references; not necessarily identical widget code.
- Golden command cases, fixture expectations and operation invariants.
- Reusable native/C++ engines where cross-compilation is worthwhile.
- Product configuration and entitlement vocabulary.

There may be three small execution-controller implementations (TypeScript, Swift, Kotlin). Shared conformance tests prevent behavioural divergence. Do not introduce a custom Rust runtime, Kotlin Multiplatform layer or JavaScript VM in native apps solely to avoid a few hundred lines of platform code. Add shared runtime infrastructure only after an ADR shows clear benefit.

## Suggested logical repository layout
Use the new-project layout in ../fresh-start/NEW_REPOSITORY_BLUEPRINT.md. Never move or write into the old checkout. Preserve newly created atepdf work between sessions.
```text
apps/web/                     client UI and browser workers
apps/apple/                   Xcode project, iOS/iPadOS/Mac targets
apps/android/                 Compose app and instrumentation tests
apps/web/server/planner/      initial server-only gateway; shared API for all clients
packages/contracts/           schemas, DTO generation, versions
packages/design-tokens/       source tokens and platform exports
packages/web-pdf/              worker engine adapters
native/pdf-core/              selected engine bridge, only if needed
prompts/                      planner versions and examples
tests/fixtures/               synthetic PDFs/images
 tests/contracts/             cross-platform semantic conformance
 tests/planner/               model evaluation cases
 tests/privacy/               outbound traffic assertions
 tests/ui/                    browser and platform visual evidence
 docs/adr/                    architecture decisions
```

## Local file model
Separate a `LocalFileRecord` from a `CloudFileManifest`. Local records may contain filename, byte buffer/handle, OS URI, secure bookmark, content flags and local-only checksum. They must have no automatic JSON serialization into network requests. Cloud manifests contain only approved IDs, media kind, page count, byte count and a small availability flag set.

Opaque IDs identify immutable file versions within a workspace. Never use a customer filename as an object-store key, network log key or filesystem path returned by the model. A version records parent refs and operation lineage locally. A result set can have multiple files; `focusedResultRef` resolves “this file”.

## Execution model
Use a typed, bounded DAG rather than an open-ended agent loop. Model output is a proposal. A deterministic compiler resolves file selectors, validates input/output types, enforces batch semantics and injects mandatory validation after each output and before publishing final results.

Execution phases: import -> preflight -> plan/clarify -> compile -> local prerequisites -> execute -> validate -> commit version -> show result. Cancellation can interrupt any phase. A running step may produce a temporary artifact but cannot promote it to a completed result until validated.

Plans may refer to current source IDs or earlier output refs. No forward reference, cycles, arbitrary URLs, function names, subprocess instructions or output path injection. Keep a small maximum step count. A stale plan whose workspace revision changed must be rejected/rebound before it runs.

Batch jobs use bounded parallelism, default one memory-heavy item at a time on mobile. Results are committed individually only when semantically independent. If a merge input fails, do not silently omit it; if independent compression of one file fails, preserve successful outputs and report partial completion.

## Persistent data
Default: temporary local working files; local output versions during the session; optional opt-in recent-job persistence; saved compiled recipes without customer file bindings. No automatic cross-device document or transcript sync.

Web can start with memory and explicit temporary IndexedDB/OPFS storage as tested. Native uses app-private temporary storage with backup exclusions where supported. Set TTL cleanup as a policy, record exceptions and provide Clear local data. Browser eviction/background behaviour prevents guarantees of crash-proof persistence.

## Minimal backend
Required endpoints: plan request, configuration/capability version, anonymous session/limits and health. Optional later: login, entitlements, purchase verification/webhooks and account deletion. Do not add Supabase Storage or a document bucket. A separate approved metadata/account backend may be used after inspecting access controls; no legacy production project or data is inherited. It is not needed to prove the first merge workflow.

Use short-lived guest tokens, per-session/IP abuse controls, global spend limits and request size caps. CORS is not authentication. Mobile credentials are never trusted as secret static strings. Keep service API keys server-side.

## Delivery boundaries
Separate dev/test/staging/production. Public demo can use synthetic sample files, clearly labelled. The customer app must not ship a mock planner or simulated engine path as if it were real. Production file operations must still work without the AI gateway when initiated by a supported local shortcut or saved recipe.
