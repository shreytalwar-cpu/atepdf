> **v7 source rule:** Work in the new independent atepdf repo. Attenlo PDF is read-only learning reference. Read `fresh-start/README.md` from the handoff root; never clone or modify the old app wholesale.

> **v6 brand override:** The final product name is **atepdf** (lowercase), with the approved gradient numeral **8** logo. Read [brand/APPROVED_BRAND.md](brand/APPROVED_BRAND.md) and [brand/brand.json](brand/brand.json). The uploaded brand board is not a UI specification. Keep the earlier approved drop-and-instruct interface, scope and local-processing architecture. Older filenames and protected source labels are retained for compatibility.

# Final stack decision: choose the simpler web foundation
**Decision date: 28 September 2026 | Applies to the web application and shared planner boundary**

## Selection
**Option 1, selected:** reuse the minimal `shadcn-ui/chatbot-template` selectively; use shadcn/ui components and Vercel AI SDK in the NEW atepdf Next.js/React project.

**Option 2, reserved:** assistant-ui + shadcn/ui + the same AI SDK/planner backend. Do not install it initially or build a second full product. Use it only when a bounded integration demonstrates that it removes substantial generic conversation work without weakening the local-file boundary.

This is not shadcn versus assistant-ui at the visual-component level: assistant-ui can coexist with shadcn and the AI SDK. It is a choice between a thinner application-specific integration and an additional reusable conversation runtime.

## Why option 1 fits atepdf
The product is a file application with a conversational surface, not a general chatbot. We must build a local document-job controller under either option. That controller owns file versions, execution, cancellation, validation and exports. A chat framework cannot replace it.

The minimal template already provides streaming, tool-call examples and a human-in-the-loop questionnaire. Its inspected chat component uses AI SDK `useChat` for message/request state and has separate clarification handling. Its scroller comes from the shadcn message-scroller primitives. Reusing these avoids starting from a blank text field while preserving the approved one-screen design. [CS01, CS02, CS03]

Do not assume that more source files mean more savings. Build a new composer/file surface from approved primitives. Reuse only isolated old helpers with a recorded evidence/licence decision, not old UI components as an application shell. Use the upstream template selectively within the new root.

## What to reuse, replace and remove
| Template element | atepdf treatment |
|---|---|
| Composer, input controls and keyboard/scroll behaviour | Reuse where appropriate; restyle with approved tokens. |
| Clarification/questionnaire interaction | Reuse a single focused question with choices; no long questionnaire. |
| Request lifecycle and model SDK integration | Reuse behind a strict planner-client boundary. |
| Generic message renderer | Replace with typed instruction, clarification, job status, result, error and quota cards. |
| Default full-message serialization | Replace with an explicit allowlisted planner-request builder. |
| Model picker and gateway model menu | Remove from customer UI; server-configured model only. |
| Provider search and demo external tools | Remove; no web search, repository access or remote file tools in the customer runtime. |
| Automatic model continuation after tool outputs | Do not inherit indiscriminately. Normal PDF result needs no extra model response. |
| Public demo API route | Harden before public traffic; no exposed, unmetered inference endpoint. |

The source route warns that it is public and spends gateway credits. It validates messages and caps generation, but does not implement atepdf's full rate, entitlement, quota and budget controls. Its example step/output limits are not our production budget. [CS02]

## Non-negotiable state separation
1. **LocalFileStore:** original bytes, temporary working copies, previews, output versions and safe local display names.
2. **JobController:** validated plan, step lifecycle, ordered events, cancellation, output promotion, undo/focus and export.
3. **PlannerClient:** consent check, narrow serialization, network timeout, response binding and typed errors.
4. **ConversationView:** displays state and submits user intent; does not execute a plan merely because a React component rendered.
5. **Server gateway:** safe configuration, model call, semantic/schema checks possible from metadata, session limits and budget/entitlement accounting.

Stopping model generation and stopping local PDF processing are different actions. Stopping an export is different again. A completed stream is not a completed PDF job.

## Protocol, not SDK-specific state, is the shared platform contract
Keep the included JSON schemas as the application boundary. The provider output is `planner-response`; the gateway binds its original request ID/revision in `gateway-envelope`. Do not let the model invent or override those bindings.

A single JSON planning response is sufficient initially. If a UI data stream is useful, add a thin adapter from the same envelope. Do not couple SwiftUI/Kotlin clients to the AI SDK's entire chat message format. Never execute a streamed partial plan. AI SDK transport customisation supports controlling request construction; check the API for the version actually installed. [CS04]

## Why assistant-ui remains an excellent fallback
assistant-ui can be styled to match atepdf and can use externally owned state. Its external-store runtime accepts messages/callbacks and enables features from supplied capabilities, so branching, editing or multi-thread UI need not be exposed. It is not inherently a generic dashboard. [CS05]

It can reduce work if we start maintaining substantial reusable conversation behaviour. It also has a React Native route, relevant only if mobile architecture is separately changed. Neither benefit removes local PDF engine work or automatically migrates native SwiftUI/Compose code.

Its default AI SDK attachment adapter turns files into base64 content, and its documented backend path sends file-content parts. For atepdf, keep file import outside that default mechanism or replace it with a verified local-only adapter. This is essential, not optional polish. [CS06]

### Evidence gate for switching
Document concrete pain encountered in the first integration: duplicated generic thread/tool handling, repeated accessibility/scroll/queue defects, or an independently approved React Native direction. Build only a narrow proof with the same synthetic fixtures, data boundary and visual design. Compare application code owned, API stability, dependency impact, test outcomes and data exposure. Do not use stars, feature count or an arbitrary controller line-count threshold as the decision rule.

If the alternative materially improves the implementation, record a short ADR and seek approval before a material runtime migration. Do not quietly install both chat runtimes.

## Not selected
CopilotKit is a credible browser-tool/agent framework, but broader application-agent coordination is not needed for this bounded planner. Tambo's model-selected UI is not our current interaction model. AI Elements may supply an individual useful component but must not introduce a competing composer/runtime. Full Vercel Chatbot and LibreChat bring general-purpose chat/storage behaviour we would need to adapt. No new bake-off is required for the first build.

## Version and licence discipline
Use current upstream documentation for pinned releases. Record exact template commit, installed package versions, primitive base, lockfile and licences in the application audit. Retain applicable notices. A Git blob SHA in this pack identifies an inspected file, not a deployable commit or published package version.

No package version, optional hosted service or model ID in historical notes is an instruction to install it blindly. The existing package manager/lockfile takes priority unless a documented compatibility fix is necessary. Do not infer performance or time savings before integration tests. No third-party code is vendored by this decision document.

## Evidence and limits
[CS01-CS07 are listed in the source registry](research/CHAT_STACK_SOURCES.md). The prior conversation inspected additional template components; this final pass rechecked the route and Chat component and current public documentation. No live app integration, bundle benchmark or model-call test was performed to prepare this handoff.

**Build option 1 now. Keep option 2 as a documented escape route, not an excuse to postpone shipping.**
