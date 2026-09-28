# Native raster scaling correction — 2026-09-28

The final native preview exposed a real rendering defect in `AtepdfPDFEngine.raster`. On the bundled 595.2756 × 841.8898 point brief, CoreGraphics returned a unit scale with translations (64.3622, 91.0551) for a 724 × 1024 bitmap and (338.3622, 479.0551) for a 1272 × 1800 bitmap. The page was centered at its original point size. This was not whitespace in the source PDF or a React Native fit/zoom issue.

The fix explicitly scales logical page dimensions into bitmap pixels, then applies `getDrawingTransform` to a logical point rectangle to preserve the crop origin and page rotation. The same raster path feeds preview and Vision OCR; no separate compensating UI zoom or OCR offset was added.

Verification:

- 20 actual pixel-anchor checks passed: maximum dimensions 96, 724, 1024 and 1800; full-page rendering; nonzero crop origin with 0°, 90°, 180° and 270° rotation. Thresholds allow two pixels for raster antialiasing/color conversion.
- The known scan title has actual OCR bounds x=45.3193, y=718.2984, width=109.1003, height=20.8536 points. The old padded coordinates were approximately x=195.9755, y=539.6416. The new assertion checks absolute position against the fixture layout.
- The host Vision helper and shared writer/controller chain passed: import → merge → OCR → compress → independent validation → page removal → undo. Both PDFKit and PDF.js find the OCR phrases, original digital text is unchanged, invisible OCR preserves rendered pixels, and original hashes are unchanged.
- The restricted first OCR run failed because the local Vision service was unavailable to that process; the host-authorized synthetic run passed. The generic CoreGraphics warning is from the intentional malformed-PDF negative test.

Evidence: `apple-raster-geometry.json`, `apple-raster-regression-proof.json`, `apple-engine-tests.json`, `apple-shared-writer-tests.json`, `apple-preview.png`, `apple-preview-1800.png`, and refreshed OCR/compression images. This is native helper and shared-engine evidence; final app rebuild/UI runs are reported separately. No old checkout, production PDF, credential, hosted planner or paid API was used.
