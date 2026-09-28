# ADR 0004 — local PDFs have no arbitrary byte admission policy

Accepted owner direction, 2026-09-28: remove the current 20 MB file restriction throughout atepdf because PDFs are processed on-device.

Removed the per-file check from import and engine preflight, the 40 MB combined-input/output cap, the 100 MB retained-history cap, the planner's PDF-size metadata rejection and UI limit text. The engine does not reject a PDF merely because its encoded bytes exceed these thresholds. Neither browser nor native file pickers upload PDFs. The unused transitional web screen was audited and its stale text corrected too.

Rendering pixel limits, supported-feature validation, page-count/OCR workload bounds, cancellation and job deadlines still govern the tested engine. The small hosted-planner JSON-body and output-token bounds protect that separate instruction service and do not constrain local PDF bytes. Actual device/browser memory still matters; unlimited processing capacity is not claimed. The canonical protocol's numeric representation constraints remain unchanged.

New regression: generate two valid PDFs with visible uncompressed RGB image streams, each larger than 20 MB (no fake File.size or trailing padding), import them, merge to a PDF larger than 40 MB, validate independently, remove page 2 while retaining over 100 MB of history, and undo. Browser proof also renders/saves the larger output and checks that no PDF data leaves the local app. Large fixtures are generated for tests and removed from temporary storage afterwards.
