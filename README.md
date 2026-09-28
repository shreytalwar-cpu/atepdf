# atepdf

Fresh independent PDF application. One React Native / Expo conversation interface for web, iOS/iPadOS and Mac Catalyst. The working browser slice imports PDFs, merges locally, independently validates, previews inside chat, saves, removes pages and undoes changes. English OCR and bounded JPEG compression run locally too.

## Run locally

Node 24 and pnpm 11 were used for verification. Install dependencies with `pnpm install --frozen-lockfile`.

- `pnpm build` then `pnpm start`: production browser application at http://127.0.0.1:3210 (shared React Native interface inside the optional Next host).
- `pnpm expo:web` then `pnpm expo:preview`: independently exported Expo web application at http://localhost:3211.
- `pnpm expo:start`: Expo development entrypoint.
- `pnpm expo:bundles`: compile the iOS Hermes bundle. This does not build a native binary.
- Apple application project: `apps/universal/ios/atepdf.xcworkspace`, scheme `atepdf`; iOS/iPadOS and Mac Catalyst. See `docs/NATIVE_APPLE.md` and `scripts/native-tools/README.md` for the local engine and build setup.
- `scripts/native/mac-build.sh --launch`: build, locally sign, verify and launch the Mac Catalyst development app. See `docs/NATIVE_MAC.md` for its signing and sandbox boundary.
- `pnpm test:native:apple`: run the synthetic Apple PDFKit/Vision/ImageIO harness with the shared writer/controller. This requires macOS and Xcode's local services.
- `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`: type, fixture/controller and real browser checks. Browser checks need Chrome installed. Set `ATEPDF_BASE_URL=http://localhost:3211` to check the Expo export.

Try the two sample PDFs, then Merge. Type `remove page 2` and `undo`. Other supported local commands: `make searchable`, `compress`, `merge, OCR, compress`. Results and read-only previews stay in the conversation. Save before closing/reloading: local files and chat currently live only in session memory.

Current targets are **iOS/iPadOS, Mac and web** (ADR 0005). Android is deferred; its experimental source is preserved. Apple builds connect the shared local controller to PDFKit validation/preview, Vision OCR and ImageIO compression. Mac Save uses Apple's document export dialog and waits for copy confirmation. iOS/iPadOS Save opens the system share sheet and asks you to verify the destination; closing that sheet alone does not confirm a save.

The browser has an optional local OpenAI planning gateway. After the original two synthetic tests, the owner enabled a new allowance of 20 requests, each capped at 2,000 output tokens with no retries. Send now plans, validates and performs supported local operations in the same conversation; missing choices and image-quality changes still receive a relevant question. Native AI transport is not connected. Quick actions continue locally. No analytics, live billing, cloud PDF processing, production identity or user migration is configured. Commerce has disabled synthetic domain contracts only, not a purchase integration.

See [implementation and evidence](docs/IMPLEMENTATION_STATUS.md), [platform limits](docs/PLATFORM_CAPABILITIES.md), [privacy checks](docs/PRIVACY_TEST_REPORT.md) and [legacy evidence](docs/legacy-learning/SOURCE_AUDIT.md). The supplied v7 handoff is preserved in `atepdf_codex_build_pack/`. Owner-approved React Native and conversational workflow changes are recorded under `docs/adr/`; the handoff itself remains unchanged.
