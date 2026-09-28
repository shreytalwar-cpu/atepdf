# Chat-stack source registry
**Checked 28 September 2026. Current code/docs are inputs to the selection, not benchmark evidence.**

## CS01 | Minimal shadcn Chatbot README

Source: https://github.com/shadcn-ui/chatbot-template/blob/main/README.md

Method: web search/open.

Use: Minimal Next.js/AI SDK/shadcn template with streaming, tool calls and clarification examples.

Limit: No build or full dependency security audit performed.

## CS02 | Minimal shadcn Chatbot API route

Source: https://github.com/shadcn-ui/chatbot-template/blob/main/app/api/chat/route.ts

Method: GitHub.fetch_file.

Use: Public endpoint warning, message validation, model/step/output controls and abort handling; must add production access/rate/budget controls.

Limit: Blob SHA is not repository commit or released package version.

Inspected Git blob: `4254cb2ad9df6840d2c52991e12d2b19ba5ee2ef`.

## CS03 | Minimal shadcn Chatbot Chat component

Source: https://github.com/shadcn-ui/chatbot-template/blob/main/components/chat.tsx

Method: GitHub.fetch_file.

Use: useChat lifecycle, scroller integration, clarification handling and automatic tool-result continuation.

Limit: Source inspection only; no app runtime test.

Inspected Git blob: `957d2ae53e05f3962817659bbc9493dd6fc866cf`.

## CS04 | AI SDK transport documentation

Source: https://ai-sdk.dev/docs/ai-sdk-ui/transport

Method: web search; direct open unsupported markdown type.

Use: Custom request/response transport boundary; version-matched integration required.

Limit: Search index freshness is not a dependency pin.

## CS05 | assistant-ui ExternalStoreRuntime

Source: https://www.assistant-ui.com/docs/runtimes/custom/external-store

Method: web search.

Use: Host-owned state and capability-based UI; supports the documented fallback design.

Limit: No performance comparison or migration implementation.

## CS06 | assistant-ui attachments

Source: https://www.assistant-ui.com/docs/guides/attachments

Method: web search.

Use: Default AI SDK adapter converts files to base64 and sends file-content parts; unsuitable for the default Attenlo pipeline.

Limit: A custom adapter can change behaviour; not a claim that the library cannot support local-only files.

## CS07 | Codex project instructions

Source: https://developers.openai.com/codex/guides/agents-md

Method: web open; official redirect.

Use: Project instructions have path scope; nested handoff rules must be read/merged for sibling application code.

Limit: Do not overwrite existing repository/global instructions.

No third-party source code or font files are vendored. Recheck current release compatibility, licences and provider access at implementation. The earlier two-option comparison also inspected additional manifests/components; do not treat those old version numbers as a production lockfile.
