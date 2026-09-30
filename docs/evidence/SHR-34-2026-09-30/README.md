# SHR-34: Mac launch-envelope evidence

Recorded 30 September 2026 for [SHR-34](https://linear.app/shrey-talwar/issue/SHR-34/decide-the-supported-mac-and-macos-launch-envelope). The decision is in [ADR 0011](../../adr/0011-mac-launch-envelope.md). These are bounded configuration, dependency and compile checks only. No application source, project setting, dependency, signing identity or account was changed. Nothing was installed, purchased, notarized or published.

## Source and host

- Decision branch base: `origin/main` `29f56ea919e73c12cdbd1c36f5f74cf37622347c` (SHR-105 design system + SHR-46 matrix merged).
- Host (the only Mac available): MacBook Air `Mac17,3`, Apple M5 (10 cores: 4 performance, 6 efficiency), 16 GB memory, macOS 27.0 (`26A428`), arm64. Rosetta is installed. About 35 GB of 460 GB free at the time of the checks.
- Toolchain: Xcode 27.0 (`27A266a`), macOS SDK 27.0, Node `v24.19.0` (the same version SHR-16 used). Expo SDK 57.0.25, React Native 0.86.3 (new architecture, Hermes), `@assistant-ui/react-native` 0.1.44.

## Isolation

The build checks ran in an APFS copy-on-write clone of the already-installed checkout at `/Users/shrey/Documents/ChatGPT/atepdf` (local `main` `4c22232`, clean, not switched or modified). The clone lived in this session's temporary scratch directory. The Pods xcconfig files in the clone referred to the owner checkout by absolute path; 83 such files in the clone were repointed at the clone itself before building, so the builds read only clone files. Your checkout's original files were confirmed unchanged afterwards.

The clone's native sources match `origin/main` except `AtepdfWorkspaceVault.swift` (SHR-39), which is not in the clone's installed Pods project. That file was type-checked separately for both architectures.

## Checks

| # | Check | Command (abridged) | Result |
|---|---|---|---|
| 1 | Existing arm64 app build (last recorded) | `lipo -info`, `otool -l`, `Info.plist` of `/private/tmp/atepdf-mac-q1y4ostq/atepdf.app` from `scripts/native/mac-build.sh` | arm64 only (app and all 4 embedded frameworks). `LC_BUILD_VERSION` platform MACCATALYST, `minos 16.4`, SDK 27.0. Built `LSMinimumSystemVersion` **13.3**. `UIDeviceFamily` **[2]** (iPad idiom). |
| 2 | Prebuilt binary slices | `Info.plist` `AvailableLibraries` of each xcframework | React, ReactNativeDependencies, hermesvm and ExpoModulesJSI all contain `ios-arm64_x86_64-maccatalyst`. |
| 3 | **Intel compile check** | `xcodebuild … -configuration Release -destination "generic/platform=macOS,variant=Mac Catalyst" ARCHS=x86_64 ONLY_ACTIVE_ARCH=NO CODE_SIGNING_ALLOWED=NO` with `SKIP_BUNDLING=1` | **BUILD SUCCEEDED**, 0 errors, 109 s. App binary and all 4 frameworks x86_64. `minos 16.4`, `LSMinimumSystemVersion` 13.3. Log SHA-256 `b55691e3331e40ac66729d9396bd25f84ad5947ccfd35f3dbeb5044f51ebf71b`; binary SHA-256 `33803c89ac33e3a62bc07de8777e8374dbca45f8cd9935a61d78a51db0cb13e3`. **Not signed, not bundled, not launched; no Intel hardware exists to run it.** |
| 4 | Vault type-check | `swiftc -typecheck -target {arm64,x86_64}-apple-ios16.4-macabi AtepdfWorkspaceVault.swift` | Both exit 0 (it imports only Foundation, CryptoKit and Security). |
| 5 | **Mac idiom build probe** | Same as #3 but `ARCHS=arm64 TARGETED_DEVICE_FAMILY=1,2,6`, with the JS bundle | **BUILD SUCCEEDED**, 0 errors, 129 s. Built `UIDeviceFamily` **[6]** (Mac idiom). 4.9 MB `main.jsbundle` included. Log SHA-256 `0143aa37125db16dda9d570bb3de025ac278f57d23a407ec133b77752af2c7e0`. |
| 6 | Mac idiom launch probe | Build #5 staged by the repo's own staging/ad-hoc-signing code, with the **bundle ID changed to `dev.atepdf.shr34.idiomprobe`** so it got its own sandbox container and could not touch `dev.atepdf.fresh.mac` data; `open -n` | Strict signature verification and sandbox entitlements passed. The process launched, stayed running for several minutes, produced no crash report, and quit cleanly through an Apple Event. Staged binary SHA-256 `75ad9cf6ac62941c58c2c0da2cf4a5fefed846944a5aebdc96b409c92272e21e`. **Not visually inspected:** the owner declined screen access for the probe, so rendering, layout, text scale, menus and keyboard behaviour under the Mac idiom remain unobserved. The probe's bundle ID also fails the app's native storage-isolation gate on purpose, so PDF processing was not exercised. |
| 7 | API availability in the macOS 27 SDK | `.swiftinterface` availability annotations | Vision `RecognizeTextRequest` and `DetectDocumentSegmentationRequest`: macOS 15 / iOS 18. `RecognizeDocumentsRequest`: macOS 26 / iOS 26. FoundationModels: macOS 26 / iOS 26, with runtime unavailability reasons `deviceNotEligible`, `appleIntelligenceNotEnabled`, `modelNotReady`. |

The probe created its own sandbox container at `~/Library/Containers/dev.atepdf.shr34.idiomprobe`. No documents were imported into it. It was not deleted automatically; the owner can remove it.

## Earlier Mac runtime evidence reused (not re-run)

- 28 September 2026, older source, this Mac: actual app import and merge, native save/cancel/retry, reopen in Preview ([mac-export-smoke.json](../native/mac-export-smoke.json)); typed removal and undo ([mac-final-input-smoke.json](../native/mac-final-input-smoke.json)); preview navigation ([mac-final-corrected-smoke.json](../native/mac-final-corrected-smoke.json)).
- 29 September 2026, SHR-39 source, this Mac: the actual app launched; the Data Protection Keychain refused the workspace key in the ad-hoc build (`-34018`, missing entitlement), so the app correctly ran session-only ([mac-catalyst.json](../SHR-39-2026-09-29/mac-catalyst.json)).
- SHR-16 (`40f23ec`): arm64 Release build and native helper tests only; the app was not opened ([README](../shr-16-2026-09-29/README.md)).
- SHR-46: browser/Node engine matrix only; explicitly not Mac app acceptance ([README](../SHR-46-2026-09-30/README.md)).

## Limits

Everything except checks 1, 5 and 6 is compile/configuration evidence. No check here is runtime acceptance of import, save/reopen, keyboard, VoiceOver, persistence, OCR, cancellation, sleep/wake or performance. No macOS other than 27.0, no 8 GB Mac and no Intel Mac was available.
