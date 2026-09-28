# Mac development build

atepdf uses the existing Expo 57 / React Native 0.86 UIKit application through Mac Catalyst, including assistant-ui's native components and the local PDFKit/Vision adapter. It is a native application. No WebView, React Native macOS fork, or framework downgrade was introduced.

The React Native macOS upstream release reviewed (0.81.8, requiring React Native 0.81.6) does not match this application's 0.86.3 runtime.

## Build locally

Run `scripts/native/mac-build.sh` with Node.js on PATH and the existing Xcode toolchain. Use `scripts/native/mac-build.sh --launch` to request launch by the exact staged path. The script defaults to build and signature verification only, installs nothing, does not provision a signing identity, and publishes nothing.

Prerequisites are the tracked Apple workspace and its locked CocoaPods dependencies. If the workspace is missing, restore atepdf source; do not run a clean Expo prebuild over the hand-managed scene/Catalyst configuration. Local Pod tooling is documented in `scripts/native-tools/README.md`.

The script compiles and links the actual Release application in `.build/mac`, then creates a new temporary staging folder. It prints the `.app` path and writes `.build/mac-last-build.json`. Existing staging folders are retained; no nonempty destination is erased. Full build logs remain local under `.build/`.

## Configuration and storage

- `apps/universal/ios/Podfile` enables React Native's `mac_catalyst_enabled` hook. Every dependency uses the existing app minimum iOS 16.4, because Xcode 27's Catalyst map does not correctly map the dependencies' old 15.1 minimum.
- `apps/universal/ios/atepdf.xcodeproj/project.pbxproj` enables Catalyst and assigns Mac the independent `dev.atepdf.fresh.mac` identifier. iOS keeps its own identifier.
- Mac App Sandbox allows user-selected read/write only. Incoming and outgoing network entitlements are absent; native hosted planning is unavailable in this build.
- The native module exposes `storageIsolated` only when the real sandbox entitlement, exact bundle identifier, container home, and cache path agree. Native operations and JavaScript startup cleanup/import fail closed otherwise. PDF engine input is restricted further to `atepdf-work`; previews are generated in `atepdf-preview`.
- Do not launch the unsigned `.build/mac/.../atepdf.app` as the runnable artifact. Always use the verified staged app path. Bundle-ID lookup can resolve an older unsigned copy; confirm the process path before UI testing.

## Development signing

Signing directly under the repository's Documents directory failed because the file-provider filesystem adds Finder metadata to generated resource bundles. Staging into a fresh temporary folder without extended attributes avoids that failure.

Installed React and ReactNativeDependencies Catalyst framework packages contain flattened duplicate version directories. The script verifies matching `Versions/A` and `Versions/Current` contents, preserves the built binaries, and restores canonical version links only in the generated staged app. It never modifies Pods or dependency source. Unexpected contents or different version copies fail closed.

All nested code and the app receive an ad-hoc development signature. The main development signature intentionally omits Hardened Runtime: without real Team IDs, its library validation rejected the embedded ExpoModulesJSI framework. Production target hardened settings remain unchanged. No library-validation exception, network entitlement, developer team, certificate, Gatekeeper bypass, or provisioning profile is added. This is not a distributable or notarized release.

Strict nested signature verification and exact entitlement comparison must pass before optional launch.

## Evidence and remaining checks

The reproducible script passed actual arm64 Catalyst compilation/linking, staging, signing, and strict verification. The exact staged process launched. CUA showed the native chat interface with the final storage gate passed; the process held `~/Library/Containers/dev.atepdf.fresh.mac/Data`, its caches/Documents folders were private, and no network sockets were observed. See `docs/evidence/native/mac-catalyst-signed-build.json` for the exact artifact and observations.

Bundled sample import and merge passed on the export-enabled artifact. Its system save dialog was cancelled, retried, and then saved to a fresh local temporary folder. The app reported the actual cancellation and success results. The saved three-page PDF reopened in independent macOS Preview; a separate PDF.js check matched complete text, page geometry, and A1/A2/B1 order. See `docs/evidence/native/mac-export-smoke.json` and `mac-export-independent.json`.

Catalyst uses `UIDocumentPickerViewController(forExporting:asCopy:)` for local save. `AtepdfPDFExporter` retains the picker until real completion, handles cancellation, and cancels an owned pending export on bridge destruction or scene disconnect. UUID ownership and controller identity prevent stale callbacks from completing a later export. Its source passes the engine's dedicated work-root, regular-file, URL, symlink and PDF validation. The source stays immutable and is released by JavaScript only after completion. This helper has no third-party dependency. iOS retains its existing system Sharing path.

The final input-adapter build passed ordinary typed page removal, composer clearing, typed undo, and save-dialog cancellation. It preserves default native autocorrection and uses assistant-ui's public input slot. One CUA attempt sent text while initial focus was changing and delivered no text; typing after accessibility confirmed focus preserved both complete commands. See `docs/evidence/native/mac-final-input-smoke.json` for exact source and bundle hashes. The prior synthetic chat was retained in its earlier process.

The final corrected chat artifact passed visible preview pages 1/2, Zoom, panning inside the viewer, Fit, Close, typed removal/undo, and save cancellation. Its bounded viewer kept every preview control visible. The empty Send control is visibly faded and accessibility-disabled. The screenshot is `docs/evidence/design/mac-final.png`; exact-source evidence is in `docs/evidence/native/mac-final-corrected-smoke.json`.

The preceding visual check caught a real native raster-scale defect: CoreGraphics did not upscale page content into the larger bitmap. The engine now scales the bitmap explicitly before its logical page transform. The corrected app shows the full-width header and expected page layout. Twenty pixel-anchor cases plus source-coordinate OCR and the shared-writer chain passed independently. Earlier evidence is retained in `mac-polish-smoke.json`, `mac-catalyst-pre-raster-fix.json` and `docs/evidence/design/mac-before-raster-fix.png`.

All focus timing paths, OCR/compression Mac UI, resizing, and a runtime scene-disconnect cancellation test remain unproven. Native engine fixture tests cover PDFKit/Vision operations separately. Catalyst currently uses the iPad idiom.

Automatic approval review rejected clearing the active synthetic chat with Start over for an app reimport check. The chat was preserved, and the saved PDF was reopened read-only in Preview instead.

An early bundle-ID lookup accidentally launched an unsigned development copy. No pre-launch cache baseline existed, so past startup cleanup cannot be asserted harmless; the bounded audit and resulting fail-closed fix are recorded in `docs/evidence/native/mac-unsigned-launch-audit.json`.

Primary references: [Apple Mac Catalyst](https://developer.apple.com/documentation/uikit/mac-catalyst), [Apple App Sandbox](https://developer.apple.com/documentation/xcode/configuring-the-macos-app-sandbox), [React Native macOS setup](https://microsoft.github.io/react-native-macos/docs/getting-started), [assistant-ui React Native](https://www.assistant-ui.com/docs/react-native).
