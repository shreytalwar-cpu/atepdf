# 08 | Test strategy and release gates

## Three different kinds of completion
1. **Pack validity:** JSON/examples/references in this handoff are internally consistent.
2. **Implementation validity:** code builds and real operations work against fixtures.
3. **Product readiness:** the approved UI is usable, private, reliable and distributable on actual platforms.

Passing the first does not imply the second or third. The supplied Python validator and fixture corpus support implementation planning; they do not prove any model or engine has passed.

## Planner evaluation
Use the supplied seed cases; extend to at least 300-500 independently authored examples before broad launch. Keep a holdout set separate from few-shot examples. Do not count near-identical paraphrases as independent proof.

Suggested case groups: explicit simple operations; merged/mixed chains; page math; negations; file ordering; originals versus current result; per-file batch versus combined; unsupported editing/signing; secret handling; ambiguous referents; malformed/malicious output; Hindi/Hinglish command variants as a separate measured slice; timeout and unavailable capability.

Measure exact semantic correctness: operation sequence, input/output refs, page selectors, parameters, final outputs and needed clarification. Schema validity is necessary but insufficient. Do not accept a plausible prose answer without a valid plan.

Initial proposed gates:
- 100% of accepted plans pass schema, semantic and capability validators.
- Zero unsafe execution cases across the adversarial corpus.
- At least 98% exact plan correctness on unambiguous simple held-out commands, and 95% on supported multi-step/follow-up commands; report confidence/sample sizes.
- Correct clarifications/unsupported outcomes measured separately; no score inflation from refusing every request.
- Target median planner latency under 1.5 seconds and p95 under 4 seconds for bounded ordinary requests on the chosen service tier. These are goals to measure, not guarantees.
- Model cost reported per correct completed plan, including failed calls/retries.

Failing a gate requires a fix, narrower advertised capability or a documented release decision. Do not silently lower thresholds or move hard cases out of the corpus.

## PDF fixture corpus
Use synthetic, licensed public or explicitly authorised test documents, not personal company files by default. Include:
- digital text with Unicode, embedded fonts and multiple columns;
- image-only scans, rotated scans, low-resolution/faint text and mixed scan/digital pages;
- mixed page sizes, rotations, crop boxes, transparency and masks;
- high-resolution images and already-compressed PDFs;
- encryption with known password and wrong-password cases;
- signed PDFs, forms/XFA, annotations, tags, bookmarks and links to exercise preservation/refusal;
- damaged/truncated files, decompression bombs, very large pages and zero-byte inputs;
- duplicate filenames, odd characters, long names and local-path canaries.

Every fixture has a local manifest of expected pages, text/sentinel content, supported operation results and acceptable losses (normally none for page operations). Keep fixture provenance and licences.

## Engine invariants
- Originals unchanged; outputs have new immutable refs.
- Page operations preserve selected order, text and rendering, within declared capabilities.
- Merge output page count equals total intended input pages; no skipped files.
- Removal/extraction uses the immediate input's physical page numbering.
- Compression never removes pages/content and reports actual final bytes; no fake exact target.
- OCR preserves visuals and creates searchable text without duplicating useful existing layers.
- Metadata cleanup removes only its documented scope.
- Encryption is tested with an independent reader; no secret in metrics.
- Partial batches show successes/failures separately; no global green tick over omitted files.
- Cancellation never exposes an incomplete artifact as final.

## UI tests
Test all states in `DESIGN.md` with actual files, not only seeded mock cards. At minimum use 360/390/430 CSS-pixel phone widths, compact-height phone, portrait/landscape tablets and 1280/1440 desktop viewports. On native platforms use equivalent real simulator/device sizes and large text settings.

Verify import-first and instruction-first, keyboard-open, multi-file strip, changing order, clarification, secure password, in-progress cancel, partial failure, result preview, Save cancellation, Share return, history missing file, offline, target-not-met and unavailable operation.

No clipping of Send/Choose files; no tiny tap labels masquerading as buttons; no blank action when a feature is unavailable; screen reader announces status without reading endless engine logs. Reduced Motion must stop decorative movement. Accessibility improvements can intentionally differ from the concept where documented.

## Network tests
Release builds with canary content must produce zero automatic document-content/secret egress, including provider requests, traces, metrics, error SDKs, session replay, previews and embedded links. Record exact destination allowlist. Test with gateway blocked to prove local operations still run. Test missing OCR assets honestly; a static asset download is allowed, an OCR page upload is not.

## Resource tests
Do not publish an unlimited file claim. Test low memory, storage exhaustion, cold OCR language download, many small files, a large digital PDF, a large scan, app backgrounding, screen lock, rotation and cancellation. Keep one heavy task at a time initially; expand concurrency only with evidence.

Approximate raw raster buffer planning uses width × height × 4 bytes, plus engine/intermediate overhead. A 300-DPI full page can consume tens of MB before copies. Estimate by page and cap pixels; do not only check input file byte size.

## CI lanes
- Common: schema lint, fixtures, model-response semantic validation, source-boundary checks and dependency/licence inventory.
- Web: type/lint/unit, actual worker operations, Playwright browser workflow tests and visual snapshots.
- Apple: Swift tests, xcodebuild simulator/device/Mac builds where runners permit, XCUITest workflow and visual evidence.
- Android: JVM/unit, Gradle build, emulator instrumentation and selected physical-device acceptance.
- Live model: scheduled/manual bounded evaluation with test credentials and spend cap; do not make every unit-test run call a paid API.
- Release: signing/install, privacy capture, store data declarations and entitlement sandbox tests.

Never “fix” CI by deleting failing tests, switching real engines to mocks or skipping platform lanes without a visible blocked status. Desktop-only tests cannot establish mobile-browser reliability.

## Release checklist
Actual capability matrix matches all marketing; no excluded features; startup is quick; outputs verified; original preservation; no document egress; privacy text accurate; known limitations visible; model/cost budgets in place; accessibility pass; local-history deletion; paid flows tested; support path; reproducible builds; owner approves publication and prices.

Provide `RELEASE_EVIDENCE.md` with build IDs, commit, engine/model configuration, tested devices/browsers, corpus versions, passes/failures, screenshots, network audit and remaining risks. This is the final product handoff, not a generic “done” message.
