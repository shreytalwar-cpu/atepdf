# SHR-46 observed browser compatibility matrix

Source: 6dbf6a565746a6fd26455dbc53633769790bb31b. All outputs were saved temporarily, independently reopened, hashed, and removed after inspection.

Executed 49 of 57 recorded scenarios. Counts: SUPPORTED 27; SAFELY_REJECTED 16; FAILED 3; FIDELITY_MISMATCH 0; UNVERIFIED 3; NOT_IMPLEMENTED 1; NOT_RUN 7. Rejections and failures remain in the executed denominator.

| Fixture | Operation | Classification | Reason / note |
| --- | --- | --- | --- |
| ordinary-brief | merge_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| ordinary-brief | select_pages | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| ordinary-brief | ocr_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| ordinary-brief | compress_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| ordinary-appendix | merge_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| ordinary-appendix | select_pages | NOT_RUN | No valid page-removal scenario: the one-page input must retain a page. |
| ordinary-appendix | ocr_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| ordinary-appendix | compress_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| raster-note | merge_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| raster-note | select_pages | NOT_RUN | No valid page-removal scenario: the one-page input must retain a page. |
| raster-note | ocr_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| raster-note | compress_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| hybrid-note | merge_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| hybrid-note | select_pages | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| hybrid-note | ocr_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| hybrid-note | compress_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| image-heavy | merge_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| image-heavy | select_pages | NOT_RUN | No valid page-removal scenario: the one-page input must retain a page. |
| image-heavy | ocr_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| image-heavy | compress_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| geometry-font | merge_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| geometry-font | select_pages | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| geometry-font | ocr_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| geometry-font | compress_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| interactive | merge_pdf | SAFELY_REJECTED | This PDF has document features this build cannot safely preserve. Your original is unchanged. |
| interactive | select_pages | SAFELY_REJECTED | This PDF has document features this build cannot safely preserve. Your original is unchanged. |
| interactive | ocr_pdf | SAFELY_REJECTED | This PDF has document features this build cannot safely preserve. Your original is unchanged. |
| interactive | compress_pdf | SAFELY_REJECTED | This PDF has document features this build cannot safely preserve. Your original is unchanged. |
| tagged | merge_pdf | SAFELY_REJECTED | This PDF has document features this build cannot safely preserve. Your original is unchanged. |
| tagged | select_pages | NOT_RUN | No valid page-removal scenario: the one-page input must retain a page. |
| tagged | ocr_pdf | SAFELY_REJECTED | This PDF has document features this build cannot safely preserve. Your original is unchanged. |
| tagged | compress_pdf | SAFELY_REJECTED | This PDF has document features this build cannot safely preserve. Your original is unchanged. |
| blank-noisy-scans | merge_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| blank-noisy-scans | select_pages | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| blank-noisy-scans | ocr_pdf | SAFELY_REJECTED | Recognition was not reliable enough. No output was committed. |
| blank-noisy-scans | compress_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| encoded-dimension-mismatch | merge_pdf | UNVERIFIED | Encoded-versus-declared raster dimensions remain unverified. |
| encoded-dimension-mismatch | select_pages | NOT_RUN | No valid page-removal scenario: the one-page input must retain a page. |
| encoded-dimension-mismatch | ocr_pdf | UNVERIFIED | Encoded-versus-declared raster dimensions remain unverified. |
| encoded-dimension-mismatch | compress_pdf | UNVERIFIED | Encoded-versus-declared raster dimensions remain unverified. |
| encrypted-aes256 | merge_pdf | FAILED | This PDF could not be safely processed. It may be encrypted or damaged. Your original is unchanged. |
| encrypted-aes256 | select_pages | NOT_RUN | No valid page-removal scenario: the one-page input must retain a page. |
| encrypted-aes256 | ocr_pdf | FAILED | This PDF could not be safely processed. It may be encrypted or damaged. Your original is unchanged. |
| encrypted-aes256 | compress_pdf | FAILED | This PDF could not be safely processed. It may be encrypted or damaged. Your original is unchanged. |
| boundary-100 | merge_pdf | SAFELY_REJECTED | Keep between 1 and 100 pages. |
| boundary-100 | select_pages | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| boundary-100 | ocr_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| boundary-100 | compress_pdf | SUPPORTED | Checked properties passed; visual verification NOT_RUN. |
| boundary-101 | merge_pdf | SAFELY_REJECTED | Use a PDF with 1–100 pages. |
| boundary-101 | select_pages | SAFELY_REJECTED | Use a PDF with 1–100 pages. |
| boundary-101 | ocr_pdf | SAFELY_REJECTED | Use a PDF with 1–100 pages. |
| boundary-101 | compress_pdf | SAFELY_REJECTED | Use a PDF with 1–100 pages. |
| damaged-missing-page | merge_pdf | SAFELY_REJECTED | Use a PDF with 1–100 pages. |
| damaged-missing-page | select_pages | NOT_RUN | No valid page-removal scenario: the one-page input must retain a page. |
| damaged-missing-page | ocr_pdf | SAFELY_REJECTED | Use a PDF with 1–100 pages. |
| damaged-missing-page | compress_pdf | SAFELY_REJECTED | Use a PDF with 1–100 pages. |
| encrypted-aes256 | unlock_pdf | NOT_IMPLEMENTED | No active executor on current main. |

Browser service/helper evidence only. Actual Mac-app acceptance and post-transform visual/OCR-placement verification were NOT_RUN.
