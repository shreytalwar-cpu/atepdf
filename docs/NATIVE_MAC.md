# Mac development build

Current planner update: the new AtepdfPlanner module can pair with the local browser gateway (ADR 0008). The staging script now includes and verifies the outgoing-network sandbox entitlement; incoming networking remains disabled. The module restricts destinations to loopback, rejects redirects and holds its short-lived bearer in native memory. Earlier no-network/native-AI-unavailable evidence below describes the preceding build. Current verification is in SESSION_2026-09-28_NATIVE_PLANNER.md.

atepdf uses the existing Expo 57 / React Native 0.86 UIKit application through Mac Catalyst, including assistant-ui's native components and the local PDFKit/Vision adapter. It is a native application. No WebView, React Native macOS fork, or framework downgrade was introduced.

The React Native macOS upstream release reviewed (0.81.8, requiring React Native 0.81.6) does not match this application's 0.86.3 runtime.

## Build locally

Run `scripts/native/mac-build.sh` with Node.js on PATH and the existing Xcode toolchain. Use `scripts/native/mac-build.sh --launch` to request launch by the exact staged path. The script defaults to build and signature verification only, installs nothing, does not provision a signing identity, and publishes nothing.

Prerequisites are the tracked Apple workspace and its locked CocoaPods dependencies. If the workspace is missing, restore atepdf source; do not run a clean Expo prebuild over the hand-managed scene/Catalyst configuration. Local Pod tooling is documented in `scripts/native-tools/README.md`.

For isolated acceptance, use `scripts/native/mac-build.sh --synthetic-container` (optionally `--launch`). This explicit compile-time mode builds into `.build/mac-synthetic`, requires the independent `dev.atepdf.synthetic.mac` sandbox, and uses only the `dev.atepdf.synthetic.workspace` Keychain service. Record whether that synthetic container existed before launching. Its storage gate still requires the actual sandbox entitlement and matching container/cache paths. The normal build has no synthetic identity allowance. This mode is for local synthetic fixtures, not distribution or proof of signed Keychain availability.

The script compiles and links the actual Release application in `.build/mac`, then creates a new temporary staging folder. It prints the `.app` path and writes `.build/mac-last-build.json`. Existing staging folders are retained; no nonempty destination is erased. Full build logs remain local under `.build/`.

## Configuration and storage

- `apps/universal/ios/Podfile` enables React Native's `mac_catalyst_enabled` hook. Every dependency uses the existing app minimum iOS 16.4, because Xcode 27's Catalyst map does not correctly map the dependencies' old 15.1 minimum.
- `apps/universal/ios/atepdf.xcodeproj/project.pbxproj` enables Catalyst and assigns Mac the independent `dev.atepdf.fresh.mac` identifier. iOS keeps its own identifier.
- Mac App Sandbox permits user-selected read/write and outgoing networking for the local planner. Incoming networking remains disabled. The planner module restricts its own endpoints to loopback; the network entitlement itself is not a domain firewall.
- The native module exposes `storageIsolated` only when the real sandbox entitlement, exact bundle identifier, container home, and cache path agree. Native operations and JavaScript startup cleanup/import fail closed otherwise. PDF engine input is restricted further to `atepdf-work`; previews are generated in `atepdf-preview`.
- Do not launch the unsigned `.build/mac/.../atepdf.app` as the runnable artifact. Always use the verified staged app path. Bundle-ID lookup can resolve an older unsigned copy; confirm the process path before UI testing.

## Development signing

Signing directly under the repository's Documents directory failed because the file-provider filesystem adds Finder metadata to generated resource bundles. Staging into a fresh temporary folder without extended attributes avoids that failure.

Installed React and ReactNativeDependencies Catalyst framework packages contain flattened duplicate version directories. The script verifies matching `Versions/A` and `Versions/Current` contents, preserves the built binaries, and restores canonical version links only in the generated staged app. It never modifies Pods or dependency source. Unexpected contents or different version copies fail closed.

All nested code and the app receive an ad-hoc development signature. The main development signature intentionally omits Hardened Runtime: without real Team IDs, its library validation rejected the embedded ExpoModulesJSI framework. Production target hardened settings remain unchanged. No library-validation exception, developer team, certificate, Gatekeeper bypass, or provisioning profile is added. ADR 0008 adds the outgoing-network entitlement described above. This is not a distributable or notarized release.

Strict nested signature verification and exact entitlement comparison must pass before optional launch.

## Evidence and remaining checks

The reproducible script passed actual arm64 Catalyst compilation/linking, staging, signing, and strict verification. The exact staged process launched. CUA showed the native chat interface with the final storage gate passed; the process held `~/Library/Containers/dev.atepdf.fresh.mac/Data`, its caches/Documents folders were private, and no network sockets were observed. See `docs/evidence/native/mac-catalyst-signed-build.json` for the exact artifact and observations.

Bundled sample import and merge passed on the export-enabled artifact. Its system save dialog was cancelled, retried, and then saved to a fresh local temporary folder. The app reported the actual cancellation and success results. The saved three-page PDF reopened in independent macOS Preview; a separate PDF.js check matched complete text, page geometry, and A1/A2/B1 order. See `docs/evidence/native/mac-export-smoke.json` and `mac-export-independent.json`.

Catalyst uses `UIDocumentPickerViewController(forExporting:asCopy:)` for local save. `AtepdfPDFExporter` retains the picker until real completion, handles cancellation, and cancels an owned pending export on bridge destruction or scene disconnect. UUID ownership and controller identity prevent stale callbacks from completing a later export. Its source passes the engine's dedicated work-root, regular-file, URL, symlink and PDF validation. The source stays immutable and is released by JavaScript only after completion. This helper has no third-party dependency. iOS retains its existing system Sharing path.

The final input-adapter build passed ordinary typed page removal, composer clearing, typed undo, and save-dialog cancellation. It preserves default native autocorrection and uses assistant-ui's public input slot. One CUA attempt sent text while initial focus was changing and delivered no text; typing after accessibility confirmed focus preserved both complete commands. See `docs/evidence/native/mac-final-input-smoke.json` for exact source and bundle hashes. The prior synthetic chat was retained in its earlier process.

The final corrected chat artifact passed visible preview pages 1/2, Zoom, panning inside the viewer, Fit, Close, typed removal/undo, and save cancellation. Its bounded viewer kept every preview control visible. The empty Send control is visibly faded and accessibility-disabled. The screenshot is `docs/evidence/design/mac-final.png`; exact-source evidence is in `docs/evidence/native/mac-final-corrected-smoke.json`.

The preceding visual check caught a real native raster-scale defect: CoreGraphics did not upscale page content into the larger bitmap. The engine now scales the bitmap explicitly before its logical page transform. The corrected app shows the full-width header and expected page layout. Twenty pixel-anchor cases plus source-coordinate OCR and the shared-writer chain passed independently. Earlier evidence is retained in `mac-polish-smoke.json`, `mac-catalyst-pre-raster-fix.json` and `docs/evidence/design/mac-before-raster-fix.png`.

All focus timing paths, OCR/compression Mac UI, resizing, and a runtime scene-disconnect cancellation test remain unproven. Native engine fixture tests cover PDFKit/Vision operations separately. Catalyst used the iPad idiom until SHR-106 (see below).

Automatic approval review rejected clearing the active synthetic chat with Start over for an app reimport check. The chat was preserved, and the saved PDF was reopened read-only in Preview instead.

An early bundle-ID lookup accidentally launched an unsigned development copy. No pre-launch cache baseline existed, so past startup cleanup cannot be asserted harmless; the bounded audit and resulting fail-closed fix are recorded in `docs/evidence/native/mac-unsigned-launch-audit.json`.

## SHR-106 window and idiom

- Catalyst now uses the **Mac idiom** (`TARGETED_DEVICE_FAMILY = "1,2,6"` for the app target; OD-6, ADR 0011 ENV-5), so the UI renders at 1:1 instead of 77%. iOS builds are unaffected.
- `AtepdfSceneDelegate` (in `AppDelegate.swift`) subclasses Expo's scene delegate: hidden window title (accessibility title "atePDF"), no title-bar separator, a 640 × 520 minimum size and a `bg.window` background in both appearances. `UIUserInterfaceStyle` is Automatic (dark mode ships at launch, OD-3); the display name is `atePDF` (OD-2).
- The app icon set is rendered from the approved Folio Eight Ink master by `pnpm design:icons` (macOS 16–512 @1x/@2x plus a full-bleed iOS 1024). An Icon Composer `.icon` layered file is not produced by this tooling.
- `scripts/native/mac-build.sh` guards its optional build-option array so it runs under macOS's bash 3.2 with `set -u`.
- Window size restore, native menu-bar commands and ⌘-shortcuts on Catalyst remain SHR-75; every command is reachable in-window.

Primary references: [Apple Mac Catalyst](https://developer.apple.com/documentation/uikit/mac-catalyst), [Apple App Sandbox](https://developer.apple.com/documentation/xcode/configuring-the-macos-app-sandbox), [React Native macOS setup](https://microsoft.github.io/react-native-macos/docs/getting-started), [assistant-ui React Native](https://www.assistant-ui.com/docs/react-native).
