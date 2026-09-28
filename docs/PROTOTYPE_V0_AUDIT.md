# atepdf — prototype-v0 freeze and product audit

**29 September 2026 · read-only application audit · no development authorized**

Frozen repository: `/Users/shrey/Documents/ChatGPT/atepdf`, branch `codex/atepdf-chat-workflows`. Annotated tag **`prototype-v0`** points to **`5a6c0c542603cdb2a72bcdb2a91958ef3b6f12ab`**. Existing application source was committed through `036a722`; the freeze commit preserved pre-existing untracked configuration and duplicate public files without altering them. See [freeze/recovery record](audit/PROTOTYPE_V0_FREEZE.md).

This report consolidates source inspection, dependency/route/caller tracing and selected historical evidence. **No builds, tests, applications, servers, installers, provider calls, simulator operations or old-project scripts were run during this audit.** No feature, UI, architecture, dependency or test was changed or deleted. New audit/canonical documentation and documentation-only freeze notices follow the tag. The previous build/polish goal is paused. Recommendations below are not implementation authority.

## 1. Executive summary

atepdf is a functioning, deliberately narrow local-first PDF prototype with a shared conversational interface. Supported simple PDFs can be imported, merged, independently read, previewed, saved, modified by physical-page removal, and restored with Undo. Local English OCR and bounded JPEG compression are implemented. Optional AI selects complete validated local tools and answers product questions; it never performs PDF processing in the gateway.

**Keep the architecture and core engines. A rebuild is not justified.** The most important next work is to define product support boundaries and establish a reproducible regression baseline, then correct specific defects. The audit found no confirmed original-file overwrite or observed security compromise in the reviewed paths, but it did find material reliability and privacy gaps.

- Conversational continuity is incomplete: a bare reply to a clarification is not linked to the earlier request. Cancelling while sample PDFs are still fetching can still allow their subsequent import.
- Retained results are never evicted. AI request validation rejects more than 40 artifacts; the shared schema rejects more than 100. Ordinary continued work can eventually fail despite having a valid current PDF.
- Independent validation checks page counts, dimensions, rotation and normalized text. It cannot detect every visual loss, image-only page swap, crop-origin change or displaced OCR layer. “Validated” must retain that meaning.
- Browser JPEG recompression decodes before checking actual encoded dimensions against the declared pixel budget. Whole-document parsing, repeated byte copies and retained history also prevent a bounded-memory claim.
- The supported PDF set is narrower than a general PDF utility: encrypted files, forms, annotations/links, bookmarks and several complex structures are rejected. OCR is English/ASCII and has scan/geometry limits.
- The private gateway has useful controls, but an alternate launch environment can redirect the provider endpoint; the older preview server has weaker static-path/Host protection. Neither issue was exploited or observed in the current beta.
- Free-form instruction filters cannot guarantee exclusion of arbitrary sensitive text. Recognized rejected secrets also remain visible in the local chat. Artifact projection itself is explicit and separate.
- Production authentication, authentic purchases/subscriptions, deployment/distribution and physical-device acceptance are absent or unproven. Existing local builds and synthetic billing tests are not release proof.

### Evidence vocabulary

**IMPLEMENTED** means an active source path exists within stated scope, not production-ready. **PARTIALLY IMPLEMENTED** means useful code exists with material integration/scope gaps. **PLANNED BUT NOT IMPLEMENTED** means retained intent without a current execution path. **BROKEN / SUSPECTED BROKEN** identifies a concrete incompatible path or plausible failure; runtime reproduction is stated separately. **UNKNOWN** means evidence is insufficient. Historical test passes retain their original source/platform scope.

## 2. Current architecture

| Layer | Actual implementation | Client/server boundary |
|---|---|---|
| Conversation | `apps/universal/App.tsx`, official assistant-ui React Native primitives, Expo/RN Web, platform adapters | Runs in browser or native app; local presentation entries, no automatic PDF attachments to AI |
| State/jobs | `packages/core`: in-memory store, immutable originals, artifact lineage, revision-bound controller, atomic final commit | Device only; no persistence across termination |
| Protocol | `packages/contracts`: schemas, generated validators, semantic checks and shared corpus | Complete proposals validated before execution; at most four supported steps and one terminal output |
| PDF writer | `packages/web-pdf`: pdf-lib writer and conservative content/feature admission | Local browser worker or native JavaScript; no cloud processing |
| Independent reader/OCR | Web PDF.js/Tesseract; Apple PDFKit/CoreGraphics/Vision/ImageIO | Device only; self-hosted browser engine assets |
| Preview/save | Web canvas/download or file-system save; native raster/OS export | Local processing, user-directed destination; OS share/cloud destinations have separate semantics |
| AI | `packages/planner`: projection, privacy guards, OpenAI adapter, key/allowance, complete tool response validation | Local Node gateway sends allowed instruction/metadata to OpenAI; no PDF engine or tool executor on server |
| Native connection | Swift transport and local pairing; optional pinned private TLS companion | Development connection to the owner's local gateway, not production account identity |
| Hosting | Owned beta server, older Expo preview server, optional Next host | All intended as local development hosts; behavior/protections differ |
| Commerce | Disabled provider-neutral contracts | No active app integration, purchase or receipt service |

Principal pinned frameworks: Expo 57.0.25, React Native 0.86.3, React 19.2.3, assistant-ui React Native 0.1.44, Uniwind 1.12.0, optional Next 16.3.6; pdf-lib 1.17.1, PDF.js 6.3.289, Tesseract.js 7.0.0; AI SDK 7.0.118/OpenAI adapter 4.0.78. All **39 direct dependency versions** match their local installed manifests; no installation occurred. Licence declarations are metadata, not completed distribution compliance or a vulnerability scan.

The tracked tree contains **1,696 files**: 152 application, 35 shared-package, 48 test, 28 script, 219 handoff, 1,199 documentation/evidence and 15 remaining root/tool/skill files. There is one root dependency importer; `packages/` is source organization rather than independent published/workspace packages. Mac is **Catalyst**, not a new SwiftUI shell. Android is deferred.

Full structure/build/provenance review: [repository audit](audit/REPOSITORY_AND_BUILD_AUDIT.md); exact [tracked inventory](audit/REPOSITORY_INVENTORY.json) and [direct dependencies](audit/DIRECT_DEPENDENCIES.json). The original pack is retained, not reread wholesale or treated as current implemented behavior. Third-party internals/historical binary evidence were not exhaustively audited line by line.

## 3. Current feature inventory

The inventory follows actual callers and engine implementations. Broader schema options, retained roadmap entries, filenames and upstream library capabilities do not establish a working feature.

| Capability | Status | Verified source behavior / material limit |
|---|---|---|
| Choose PDFs / browser drag and drop | IMPLEMENTED | Platform picker/drop adapters; atomic supported-PDF import, actual file facts; touch can choose files |
| Bundled sample PDFs | IMPLEMENTED | Real local `brief.pdf`/`appendix.pdf`; pending sample-fetch cancellation is a separate defect |
| Originals and visible import order | IMPLEMENTED | Defensive snapshots; original files not overwritten; merge follows import order |
| Select/reorder/remove individual originals | PLANNED BUT NOT IMPLEMENTED / scope unresolved | All originals remain selected; no original management controls; visible position restarts per import batch and can be ambiguous |
| Local merge | IMPLEMENTED | Copies accepted pages into a new PDF; independently inspected before result |
| Remove physical pages | IMPLEMENTED | Validates page indices and refuses removing every page |
| Undo | IMPLEMENTED | Restores prior in-session result bytes; does not reclaim discarded artifact storage |
| Multi-step merge → OCR → compression | IMPLEMENTED within bounds | Actual engines and staged atomic output; historical browser/Apple helper chain evidence |
| English scanned-page OCR | PARTIALLY IMPLEMENTED | Text-empty eligible pages only, at most 15, printable ASCII hidden text; rotated/non-origin scans refused; same-page hybrid not generally handled |
| Compression | PARTIALLY IMPLEMENTED | Selected RGB JPEG recompression/object streams; no-larger fallback; requested target is best effort, not guaranteed |
| Independent validation | PARTIALLY IMPLEMENTED | Different writer/reader and semantic checks; incomplete visual/geometry fidelity oracle |
| Inline read-only preview | IMPLEMENTED | Page/zoom/Fit/Close; web canvas/native raster; not an editor or searchable/selectable text view |
| OCR quality inspection in preview | PARTIALLY IMPLEMENTED | Page appearance visible; no exposed recognized-text layer despite copy suggesting recognition review |
| Current/Earlier results, Save and follow-up context | IMPLEMENTED | Actual page/byte facts and local output cards; no saved chat history |
| Browser save/download | IMPLEMENTED | File-system close confirms save where supported; fallback truthfully says download started |
| Mac as-copy export | IMPLEMENTED source, latest interaction UNKNOWN | Confirmed/cancelled native callback exists; current Mac UI check deferred |
| iOS/iPadOS share/export | IMPLEMENTED with limited receipt | Share dismissal is not destination success; earlier simulator exact save/reopen proof exists, physical acceptance unknown |
| Local quick actions/help | IMPLEMENTED | Supported deterministic actions without AI; local help and product context |
| Scroll follow / Latest message / reply copy | IMPLEMENTED | Deliberate reading suspends following; explicit submissions/latest control restore it; copy is text-only and omitted for PDF result cards |
| AI product questions | IMPLEMENTED, bounded | GPT-6 Luna chat-reply tool with maintained product facts; accuracy not guaranteed by schema |
| AI PDF requests/quick actions | IMPLEMENTED | Model selects complete local workflow; client validates and executes; no app 2,000-token cap, bounded request allowance remains |
| Recover local shortcuts after enabled-provider failure | PARTIALLY IMPLEMENTED | Fallback exists when status is absent/disabled, but a failing enabled provider keeps receiving shortcut requests; explicit Help/current-card Undo remain local |
| Clarification dialogue | PARTIALLY IMPLEMENTED | Question displayed but next turn lacks question/prior-plan binding; short answer can lose intent |
| Honest job activity / stop / late-response rejection | IMPLEMENTED with interruption limits | Controller events, no fake percentages; no cancelled final commit; all CPU/native work is not instantly preemptible |
| Cancel before sample import starts | BROKEN / SUSPECTED BROKEN | Fetch lacks cancellation binding; cancel can precede a later successful import; source-reachable, not rerun |
| Long-session operation | BROKEN / SUSPECTED BROKEN | All stored outputs/undone artifacts enter request; >40 rejected by AI, >100 by shared schema; source-reachable |
| Masked key setup / connection status | IMPLEMENTED for private beta | Local key persistence and allowance; plaintext private file, not Keychain or user account |
| In-app allowance approval/pause/key removal | PLANNED BUT NOT IMPLEMENTED / scope unresolved | Private beta setup scripts exist; no complete consumer control flow |
| Native pairing/TLS | PARTIALLY IMPLEMENTED | Expiring local pairing/pinned transport; physical-network acceptance and production auth absent |
| Connection-control concurrency/error recovery | PARTIALLY IMPLEMENTED | Some setup work uses component-local busy state; native disconnect error handling incomplete |
| Start over / session warning | IMPLEMENTED | Clears local workspace; does not persist it or promise secure erasure |
| Persistent history/autosave/recovery/sync | PLANNED BUT NOT IMPLEMENTED | Memory-only store; export is separate from recovery |
| Arbitrarily large/unlimited PDFs | UNKNOWN; not a supported guarantee | No 20 MB byte cap; page/file/pixel/content bounds and available memory still apply |
| Encrypted PDFs / passwords | PARTIALLY IMPLEMENTED | No password-input/decryption workflow; real encrypted corpus gap |
| Forms, annotation/link/bookmark preservation | PLANNED BUT NOT IMPLEMENTED | Existing admission refuses those structures; no form filling or editing |
| Retained extra PDF/conversion commands | PLANNED BUT NOT IMPLEMENTED | Registry includes extract-selected-pages, split, reorder, rotate, reverse, images-to-PDF, PDF-to-images, text extraction, remove metadata, protect/unlock and ZIP export. Active protocol/engine permits only merge, removal, OCR and compression; registry declarations are not executable support |
| General text/image editing and document Q&A | UNKNOWN (no active implementation) | Current picker is PDF-only; no editor or document-Q&A tool; no v1 scope decision inferred. Document contents are not automatically projected; sensitive content typed into instructions may still reach the provider |
| Responsive layout / large text / reduced motion | PARTIALLY IMPLEMENTED | Real adaptive source and scoped historical tests; physical keyboard, minimum OS and mobile-web gaps |
| Full accessibility | UNKNOWN | Names/focus/targets and selected checks exist; no complete VoiceOver/WCAG acceptance |
| Dark mode | PARTIALLY IMPLEMENTED template scaffolding | App selects light appearance; no complete dark palette or acceptance |
| Web/browser support | PARTIALLY IMPLEMENTED | Chrome evidence; no declared/tested Safari/Firefox/Edge/mobile-web matrix or feature preflight |
| iOS/iPadOS/Mac release support | PARTIALLY IMPLEMENTED | Real native builds and selected simulator proof; current Mac interaction, devices and distribution remain open |
| Android | PARTIALLY IMPLEMENTED, deferred | Native bridge lacks required storage-isolation capability; no native test/build evidence, no OCR |
| Authentication/accounts | PLANNED BUT NOT IMPLEMENTED | Local token/pairing protection only; no signup/login/recovery/account authorization |
| Payments/subscriptions | PARTIALLY IMPLEMENTED domain contracts only | No purchase UI/provider/receipt/restore/webhook integration; disabled, eight synthetic tests |
| Product analytics | UNKNOWN (no current implementation) | No active emitter/provider found; local diagnostics and provider requests are separate |
| SEO/public marketing | PARTIALLY IMPLEMENTED dormant metadata only | Next layout metadata bypassed by raw Expo HTML route; no active public page/sitemap/robots strategy |
| Deployment/install/update | PARTIALLY IMPLEMENTED local tooling | Local launchers/builds; no verified public CI/deploy/store/notarization/update pipeline |

Detailed complete control/caller tracing: [frontend audit](audit/FRONTEND_CAPABILITIES_AUDIT.md). Engine/complex-PDF status: [PDF audit](audit/PDF_AND_TESTING_AUDIT.md). AI/auth/commerce: [security audit](audit/SECURITY_PRIVACY_AI_COMMERCE_AUDIT.md).

## 4. Technical debt, duplicates and incomplete experiments

1. **Large orchestration and compressed source.** `App.tsx` coordinates many state transitions; core/planner/engine files often put multiple decisions on one line. This makes reasoning and review harder. A broad rewrite is not necessary; isolate changes around tested transitions after approval.
2. **Competing host paths.** Beta, standalone preview and optional Next differ in containment, environment, gzip and lifecycle protection. README historically advertises all three. Resolve ownership instead of duplicating fixes indefinitely.
3. **Unreachable old UI.** The earlier Next `features/workspace/Workspace.tsx`, its modal Preview and shadcn Button have no active route/caller. Direct Radix dialog/slot, class-variance-authority and lucide-react are removal candidates tied to that island. Shared `services/export.ts` is active and must not be swept away with it. clsx/tailwind-merge and native icons remain used.
4. **Template residue.** assistant-ui has dormant template branches; source presence does not prove reasoning, attachments, suggested actions or other product workflows. Remove only proven unused branches after a scoped test-backed decision.
5. **Deferred native experiments.** Android source/tests are incomplete, intentionally preserved. Diagnostic UI tests and reverted-candidate evidence are historical instruments, not abandoned production features to delete automatically.
6. **Generated and duplicate material.** Numbered public shells/metadata/PDF copies, retained old hashed assets, duplicate manifest declarations, checked-in generated validators/knowledge and ~188 MB of tracked docs/evidence complicate identity and review. Exact duplicates are preserved at the tag. Generated artifacts need drift checks; evidence needs indexing before any cleanup proposal.
7. **Fragmented tests/build assumptions.** Root test and typecheck commands do not cover all layers; no tracked CI; host/Xcode/tool locations are machine-specific. Existing exports/builds are useful but not a reproducible release pipeline.
8. **Capacity and work interruption.** Repeated full-buffer copies, base64 native transfers, memory-only unlimited retained history and synchronous native/JS segments affect peak memory/cancel latency. Removing a SaaS byte limit was correct to the owner decision; it did not establish unlimited workload safety.
9. **Documentation drift.** Historical reports contain superseded stack, model/token/native and next-action claims. The new canonical index labels precedence without rewriting history. Runtime flags in app metadata are descriptive, not security gates.

## 5. Critical risks and acceptance blockers

No confirmed Critical-severity vulnerability was established. These are the highest-impact product/reliability risks plus source-backed conditional security findings; priorities are recommendations, not permission to fix.

| Priority | Risk | Evidence / practical implication |
|---|---|---|
| High before broader PDF claims | Fidelity checks miss imagery, crop-origin and text-position faults | PDF-02; independent parser is necessary but not sufficient. Build a preservation oracle and define supported structures |
| High before large-file/device claims | Web JPEG decoded-size guard and whole-document memory limits | PDF-01/PDF-04; no reproduced crash, but a concrete missing codec-boundary check and repeated allocations |
| High before public release | Production auth/key custody/distribution not implemented | Local owner token/plaintext credential model is not a multi-user service or shipped account system |
| Medium security, conditional | Inherited `OPENAI_BASE_URL` can redirect key/instruction metadata | Security F01; affects environment-inheriting paths, beta launcher filters it; current environment not inspected |
| Medium security, conditional | Older host can serve escaping symlink targets | Security F02; requires that host and pre-existing symlink; no planner-auth bypass asserted |
| Medium privacy | Categorical privacy wording exceeds free-text detection | Security F03; user-entered sensitive text may pass heuristics; automatic file projection remains restricted |
| Low privacy | Rejected recognized secret remains in visible local chat | Security F04; no automatic transmission established |
| Medium reliability | >40/100 retained-artifact limits stop normal requests | Frontend/PDF-03; local history and planning manifest need an explicit relationship |
| Medium UX | Clarification continuity and sample-fetch cancellation | Source-reachable incomplete state transitions; no live repro in audit |
| Medium recovery | Enabled-provider failure can block otherwise local shortcuts | FE-05; fallback depends on status being unavailable/disabled, not a failed provider request; no automatic paid retry is proposed |
| Release gate | Physical devices, current Mac interaction, browser/a11y coverage | Builds/viewport simulation do not prove actual export, software keyboard, lifecycle, assistive technology or memory behavior |
| Release gate | Broad difficult-PDF and visual-preservation corpus absent | Existing synthetic suite is meaningful but narrow; support must not be inferred from library features |

Other unknowns: dependency CVEs, parser fuzzing, full secret-history exposure, provider retention/account state, legal policy/store declaration adequacy, release licence notices, OS/system cloud-provider behavior. No secrets or private runtime configuration were inspected.

## 6. Test coverage and minimum baseline

There is substantial test source, but no single complete regression gate. The latest retained records show 72/72 core, 35/35 browser on final UI source, 16/16 beta launcher and two host PDF workflows. Selected source-bound iPhone/iPad Release checks pass 4/4 with qualified intermittent XCTest waits. Earlier candidate5 has actual simulator Files save → restart → system Preview and independent PDF.js read of that exact output. Mac has an actual local Catalyst build/signature check, not current interactive acceptance. Six Android native methods are unrun. Eight commerce cases are synthetic contracts, not billing sandbox purchases.

These are **historical results, not reruns on the tag**. Some helper tests use stubbed engines, some browser planner tests mock network responses, and different evidence belongs to different source snapshots. No line/branch coverage percentage is established.

The minimum proposed baseline is in [TESTING.md](TESTING.md): preserve the exact merge/remove/Undo/save chain; immutable originals and atomic failures; model/privacy/auth boundaries; clarification/cancel/history cases; and real supported/refused difficult PDFs. Each accepted transform must independently reopen actual saved bytes and prove page identity/order, geometry/text and rendered fidelity for the fixture. Each refusal must preserve earlier work and prevent partial import/output.

| Difficult category | Current coverage truth | Minimum gap |
|---|---|---|
| Encrypted | Refusal code, not a real encrypted-byte corpus | Real encrypted/owner-restricted/malformed cases |
| Malformed | Basic invalid bytes and drawing syntax | Cross-reference, object-stream, cycle/truncation and valid incremental update |
| Scanned | Real English scan/mixed-pages OCR | Same-page hybrid, existing OCR, blank/noisy/over-limit, text placement |
| Forms | Empty-dictionary rejection branch | Real filled widgets/XFA refusal |
| Annotations | Annots refusal | Actual highlight/ink/note/malformed refusal |
| Bookmarks/hyperlinks | Outlines/Names/Annots refused | Real outline, URI, GoTo and destination cases |
| Unusual fonts | Small digital/Helvetica fixtures | CFF/CID/CMap/non-Latin/subset/missing-font fidelity |
| Large files | Real >20 MB input/>40 MB output historical proof | Physical peak memory and encoded/declared image mismatch |
| Large page counts | 100-page boundary in code/metadata | Actual 99/100 success and 101-page atomic refusal |
| Rotated/mixed page sizes | Useful Apple raster-anchor tests | Cross-reader mixed-size/crop/rotation transform and saved-output corpus |

No missing test was implemented. No public test contact or paid call was made. Authentic billing sandbox and production-auth tests require their integrations to be separately approved first.

## 7. Subsystem disposition

Each row has a primary recommendation. “REFACTOR” means bounded work on the current design, not a rebuild. No disposition was applied.

| Subsystem | Classification | Reason / boundary |
|---|---|---|
| Shared Expo/RN/assistant-ui architecture | KEEP | Matches owner direction; actual working active interface |
| Approved identity/incumbent design | KEEP | Established brand/chat layout; no redesign required by audit |
| Local store/controller separation | KEEP | Immutable originals, revision binding, staging and atomic commit are valuable |
| Store retention/actionable manifest | REFACTOR | Memory growth and 40/100-artifact incompatibility |
| Shared protocol/complete-plan execution | KEEP | Positive validation boundary; preserve no partial execution |
| PDF writer + independent readers | KEEP | Existing engines have real proof; no replacement justified |
| Admission/workload/fidelity checks | REFACTOR | Codec guard and limited preservation oracle; retain fail-closed complex-PDF policy |
| OCR/compression | REFACTOR | Keep bounded implementation; clarify quality/support and validate corpus |
| Preview/save receipts | KEEP | Local inline preview and differentiated platform receipt facts |
| Conversation state orchestration | REFACTOR | Clarification, pre-import cancel, setup concurrency and long-session behavior |
| Active assistant-ui template adapters | KEEP | Shared primitives are integrated; preserve native composer behavior |
| Unreachable Next workspace/UI dependencies | REMOVE | Candidate only after caller/build verification; preserve active export helper and notices |
| Dormant template branches | UNKNOWN / NEEDS INVESTIGATION | Not all exported primitives are product features; inventory before removal |
| Older standalone preview host | REPLACE | Consolidate on one guarded host after deciding supported local/production path |
| Optional Next host | UNKNOWN / NEEDS INVESTIGATION | Working host, overlapping responsibilities; retained need not established |
| Provider construction/privacy rejection handling | REFACTOR | Endpoint trust and honest instruction privacy/retention |
| Local gateway auth/allowance/native pairing | KEEP within private beta | Useful scoped controls; do not relabel as production identity or dollar cap |
| Production auth/key storage | UNKNOWN / NEEDS INVESTIGATION | Product/account/custody decisions absent |
| Apple native engine/export bridge | KEEP | Real source/build/helper/simulator evidence, remaining platform gates |
| Deferred Android code | KEEP isolated | Preserve experiment; integration incomplete and explicitly deferred |
| Commerce contracts | KEEP disabled | Useful synthetic domain work; no pricing/purchase authority |
| Analytics absence | KEEP | No approved collection requirement; instrumentation not added by default |
| Generated assets/build scripts/test orchestration | REFACTOR | Reproducibility, drift, duplicate hosts/manifests and machine assumptions |
| Duplicate public generated files | REMOVE candidate | Byte-identical/stale artifacts preserved in snapshot; assess supported host needs before cleanup |
| Evidence/handoff/legacy provenance | KEEP | Needed for recovery, decisions and honest claims; improve index without erasing failures |
| Public SEO/distribution/payments | UNKNOWN / NEEDS INVESTIGATION | Not established production product decisions/integrations |

## 8. Documentation gaps and canonical structure

The requested structure is now created as an index of source-backed truth:

| Canonical file | Role / remaining gap |
|---|---|
| [PRODUCT.md](PRODUCT.md) | Audience, actual capability boundary, explicit unresolved product choices |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Current data/control flow and platform/server separation |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Canonical entry to incumbent tokens and state contract; no duplicate token system |
| [PRIVACY.md](PRIVACY.md) | Actual destinations/retention and free-text limitations; not a public legal policy |
| [SECURITY.md](SECURITY.md) | Threat boundaries, findings and unverified production controls |
| [TESTING.md](TESTING.md) | Existing layers/evidence and proposed minimum suite; no new tests |
| [ANALYTICS.md](ANALYTICS.md) | No active analytics, actual local diagnostics, unresolved collection/retention |
| [MONETIZATION.md](MONETIZATION.md) | Disabled contracts, preserved hypotheses and unresolved seller/purchases |
| [DECISIONS.md](DECISIONS.md) | Precedence and index of existing ADRs; freeze controls execution |
| [AGENTS.md](../AGENTS.md) / [README.md](../README.md) | Freeze instruction/current audit index; preserved local-running reference |

Historical reports/ADRs remain intact. The task ledger retains F/M/G mapping with a freeze notice; its old “next task” text is not permission to execute. Gaps still needing actual decisions/evidence include public product/support policy, data retention and legal privacy terms, browser/OS support, production deployment/auth/commerce, final packaging notices and reproducible CI. Creating these filenames does not resolve those gaps.

## 9. Top unresolved product questions

1. What is v1's promised PDF set: simple digital PDFs plus scans, or ordinary PDFs with forms/links/bookmarks? Is explicit rejection acceptable for the first release?
2. Must unsaved work recover after closing/crashing, or is a clearly disclosed session-only product acceptable? What should Undo/history retain?
3. How should clarification replies and follow-up references be bound to earlier intent while keeping document data local?
4. Who owns the AI key/cost/account in a shipped product, and what remains usable without AI or after allowance/network failure?
5. What privacy guarantee applies to typed instructions, provider retention and user-chosen cloud export destinations? What wording accurately communicates it?
6. Which browsers, OS versions and device classes are promised, with what measured resource/cancel behavior? Does “offline” include cold startup/install or only local processing after assets are present?
7. What constitutes acceptable PDF fidelity and OCR quality, and how can users verify the recognized text with the current read-only result model?
8. How will web/Mac/iOS be installed, updated, signed and authenticated for v1? Is the optional Next host still needed?
9. What accessibility and everyday-user comprehension gates must pass before release? Current scores/screenshots do not answer this.
10. What are the free/paid boundary, seller, price model, entitlement/restore rules and support/legal obligations? No retained commercial hypothesis is an approved launch offer.

These are a decision register, not ten blocking questions requiring an immediate chat response. No answers were invented.

## 10. Recommended path from prototype-v0 to production v1

Continue the existing retained F/M/G tasks only after the owner unfreezes a bounded phase. Do not start another roadmap or framework migration.

| Gate | Recommended next scope | Existing task alignment | Exit evidence |
|---|---|---|---|
| A — Product truth accepted | Review this audit; settle the v1 PDF/recovery/platform/AI boundaries; prioritize findings | F01/F02 and existing decision/design tasks | Owner-approved narrow scope and explicit non-goals |
| B — Reproducible frozen baseline | Run existing suites/builds in isolation; authorize minimum missing regression cases before fixes | F03/F04/F05/F06/F07/F09 | Source-bound baseline, saved-output oracle, expected failures for identified defects |
| C — Bounded correctness/security fixes | History/clarification/cancel, JPEG guard, endpoint/static-host/privacy defects; preserve engines/UI | Same affected F03–F07/F09 tasks | Each defect reproduced then fixed, regressions pass, originals/output integrity maintained |
| D — Platform and usability acceptance | Physical iPhone/iPad, current Mac, chosen browser/OS matrix, a11y and prepared consenting-user study | F02/F03/F09, retained G19/G27/G29 | Actual save/reopen, keyboard/lifecycle/memory/privacy evidence and observed task comprehension |
| E — Production operations | Decide and implement account/key custody, packaging/distribution, CI, notices/privacy/support; billing only if approved | F06/F08/F10 and retained M6/M7/G lifecycle tasks | Authentic auth/security and applicable store sandbox, signed/distributable artifacts, operational/legal readiness |
| F — Explicit release approval | Evaluate all accepted gates and known limitations before any publication | F10 | Owner-approved release scope, rollout and rollback evidence; no implied migration |

The smallest next action is **owner review of this audit and approval of Gate A/B scope**, not a rebuild. There is no evidence-based launch date or honest completion percentage yet because the supported product and several release-critical decisions are unresolved.

### Audit closeout

The app, old reference checkout and running owner session were left untouched. The recoverable source tag is fixed. Canonical documentation and four specialist audit reports are separate documentation changes. Runnable status remains the previously recorded local prototype; this audit does not assert a fresh launch or build. Old-source observation status: no new observation; prior hash-pinned learning remains under `docs/legacy-learning`. No runtime failure was newly reproduced; source defects, historical failed attempts and unverified gates are explicitly distinguished above.
