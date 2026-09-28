# Platform evidence

One React Native / Expo and assistant-ui conversation targets **web, iOS/iPadOS and Mac Catalyst**. Android is deferred by the latest owner decision (ADR 0005); its source is preserved. The original handoff remains unchanged as provenance; later owner instructions control.

| Target | Current implementation | Verification boundary |
| --- | --- | --- |
| Web | Shared React Native view, real local worker transformations, PDF.js independent validation, Tesseract English OCR | Production build and browser fixture evidence recorded in IMPLEMENTATION_STATUS |
| iOS/iPadOS | Same React Native screen and local store/controller; new PDFKit reader/preview, Vision OCR and ImageIO codec; independent ID dev.atepdf.fresh | Native helper/shared-controller fixture chain passed. Two final iPhone simulator UI tests pass, including preview, typed removal/undo and actual share-sheet dismissal. iPad launch is separate; no physical-device claim. |
| Mac | Same native Apple module and interface through Mac Catalyst, using the installed React Native Catalyst framework slices | New Catalyst target configuration; application build/launch results are separate from the macOS helper tests. No distribution claim. |
| Android — deferred | Experimental adapter/preflight and fresh generated project retained | No Android native build or device execution; OCR unavailable. Android is excluded from default Expo platforms and bundle command. |

Browser scope: simple unencrypted PDFs, no fixed PDF byte cap; up to 100 pages per result. Document-level forms, tags, portfolios, outlines, name trees, actions and page annotations/links are rejected before transformation because preservation is not yet demonstrated. This is intentionally narrower than generic PDF support.

OCR: English only, at most 15 scanned pages per action, unrotated origin-aligned pages; ASCII output checked, unsupported encodings fail closed. Adds a real invisible text layer. Text-bearing pages are retained, not rasterised. OCR confidence is not a correctness guarantee. Mixed-content pages containing any existing text are currently skipped and need a broader scan-classification test corpus.

Compression: lossless object optimisation plus bounded re-encoding of plain 8-bit RGB JPEG XObjects at original dimensions. Masks, decode arrays, profiles and other unsupported encodings are not re-encoded. Text/vectors are retained. Outputs must independently validate and be smaller before replacing the candidate. Target checks use actual final bytes; no guaranteed size promise. Visual quality must be reviewed.

The optional browser development planner completed the original two approved synthetic calls. After the owner funded the account and requested AI enabled, a new local allowance of 20 requests was enabled without making another model call. Requests retain a 2,000-output-token limit, no retries and direct planning on Send; this is not an account dollar cap. Native AI transport is unavailable. No analytics or PDF upload endpoint exists. No live billing products, store account, migration or production namespace is configured. Eight synthetic commerce contract tests do not establish a purchase integration.

Apple preview renders to a disposable local PNG inside the conversation. Picked files are copied into app-private cache, read into the immutable store and released after import. Failed/cancelled imports release every returned picker copy; a provider failure before returning its handles may leave unknown copies until OS eviction. On Mac, the system document export dialog reports copy completion or cancellation before its source copy is removed. On iOS/iPadOS, native share targets may read after the sheet closes, so the disposable share PDF is retained until next application startup. A closed share sheet is not evidence of a destination save; reopen at the chosen destination to verify it.

The owner removed fixed PDF size restrictions. Import, engine preflight/output, retained local history and planner metadata no longer enforce byte caps. Actual device/browser memory and supported PDF features still determine whether a job can finish. This does not claim unlimited file support; decoded image, page-count and OCR-workload safeguards remain. The planner gateway limits its small JSON instruction request, not PDF bytes, which never leave the device.
