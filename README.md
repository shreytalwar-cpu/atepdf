# atepdf

Fresh independent PDF application. One React Native / Expo conversation interface for web, iOS and Android. The working browser slice imports PDFs, merges locally, independently validates, previews inside chat, saves, removes pages and undoes changes. English OCR and bounded JPEG compression run locally too.

## Run locally

Node 24 and pnpm 11 were used for verification. Install dependencies with `pnpm install --frozen-lockfile`.

- `pnpm build` then `pnpm start`: production browser application at http://127.0.0.1:3210 (shared React Native interface inside the optional Next host).
- `pnpm expo:web` then `pnpm expo:preview`: independently exported Expo web application at http://localhost:3211.
- `pnpm expo:start`: Expo development entrypoint.
- `pnpm expo:bundles`: compile iOS/Android Hermes bundles. This does not build native binaries.
- `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`: type, fixture/controller and real browser checks. Browser checks need Chrome installed. Set `ATEPDF_BASE_URL=http://localhost:3211` to check the Expo export.

Try the two sample PDFs, then Merge. Type `remove page 2` and `undo`. Other supported local commands: `make searchable`, `compress`, `merge, OCR, compress`. Results and read-only previews stay in the conversation. Save before closing/reloading: local files and chat currently live only in session memory.

Native processing is disabled until native PDF adapters pass conformance. There is no active hosted planner, analytics or billing. No cloud PDF processing, production identity or user migration is configured.

See [implementation and evidence](docs/IMPLEMENTATION_STATUS.md), [platform limits](docs/PLATFORM_CAPABILITIES.md), [privacy checks](docs/PRIVACY_TEST_REPORT.md) and [legacy evidence](docs/legacy-learning/SOURCE_AUDIT.md). The supplied v7 handoff is preserved in `atepdf_codex_build_pack/`. Owner-approved React Native and conversational workflow changes are recorded under `docs/adr/`; the handoff itself remains unchanged.
