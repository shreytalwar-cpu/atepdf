# Platform evidence

Owner changed the framework during the first session: one React Native / Expo interface now targets web, iOS and Android. See ADR 0001. The original handoff remains unchanged as provenance; the later owner instruction controls.

| Target | Current implementation | Verification boundary |
| --- | --- | --- |
| Web | Shared React Native view, real local worker transformations, PDF.js independent validation, Tesseract English OCR | Production build and browser fixture evidence recorded in IMPLEMENTATION_STATUS |
| iOS/iPadOS | Same React Native screen and Expo document picker; independent development ID dev.atepdf.fresh | Hermes bundle is not a native binary or device execution. Processing deliberately unavailable pending native PDF adapter. |
| Android | Same React Native screen and Expo document picker; independent development ID dev.atepdf.fresh | Hermes bundle is not APK/device proof. Native processing deliberately unavailable. |
| Mac | Web currently; separate React Native macOS target remains scheduled | No Mac native application implemented or tested. Expo mobile is not Mac parity. |

Browser scope: simple unencrypted PDFs, up to 20 MB each / 40 MB selected / 100 pages per result. Document-level forms, tags, portfolios, outlines, name trees, actions and page annotations/links are rejected before transformation because preservation is not yet demonstrated. This is intentionally narrower than generic PDF support.

OCR: English only, at most 15 scanned pages per action, unrotated origin-aligned pages; ASCII output checked, unsupported encodings fail closed. Adds a real invisible text layer. Text-bearing pages are retained, not rasterised. OCR confidence is not a correctness guarantee. Mixed-content pages containing any existing text are currently skipped and need a broader scan-classification test corpus.

Compression: lossless object optimisation plus bounded re-encoding of plain 8-bit RGB JPEG XObjects at original dimensions. Masks, decode arrays, profiles and other unsupported encodings are not re-encoded. Text/vectors are retained. Outputs must independently validate and be smaller before replacing the candidate. Target checks use actual final bytes; no guaranteed size promise. Visual quality must be reviewed.

No active planner or analytics integration. No upload endpoints. No live billing products, store account, migration or production namespace is configured.
