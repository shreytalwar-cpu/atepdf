# Startup investigation and import-only fix

29 September 2026. One measured baseline, one measured confirmation. No paid calls, document imports, installations, engine/state-behavior changes, simulator interaction, or owner browser use occurred during this performance task. Six application files changed only in their import declarations.

## Actual bottleneck

The Metro export included **both complete Lucide catalogues**:

- Native barrel imported by App, thread, activity and preview components.
- Web barrel imported for just `FilePlus2` in `DropSurface.web.tsx`.

Candidate 6 contained 3,708 icon modules (1,854 from each package). Their bodies occupied **3,080,751 bytes**, and three export barrels another **1,481,895 bytes**. These bytes were eagerly transferred in the entry bundle. The barrel's import graph accounts for the largest avoidable startup cost; the presence of a function in the bundle does not mean every function was invoked.

The analysis uses Babel's installed parser to inspect actual emitted Metro `__d` modules, rather than estimating from node_modules directory sizes. Source maps were absent from the existing export. Icon modules were identified through their declared icon-data names matched against the installed icon catalogue; barrel modules and their dependency arrays were measured directly. Raw module records are in `candidate6-bundle-analysis.json` and `candidate7-bundle-analysis.json`.

PDF.js and Tesseract already load via dynamic imports in `packages/web-pdf/src/client.ts`; their engine workers start only when used. No engine processing, independent validation or planner privacy boundary was moved for this fix.

## Change

Replaced 45 runtime icon bindings with **31 supported `lucide-react-native/icons/*` subpaths**, in:

- `apps/universal/App.tsx`
- `apps/universal/src/components/assistant-ui/elements/thread.aui.tsx`
- `apps/universal/src/components/JobActivity.tsx`
- `apps/universal/src/platform/Preview.web.tsx`
- `apps/universal/src/platform/Preview.native.tsx`
- `apps/universal/src/platform/DropSurface.web.tsx`

Existing local binding names and type imports were preserved. Alias names such as FileCheck2 and FilePlus2 were resolved through the installed package's own export declarations, to `file-check-corner` and `file-plus-corner` respectively. The installed native package explicitly supports `./icons/*`, including matching declaration files.

The installed web `lucide-react` package does **not** expose the equivalent typed public subpaths. DropSurface's single icon therefore uses the native package's matching cross-platform icon. Its `__iconData` literal was compared byte-for-byte with the previous web icon and matched exactly. No undocumented package internals or new dependencies were introduced. The separate optional Next workspace's web icon imports were left unchanged.

`import-changes.json` records every binding and destination. The transform guard failed before changing any file when it discovered the web-package export difference; the subsequent successful transform was limited to these six files.

## Measured bundle result

| Metric | Candidate 6 | Candidate 7 | Change |
|---|---:|---:|---:|
| Entry JS bytes | 6,795,614 | 2,238,893 | **−4,556,721 (−67.05%)** |
| Metro modules | 4,752 | 1,060 | −3,692 |
| Icon modules | 3,708 | 31 | −3,677 |
| Catalogue barrels | 3 | 0 | −3 |
| Locally computed gzip level 9 | 917,364 B | 482,977 B | −47.35% |
| Locally computed Brotli quality 11 | 573,142 B | 374,494 B | −34.66% |

Compression sizes are **estimates computed from the built files**, not transferred sizes. The local server sent uncompressed responses in both browser measurements.

Exact identifiers:

- Candidate 6 HTML: `2b0b0003602797ac9c0616a22ec3f9f5f94277b70ebdaae480cbf87043982d9c`
- Candidate 6 entry: `index-a4b8675353a7d03b97b406bf57159d3f.js`; SHA256 `b2251413e45e5bce229fda1c6b9dc1b25ebaf3be712bd41b9d966ac270983f5d`
- Candidate 7 HTML: `0054b8192566df7108bf418b0fc965b6d951f490361bd6505f766fd7ca024f45`
- Candidate 7 entry: `index-356409ae3ac271b0e3724cec6263d3e7.js`; SHA256 `0af20a4d1ec8015573521f78e045bb30ca06943f0f102adcb1f270288f76db29`

The initial static investigation used candidate 5. The parent switched the server to candidate 6 before the first throttled navigation, so **candidate 6 is the actual measured baseline** and the table uses its exact module/byte counts. The candidate 5 analysis is retained separately as `bundle-analysis.json`; its 4,751-module count must not be substituted for candidate 6's 4,752.

## One cold browser measurement before and after

Installed headless Chrome **154.0.8037.58**, 1440 × 1000 CSS px, isolated context, cache disabled, CPU slowdown **4×**, download **1.6 Mbps**, upload **0.75 Mbps**, latency **150 ms**, reduced motion. Same localhost server URL, app artifact changed by the parent between runs. JavaScript coverage instrumentation was enabled in both runs.

| Measurement | Candidate 6 | Candidate 7 |
|---|---:|---:|
| Named Choose-files control becomes visible | 35,672 ms | **12,197 ms** |
| Privacy dialog responds to the subsequent click, measured from navigation start | 35,773 ms | 12,293 ms |
| CDP cumulative script duration | 948 ms | **403 ms** |
| CDP cumulative task duration | 1,306 ms | 605 ms |
| Largest observed startup long task | 642 ms | **205 ms** |
| Sampled JS heap used | 28,866,076 B | 11,178,896 B |

The first-control observation improved **65.8%** in this single pair. It is not Lighthouse TTI, INP, p75, a physical-device result, or a production CDN claim. It does not wait for every decorative image to finish. Coverage instrumentation and the machine's concurrent workload can affect CPU timings. Transfer dominates this deliberately slow, uncompressed localhost scenario. There was no series of repeated samples to establish statistical stability.

Baseline capture recorded its timing/CPU/resource metrics and closed Chrome successfully, then its coverage serializer encountered an outdated Playwright result-shape assumption. The stored timing measurements remain available; baseline coverage ranges were not recovered. The serializer was corrected to the installed Playwright API before the one candidate-7 confirmation, which completed without errors. No baseline browser rerun was performed.

Artifacts:

- `throttled-startup.json` — actual candidate-6 timing and resource evidence, with the serialization limitation retained.
- `throttled-startup-candidate7.json` — candidate-7 confirmation, no errors.
- `throttled-ready-candidate7.png` — confirmation screenshot.
- `before-after.json` — exact bundle comparison.
- `candidate7-export.log` — successful real Expo web export to `.build/ux-20260929/candidate-web-7`.
- `expo-ts.log` — successful Expo TypeScript check (exit 0; empty diagnostic output).

## Remaining recommendations

1. Keep the direct public icon subpaths as a startup budget guard. A practical immediate guard is **entry JS ≤2.5 MB uncompressed and ≤500 KB gzip** on this build path, with zero catalogue barrels. Those limits leave modest room above the measured result; they are proposed engineering budgets, not user-facing promises.
2. Serve Brotli/gzip when the application is actually hosted; no hosting or publication change is authorized or performed here. A compressed-production network result must be measured independently. The current 12.2-second emulated load remains too slow to call a completed slow-network experience.
3. The unchanged paper illustration is about 688 KB. A format/size pass can reduce its transfer while preserving artwork, but no image edit was part of this task.
4. If a further lazy boundary is needed, split the lightweight planner connection/status client from response validation. The standalone response-validator module contributes about **153 KB uncompressed** and is needed only when a planner reply is handled. Load it before accepting a reply and preserve complete validation before any execution. Local request/envelope validation is shared by deterministic operations, so moving that code without an async-controller design would risk correctness. This is a smaller follow-up opportunity, not an implemented change.

The parent owns end-to-end regression and final UI/native acceptance. This task completed the import-only change, Expo TypeScript check, real web export, exact module analysis and one matching throttled confirmation. All created Chrome contexts/browsers were closed; port 3213 was left running under the parent's control.
