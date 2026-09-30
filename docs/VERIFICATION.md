# Clean-checkout and PR verification

SHR-90 implements infrastructure only, under PRODUCT_V1 ARCH-06/G-09. Passing these gates does not certify v1 capability, Mac usability or release readiness. Product behavior, dependencies, billing, branch protection and owner sessions are outside this change.

## Exact local entry point

Use a dedicated **clean, committed** checkout with Git, Node **24.19.0** and plain pnpm **11.19.0** on PATH:

```sh
node --version
pnpm --version
node scripts/verification/verify.mjs
```

The default runs core and browser verification. Every mode exports `git archive HEAD` into a fresh temporary source directory and runs `pnpm install --frozen-lockfile` there. It never copies ignored dependencies, Pods, credentials, built exports or evidence from another checkout. The pnpm content store may supply integrity-checked locked packages; this is a fresh dependency directory, not a cold-network cache test. No `git clean`, version switching, owner server restart or dependency-directory purge is used.

`.node-version`, `package.json` engines/packageManager and `.npmrc` pin the tested versions. `.npmrc` rejects wrong engines/package-manager versions and disables implicit package-manager downloading/switching. No Corepack, custom runner wrapper or global install is required by the verifier. Provision those exact runtimes using your normal runtime manager before invoking it. Do not run the command from an active owner checkout.

Individual modes, all through the same isolated entry point:

```sh
node scripts/verification/verify.mjs core
node scripts/verification/verify.mjs browser
node scripts/verification/verify.mjs failures
node scripts/verification/verify.mjs native  # macOS + selected Xcode only
```

Browser mode installs only the Chromium revision specified by the locked Playwright package. On Linux, OS libraries must be available. The Actions browser job provisions them with `pnpm exec playwright install-deps chromium`; a local Linux machine can run that command after `pnpm install --frozen-lockfile`. It may need administrator permission. macOS needs no OS-library installation. Network access is needed for locked packages and browser downloads, and loopback is needed for fixture servers. Tests use synthetic documents and providers, never paid model calls, production credentials or customer data.

## Audited baseline and checks

Start source for SHR-90: `37e970025eaff9be35a2b8d5fa0291d9c7eef0a5`, latest fetched origin/main at dispatch. Required context: SHR-90, parent SHR-29, completed SHR-16/SHR-17, AGENTS, PRODUCT_V1, DECISIONS and ARCHITECTURE. Historical records remain unchanged.

| Area | Current prerequisites / exact commands | Gate |
|---|---|---|
| Install | Node 24.19.0, pnpm 11.19.0; `pnpm install --frozen-lockfile`; root `pnpm-lock.yaml` format 9.0 | Every verification mode |
| Package layout | One root lockfile importer; source-module `packages/` and duplicated universal manifest; not independently installed workspaces | Preserve root install |
| Build scripts | `pnpm-workspace.yaml` permits esbuild installer and declines Tesseract postinstall; no blanket lifecycle-script enabling | Frozen install |
| Shared/core | `node --import tsx --test tests/regressions/*.test.ts` (verifier expands sorted file list without shell globs) | Mandatory PR |
| Beta/unit | First `node scripts/build-gateway.mjs` (required ignored gateway build); then `node --test scripts/beta/beta.test.mjs`; synthetic local hosts/OpenSSL fixture certificates | Mandatory PR |
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit --incremental false -p apps/web/tsconfig.json`; repeat for `apps/universal/tsconfig.json` and `tests/compatibility/tsconfig.json` | Mandatory PR |
| Generated validators | `node scripts/contracts.mjs --check` compares expected locked-Ajv standalone JS/declarations without writing | Mandatory PR |
| Generated knowledge | `node scripts/embed-product-knowledge.mjs --check` | Mandatory PR; runtime facts unchanged |
| Schemas/catalogue/evals | `node --import tsx scripts/verification/schemas.mts`: compile four current contract schemas, fixture/compatibility schemas; validate manifest and retained matrix; validate all 118 seed DTO/response rows; check unique eval IDs/row shape and catalogue parameter parity with request/response schemas | Mandatory PR |
| Protocol adversarial corpus | Existing protocol-conformance suite checks supported seeds and all 21 adversarial plans, including intentionally malformed requests | Mandatory PR |
| Browser | `node scripts/assets.mjs`; Expo web export; `node scripts/check-web-budget.mjs`; `node scripts/verification/browser.mjs` through the entry point | Mandatory bounded PR smoke |
| Apple helper | `node tests/native/apple/run.mjs`: xcrun/swiftc, PDFKit/CoreGraphics/Vision/ImageIO, local ML services; same locked Node packages | Optional local native mode |
| Swift transport | Native mode compiles `AtepdfPlannerTransport.swift` + `tests/native/planner/main.swift` with isolated module cache | Optional local native mode; execution is separate |
| Catalyst application | `scripts/native/mac-build.sh` in a separately isolated checkout; full Xcode, Python 3, tracked workspace, locally installed **locked** Pods, Node on PATH | Manual compile/build; no launch by default |
| CocoaPods tools | `scripts/native-tools/Gemfile.lock`, CocoaPods 1.16.2, historical Bundler 2.4.22/Ruby 2.6.10; `apps/universal/ios/Podfile.lock` | Native setup only, not provisioned by Linux CI |
| Full compatibility/OCR/large files | `tests/compatibility/README.md`, original `playwright.config.ts`, optional Python corpus generation environment | Optional/manual; not each PR |
| Sonar/quality | No current Sonar configuration, Actions, linter or coverage gate found at dispatch | No service/token provisioned; actionlint validates new workflow |

The retained 15-operation catalogue is a historical specification; the current runtime advertises four capabilities. The gate checks their consistency without promoting planned tools into implemented claims. Retained compatibility observations are schema-validated as historical data, not rerun or relabelled current passes. Optional Python corpus regeneration remains visibly skipped unless explicitly provisioned; manifest/hash/reader regressions still run.

SHR-16's fragile assumptions addressed here:

- Its pnpm wrapper attempted registry lookup and a noninteractive dependency purge. Version pins and direct installed Node tool invocations avoid wrapper-driven test execution.
- It reused installed dependencies/Pods; a dependency symlink failed Metro resolution. Each mode now installs locked packages inside the source snapshot. Native Pods still need separate clean-machine validation.
- Restricted loopback produced `EPERM`; these tests need ordinary local listening permission, not provider access.
- Beta unit fixtures import the ignored built gateway; the core lane explicitly builds it before testing.
- Default Playwright configuration uses installed Chrome, a fixed port and `reuseExistingServer:true`, and writes tracked historical evidence. PR smoke uses locked Chromium, an owned ephemeral server with no real gateway, and writes within a disposable snapshot.
- Generator output had internal regular-expression identifier drift in two validators. Regeneration changes identifiers only; validation logic is byte-identical after consistent identifier renaming. This PR does not change schema/product semantics.

## Required checks and review policy

Recommend these exact GitHub check names, from `.github/workflows/verify.yml`:

- **Shared and quality gates** — clean install; full core and beta units; all three TypeScript configurations; generated checks; schema/catalogue/eval validation; deliberate failure and restoration proof.
- **Safe browser smoke** — fresh Expo export, local engine assets, startup budget, all existing mocked planner cases and the saved merge → remove page → Undo workflow, with independent saved-byte inspection.

Both jobs run on every PR to avoid missing required checks through path filtering. No platform matrix, push duplication or full expensive browser/Apple suite. Concurrency cancels superseded runs. Expensive native acceptance is selected by the changed area and reviewer, not automatically run on every documentation PR. New mandatory coverage should be added when a separately authorized implementation introduces it.

**Owner approval and repository support are still required to configure branch protection/rulesets.** Recommended steps: require the two successful names above on current PR revisions; require conversation resolution; select the intended review count/critical-code ownership policy; forbid auto-merge. Do not bypass unavailable protection. The current read-only API returned HTTP 403 requiring GitHub Pro or a public repository; this task does not change the plan or repository visibility. No protection has been changed.

No auto-merge. Implementation PRs may be batch reviewed later. Security, storage, billing, signing and outbound-boundary changes need stronger independent human/appropriate specialist review, with explicit acceptance evidence. No mandatory per-PR cross-model review is introduced. CI never replaces actual Mac acceptance. Reviews and owner release approval remain separate.

## Runners, cost and permissions

The workflow uses two standard `ubuntu-24.04` jobs, read-only `contents` permission and exact official action commit pins. Checkout credentials are not persisted. No production secrets, caches, uploaded artifacts, macOS hosted capacity, scheduled runs, larger runners, spending settings or paid-service calls are enabled. Logs and job summaries contain source identity and exact commands; local structured evidence stays under ignored `.build/verification/`.

Planning estimate: roughly **3–6 Linux wall minutes for core/failure checks plus 4–8 for browser**, subject to downloads/runner speed; each job has a 15-minute timeout, at most 30 allocated Linux job minutes per workflow attempt. This is an estimate pending measured hosted runs. For this private repository, minutes consume the owner's existing allowance. Allowance/budget details could not be read with current token permissions; no extra billing scope was requested and no budget changed. Verify existing allowance and a zero-overage budget in owner billing settings before sustained use; a workflow timeout is not an account spending cap.

GitHub's [billing documentation](https://docs.github.com/en/billing/concepts/product-billing/github-actions), checked 30 September 2026, lists standard Linux 2-core at $0.006/minute and standard macOS at $0.062/minute for usage beyond allowance. Thus a 7–14-minute Linux run would be about $0.042–$0.084 if over allowance; the 30-minute timeout bound is $0.18. No paid capacity is authorized by SHR-90. Self-hosted infrastructure and administration would be a separate owner decision.

No hosted Mac job is enabled: the current native baseline uses Xcode 27.0 (27A266a), local Vision services and previously installed Pods. Hosted Xcode/SDK availability, minimum-OS support, clean frozen Pod install and cost need validation before a bounded native lane is required. Mac runner cost is materially higher. Native mode can run the existing Swift helper and compile transport locally without CocoaPods or signing credentials. Catalyst compilation stays manual until its clean prerequisites are proven.

## Source-bound evidence

The verifier refuses dirty/untracked source and mismatched `VERIFY_EXPECTED_SHA`, and verifies Node/pnpm before export. Actions verifies the default PR **merge commit** (`github.sha`), recording the PR head separately. This tests proposed changes integrated with main; it is not evidence for some unrelated head. Each report includes:

- exact verified commit, PR head, workflow ref/revision, run ID;
- SHA-256 of archived committed source, lock/config/workflow/harness files;
- each actual command, result, timing and log hash;
- browser version, HTML/script hashes and test result data;
- failure mutation before/after hashes, expected nonzero status and restored checks.

Local invocation writes `.build/verification/<mode>-<commit>-<timestamp>/report.json` and per-command logs. CI prints compact reports into job logs and adds command/result summaries. GitHub binds run/check metadata to its tested commit and workflow; review the PR head and tested merge commit together. `GITHUB_WORKFLOW_SHA` identifies executed workflow source, which can differ from tested merge source. Do not reuse evidence after relevant source/config changes.

The failure mode deliberately injects a TypeScript assignment error, schema drift, stale validator, stale knowledge, malformed catalogue, invalid manifest and failing regression. Each must exit nonzero with the expected diagnostic; signals/timeouts are failures of the proof, not accepted rejections. Mutated files are restored in `finally`; schemas/generated/type checks and the affected regression are rerun afterward. Mutations occur only inside disposable committed snapshots.

## Mac and release separation

Actual Finder import/export, system dialogs, keyboard/focus, VoiceOver, sleep/wake, real Intel/Apple Silicon behavior and signed-production Keychain/sandbox behavior require actual Mac acceptance. Swift helper execution, transport compilation, Chromium smoke, Catalyst builds and ad-hoc signatures prove none of those by themselves. Certificates, notarization, App Store archives, Developer ID, distribution/updates and channel billing are release-only checks owned by later bounded tasks. SHR-90 starts no downstream task.

## Troubleshooting

- **Dirty checkout / wrong SHA:** use a dedicated worktree at the intended committed revision. Never delete another worker's files to make the gate pass.
- **Wrong runtime / pnpm wrapper:** provision pinned versions on PATH. The verifier checks the observed version; a wrapper that reports the version but switches/purges later is unsuitable. Do not bypass pins or update the lock to silence an install failure.
- **Frozen install fails:** inspect registry connectivity and lockfile/manifests. The root lock is authoritative; no broad upgrade or install in subprojects.
- **Generated drift:** run `node scripts/contracts.mjs` or `node scripts/embed-product-knowledge.mjs` in your development checkout, review the diff, commit the justified regeneration, then rerun. Check mode never repairs drift silently.
- **Catalogue/schema failure:** correct the assigned schema/catalogue inconsistency; do not advertise extra runtime capabilities or weaken admission guards.
- **Loopback/ML sandbox denial:** run authorized synthetic checks in an environment permitting loopback and (native mode) local Vision services. An `EPERM`/Vision service denial is not a pass or a product defect by itself.
- **Browser missing OS libraries:** provision Chromium libraries as above; never point smoke at an owner preview, a different checkout or a live gateway. Read the failing command's isolated logs.
- **Native prerequisite missing:** select and record compatible full Xcode. Do not reuse another checkout's Pods/builds and call that clean-machine evidence. No Expo prebuild, signing account or tool installation is automatic.
- **Actions unavailable/quota exhausted:** leave checks unverified and report the hosted limitation. Do not add paid runners, secrets, auto-merge or bypass protection.
