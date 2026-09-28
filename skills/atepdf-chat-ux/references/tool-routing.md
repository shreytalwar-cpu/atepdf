# Skills and tools for atepdf UX

Inventory checked 29 September 2026. Tools listed below are exposed in the current Codex environment; connector authentication and operation were not tested by creating remote artifacts. Re-discover names and schemas in future sessions. No new MCP server or plugin is required for the core workflow.

## Skill selection

Load each skill's actual SKILL.md before applying it; do not load the whole catalogue. Plugin cache version paths can change, so use the active skill catalogue.

| Skill | Use in this workflow | Boundary |
| --- | --- | --- |
| `impeccable:impeccable` | Critique, extract existing tokens, clarify, adapt and polish a scoped surface. For planning, use its workflow guidance. | Preserve approved identity. Its HTML/CSS detector is not native React Native accessibility proof. Capture settled product context before a new-surface shape workflow. |
| `product-design:audit` | Evidence-led review of a multi-step flow with screenshot-linked findings. | Load its router/critical overrides/user-context preflight when actually auditing. Read existing context; do not overwrite shared design memory during an audit. A screenshot is not a usability study. |
| `emil-design-eng` / `review-animations` | A focused interaction or animation pass after the flow works. | Choose the matching skill, not both automatically. Apply web-specific guidance only to web; respect Reduce Motion and factual job status. |
| `build-web-apps:frontend-testing-debugging` | Browser workflow, responsive and failure diagnosis. | Test the Expo web output served by the local host, not a replacement website. |
| `build-web-apps:react-best-practices` | Relevant React rendering/state review. | Do not transplant Next server/DOM patterns into native code. No framework migration. |
| `build-ios-apps:ios-debugger-agent` | Real simulator application build/run/debug and evidence. | Current Apple UI is React Native/Catalyst, not a request to rewrite in SwiftUI. |
| `figma:figma-use` / `figma:figma-code-connect` | Optional editable flow/component design, then mapping to existing source. | Not required to begin implementation. Follow per-tool skill requirements; do not upload documents or existing user chats. |
| Handoff `attenlo-ui-fidelity`, `attenlo-chat-integration`, `attenlo-local-processing` | Approved design fidelity and local processing boundaries. | Read in `atepdf_codex_build_pack/.agents/skills/`. Old stack/no-assistant-ui clauses are superseded by owner decisions and ADRs; safety constraints still apply. |

## MCP and execution routes

| Capability | Available route | Concrete job |
| --- | --- | --- |
| Actual web inspection | `mcp__cua_repl.js` unified browser control | Observe the current page, use a separate synthetic session when needed, capture/inspect states. Follow its first-call documentation and supported APIs; do not reset a user's existing conversation. |
| Apple simulator builds and tests | XcodeBuildMCP: `discover_projs`, `list_sims`, `session_show_defaults`, `build_sim`, `test_sim`, `build_run_sim` | Build the existing workspace, target an explicit device and run a scoped suite. Inspect tool schemas; coordinate defaults/build ownership. |
| Native visual evidence | XcodeBuildMCP: `snapshot_ui`, `screenshot`, `record_sim_video` | Capture real hierarchy, keyboard layout, processing and transitions. Explicit CLI/XCTest targeting is a fallback where per-call device control is unavailable. |
| Optional design canvas | Figma connector: `figma_use_figma`, `figma_get_design_context`, `figma_get_screenshot`, `figma_get_variable_defs`, `figma_get_code_connect_map` | Inspect or develop an agreed synthetic UI/component specification and connect it to actual code. Callability does not prove auth. External uploads/public sharing/generation are not automatic. |
| Source and independent results | `exec_command`, `apply_patch`, `view_image` | Edit scoped source, run existing scripts, inspect saved screenshots and PDF outputs. These are execution tools, not a new MCP service. |
| Repeatable web regression | Repository Playwright CLI | Actual browser tests, network canaries, keyboard and responsive assertions. Playwright is installed as a project dependency; no Playwright MCP was verified or installed. |
| Present the artifact | `mcp__codex_app__open_in_codex` | Open the plan/source or local preview for review. Opening a tab is not a visual test. |

Mac native UI automation remains deferred by the owner. Do not confuse simulator control with authorization to unlock/control the Mac desktop. Figma, image generation and competitor browsing are optional; the working app is the acceptance artifact. No Stitch MCP was found in this inventory, and none is needed.

## Actual repository entry points

- Shared screen: `apps/universal/App.tsx`.
- Official chat adapters: `apps/universal/src/components/assistant-ui/`.
- Factual activity: `apps/universal/src/components/JobActivity.tsx`.
- Platform composer/preview/drop: `apps/universal/src/platform/`.
- Local truth and serialization: `packages/core/`, `packages/contracts/`, `packages/planner/`.
- Browser tests: `tests/e2e/`, `playwright.config.ts`.
- Native UI tests: `tests/native/ios/`; synthetic planner: `tests/native/planner/server.ts`.
- Saved-output reader: `tests/native/ios/verify-saved-export.mjs`.

Verified script entry points in package.json: `pnpm typecheck` (web only: apps/web/tsconfig.json), `pnpm test`, `pnpm test:e2e`, `pnpm expo:web`, `pnpm build`, `pnpm test:native:apple`. The last is a native helper suite, not full-app UI acceptance. Check universal/native TypeScript separately with `pnpm exec tsc --noEmit -p apps/universal/tsconfig.json`; that config exists in this repository. `pnpm build` performs the actual Expo export and Next production build; type checks and package validation are not application builds.

Before running a command inspect its current environment and output paths. `pnpm build` changes shared generated exports, and the Playwright configuration writes named evidence files; preserve previous evidence and coordinate the running beta before rebuilding. Use an isolated synthetic host/configuration for failure and privacy tests. Do not direct destructive tests or paid planner requests at the owner's live beta. Do not guess new CLI flags or MCP parameters from this reference.

## Practical prompts

- “Use $atepdf-chat-ux to plan the composer and active-document state contract; do not change application code yet.”
- “Use $atepdf-chat-ux to refine the existing result card and read-only preview with actual bundled PDFs. Keep all outputs in chat and verify Save/Undo.”
- “Use $atepdf-chat-ux to audit keyboard, large text and reduced-motion behaviour. Separate unavailable physical/Mac checks from simulator passes.”
- “Use $atepdf-chat-ux to review the diff for duplicate execution, false progress/save claims and accidental document-data egress.”
