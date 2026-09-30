# atepdf

**The approved v1 target is [PRODUCT_V1.md](docs/PRODUCT_V1.md). Implementation remains paused pending a bounded owner task.** Start with [AGENTS.md](AGENTS.md), the specification, then relevant [decisions](docs/DECISIONS.md)/architecture and the assigned task. V1 is Mac-first, for both Mac App Store and direct distribution; web and iPhone/iPad launches must not delay Mac. Android remains deferred.

Keep target and evidence separate: [PRODUCT.md](docs/PRODUCT.md) describes current implementation; [AUDIT_PROTOTYPE_V0.md](docs/AUDIT_PROTOTYPE_V0.md) and the [audit index](docs/PROTOTYPE_V0_AUDIT.md) preserve the audited snapshot; [IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) records subsequent work and the known quick-action routing mismatch. The recoverable `prototype-v0` tag remains `5a6c0c542603cdb2a72bcdb2a91958ef3b6f12ab` ([freeze record](docs/audit/PROTOTYPE_V0_FREEZE.md)). Documentation adoption neither implements v1 nor marks findings fixed. The commands below are reference instructions, not permission to build, install or restart an owner session.

Canonical records: [Product](docs/PRODUCT.md) · [Architecture](docs/ARCHITECTURE.md) · [Design system](docs/DESIGN_SYSTEM.md) · [Privacy](docs/PRIVACY.md) · [Security](docs/SECURITY.md) · [Testing](docs/TESTING.md) · [Analytics](docs/ANALYTICS.md) · [Monetization](docs/MONETIZATION.md) · [Decisions](docs/DECISIONS.md).

Fresh independent PDF application. One React Native / Expo conversation interface for web, iOS/iPadOS and Mac Catalyst. The working browser slice imports PDFs, merges locally, independently validates, previews inside chat, saves, removes pages and undoes changes. English OCR and bounded JPEG compression run locally too.

## Private beta

After the browser export is built, use **Start atepdf.command** and **Stop atepdf.command** in `scripts/beta`. **Open atepdf Mac.command** opens the latest verified local Mac build. These shortcuts do not install, build, publish or change the request allowance. See [beta instructions](docs/INTERNAL_BETA.md) for historical pairing and private-beta acceptance instructions.

## Run locally

Reproducible PR verification uses Node **24.19.0** and pnpm **11.19.0**, pinned in repository configuration. From a clean committed checkout, run `node scripts/verification/verify.mjs`. See [verification and CI](docs/VERIFICATION.md) for exact prerequisites, gates, source-bound evidence, costs and manual Mac acceptance. For ordinary authorized development, install dependencies with `pnpm install --frozen-lockfile`.

- `pnpm build` then `pnpm start`: production browser application at http://127.0.0.1:3210 (shared React Native interface inside the optional Next host).
- `pnpm expo:web` then `pnpm expo:preview`: independently exported Expo web application at http://localhost:3211.
- `pnpm expo:start`: Expo development entrypoint.
- `pnpm expo:bundles`: compile the iOS Hermes bundle. This does not build a native binary.
- Apple application project: `apps/universal/ios/atepdf.xcworkspace`, scheme `atepdf`; iOS/iPadOS and Mac Catalyst. See `docs/NATIVE_APPLE.md` and `scripts/native-tools/README.md` for the local engine and build setup.
- `scripts/native/mac-build.sh --launch`: build, locally sign, verify and launch the Mac Catalyst development app. See `docs/NATIVE_MAC.md` for its signing and sandbox boundary.
- `pnpm test:native:apple`: run the synthetic Apple PDFKit/Vision/ImageIO harness with the shared writer/controller. This requires macOS and Xcode's local services.
- `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`: type, fixture/controller and real browser checks. Browser checks need Chrome installed. Set `ATEPDF_BASE_URL=http://localhost:3211` to check the Expo export.

Try the two sample PDFs, then Merge. Type `remove page 2` and `undo`. Other supported local commands: `make searchable`, `compress`, `merge, OCR, compress`. Results and read-only previews stay in the conversation. Save before closing/reloading: local files and chat currently live only in session memory.

Existing implementations cover **iOS/iPadOS, Mac and web** (ADR 0005); its equal platform priority is superseded by the Mac-first v1 target. Android is deferred; its experimental source is preserved. Apple builds connect the shared local controller to PDFKit validation/preview, Vision OCR and ImageIO compression. Mac Save uses Apple's document export dialog and waits for copy confirmation. iOS/iPadOS Save opens the system share sheet and asks you to verify the destination; closing that sheet alone does not confirm a save.

The current prototype has an optional local OpenAI gateway using GPT-6 Luna, with bounded development request allowance, no app-defined 2,000-output-token cap and no retries. Typed requests use the enabled planner; validated complete plans execute locally. The preserved uncommitted quick-action change makes explicit buttons run locally even with AI enabled. **That bypass is current working-tree behavior, not the approved v1 architecture:** D-04/CONV-01 retain intentional AI orchestration; this documentation task does not revert code. Failure/offline policy remains separately unresolved.

Apple development apps can pair with the local gateway; private TLS and tokens are development mechanisms, not production account identity. V1 requires atePDF-supplied AI without consumer keys or a local gateway (D-03). No production service, live billing, cloud PDF processing or user migration is established by adopting the specification. Commerce currently consists of disabled synthetic contracts.

See [implementation and evidence](docs/IMPLEMENTATION_STATUS.md), [platform limits](docs/PLATFORM_CAPABILITIES.md), [privacy checks](docs/PRIVACY_TEST_REPORT.md) and [legacy evidence](docs/legacy-learning/SOURCE_AUDIT.md). The supplied v7 handoff is preserved in `atepdf_codex_build_pack/`. Owner-approved React Native and conversational workflow changes are recorded under `docs/adr/`; the handoff itself remains unchanged.

The AI's maintained product facts and answer boundaries are in [AI product knowledge](docs/AI_PRODUCT_KNOWLEDGE.md). The shared local gateway embeds that document at build time; edits require a rebuild before they reach the model.
