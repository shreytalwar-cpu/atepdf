# Testing baseline

Frozen source: `prototype-v0`, 29 September 2026. **No test, build or application was run during this audit, and no test was added.** Existing test definitions and selected historical result files were read. Counts below are not fresh passes.

## Approved target and current evidence

[PRODUCT_V1.md Section 16](PRODUCT_V1.md#16-verification-and-release-gates) governs v1 release acceptance, with Mac as launch/acceptance platform. The historical baseline and proposed tests below are not a new implementation instruction or a passed v1 gate. The later [quick-action checkpoint](IMPLEMENTATION_STATUS.md#29-september-scoped-quick-action-correction) tested the prior bypass task; its objective is now superseded by D-04/CONV-01, while source and evidence remain unchanged. No application test or build was run in this documentation-adoption task.

## Current clean-checkout gate (SHR-90)

The [verification guide](VERIFICATION.md) defines the new isolated entry point, mandatory PR checks, rejection proofs and source binding. The frozen counts and historical evidence below are preserved. Optional Mac UI and release acceptance remain separate.

## Existing layers

| Layer | What exists | Historical proof and limits |
|---|---|---|
| Core/contract/planner regressions | 11 Node test files, 72 top-level declarations; root `pnpm test` | Latest retained core record 72/72. Includes real PDF tests and stubbed controller/transport tests, not 72 fidelity workflows |
| Built browser | Six Playwright spec files, Chrome-only configured runner | Candidate10 UI source `7935daa`: 35/35. Host follow-up: two real PDF workflows. Mocked planner cases do not prove hosted AI |
| Local beta launcher | Separate launcher/static response test sources | Retained 16/16; not included in root `pnpm test`; not proof for the older preview host |
| Apple engine helper | Swift PDFKit/CoreGraphics/Vision/ImageIO plus TS shared writer/controller harness | Actual historical OCR/compression/geometry/save-reader evidence; host helper is not an iOS app or physical device |
| Apple UI | Three UI-test files, 19 methods, including probes/diagnostics | Latest source-bound selected iPhone/iPad cases 4/4, with qualified intermittent animation-idle waits; not all 19 freshly passed |
| Saved native output | Simulator export/restart/system Preview plus separate PDF.js read | Earlier candidate5 exact saved copy: 3,099 bytes, three pages A1/A2/B1; not latest-source or physical save acceptance |
| Native planner/TLS | Node and Swift harnesses with synthetic peers | Positive/negative local authentication, cancellation and pinning cases; physical Wi-Fi remains open |
| Hosted model | Separate explicitly gated synthetic live runner | Earlier bounded GPT-6 Luna calls only; no request made during audit and no new allowance granted |
| Android | Three host preflight cases and six native instrumented methods | Native methods unrun; no Android app-build proof; platform deferred |
| Commerce | Eight pure contract tests | No store/provider receipt, checkout or purchase sandbox test |
| Type/build | Next typecheck; separate universal check; Expo export; actual Next/Xcode builds in prior records | Package validation, Hermes bundle and helper compilation are distinct from application builds, launches and export proof |

Source maps, exact result records and limits are in [PDF_AND_TESTING_AUDIT.md](audit/PDF_AND_TESTING_AUDIT.md), [FRONTEND_CAPABILITIES_AUDIT.md](audit/FRONTEND_CAPABILITIES_AUDIT.md), and [SECURITY_PRIVACY_AI_COMMERCE_AUDIT.md](audit/SECURITY_PRIVACY_AI_COMMERCE_AUDIT.md). Prior failures, skipped/unrun probes and source mismatches remain visible there and in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## Minimum regression gate before further development — proposed, not implemented

First establish a reproducible baseline on the frozen source in an isolated environment, preserving the owner's live session and credentials. Reuse current suites rather than replacing them. Record source SHA, exact dependency/runtime versions, app/export identity, test configuration and saved-output identity. Root `pnpm test` alone is insufficient; no single current script combines all layers.

1. **Core correctness:** actual bundled merge → independent reader → preview/save → remove page 2 → Undo exact prior bytes. Immutable originals, stale/partial/malformed/replayed plan rejection, validation failure mid-chain, cancellation before commit and atomic failed import. Inspect actual saved bytes, not a separately regenerated substitute.
2. **Conversation and lifecycle:** local and mocked-AI paths for the same job; bare clarification reply; cancel delayed sample loading; late planner response; lossy choice; more than 40/100 retained artifacts with Undo; long-session memory. Assert errors retain usable prior work. Existing code is expected to expose gaps in these proposed cases.
3. **Privacy/security:** outbound synthetic canaries, exact request allowlist, no document/filename/path/checksum/secret fields, recognized rejected-secret chat retention, explicit free-text limitations, inherited endpoint override, every supported host's Host/symlink guards, oversized response, local key/allowance and native auth isolation. Do not spend on hosted calls to prove local transport behavior.
4. **Difficult PDFs:** the minimum families below, with supported-versus-rejected outcomes decided explicitly. Refusals must be atomic and understandable; unsupported fixtures are not a request to implement support.
5. **Platform UI/export:** built web on the approved browser matrix; actual iPhone/iPad app with visible keyboard, larger text, VoiceOver, Reduce Motion, rotation/background/restart and save/reopen; current Mac interaction/export. Simulator and physical runs are distinct gates. Android stays deferred.

## Difficult-PDF minimum corpus

The [SHR-45 synthetic corpus](../tests/fixtures/corpus/README.md) indexes reusable ordinary and difficult inputs with hashes, provenance and structural checks. Fixture presence alone does not classify a transform as compatible; operation evidence is recorded separately below.

The [SHR-46 service matrix harness](../tests/compatibility/README.md) runs current browser executors and independent saved-output checks with explicit supported/refused/failed/unverified/unrun categories. Its [source-bound observations](evidence/SHR-46-2026-09-30/README.md) preserve every refusal/failure and identify the remaining Mac-app and visual verification gaps.

| Family | Current boundary | Minimum missing regression evidence |
|---|---|---|
| Encrypted | Refuses encryption/locked documents; no password entry | Real password-protected AES and owner-restricted files, malformed encryption; safe refusal |
| Malformed | Basic invalid bytes and content syntax tests exist | Truncated xref/object stream, bad length, cyclic/missing pages, valid incremental update; no silent blank success |
| Scanned | English OCR; text-empty eligible pages, at most 15; ASCII hidden text | Image-only, same-page hybrid, existing OCR, blank/noisy scan, over-limit scan; text position/search/copy plus unchanged image |
| Forms | AcroForm rejected | Real filled text/widget/check/radio/XFA structures; refusal rather than silent loss |
| Annotations | Page annotations rejected | Highlight, note, ink and malformed arrays; atomic refusal |
| Bookmarks/hyperlinks | Outlines, Names and annotations rejected | Nested outline, URI, GoTo and named destination; explicit refusal |
| Unusual fonts | Narrow digital fixture evidence | Embedded subset/CFF/CID/CMap, ligatures, non-Latin, missing font/Type3; render and text-position preservation for admitted files |
| Large files | Actual >20 MB inputs and >40 MB output covered historically | Encoded JPEG/dictionary dimension mismatch, cumulative decoded work, decompression bounds, peak memory on physical devices |
| Large page counts | 100-page limit; metadata boundary tests | Actual 99/100-page success and 101-page input/merge refusal; no partial result |
| Rotated pages | Digital geometry partially covered; rotated OCR rejected | 0/90/180/270 and nonzero crops; preserve digital boxes/identity, refuse unsupported OCR |
| Mixed page sizes | Limited helper geometry coverage | A4/Letter/landscape and crop origins through merge/remove/save across PDF.js/PDFKit |
| Compression | Bounded RGB JPEG, no-larger fallback | CMYK/ICC/grayscale/masks/unsupported filters skipped faithfully; actual byte facts and target-not-met receipt |

For each accepted transform: preserve original checksum locally, check physical page identity/order, boxes/rotation and extracted text, independently reopen the actual saved output, and render every page for the fixture oracle. Include deliberately faulty candidate outputs (blank, swapped scan pages, missing image, shifted OCR/crop) to establish what validation can detect. Runtime text/page checks alone cannot prove visual fidelity.

The detailed [engine audit matrix](audit/PDF_AND_TESTING_AUDIT.md#difficult-pdf-coverage-current-evidence-and-minimum-regression-proposal) specifies exact source coverage and cases. Do not implement the proposed suite under the freeze. Authentic billing sandbox coverage becomes mandatory only when a purchase integration is separately approved and implemented; its absence must not be hidden behind the current eight synthetic tests.

## Unknowns

No line/branch coverage percentage, clean current all-platform baseline, parser fuzzing, fresh CVE review, minimum-OS matrix, Safari/Firefox/Edge acceptance, physical memory/lifecycle proof or completed accessibility audit is established. Existing Chrome viewport checks are not mobile-browser compatibility. The SHR-90 [verification guide](VERIFICATION.md) orchestrates a bounded PR subset; it does not establish all-platform or Mac acceptance.
