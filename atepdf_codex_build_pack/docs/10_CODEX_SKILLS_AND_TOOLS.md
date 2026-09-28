# 10 | Codex skills, tools and session execution

## Final v3 entry
Read `../STACK_DECISION.md` and `../implementation/SHADCN_INTEGRATION.md`. The web stack selection is settled; do not restart a tool bake-off. Use the additional `attenlo-chat-integration` skill for the narrow transport/local-controller integration. Merge project-local skill pointers without overwriting global configuration.

## Use tools to ship, not to collect integrations
Development MCPs help Codex inspect docs, build, test and review. They do not belong in the customer app's runtime, and they must never become a route for customer PDFs to leave the device.

## Included project skills
Four original instruction-only skills live in `.agents/skills/`:
- `attenlo-ui-fidelity`: implement/compare the approved visual states.
- `attenlo-local-processing`: enforce real local operations, preservation and privacy.
- `attenlo-command-evals`: maintain protocol/model correctness and adversarial tests.
- `attenlo-release-check`: require evidence before marking a target ready.

Current Codex documentation supports repository-local `.agents/skills` and project `AGENTS.md` [S22, S23]. Merge carefully into the actual checkout; do not overwrite unrelated rules. The skills point at this pack's documents and need their paths adjusted if the handoff is relocated.

## Installed skill families worth using
When available in the Codex environment, read and use the relevant installed skills:
- Build Web Apps: frontend-app-builder, frontend-testing-debugging, react-best-practices; shadcn only if already adopted or appropriate.
- Build macOS Apps: swiftui-patterns, view-refactor, build-run-debug, appkit-interop, window-management, test-triage, signing-entitlements and packaging-notarization.
- Liquid Glass is optional for appropriate native chrome. It must not override the approved white/pastel design or introduce complex glass panels.
- Supabase/Stripe skills only if those services are actually chosen; do not create a backend/merchant dependency to satisfy a skill checklist.

Availability in this chat does not establish identical availability in the future Codex session. Discover first; use documented local CLI alternatives when a plugin is absent. Never report an installed tool merely because this file mentions it.

## Recommended small tool set
| Tool | Purpose | Boundary |
|---|---|---|
| OpenAI docs MCP | Current planner/API documentation. | Read-only docs; no user file content. [S24] |
| Existing GitHub integration or git CLI | Inspect code, review changes and CI. | No force push/publication or destructive operations without authority. |
| Browser tooling / Playwright | Real UI tests, screenshots and network assertions. | Use synthetic fixtures, not sensitive documents. [S25] |
| XcodeBuildMCP or xcodebuild | Apple builds/simulators/tests. | Requires actual toolchain; not proof of an app build by itself. [S26] |
| Android Studio/Gradle/adb | Android builds/device tests. | Use available SDK/toolchain; report missing device access honestly. |
| Figma/image generation, optional | Extract/build approved design assets and inspect fidelity. | Do not restart the approved design or publish files externally by default. |

The official documentation MCP can be configured using:
```sh
codex mcp add openaiDeveloperDocs --url https://developers.openai.com/mcp
codex mcp list
```
Use these only after inspecting existing configuration and permissions. Do not blindly replace `~/.codex/config.toml` [S24]. Pin third-party MCP versions, inspect upstream manifests and permissions, and prefer existing trusted installations over running arbitrary “latest” packages.

## Standard session loop
Read current status -> inspect affected code -> implement one vertical slice -> build/test -> run UI -> compare screenshots -> fix -> update status and evidence -> next slice. Keep a short active task list and completed task IDs. A session should leave executable progress, not only more documentation.

## Safe parallelism
Parallel agents can implement isolated adapters/platform UI after the schema is frozen for that milestone. Use one contract owner and one integrator. Coordinate token changes, dependencies and migration files. Never let agents independently rewrite app architecture or modify the same global config.

## Stop/ask rules
Ask only for genuinely missing credentials, paid licence decisions, OS signing/merchant setup, ambiguity not resolvable from approved design, or publishing authority. Continue independent local tasks while waiting. Do not automatically create cloud projects, purchase domains, submit apps or charge users.

## Useful completion report
- Exact implemented user journey and target platforms.
- Tests/commands actually run and failures/skips.
- Real app screenshots and visual mismatch ledger.
- Network privacy results and engine/model versions.
- Remaining unsupported operations, limitations and next task ID.

Do not say “production ready” based on a working landing page, mocked UI or a single browser test.


## Version 2 research and lifecycle workflow
A fifth original project skill, `attenlo-growth-lifecycle`, covers onboarding, paywall, purchase recovery, quota and self-service. The additional backlog is `growth/BUILD_TASKS.json`. When available, use the Appllama connector's `get_screen` with exact refs in `research/appllama/SOURCE_REGISTRY.json`. Do not invent a plugin install command or claim external tools exist without discovery. Media availability and recorded experiments can differ; log actual visual inspection. The original approved design remains authoritative. Appllama is a developer research tool, not a runtime service for customer files.
