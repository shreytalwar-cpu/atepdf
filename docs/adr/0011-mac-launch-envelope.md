# ADR 0011 — Supported Mac and macOS launch envelope (SHR-34)

**Status:** Proposed, awaiting Shrey's approval. Nothing here is a public compatibility promise until approved and verified.  **Source:** `origin/main` `29f56ea919e73c12cdbd1c36f5f74cf37622347c` (30 September 2026).  **Authority:** `PRODUCT_V1.md` OPEN-01, MAC-01–04, ARCH-01, G-07; [SHR-34](https://linear.app/shrey-talwar/issue/SHR-34/decide-the-supported-mac-and-macos-launch-envelope) (parent SHR-26); SHR-16 baseline; approved SHR-105 design system (OD-6 Mac idiom pending engineering confirmation).  **Evidence:** [docs/evidence/SHR-34-2026-09-30](../evidence/SHR-34-2026-09-30/README.md).

The existing Expo / React Native / Mac Catalyst architecture stays (ARCH-01). This ADR recommends which Macs and macOS versions v1 supports, and what must be tested before that support is claimed. It changes no project setting.

## 1. Current configuration facts

| Item | Fact (source) |
|---|---|
| App target | One `atepdf` target builds iOS/iPadOS and Mac Catalyst (`SUPPORTS_MACCATALYST = YES`). Mac bundle ID `dev.atepdf.fresh.mac` (development). |
| Deployment target | `IPHONEOS_DEPLOYMENT_TARGET = 16.4`. Catalyst derives its floor from it: the built binary says `MACCATALYST minos 16.4`, and Xcode writes `LSMinimumSystemVersion` **13.3** (macOS Ventura 13.3). |
| Stale/secondary values | The source `Info.plist` says `LSMinimumSystemVersion 12.0`; Xcode overrides it in the built app. The app target also sets `MACOSX_DEPLOYMENT_TARGET = 13.4`, and the Podfile forces 13.4 on every pod as a workaround for Xcode 27 mapping React Native's 15.1 pod floor to unsupported macOS 10.15. None of these is the effective app floor; 13.3 is. |
| Idiom | `TARGETED_DEVICE_FAMILY = "1,2"` → Catalyst **iPad idiom**, "scaled to match iPad" (the built app's `UIDeviceFamily` is `[2]`). The whole UI renders at 77%. |
| Architectures | `ARCHS` is not set. `scripts/native/mac-build.sh` builds `arch=$(uname -m)` with `ONLY_ACTIVE_ARCH=YES`, so every recorded Mac build is **arm64 only**; that is a property of the script, not a deliberate exclusion. No `EXCLUDED_ARCHS`. `UIRequiredDeviceCapabilities = arm64` is an iOS key and does not exclude Intel Macs. |
| Toolchain | Xcode 27.0 (`27A266a`), macOS SDK 27.0, Node 24.19.0, Expo SDK 57.0.25, React Native 0.86.3 (new architecture, Hermes). No pinned Node/pnpm or CI (SHR-16 finding). |
| Dependency floors | Expo 57 native modules declare iOS **16.4** (→ macOS 13.3) and set the hard floor. React Native core allows iOS 15.1. |
| Prebuilt binaries | React, ReactNativeDependencies, Hermes (`hermesvm`) and ExpoModulesJSI all ship `ios-arm64_x86_64-maccatalyst` slices. |
| Own native code | `atepdf-pdf`: PDFKit, CoreGraphics, ImageIO, Vision (`VNRecognizeTextRequest`, accurate, `en-US`, no revision pinned), UIKit export picker, UniformTypeIdentifiers, CryptoKit AES-GCM, Security (Data Protection Keychain). `atepdf-planner`: URLSession (paired/pinned development planner). No `@available` gates; nothing needs more than iOS 16.4. |
| Sandbox/entitlements | App Sandbox, user-selected read-write, outgoing network (build settings; the entitlements file is empty). There is no `application-identifier` / `keychain-access-groups`, so in ad-hoc builds the Data Protection Keychain refuses the workspace key (`-34018`) and the app runs session-only (SHR-39 evidence). |
| Resource bounds in code | Admission 1–100 pages. Native decoded-image budget 12 MP (`AtepdfPDFEngine.pixelLimit`). |

## 2. Hardware- and OS-sensitive features

| Feature | Status | Sensitivity |
|---|---|---|
| PDF read/render/merge/remove (PDFKit, CoreGraphics, shared JS writer in Hermes) | **Implemented** | Architecture-neutral. Time and memory scale with pages and pixels. |
| OCR (Vision accurate, English) | **Implemented** (native helper verified; Mac app UI unproven) | On Apple Silicon Vision can use the Neural Engine; on Intel it runs on CPU/GPU (slower, unmeasured). Output can differ between macOS releases because no request revision is pinned, so OCR must be checked on the minimum **and** latest OS. |
| Compression (ImageIO JPEG re-encode) | **Implemented** | Architecture-neutral; CPU-bound. |
| Images→PDF, PDF→images | Planned (SHR-51 formats) | ImageIO; HEIC decode is hardware-accelerated on Apple Silicon. |
| Protect/Unlock encryption | Planned (SHR-52) | Depends on the chosen engine. A native library must ship every architecture we support. |
| Local understanding | Planned (SHR-66) | Candidate APIs differ by OS: Vision text/segmentation (macOS 15+), `RecognizeDocumentsRequest` (macOS 26+), FoundationModels (macOS 26+, only on Apple Intelligence-eligible Apple Silicon Macs with the feature enabled and the model ready, so it can never be required). |
| Encrypted workspace + Keychain | **Implemented in source** (SHR-39); actual-app encryption **unverified** | CryptoKit is on every Mac. The Data Protection Keychain needs a team-signed identity (SHR-91) before it can be tested in the real app. |
| Finder/file access | Import picker and export picker **implemented**; native drag/drop planned (SHR-73) | Sandbox and security-scoped access; OS-version UI differences. |
| Mac idiom / window behaviour | iPad idiom today; Mac idiom approved direction (OD-6) | Section 7. |
| Keyboard/focus, VoiceOver | Partial; Mac acceptance not done (SHR-75/76) | Catalyst keyboard, menu and accessibility behaviour varies by macOS release. |
| Dark/light | Approved (SHR-105 OD-3), not implemented (SHR-106) | Available on every candidate OS. |
| Local inference | **None implemented.** Planning is a hosted/paired service. | Network, not hardware. |

## 3. Candidate envelopes

| | **E1 — Dependency floor** | **E2 — Apple's current security window** | **E3 — Current + previous (recommended)** |
|---|---|---|---|
| Minimum macOS | 13.3 Ventura | 15.0 Sequoia | **26.0 Tahoe** |
| CPU | Universal (Apple Silicon + Intel) | Apple Silicon only | **Apple Silicon only** |
| RAM (engineering assumption) | 8 GB | 8 GB min / 16 GB recommended | **8 GB min / 16 GB recommended** |
| Free disk | Unmeasured; see section 6 | same | same |
| Distribution impact | Widest store reach; direct build must be universal; Intel users need separate support copy | Store shows "requires Apple silicon"; direct download must say so | Same as E2; smallest set of OS versions to document |
| Engineering cost | Universal builds and signing, x86_64 slices for every future native dependency, API gating for 13–27 | Gate macOS 26 APIs (SHR-66); design for pre-Tahoe and Tahoe window chrome | Lowest: no gating for macOS 26 APIs; one generation of window chrome |
| Testing burden | 5 major OS versions + Intel lane; **no Intel or old-OS hardware exists** | 3 OS versions (min 15 + 27; 26 spot check) | 2 OS versions (26 + 27) |
| Benefits | Nobody excluded who can install it | Covers every Apple Silicon Mac, including those kept on Sequoia | Test matrix the team can actually cover; newest Vision document APIs available; consistent Catalyst window/menu behaviour |
| Risks | Unsupported OSes (13/14 no longer get security updates); promises nobody can test; slower Intel OCR | More OS variance for OCR and Catalyst; API gating adds code paths | Excludes Apple Silicon users who stay on 15; needs a 26 test lane before launch |
| Excluded | Macs that cannot run 13.3 | All Intel Macs; Apple Silicon Macs below 15 | All Intel Macs; Apple Silicon Macs below 26 |

E4 ("macOS 27 only") was rejected: it would exclude supported users on 26 for no technical gain.

## 4. Apple Silicon only vs Universal

| Question | Answer |
|---|---|
| Can the current project compile for Intel? | **Yes.** A bounded Release Catalyst build with `ARCHS=x86_64` succeeded with 0 errors (evidence #3). It was not signed, bundled or run. |
| Do native dependencies have x86_64 slices? | **Yes today** for all four prebuilt binaries. Future dependencies (SHR-52 encryption engine, any SHR-66 method) would each need them too. |
| Do OCR/PDF components work in principle? | PDFKit, Vision, ImageIO and CryptoKit exist on Intel Macs. FoundationModels does not run on Intel (Apple Intelligence needs Apple Silicon). |
| Does performance differ? | Very likely for OCR (no Neural Engine), but **unmeasured**. There is no Intel hardware to measure it on. |
| Intel Mac available for runtime acceptance? | **No.** Rosetta on the M5 is translation, not Intel acceptance. |
| Which OS could Intel users run? | Apple announced at WWDC 2025 that macOS 26 Tahoe is the last release for Intel Macs (verify on Apple's compatibility page before any public statement). Under E3, Intel support would mean only the few Intel models that run 26, on exactly one OS release. |
| Extra QA/release burden | A second architecture lane for every release, universal signing and notarization, x86_64 builds of every native dependency, separate performance budgets, and support for hardware we cannot reproduce issues on. |

**Recommendation: Apple Silicon only.** Ship arm64. Keep the ability to compile x86_64 (do not add architecture exclusions that break it) but make no Intel claim. Revisit only with Intel test hardware and an owner decision.

## 5. Minimum macOS

**Recommend macOS 26.0 (Tahoe).**

- **APIs actually used** need only iOS 16.4 / macOS 13.3, so the choice is about cost and reach, not a technical blocker.
- **Security/updates:** at a 2027 launch, 27 is current and 26 is the previous release; both receive Apple updates. 13 and 14 do not.
- **SHR-66 local understanding** can use `RecognizeDocumentsRequest` and, optionally, FoundationModels (macOS 26+) without extra fallback code for 15. FoundationModels still needs a fallback because of eligibility.
- **SHR-105 UI:** one generation of Tahoe-era window chrome, layered Icon Composer icons, and consistent Catalyst menus and keyboard behaviour under the Mac idiom.
- **Accessibility and QA cost:** two OS versions to test with VoiceOver and keyboard, instead of three to five.
- **Coverage:** every Apple Silicon Mac is eligible for macOS 26 (per Apple's announced compatibility; verify). Users who choose to stay on 15 are excluded.

**Alternative:** macOS 15.0 (E2) is technically viable. It costs a macOS 15 test lane, gating of macOS 26 APIs in SHR-66, and pre-Tahoe window-chrome checks in SHR-106. Choose it if reaching Sequoia holdouts matters more than those costs.

**Enforcing the floor** requires a later, separate change. Raising `IPHONEOS_DEPLOYMENT_TARGET` would also raise the preserved iPhone/iPad builds (D-02), so a Catalyst-only floor (for example an SDK-conditional `IPHONEOS_DEPLOYMENT_TARGET[sdk=macosx*]`) must be verified first. Clean up the stale `Info.plist` 12.0 and the 13.4 values at the same time. **Not changed here.**

## 6. Resource assumptions (engineering only — not public requirements)

| Resource | Assumption | Basis | What SHR-78 must measure |
|---|---|---|---|
| Minimum RAM | **8 GB** | The smallest Apple Silicon Mac configuration | Peak memory for 100-page import, OCR and compression, and a long session with many results, on an **8 GB Mac (not available today)** |
| Recommended RAM | **16 GB** | The only test Mac | The same scenarios on the 16 GB M5 as the reference |
| CPU class | Any Apple Silicon (M1 or later); no class split proposed | No measurements | Cold start, per-operation time and cancellation latency on the slowest available M-series Mac vs the M5 |
| App size | About 33 MB staged arm64 (measured) | Evidence #1 | Final signed size per channel |
| Free disk | No number proposed yet. Hypothesis: a job needs about 3× its largest input (encrypted copy + staged output + export), plus retained workspace growth | Controller stages outputs; the workspace keeps encrypted copies (ADR 0010) | Disk used per job and per retained workspace; behaviour at low and full disk (with SHR-40/41) |

Public copy until SHR-78 measures: **"A Mac with Apple silicon, macOS 26 or later."** No RAM, disk or speed claim.

## 7. Catalyst Mac idiom (OD-6 engineering confirmation)

- **Buildable: yes.** `TARGETED_DEVICE_FAMILY=1,2,6` builds with 0 errors and produces `UIDeviceFamily [6]` (evidence #5).
- **Launchable: yes.** The ad-hoc staged probe launched, stayed up and quit cleanly (evidence #6).
- **Visual/interaction check: not done.** Screen access was declined, so text scale, layout, menus, pickers and keyboard behaviour under the Mac idiom are unobserved.
- **Deployment constraints:** the Mac idiom exists on every candidate OS (macOS 11+). It removes the 77% scaling, so SHR-105's `theme.scale` becomes 1.0. React Native reports the idiom through `Platform` constants (`RCTPlatform.mm` handles `UIUserInterfaceIdiomMac`), and the app's JS does not branch on idiom today. Under the Mac idiom some UIKit controls take AppKit appearance and sizes; this app draws its own controls, and the system surfaces it uses (document pickers, alerts) must be rechecked.
- **Conclusion:** technically viable within E3 and E2. **No blocker found for SHR-106 or SHR-75.** SHR-106 must make the switch as its first step and verify rendering, text scale, pickers, focus and VoiceOver on an actual build. If a blocker appears, keep `theme.scale = 0.77` and report it.

## 8. Test matrix (truthful as of this ADR)

Environments:
- **T1:** MacBook Air M5, 16 GB, macOS 27.0. The only Mac available.
- **T2:** minimum OS, macOS 26.x. None available.
- **T3:** 8 GB Apple Silicon Mac. None available.
- **T4:** Intel Mac. None available.

| Capability | T1 macOS 27 (M5) | T2 macOS 26 | T3 8 GB | T4 Intel |
|---|---|---|---|---|
| Release Catalyst build | Builds (arm64; iPad idiom and Mac idiom probe) | Untested | Untested | **Compiles only** (x86_64, unsigned, not run) |
| Native engine helper (PDFKit/Vision/ImageIO) | Helper tests pass (SHR-16) | Untested | Untested | Untested |
| App launch | Actual app tested (SHR-39; Mac idiom probe) | Untested | Untested | Untested |
| Import (picker, samples) | Actual app, older source only (28 Sep smoke) | Untested | Untested | Untested |
| Finder drag/drop | Untested | Untested | Untested | Untested |
| Save/export/reopen | Actual app, older source only (28 Sep smoke, Preview reopen) | Untested | Untested | Untested |
| Keyboard/focus | Partial: typed commands via accessibility (28 Sep); no keyboard-only journey | Untested | Untested | Untested |
| VoiceOver | Untested | Untested | Untested | Untested |
| Encrypted persistence | Helper/harness tests pass; **actual app falls back to session-only** (ad-hoc Keychain `-34018`) | Untested | Untested | Untested |
| OCR/compression in app UI | Untested (helper only) | Untested | Untested | Untested |
| Long-running processing, memory | Untested | Untested | Untested | Untested |
| Cancellation | Browser/unit tests only; Mac app untested | Untested | Untested | Untested |
| Sleep/wake | Untested | Untested | Untested | Untested |

**How import, save/reopen, keyboard and VoiceOver will be checked:**
- SHR-73, SHR-74 and SHR-76 run the journeys by hand on T1 with a team-signed development build (SHR-91 identities).
- SHR-78 repeats the core journey and the benchmarks on T2 and T3.
- Each run records the exact build hash, macOS build and Mac model.
- Saved outputs are reopened in an independent reader and hash-checked.
- VoiceOver is run for real with the VoiceOver Utility settings recorded.
- Browser, iOS-simulator and helper results never count.

T2 can be a macOS 26 virtual machine on T1 (Apple Silicon hosts can virtualize macOS). That needs tooling and an IPSW download, which requires separate approval. T3 needs an 8 GB Mac (a purchase or loan decision).

## 9. Recommendation

**RECOMMENDED V1 LAUNCH ENVELOPE**

- **Minimum macOS:** 26.0 (Tahoe)
- **CPU:** Apple Silicon (arm64) only
- **RAM:** engineering floor 8 GB (unverified; SHR-78)
- **Recommended RAM:** 16 GB (engineering assumption, not published)
- **Free disk:** not yet specified; SHR-78 measures. No public disk requirement beyond the store's download size.
- **Distribution:** arm64-only builds for both the Mac App Store and direct download. Direct-download pages state "Mac with Apple silicon, macOS 26 or later".
- **Actual tested hardware:** MacBook Air M5 (Mac17,3), 16 GB, macOS 27.0, and only for the items marked tested in section 8.
- **Build-compatible but unverified:** macOS 26.x on any Apple Silicon Mac; 8 GB Apple Silicon Macs; x86_64 Catalyst (compiles only); the Mac idiom (builds and launches only).
- **Explicitly unsupported:** Intel Macs; macOS 15.x and earlier (13.3–15.x, even though the current binary installs there until the floor is enforced); Rosetta; non-Mac platforms for v1 acceptance.

**Why:** it is the widest envelope the team can actually test. It stays inside Apple's update window and avoids promising Intel or old-OS support we cannot reproduce. It unblocks SHR-66 on the newest local APIs and keeps SHR-106's Mac idiom and window-chrome work to one generation.

## 10. Downstream consequences

| Issue | Consequence |
|---|---|
| SHR-73 Finder import | Test on T1 (27) and T2 (26), arm64, with a team-signed build. Drag/drop and file-provider behaviour are checked on both OS versions. |
| SHR-74 save/export | Same two OS versions. Include Tahoe-era save panels. Independent reopen on the same Mac. |
| SHR-75 window/keyboard/focus | Build on the Mac idiom (section 7). Menus and shortcuts are verified on 26 and 27 only. |
| SHR-78 runtime/performance | Owns the section 6 measurements on T1 plus an 8 GB Mac and the macOS 26 lane. Proposes the RAM/disk numbers for approval. |
| SHR-91 signing/update | arm64-only artifacts for both channels. A team-signed identity with an application identifier is a prerequisite for testing encrypted persistence at all. Enforce the macOS 26 floor in a Catalyst-only way without raising iOS. |
| SHR-51 support profiles | Resource envelopes are per Apple Silicon Mac; budgets come from SHR-78. OCR language support is checked on 26 and 27. |
| SHR-52 encryption | The engine needs an arm64 Mac Catalyst build only. x86_64 is not required. |
| SHR-66 local understanding | macOS 26 APIs may be used without fallback to 15. FoundationModels is optional and must degrade gracefully when unavailable. |
| SHR-106 Mac idiom/UI | Switch to the Mac idiom first (`theme.scale` 1.0). Design for Tahoe-era chrome only. Verify on an actual build. |
| SHR-38/39/41 persistence | Keychain behaviour is verified on team-signed builds on 26 and 27. |

## 11. Unresolved items

1. No macOS 26 environment, 8 GB Mac or Intel Mac exists for testing.
2. The Mac idiom has not been visually checked.
3. Encrypted persistence has not been exercised in the real app (signing).
4. The Catalyst-only deployment floor setting needs verification.
5. Apple's Intel/OS compatibility statements must be checked against Apple's pages before public copy.
6. Launch date is not set; if it slips past macOS 28's release, revisit the floor (26 would then be N-2).
7. There is no CI/pinned toolchain (SHR-16).

## 12. OWNER DECISION

Pending. Shrey to approve or change each item:

| ID | Decision | Recommendation |
|---|---|---|
| ENV-1 | Minimum macOS | **26.0** (alternative: 15.0) |
| ENV-2 | CPU support | **Apple Silicon only**; no Intel claim |
| ENV-3 | RAM/disk | 8 GB floor and 16 GB recommended as **internal assumptions only**; no public RAM/disk claim until SHR-78 measures |
| ENV-4 | Test lanes | Approve a macOS 26 test environment (VM on the M5 or a device) and access to an 8 GB Apple Silicon Mac for SHR-78, each as a separate bounded task |
| ENV-5 | Mac idiom | Accept "viable, no blocker found; SHR-106 verifies visually first" as the OD-6 engineering confirmation |
| ENV-6 | Public wording | "A Mac with Apple silicon, macOS 26 or later", once ENV-1/2 are approved and verified |

SHR-34 stays In Review until Shrey records these decisions.
