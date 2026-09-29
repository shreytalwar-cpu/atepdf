# SHR-16: current-source Mac development baseline

Issue: [SHR-16](https://linear.app/shrey-talwar/issue/SHR-16/lock-a-reproducible-mac-development-baseline). This record covers the existing runners and synthetic fixtures only. No application source, dependency, provider setting, owner session, or historical evidence was changed.

## Source and build identity

- Fetched `origin/main` and branched from commit `40f23ec2aaaf0e7522b1adc108c10f93d9f97d8d` (`Adopt approved atePDF v1 product specification`). The baseline source was exported with `git archive HEAD` into a new temporary directory; the checkout remained clean before evidence was added.
- Runtime: Node `v24.19.0`; Xcode `27.0` (build `27A266a`). Existing locked packages and CocoaPods were reused; nothing was installed or upgraded.
- SHA-256: `package.json` `64a3d5920fd5fbcbac85eee74c4f97ad7083ee15521f99ceff0a1e20e2f8eda6`; `pnpm-lock.yaml` `06b10dc0042b58e6d66f9233551f0859ed2613c10d8953324ab691d4f6264c81`; `apps/universal/App.tsx` `b6394f917126b729c0eaaaa3cb16b5aab2df0eca99787f97955755a874fb28ca`; `apps/universal/ios/atepdf.xcodeproj/project.pbxproj` `0603a0e8c9100a23cd809affb729469e14a40475a989217d7c2c88888c73386f`.
- The unsigned Release Mac Catalyst app was staged and signed for local development by the existing script. Bundle ID: `dev.atepdf.fresh.mac`; staged executable SHA-256: `5730ee6b514fc7c87611099a98257d1b23e93c3776ae04b91663e1135dafad23`. Strict signature verification and exact sandbox entitlement comparison passed. The script did not launch the app. This is an ad-hoc development artifact, not a notarized or distribution build.

## Commands and results

All commands below ran inside the temporary archive of `40f23ec`; `NODE` was `/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`. The archive used a copy of the already installed `node_modules` for the successful Mac build and a symlink to the existing locked Pods. Generated `.build`, native helper output, and Mac staging were isolated from the owner's checkout. There were no provider calls or real documents.

| Command | Result | Evidence |
|---|---|---|
| `$NODE --import tsx --test tests/regressions/*.test.ts` | **72 passed, 0 failed**, after allowing local loopback sockets for the synthetic network cases | [core.log](core.log) |
| `$NODE node_modules/typescript/bin/tsc --noEmit -p apps/universal/tsconfig.json` | **Passed**, exit 0 | Command record here; no stdout |
| `$NODE node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json` | **Passed**, exit 0 | Command record here; no stdout |
| `$NODE tests/native/apple/run.mjs` | **Passed**: PDFKit/CoreGraphics/Vision/ImageIO helper and shared writer/controller chain, including merge, OCR, compression, independent validation, page removal and Undo; synthetic original hashes unchanged | [apple-helper.log](apple-helper.log), [engine result](apple-engine-tests.json), [shared writer result](apple-shared-writer-tests.json) |
| `PATH="<installed Node bin>:$PATH" scripts/native/mac-build.sh` | **Passed**: Release Catalyst compile/link/bundle, staged ad-hoc signature, strict verification and sandbox entitlements; no launch | [command output](mac-build-command.log); full Xcode build log SHA-256 `5e353521613f8813cd697c85457278b45424d211a28a80f26ec57be76e044270` (temporary local log) |

The native helper independently checked page count/order, geometry, text, selected raster anchors and saved PDF readability. These checks do not prove complete visual fidelity for arbitrary PDFs. The Mac application was built but not opened or exercised in its UI; helper execution is not Mac application acceptance.

## Failed attempts and classification

- `pnpm test`, `pnpm exec tsc --noEmit -p apps/universal/tsconfig.json`, and `pnpm typecheck` each stopped in the bundled `pnpm` wrapper before their scripts ran: it attempted npm registry metadata access, then aborted a dependency-directory purge because there was no TTY. No installation or purge occurred. The direct installed Node/TypeScript runners above completed the intended checks. This is a runner/environment failure, not an application regression.
- The first direct core run in the restricted command sandbox reached a synthetic TLS test and failed with `listen EPERM` on `127.0.0.1`. The unchanged suite passed 72/72 with loopback permission. This is a sandbox restriction, not a product failure.
- The first isolated Mac build compiled but Metro could not resolve `expo` through the temporary archive's external `node_modules` symlink. A byte-preserving APFS copy of the already installed dependencies inside that archive allowed the same script to succeed. No dependency or application source was changed. The failed Xcode log SHA-256 is `cc250b269faa3415da87b24511161d2c23fb3b2d940ed7f3809780d2bdc2ebaf` (temporary local log).

No failing application check remains from these runs. Historical findings in `docs/AUDIT_PROTOTYPE_V0.md` are pre-existing and were not repaired or reclassified by this baseline. In particular, current-source quick-action routing and the approved v1 AI routing decision remain a known source/target mismatch outside SHR-16.

## Limits and repeatability

The Mac build reused this machine's installed dependencies and Pods. A clean-machine install, current Mac interactive import/save/reopen, keyboard/VoiceOver, physical device, signed distribution, and paid-provider behavior were not tested. The repository has no pinned Node/pnpm requirement or unified CI baseline; those are future triage findings, not changes made for SHR-16. The existing script creates a fresh temporary staged app and writes its build record in its source checkout; run it in an isolated source directory if an owner session may depend on the checkout's `.build` directory.
