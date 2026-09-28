# Repository, dependencies and delivery audit

29 September 2026. Source: `prototype-v0` (`5a6c0c542603cdb2a72bcdb2a91958ef3b6f12ab`). Static inspection only; no application, build, install, test, server, simulator or provider was run. Documentation and the requested Git freeze are the only mutations.

## Coverage and inventory

[REPOSITORY_INVENTORY.json](REPOSITORY_INVENTORY.json) records every tracked path, blob identity and size at the tag: 1,696 files. Top-level counts are 152 application files, 35 shared-package files, 48 test files, 28 script files, 219 handoff files, 1,199 documentation/evidence files and 15 remaining root/tool/skill files. `docs` contains about 188 MB of tracked material, mostly historical evidence. File counts and evidence volume are not capability or coverage measures.

All first-party source areas, entrypoints, manifests, local/native hosts and testing configuration were included in the audit. Historical packs and binary evidence were inventoried; relevant current decisions and selected result records were read. This is not a line-by-line security review of vendor code or a fresh execution of every historical artifact.

The independent repository boundary is documented in [legacy-learning/INDEPENDENCE_CHECK.md](../legacy-learning/INDEPENDENCE_CHECK.md). The old Attenlo source was neither needed nor read during this audit. Its prior bounded observation is hash-pinned in [source-snapshot.json](../legacy-learning/source-snapshot.json); no new legacy observation or portability claim is made.

| Area | Actual role | Disposition |
|---|---|---|
| `apps/universal` | Active Expo/React Native/assistant-ui interface, platform adapters, Apple project, deferred Android project/module | KEEP active architecture; REFACTOR bounded defects only after approval |
| `apps/web` | Optional Next host and planner routes; also unreachable pre-Expo UI and generated public copies | REFACTOR host ownership; REMOVE unreachable UI only after approval |
| `packages/contracts`, `core`, `web-pdf`, `planner` | Shared protocol, local state/jobs, local PDF writer/browser reader, development AI gateway | KEEP separation; review subsystem findings |
| `packages/commerce` | Disabled, unconnected synthetic commerce contracts | KEEP quarantined until commercial decisions |
| `tests`, `scripts` | Multiple independent runners and local build/host tools | REFACTOR reproducibility and one documented baseline |
| `atepdf_codex_build_pack` | Preserved original specification/hypotheses, superseded selectively by owner decisions | KEEP historical source; not a second roadmap |
| `docs/evidence`, older reports | Source-specific historical evidence; many duplicates/checkpoints | KEEP evidence; REFACTOR indexing/retention later |

## Frameworks and dependency truth

[DIRECT_DEPENDENCIES.json](DIRECT_DEPENDENCIES.json) contains all 32 direct runtime and seven development dependencies, exact declared and installed versions, and installed manifest licence declarations. All 39 installed versions match their pins. This reads manifests through their local filesystem paths; it does not mistake restricted package exports for missing dependencies.

Principal versions: Expo 57.0.25; React Native 0.86.3; React/React DOM 19.2.3; React Native Web 0.21.3; assistant-ui React Native 0.1.44; Uniwind 1.12.0; optional Next 16.3.6; pdf-lib 1.17.1; PDF.js 6.3.289; Tesseract.js 7.0.0; AI SDK 7.0.118/OpenAI adapter 4.0.78; Ajv 8.20.0; TypeScript 7.0.2; Playwright 1.63.0.

`pnpm-lock.yaml` has one root importer. `pnpm-workspace.yaml:1` configures two install-script decisions but no workspace package globs. The `packages` directories are source modules, not independently packaged/versioned workspaces. `apps/universal/package.json` duplicates some root dependency declarations and uses root autolinking. Neither root `engines` nor `packageManager` is declared; README describes Node 24/pnpm 11. Avoid calling this a reproducible multi-package workspace without a clean-machine baseline.

The existing [dependency review](../DEPENDENCY_AUDIT.md) and 619-package [SBOM](../dependency-sbom.json) are provenance/licence metadata, not a current vulnerability scan or completed distribution compliance. No advisory service was contacted. Root application licence and complete release NOTICE assembly are unresolved. Optional sharp/libvips distribution obligations and native packaging review remain open; no new licence interpretation is made by this audit. Read-only import tracing identifies some obsolete direct UI dependency candidates in the [frontend audit](FRONTEND_CAPABILITIES_AUDIT.md); no package was removed.

## Build and host paths

| Entry | What it actually does | Limits |
|---|---|---|
| `pnpm build` | Generates contracts/engine assets/gateway, exports Expo web, copies assets into Next public, runs Next production build | Mutates generated outputs; not run in audit |
| `pnpm expo:web` | Generates assets and exports web interface | Actual web export, not Apple binary |
| `pnpm expo:bundles` | Generates validators and exports iOS Hermes bundle | Not Xcode compile, sign, launch or save proof |
| `pnpm start` / `dev` | Loopback Next host on 3210 | Local development credential model, not production hosting |
| `pnpm expo:preview` | `scripts/serve-expo.mjs` loopback host | Older static-host protections and performance differ from beta launcher |
| `scripts/beta/beta.mjs` | Owned local start/stop/status; optional private native TLS listener | Does not build or install; owner-session preservation required |
| `scripts/native/mac-build.sh` | Release Catalyst build, local ad-hoc signing, strict signature/entitlement check | No Developer ID, notarization, App Store or production signing proof |

`apps/web/src/app/route.ts:5` returns the exported Expo HTML directly. Next layout metadata, CSS and viewport declarations (`layout.tsx:3`) are not evidence of the HTML delivered by that route. No active public marketing/SEO implementation, sitemap or robots file was found. Production indexing behavior must be explicitly decided and tested; the unused layout's noindex flag is not a release control.

`scripts/host-expo.mjs:4` copies new export entries without pruning old hashed assets. Numbered HTML/metadata/fixture copies in Next public were preserved by the freeze. These are duplicate/generated deployment material with stale-shell risk, not new functionality. No deletion is proposed as part of this audit.

The beta server validates static Host and realpath containment (`scripts/beta/server.mjs:74`, `:112`), checks export identity and manages process ownership. The older preview script has only lexical containment and follows symlinks (`scripts/serve-expo.mjs:18`), with no static Host allowlist. API gateway protections are separate; this is not an established planner-auth bypass. See the security audit for preconditions. Choose one supported host before production; the audit does not switch the running host.

Contract validators and AI product facts are generated checked-in source. `scripts/contracts.mjs`, `scripts/embed-product-knowledge.mjs` and build scripts form a drift boundary. Native bundle generation does not itself regenerate all gateway knowledge. A future gate should compare generated artifacts and source without silently accepting a dirty build. `app.json` and `.atepdf-project.json` production flags are declarations; do not assume they enforce access control.

## Apple, Android and delivery

Mac is the shared React Native app through **Mac Catalyst**, not a separate SwiftUI or React Native macOS application. The Apple project specifies iOS 16.4 and Mac Catalyst 13.4; Info.plist's minimum-system string differs from the Xcode target. No broad deployment-target acceptance follows from one simulator build. Pod configuration enables Catalyst throughout dependencies and native tooling assumes locally available Xcode/Node/CocoaPods. No second-machine reproducibility proof was established.

Development bundle identities are independent (`dev.atepdf.fresh`, Catalyst `dev.atepdf.fresh.mac`). The local Mac script signs sandbox/network-client/user-selected read-write entitlements and stages `/private/tmp/atepdf-mac-*` artifacts; launcher registration expects that path and hashes/signatures. Temporary-artifact survival is not a durable installer/update strategy. No production team/notarization/distribution pipeline was found. Android is deferred, outside default Expo platforms, with unfinished integration; do not market it as supported.

No tracked CI workflow, deployment provider config, container setup, EAS/fastlane distribution flow, service worker or PWA manifest was found in the tracked inventory. This states repository evidence, not the absence of any external account or deployment. Offline local engine operation after assets are available is distinct from cold-start offline installation.

## Testing and performance configuration

Root `pnpm test` includes only `tests/regressions/*.test.ts`; it excludes browser, launcher, Apple/Android, native transport and live-provider suites. Root `typecheck` covers the Next configuration; universal typing has a separate invocation in historical evidence. Playwright config uses Chrome only, one worker and an existing-server reuse path. Historical source identity checks improve confidence, but default runner configuration alone does not guarantee that an existing server matches the checkout.

Startup budget is 2.5 MB raw / 500 KB calculated gzip for entry scripts; lazy engines and images are outside this check. Actual beta-host gzip has historical tests and timing evidence, but the older host is different. One historical constrained pair improved first-control visibility from 12.320 to 3.342 seconds; full artwork remained 7.131 seconds in a separate observation. These are local lab observations, not real-user percentiles or a browser compatibility guarantee.

Major debt: highly compressed source lines; large orchestration component; divergent hosts; duplicate manifests/generated shells; unindexed historical reports; no single clean-checkout baseline; memory-resident results with repeated full-buffer copies. None requires a rebuild. Specific work should follow an approved scope and minimum regression baseline.
