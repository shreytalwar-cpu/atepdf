# SHR-51 evidence — v1 tool support profiles (30 September 2026)

Supporting evidence for [ADR 0015](../../adr/0015-v1-tool-support-profiles.md) (approved 30 September 2026, TOOLPROF-1–9). It changes no source, test, guard or dependency.

## Source

`origin/main` `ff3e291`. Current capability was established by source inspection. File and line references are in ADR 0015 section 2. Observed matrix results come from [SHR-46](../SHR-46-2026-09-30/README.md) and are not re-run here.

## Platform probe

- [platform-probe.swift](platform-probe.swift) prints:
  - the Vision `VNRecognizeTextRequest` revision and its supported recognition languages (`.accurate` and `.fast`);
  - the ImageIO decode and encode type identifiers.
- Command: `swift platform-probe.swift`.
- Output: [platform-probe.out](platform-probe.out).
- Host: MacBook Air (M5, arm64), macOS 27.0 (26A428).

Limits of this evidence:
- The lists show what the OS on this host offers. They are **not** OCR accuracy, image-decode safety or support evidence.
- They were **not** captured on the macOS 14.0 minimum (ADR 0011) or on Intel. Language and codec availability varies by OS version.
- No PDF or image was processed, and nothing left the Mac.

| Probe | Result |
|---|---|
| Vision `.accurate` revision | 3 |
| Vision `.accurate` languages | 33 (en-US, fr-FR, it-IT, de-DE, es-ES, pt-BR, zh-Hans, zh-Hant, yue-Hans, yue-Hant, ko-KR, ja-JP, ru-RU, uk-UA, th-TH, vi-VT, ar-SA, ars-SA, tr-TR, id-ID, cs-CZ, da-DK, nl-NL, no-NO, nn-NO, nb-NO, ms-MY, pl-PL, ro-RO, sv-SE, fi-FI, hi-IN, mr-IN) |
| Vision `.fast` languages | 6 (en-US, fr-FR, it-IT, de-DE, es-ES, pt-BR) |
| ImageIO decode (relevant subset) | `public.jpeg`, `public.png`, `public.heic`, `public.heif`, `public.tiff`, `com.compuserve.gif`, `com.microsoft.bmp`, `org.webmproject.webp`, `public.avif`, `public.jpeg-2000`, `public.jpeg-xl`, RAW families |
| ImageIO encode (relevant subset) | `public.jpeg`, `public.png`, `public.heic`, `public.tiff` |

## Regression check (unchanged source)

`node --import tsx --test tests/regressions/pdf-corpus.test.ts tests/regressions/compatibility-matrix.test.ts` (Node 24.19.0): **16 passed, 0 failed, 1 skipped**. The result was the same when re-run after merging `origin/main` `7853973`, which adds SHR-49 / ADR 0013 and changes documentation only. The skipped test is the optional byte-regeneration check, which needs `ATEPDF_CORPUS_PYTHON`. The log is in [regressions.log](regressions.log).

## Derived figure

A standard 12 MP camera image is 4032 × 3024 = **12,192,768 px**. The current decoded-pixel guard is 12,000,000 (`packages/web-pdf/src/types.ts:10`, `AtepdfPDFEngine.swift:50`), so that image would be refused. This is recorded as gap G7 and is not tested here.
