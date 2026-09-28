# 06 | Platform-specific execution brief

## Common behaviours
Every platform implements the same request/result protocol, page semantics, immutable originals, focused-result context and truthful progress. The interface adapts to each platform. “Shared product” does not mean desktop controls squeezed onto a phone or an iPhone screen stretched across a Mac window.

The public capability matrix must include operation, tested platform/runtime, exact engine version, supported inputs/languages, known preservation limits and release status. Hide unavailable operations from AI capabilities and shortcuts. Marketing/SEO must use that same tested matrix.

## Web
- Start new Next.js/React/TypeScript source in atepdf; use the old web code only as read-only reference. The processing workspace is explicitly client-only; no File/ArrayBuffer passed to server components, server actions or remote converters.
- Use normal file input/drop and local `File` objects; File System Access APIs are optional progressive enhancement, not a universal dependency. Provide Blob download and a save/share fallback tested in Safari/Firefox as well as Chromium [S14].
- Host heavy engine code in dedicated workers, with transferable buffers/streams where supported. Avoid duplicating each file buffer across state, preview and OCR.
- Load PDF preview/manipulation at first file use; OCR engine/language assets only on first OCR request. Precache only controlled static assets.
- PWA offline shell and local quick actions work after needed assets are available. Natural-language planning requires connectivity. Cached compiled recipes may still run locally.
- Do not depend on SharedArrayBuffer, cross-origin isolation or multi-thread WASM for correctness; make them tested optional accelerations. Account for browser storage eviction and mobile Safari suspension.
- Use IndexedDB/OPFS only with explicit retention/cleanup design and browser tests. Keep raw buffers out of Redux/devtool/session-replay persistence.
- Import/export of ZIP must use bounds against decompression bombs and path traversal. Zip output is an artifact collection, not an excuse to upload files.
- Separate marketing pages from the sensitive application context. No advertising trackers/session replay in the file workspace.
- Browser tests: current stable Chromium, Firefox and Safari/WebKit plus actual mobile Safari/Chrome where needed. Emulated viewports are not substitutes for real memory/device behaviour.

## iPhone and iPad
- Create fresh SwiftUI targets and Swift packages. Use read-only old-source lessons for native file/engine pitfalls; selectively port only proven isolated helpers with provenance. Share new Apple views/services where sensible, not every layout dimension.
- Use file importer/document picker, UTType validation, Photos picker for supported images and user-selected output/export. Resolve security-scoped URLs correctly; copy to temporary app-private storage only as needed.
- Keep import, processing and preview off the main thread; expose observable state with clear ownership and cancellation.
- System share extension is a convenience, not a second implementation of the whole engine. Transfer the selected file safely into the main app's workflow. No automatic background upload.
- On iPad support portrait, landscape, split view/window resizing and drag/drop. Composer and focused file stay reachable while the keyboard is visible.
- Honour background execution constraints; pause/resume/checkpoint only where proven. Do not promise heavy OCR continues indefinitely after app suspension.
- Use PDFKit for read-only preview. Don't expose its annotation/editor controls. Existing active content and signed/form-bearing PDFs need preflight safety handling.
- Vision/Tesseract OCR adapter returns structured local text geometry, then a tested searchable-layer writer produces output. Both pieces must be verified.
- Avoid an Apple Intelligence requirement. Choose and test the new deployment targets from engine requirements and intended device coverage; do not inherit old minima blindly.

## Mac
- Native SwiftUI main workspace, not an Electron/Tauri/WebView replacement for functioning native code.
- Start with a normal main window; settings in a secondary settings window/sheet and recent jobs in a secondary command/menu.
- Real Open/Save/Share, drag/drop, paste where supported, keyboard navigation and menu commands: New job, Add files, Save result, Preview, Undo operation, Settings.
- Handle multiple windows with isolated workspace IDs and result focus. Global preferences/account state can be shared, but file selection and jobs must not leak between windows.
- Package specialist engines as compatible libraries/frameworks inside the app. Do not expect customers to install Homebrew, qpdf, Python or Tesseract manually.
- Respect sandbox, file access and hardened-runtime requirements. Build simulator/device/desktop slices separately where applicable. Test the actual signed distribution build.
- Intel support is an explicit packaging/performance decision, not assumed by the use of cloud AI. Include only if the existing build and selected native engines support it.

## Android
- Kotlin/Compose UI reflecting the approved style with native Android behaviour, not fake Apple status bars or copied iOS system controls [S13].
- Use Storage Access Framework and relevant Photos picker; read selected `content://` URIs via platform APIs rather than assuming filesystem paths [S12].
- Support ACTION_SEND/ACTION_SEND_MULTIPLE import with safe URI grants, MIME validation and size limits. Use a secure content provider for sharing results, not public temporary filesystem paths.
- Use coroutines with separate IO/CPU dispatchers, cancellation and lifecycle-aware state. Survive screen rotation without duplicating a job or losing the current result.
- Rendering and writing are separate adapters. Prove selected local writing library/NDK bridge under each supported ABI. Pin NDK/toolchain builds in CI.
- Choose bundled/local-downloaded ML Kit text recognition or a Tesseract adapter per script support. No cloud Vision/OCR API. Disclose static language-asset downloads separately from file processing [S18].
- Maintain a read-only preview and system save/share path. All result metadata must come from real output.
- Avoid requiring Gemini Nano. Test on a representative mid-range Android phone, not only emulators/flagships. Establish memory-sensitive limits empirically.
- Target current required Play SDK/API levels at submission; do not pin an obsolete store-policy requirement from this brief.

## Backend and environments
Create a small TypeScript gateway in the new project, with a provider adapter, validators, anonymous sessions and rate limits. Start as one server-only route usable by every client. Existing service accounts may be used only under separately approved sandbox/project scopes; do not inherit old production data or configuration. Set `MODEL_PRIMARY`, token/output/request caps, retry/timeouts, daily budget and feature flags. API keys use server secret storage, never `NEXT_PUBLIC_` or bundled config.

No provider credential is included in this pack. Use a connected approved secret-management/setup workflow when available; otherwise ask the owner for the minimum secure credential action. Continue UI/engine/contract tests with explicit test doubles while live access is blocked; never report those tests as live AI success.

Accounts, database and billing should not block the first local vertical slice. Stage them behind feature flags. All public publishing and paid-service activation require a final owner-controlled gate.
