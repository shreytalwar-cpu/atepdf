# ADR 0011 — Supported Mac and macOS launch envelope (SHR-34)

**Status:** **Approved** by Shrey on 30 September 2026 (revision 2, ENV-1 to ENV-7; section 13). The public wording remains provisional until the section 9 runtime acceptance passes; nothing here is a verified compatibility claim yet.  **Source:** `origin/main` `29f56ea919e73c12cdbd1c36f5f74cf37622347c` (30 September 2026).  **Authority:** `PRODUCT_V1.md` OPEN-01, MAC-01–04, ARCH-01, G-07; [SHR-34](https://linear.app/shrey-talwar/issue/SHR-34/decide-the-supported-mac-and-macos-launch-envelope) (parent SHR-26); SHR-16 baseline; approved SHR-105 design system (OD-6 Mac idiom pending engineering confirmation); Shrey's revision direction of 30 September 2026.  **Evidence:** [docs/evidence/SHR-34-2026-09-30](../evidence/SHR-34-2026-09-30/README.md).

The existing Expo / React Native / Mac Catalyst architecture stays (ARCH-01). This ADR recommends which Macs and macOS versions v1 supports, and what must be tested before that support is claimed. It changes no project setting.

**Revision 2.** Shrey did not approve revision 1 (macOS 26 minimum, Apple Silicon only). He directed:

- **Keep Intel.** Target Universal (arm64 + x86_64), conditional on real Intel runtime acceptance.
- **Setapp.** Treat Setapp as an intended channel.
- **Lowest practical floor.** Choose it from macOS 13.3 or 14 on evidence, and do not raise the floor for newer optional APIs.

This revision applies that direction to the same evidence. Revision 1's candidate table is superseded.

## 1. Current configuration facts

| Item | Fact (source) |
|---|---|
| App target | One `atepdf` target builds iOS/iPadOS and Mac Catalyst (`SUPPORTS_MACCATALYST = YES`). Mac bundle ID `dev.atepdf.fresh.mac` (development). |
| Effective floor | `IPHONEOS_DEPLOYMENT_TARGET = 16.4`. The app binary and ExpoModulesJSI are stamped `MACCATALYST minos 16.4` (React and ReactNativeDependencies 14.0, Hermes 15.1). Xcode writes `LSMinimumSystemVersion` **13.3** (macOS Ventura 13.3). The highest stamp sets the floor, so the current app installs on **13.3**. |
| Non-effective values | The source `Info.plist` says `LSMinimumSystemVersion 12.0`, which Xcode overrides. The app target and, through the Podfile workaround, every pod set `MACOSX_DEPLOYMENT_TARGET = 13.4`. For Catalyst the stamped minimum comes from the iOS deployment target, so **13.4 is not the floor; 13.3 is.** |
| Idiom | `TARGETED_DEVICE_FAMILY = "1,2"` → Catalyst **iPad idiom** (built `UIDeviceFamily [2]`), UI rendered at 77%. |
| Architectures | `ARCHS` unset, no `EXCLUDED_ARCHS`. `scripts/native/mac-build.sh` builds only the host architecture (`arch=$(uname -m)`, `ONLY_ACTIVE_ARCH=YES`), so every recorded build is arm64 only. That is a development-script choice, not an exclusion. `UIRequiredDeviceCapabilities = arm64` is an iOS key and does not exclude Intel Macs. |
| Toolchain | Xcode 27.0 (`27A266a`), macOS SDK 27.0, Node 24.19.0, Expo SDK 57.0.25, React Native 0.86.3 (new architecture, Hermes). No pinned Node/pnpm or CI (SHR-16). |
| Dependency floors | Expo 57 native modules declare iOS **16.4** (→ macOS 13.3); React Native core allows iOS 15.1. |
| Prebuilt binaries | React, ReactNativeDependencies, Hermes and ExpoModulesJSI all ship `ios-arm64_x86_64-maccatalyst` slices. |
| Own native code | `atepdf-pdf`: PDFKit, CoreGraphics, ImageIO, Vision (`VNRecognizeTextRequest`, accurate, `en-US`, no revision pinned), UIKit export picker (`UIDocumentPickerViewController(forExporting:asCopy:)`), UniformTypeIdentifiers, CryptoKit AES-GCM, Security (Data Protection Keychain). `atepdf-planner`: URLSession. **No `@available` gates; nothing needs more than iOS 16.4 / macOS 13.3.** |
| Sandbox/entitlements | App Sandbox, user-selected read-write, outgoing network. There is no `application-identifier` / `keychain-access-groups`, so in ad-hoc builds the Data Protection Keychain refuses the workspace key (`-34018`) and the app runs session-only (SHR-39). |
| Resource bounds in code | Admission 1–100 pages; native decoded-image budget 12 MP (`AtepdfPDFEngine.pixelLimit`). |

## 2. Hardware- and OS-sensitive features

| Feature | Status | Sensitivity |
|---|---|---|
| PDF read/render/merge/remove (PDFKit, CoreGraphics, shared JS writer in Hermes) | **Implemented** | Architecture-neutral; time and memory scale with pages and pixels. |
| OCR (Vision accurate, English) | **Implemented** (native helper verified; Mac app UI unproven) | Apple Silicon can use the Neural Engine; Intel runs on CPU/GPU (slower, **unmeasured**). There is no pinned request revision, so output can differ by macOS release. Test on the minimum and latest OS **per architecture**. |
| Compression (ImageIO JPEG re-encode) | **Implemented** | Architecture-neutral; CPU-bound. |
| Images→PDF, PDF→images | Planned (SHR-51) | ImageIO. HEIC decode is hardware-accelerated on Apple Silicon and on some Intel Macs; measure on Intel. |
| Protect/Unlock | Planned (SHR-52) | A native engine must ship **arm64 and x86_64** Catalyst builds under a Universal target. |
| Local understanding | Planned (SHR-66) | Vision text/segmentation (macOS 15+), `RecognizeDocumentsRequest` (macOS 26+), FoundationModels (macOS 26+, Apple Intelligence-eligible Apple Silicon only). Under this envelope all of these are **optional and availability-gated**; the required v1 path must work on the floor OS and on Intel. |
| Encrypted workspace + Keychain | **Implemented in source** (SHR-39); real-app encryption **unverified** | CryptoKit and the Data Protection Keychain exist on every candidate OS and both architectures. Real-app testing needs a team-signed identity (SHR-91). |
| Finder/file access | Import and export pickers **implemented**; drag/drop planned (SHR-73) | Sandbox/security-scoped access; picker UI differs by OS release. |
| Mac idiom / window behaviour | iPad idiom today; Mac idiom approved direction (OD-6) | Section 8. |
| Keyboard/focus, VoiceOver | Partial; Mac acceptance not done (SHR-75/76) | Catalyst keyboard, menu and accessibility behaviour varies by release. |
| Dark/light | Approved (SHR-105 OD-3), not implemented | Available on every candidate OS. |
| Local inference | **None implemented** | Planning is a hosted/paired service. |

## 3. Candidate envelopes (revision 2)

Both candidates are **Universal (arm64 + x86_64)**, with Apple Silicon as the primary development and performance target and Intel conditional on runtime acceptance (section 5).

| | **Option A — macOS 13.3 Ventura** | **Option B — macOS 14.0 Sonoma (recommended)** |
|---|---|---|
| CPU | Universal, Intel conditional | Universal, Intel conditional |
| RAM / disk | 8 GB / 16 GB internal hypotheses; disk unmeasured | same |
| Project change needed to enforce | None (today's effective floor); clean up the stale 12.0 / 13.4 values | Raise the **Catalyst** floor to Catalyst 17.0 (macOS 14.0) without raising the iPhone/iPad target (D-02); verify the mechanism first (section 6) |
| APIs used by current code | All available | All available |
| Major macOS releases in range | 13, 14, 15, 26, 27 (five) | 14, 15, 26, 27 (four) |
| Oldest Intel hardware in range | 2017 models: MacBook (12-inch), MacBook Pro, iMac, per Apple's Ventura list (verify) | 2018 MacBook Air/Pro, Mac mini; 2019 iMac; iMac Pro 2017; Mac Pro 2019, per Apple's Sonoma list (verify) |
| Apple Silicon coverage | Every Apple Silicon Mac | Every Apple Silicon Mac (all can run 14); only users who choose to stay on 13 are excluded |
| Distribution / signing | No difference: both floors are acceptable to Developer ID and the Mac App Store | same |
| Setapp | Widest reach; Setapp's own OS requirement must be checked | Very wide; same check |
| Accessibility / UI | Same frameworks. One more release of VoiceOver, keyboard and picker behaviour to verify. Icon Composer layered icons render only on 26+, so the legacy icon set covers every other release (already required by SHR-105) | Same minus one release |
| Testing burden | Five releases × two architectures; the weakest Intel hardware (2017 dual-core MacBook) sets the performance floor | Four releases; the Intel floor is 2018-class hardware |
| Security posture at launch | Apple's usual pattern updates only the current and two previous macOS releases (27, 26, 15); 13 dropped out first (verify) | 14 is also expected to be outside Apple's update window at launch (verify) |
| Dependency headroom | Equal to the current floor, so the next Expo/React Native minimum-iOS raise would force **dropping** a supported OS after launch | One release of headroom: a future raise to iOS 17 maps to macOS 14 and needs no support withdrawal |

Rejected: macOS 15.0 or 26.0 minimums. Current code and dependencies do not require them, and SHR-66's newer APIs can be optional (revision-1 rationale withdrawn).

## 4. Minimum macOS recommendation: 14.0 (Option B)

The current stack has **no hard technical difference between 13.3 and 14.0**: the same APIs, dependencies, signing and channels. The choice therefore rests on support and test cost, and on those B is the more practical floor.

1. **Universal makes the macOS floor the Intel hardware floor too.** A 13.3 floor adds the 2017 Intel machines, including the dual-core 12-inch MacBook. They are the slowest hardware for Vision OCR and compression and the likeliest to fail performance acceptance. Supporting them would mean finding and testing that hardware or excluding it after launch.
2. **One fewer macOS release** to verify for import/export pickers, keyboard, VoiceOver and OCR output on each architecture.
3. **Dependency headroom.** Expo and React Native periodically raise their minimum iOS; iOS 17 maps to macOS 14. Choosing 13.3 would make the next such raise a user-facing support withdrawal instead of a routine upgrade.
4. **No Apple Silicon Mac is excluded by hardware.** Every Apple Silicon Mac can run macOS 14. Only owners who choose to stay on 13 lose out.
5. **Cost of B:** a small, one-time configuration change to enforce a Catalyst-only floor, which must be verified.

**Option A remains viable.** Choose it if reaching Ventura users and 2017 Intel owners matters more than the extra test and support load. It needs no project change, but the weakest 2017 Intel hardware must then pass section 5 acceptance.

## 5. Universal arm64 + x86_64

**Recommendation: target Universal (arm64 + x86_64) for launch.** Apple Silicon is the primary development and performance target. Intel support is **released only after actual Intel runtime acceptance.**

| Question | Answer |
|---|---|
| Does the project compile for Intel? | **Yes.** A bounded Release Catalyst build with `ARCHS=x86_64` succeeded with 0 errors (evidence #3). |
| Do dependencies have x86_64 slices? | **Yes**, all four prebuilt binaries. Every future native dependency (SHR-52, any SHR-66 engine) must provide one too. |
| Do OCR/PDF components work in principle? | PDFKit, Vision, ImageIO, CryptoKit and the Keychain exist on Intel Macs. FoundationModels does not (Apple Silicon only), which is fine because it is optional. |
| Performance | OCR is expected to be slower without the Neural Engine. **Unmeasured**; SHR-78 measures it on real Intel hardware. |
| Intel Mac available now? | **No.** Rosetta on the M5 is **not** Intel acceptance, and a cross-compile alone is not runtime support. |
| Intel OS range | Intel Macs top out at macOS 26 (Apple's WWDC 2025 statement that Tahoe is the last Intel release; verify). Under Option B, Intel support covers macOS 14–26 on 2018-or-later Intel hardware. |
| Extra burden | A universal release build (the development script stays host-only), universal signing and notarization, x86_64 builds for every native dependency, Intel performance budgets, and an Intel test lane every release. The native code portion of the download roughly doubles; SHR-91 measures the final size. |

**Intel acceptance plan.** Before any public statement that Intel Macs are supported, one actual Intel Mac in the envelope must pass the Intel section of the section 9 matrix on a team-signed Universal build:

- launch;
- import;
- representative PDF processing;
- OCR;
- save/export/reopen;
- persistence;
- basic keyboard/focus;
- a crash-free smoke session.

Preferably the machine is 2018–2020 class with 8 GB, runs the minimum macOS, and repeats the run on macOS 26. Results are recorded against the exact build hash, Mac model and macOS build.

**Fallback.** If real Intel testing shows a material incompatibility, unacceptable performance or disproportionate maintenance, Shrey may separately decide to ship Apple Silicon only. The arm64-only build path already works.

## 6. Setapp

Setapp is an intended v1 distribution channel (**ENV-7, approved**). This supersedes the earlier `PRODUCT_V1.md` §4.2 exclusion, and §4.2 has been updated in the same change. Setapp acceptance has **not** been obtained.

For the envelope:

- A **Universal build is the safest compatibility posture for Setapp.** Setapp subscribers can be on Intel Macs, and one build serves both architectures. This is a reason to keep Intel where practical.
- Apple Silicon only stays a **fallback** if Setapp or runtime constraints later justify it.
- Setapp's integration, licensing, sandbox, bundle-ID, update-delivery and minimum-OS requirements are **not verified here**. SHR-91 (or a dedicated channel task) must check them against Setapp's current developer documentation before any claim. No Setapp acceptance is claimed.

**Enforcing the floor.** Raising `IPHONEOS_DEPLOYMENT_TARGET` would also raise the preserved iPhone/iPad builds (D-02). A Catalyst-only floor (for example an SDK-conditional `IPHONEOS_DEPLOYMENT_TARGET[sdk=macosx*] = 17.0`) must be verified in SHR-91 or SHR-106, together with removing the stale 12.0 and 13.4 values. **Not changed here.**

## 7. Resource assumptions (internal hypotheses — not published)

| Resource | Hypothesis | What SHR-78 must measure |
|---|---|---|
| Minimum RAM | **8 GB** | Peak memory for 100-page import, OCR and compression, and a long session, on an 8 GB Apple Silicon Mac and on the Intel test Mac |
| Recommended RAM | **16 GB** | The same scenarios on the 16 GB M5 reference |
| CPU class | Apple Silicon M1+ primary; Intel 2018+ conditional | Cold start, per-operation time and cancellation latency on the slowest available Apple Silicon Mac, the Intel Mac and the M5 |
| App size | About 33 MB staged arm64 (measured); Universal larger | Final signed Universal size per channel |
| Free disk | **No number.** Working hypothesis: a job needs about 3× its largest input plus retained workspace growth | Disk per job and per retained workspace; low and full disk behaviour (with SHR-40/41) |

No RAM, disk or speed claim is published until SHR-78 measures.

## 8. Catalyst Mac idiom (OD-6 engineering confirmation)

**Technically viable; no blocker found.**

- `TARGETED_DEVICE_FAMILY=1,2,6` builds (0 errors, `UIDeviceFamily [6]`) and launches, quitting cleanly (evidence #5/#6).
- The Mac idiom exists on every candidate OS (macOS 11+). It removes the 77% scaling, so SHR-105's `theme.scale` becomes 1.0.
- React Native handles `UIUserInterfaceIdiomMac`, and the app's JS does not branch on idiom.
- **Not visually inspected** (screen access was declined). Visual and interaction acceptance belongs to **SHR-106** (switch first, verify rendering, text scale, pickers) and **SHR-75** (window, keyboard, focus), on the minimum and latest macOS and on Intel. If a blocker appears, keep `theme.scale = 0.77` and report it.

## 9. Test matrix

**Current state.**

Environments:
- **T1:** MacBook Air M5, 16 GB, macOS 27.0. The only Mac available.
- **T2:** Apple Silicon Mac on the minimum macOS.
- **T3:** 8 GB Apple Silicon Mac.
- **T4:** Intel Mac.

| Capability | T1 macOS 27 (M5) | T2 min macOS | T3 8 GB | T4 Intel |
|---|---|---|---|---|
| Release Catalyst build | Builds (arm64; iPad idiom and Mac-idiom probe) | Untested | Untested | **Compiles only** (x86_64, unsigned, not run) |
| Native engine helper | Helper tests pass (SHR-16) | Untested | Untested | Untested |
| App launch | Actual app tested (SHR-39; Mac-idiom probe) | Untested | Untested | Untested |
| Import | Actual app, older source only (28 Sep smoke) | Untested | Untested | Untested |
| Finder drag/drop | Untested | Untested | Untested | Untested |
| Save/export/reopen | Actual app, older source only (28 Sep, Preview reopen) | Untested | Untested | Untested |
| Keyboard/focus | Partial: typed commands (28 Sep); no keyboard-only journey | Untested | Untested | Untested |
| VoiceOver | Untested | Untested | Untested | Untested |
| Encrypted persistence | Harness passes; **real app session-only** (ad-hoc Keychain `-34018`) | Untested | Untested | Untested |
| OCR/PDF processing in app | Untested (helper only) | Untested | Untested | Untested |
| Cancellation | Browser/unit only | Untested | Untested | Untested |
| Sleep/wake | Untested | Untested | Untested | Untested |
| Long session / memory | Untested | Untested | Untested | Untested |

**Required before launch support is claimed.** Every row must pass on the actual atePDF app, with a team-signed build:

| Requirement | Apple Silicon: minimum macOS | Apple Silicon: latest macOS | Apple Silicon 8 GB | Intel (before public Universal support) |
|---|---|---|---|---|
| Launch / crash-free smoke session | ✔ | ✔ | ✔ | ✔ |
| Import (picker + Finder drag/drop) | ✔ | ✔ | — | ✔ (import) |
| Save/export/reopen (independent reader, hashes) | ✔ | ✔ | — | ✔ |
| Encrypted persistence (quit/relaunch) | ✔ | ✔ | — | ✔ |
| Keyboard/focus | ✔ full journey | ✔ full journey | — | ✔ basic |
| VoiceOver | ✔ | ✔ | — | — |
| OCR / PDF processing | ✔ | ✔ | ✔ (performance) | ✔ representative + OCR |
| Cancellation | ✔ | ✔ | ✔ | — |
| Sleep/wake | ✔ | ✔ | — | — |
| Long session / memory | ✔ | ✔ | ✔ | — |

- "Latest macOS" is 27 for Apple Silicon; Intel's latest is 26, which is recommended for the Intel run if the machine supports it.
- A minimum-macOS lane can be a macOS VM on an Apple Silicon Mac (separate approval: VM tooling and an IPSW download), but VoiceOver and performance results from a VM must be labelled as such.
- Rosetta, browser, iOS-simulator and helper results never count. Each run records the build hash, macOS build and Mac model.

## 10. Recommendation (revision 2)

**RECOMMENDED V1 LAUNCH ENVELOPE**

- **Minimum macOS:** 14.0 (Sonoma). Option A, 13.3, is viable at a higher test cost.
- **CPU:** Universal arm64 + x86_64.
- **Intel status:** supported for launch **only after** actual Intel runtime acceptance (section 5); otherwise fall back to Apple Silicon only by separate decision.
- **Apple Silicon:** primary development and performance target.
- **RAM:** 8 GB minimum, internal hypothesis only.
- **Recommended RAM:** 16 GB, internal hypothesis only.
- **Free disk:** no public number until SHR-78 measures.
- **Distribution:**
  - Universal builds for the Mac App Store and direct download.
  - Setapp is an intended channel (ENV-7, approved) and prefers Universal; channel requirements are verified in SHR-91.
- **Actual tested hardware:** MacBook Air M5 (Mac17,3), 16 GB, macOS 27.0, and only for the items marked tested in section 9.
- **Build-compatible but unverified:**
  - macOS 14–26 on Apple Silicon;
  - 8 GB Macs;
  - x86_64 (compiles only);
  - the Mac idiom (builds and launches only).
- **Explicitly unsupported:**
  - macOS 13.x and earlier (unless Option A is chosen);
  - Intel Macs that cannot run the minimum macOS;
  - Rosetta as a substitute for native builds;
  - non-Mac platforms for v1 acceptance.

**Public wording (provisional, not publishable until section 9 passes):** "macOS 14 or later. Mac with Apple silicon or Intel processor." If Intel acceptance does not pass, the wording becomes "Mac with Apple silicon".

## 11. Downstream consequences

| Issue | Consequence |
|---|---|
| SHR-73 Finder import | Verify on the minimum and latest macOS, arm64 and x86_64 (Intel: basic import), with team-signed Universal builds. |
| SHR-74 save/export | Same OS × architecture coverage; independent reopen and hash checks. |
| SHR-75 window/keyboard/focus | Build on the Mac idiom. Full keyboard journey on Apple Silicon min/latest; basic check on Intel. |
| SHR-78 runtime/performance | Owns section 7 measurements on the M5, an 8 GB Apple Silicon Mac and the Intel Mac. Proposes budgets for approval. |
| SHR-91 signing/update | Universal release build (separate from the host-only dev script), Catalyst-only macOS 14.0 floor enforcement and stale-value cleanup. A team-signed identity is a prerequisite for encrypted-persistence testing. Includes verifying the Setapp channel requirements (ENV-7) and a documented arm64-only fallback. |
| SHR-51 support profiles | Budgets per architecture from SHR-78; OCR language checks on min/latest OS and on Intel. |
| SHR-52 encryption | The engine must build for arm64 **and** x86_64 Mac Catalyst and pass on the Intel lane. |
| SHR-66 local understanding | The required v1 path must work on macOS 14 and Intel. macOS 15/26 Vision APIs and FoundationModels are optional, availability-gated or have a fallback, unless SHR-66 proves that impractical. |
| SHR-106 Mac idiom/UI | Switch to the Mac idiom first (`theme.scale` 1.0). Design for pre-Tahoe and Tahoe window chrome (14–27). Ship the legacy icon set alongside Icon Composer layers. Visual acceptance on min/latest and Intel. |
| SHR-38/39/41 persistence | Keychain behaviour is verified on team-signed builds on the minimum and latest macOS and on Intel. |

## 12. Still open (validation, not approval)

Nothing blocks the recorded decision. These remain before launch claims:

1. *(Resolved: ENV-7 approved and `PRODUCT_V1.md` §4.2 updated.)*
2. **No test hardware or lanes** exist yet for the minimum macOS, an 8 GB Apple Silicon Mac or an Intel Mac. Those are required before launch claims, not before approving this decision.
3. **The Catalyst-only floor mechanism** for Option B is unverified.
4. **The Mac idiom** has not been visually checked.
5. **Encrypted persistence** has not run in the real app (needs signing).
6. **Apple's Intel and OS support statements** must be checked against Apple's pages before public copy.
7. **Setapp requirements** are unverified.
8. **No CI or pinned toolchain** exists (SHR-16).

## 13. OWNER DECISION

**Approved by Shrey on 30 September 2026.** Every item was approved as recommended:

| ID | Decision | Approved outcome |
|---|---|---|
| ENV-1 | Minimum macOS | **Approved: macOS 14.0 Sonoma** (Option B). Option A (13.3) not chosen. |
| ENV-2 | CPU | **Approved: Universal arm64 + x86_64** launch target. Intel support is conditional on real Intel runtime acceptance before public launch. Apple Silicon remains the primary development/performance target. Apple Silicon only is the fallback if real Intel testing reveals a material issue. |
| ENV-3 | RAM/disk | **Approved:** 8 GB minimum and 16 GB recommended remain internal engineering hypotheses only. No public disk-space requirement until SHR-78 measures it. |
| ENV-4 | Test coverage | **Approved:** a minimum-macOS (14.0) test lane, access to an 8 GB Apple Silicon Mac, and access to one real Intel Mac are required. These are validation requirements for launch claims, not blockers to recording this decision. |
| ENV-5 | Mac idiom | **Approved:** Catalyst Mac idiom is technically viable with no blocker found. Final visual/interaction acceptance stays with SHR-106 / SHR-75. |
| ENV-6 | Public wording | **Approved (provisional):** "macOS 14 or later. Mac with Apple silicon or Intel processor." Provisional until the required runtime acceptance is complete. |
| ENV-7 | Setapp channel | **Approved:** Setapp is an intended atePDF v1 distribution channel; `PRODUCT_V1.md` §4.2 updated. Setapp requirements still need verification in SHR-91; no Setapp acceptance has been obtained. |

OPEN-01 (minimum macOS, CPU and hardware envelope) is settled by this decision; its runtime evidence remains owed by SHR-73/74/75/76/78/91. SHR-34 stays In Review until PR #93 merges.
