# Sources and verification notes

Checked on **27 September 2026**. These are primary technical sources or official project documentation. Architecture, product limits, UX rules, performance targets and commercial choices in this pack are proposed decisions, not claims that the product already implements them.

## S01 | GPT-5.6 Luna model
https://developers.openai.com/api/docs/models/gpt-5.6-luna

Verified candidate model, structured-output/function support and token rates. Recheck availability and project access.

## S02 | GPT-5 nano model
https://developers.openai.com/api/docs/models/gpt-5-nano

Cheaper benchmark candidate, not a proven sufficient model.

## S03 | Structured model outputs
https://developers.openai.com/api/docs/guides/structured-outputs

Constrained response mechanism; provider schema subset still needs live integration testing.

## S04 | OpenAI data controls
https://developers.openai.com/api/docs/guides/your-data

Provider application-state and abuse-monitoring retention differ. store:false is not a blanket zero-retention promise.

## S05 | Function calling
https://developers.openai.com/api/docs/guides/function-calling

API implementation reference for model requests versus application execution; verify current SDK before coding.

## S06 | PDF.js upstream
https://github.com/mozilla/pdf.js

Browser PDF rendering/text tooling and upstream licence. Audit exact release.

## S07 | pdf-lib upstream
https://github.com/Hopding/pdf-lib

Browser manipulation and limitations; explicitly warns against encrypted-document processing and ignoreEncryption misuse.

## S08 | qpdf upstream
https://github.com/qpdf/qpdf

Content-preserving structural toolkit and licence. Does not prove this project has native/WASM builds.

## S09 | qpdf command documentation
https://qpdf.readthedocs.io/en/stable/cli.html

Optimisation, metadata and encryption options; image optimisation is not general downsampling.

## S10 | Tesseract.js upstream
https://github.com/naptha/tesseract.js

WASM/browser OCR; no direct PDF input. Output API changes require version testing.

## S11 | Tesseract OCR FAQ
https://tesseract-ocr.github.io/tessdoc/FAQ.html

Searchable PDF/text-only layer concepts and output formats.

## S12 | Android document access
https://developer.android.com/training/data-storage/shared/documents-files

Storage Access Framework and user-controlled content URIs.

## S13 | Jetpack Compose
https://developer.android.com/compose

Android native UI toolkit reference.

## S14 | MDN File API
https://developer.mozilla.org/en-US/docs/Web/API/File_API

Browser-local user-selected file access.

## S15 | MDN Web Workers
https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers

Worker scheduling and browser integration reference.

## S16 | Apple PDFKit
https://developer.apple.com/documentation/pdfkit

Official documentation page is JavaScript-rendered; inspect with Apple docs/Xcode tooling before relying on specific API signatures.

## S17 | Apple Vision text recognition
https://developer.apple.com/documentation/vision/recognizing-text-in-images

Official JavaScript-rendered API reference; language and OS support require runtime/documentation verification.

## S18 | Google ML Kit text recognition
https://developers.google.com/ml-kit/vision/text-recognition/v2

Documented script support and recognition geometry; not proof of universal OCR languages or searchable PDF writing.

## S19 | Android PdfRenderer
https://developer.android.com/reference/android/graphics/pdf/PdfRenderer

Native PDF API reference; review supported levels and methods separately from general writer requirements.

## S20 | Apple App Review Guidelines
https://developer.apple.com/app-store/review/guidelines/

Store/privacy/billing review starting point, not legal advice or completed compliance assessment.

## S21 | Google Play Billing
https://developer.android.com/google/play/billing

Official app/backend billing and entitlement architecture. Recheck current linked store policies before release.

## S22 | Codex AGENTS.md
https://developers.openai.com/codex/guides/agents-md

Project instruction discovery; redirects to the current official ChatGPT Learn documentation.

## S23 | Codex skills
https://developers.openai.com/codex/skills

Repository-local skills and discovery; redirects to current official documentation.

## S24 | OpenAI docs MCP
https://developers.openai.com/learn/docs-mcp

Official read-only documentation MCP and documented configuration command.

## S25 | Playwright MCP upstream
https://github.com/microsoft/playwright-mcp

Browser testing tool candidate; pin/review configuration and permissions.

## S26 | XcodeBuildMCP upstream
https://github.com/getsentry/XcodeBuildMCP

Apple build/test tool candidate; availability does not replace actual toolchain/test evidence.

## Context sources
The user's current conversation and the two explicitly reattached approved mock-ups define the latest product scope. The saved `ATTENLO_UTILITY_SUITE_CODEX_MASTER_PLAN.md` was retrieved for historical native Apple/web stack and reuse constraints. Its broad editing/signing/cloud exceptions are superseded by the latest conversation. No current repository audit or device/model benchmark was performed in preparing this handoff.

## Limits of verification
Model prices and product documentation can change. Source pages establish capabilities/constraints, not actual app quality. Some Apple API pages require JavaScript and must be checked in the build environment for exact signatures. Direct Google support policy pages were not readable through the research tool; the accessible official Play Billing architecture page is included instead, and policy review remains a release gate. No trademark clearance, paid SDK licence clearance, app-store approval or merchant eligibility has been established.
