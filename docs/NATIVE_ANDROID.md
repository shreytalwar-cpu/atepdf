# Android local PDF adapter

**Deferred by the owner on 2026-09-28.** Active delivery targets are iOS/iPadOS, Mac and web. This experimental source and its unrun device tests are retained for later; it is excluded from the default Expo platform list and native bundle command. No Android release is enabled or verified. The generated development project is not a production signing configuration.

The fresh Expo module lives in `apps/universal/modules/atepdf-pdf/android`. It uses Android's `PdfRenderer` as an independent reader and renderer, and `BitmapFactory`/`Bitmap.compress` for JPEG re-encoding. The shared TypeScript engine remains the PDF writer and job controller. This adds no new runtime dependency and no network client, WebView, telemetry library or document upload path.

**Status: source implemented; not compiled or run on Android in this session.** The host has no usable Java runtime, Android SDK, Gradle, emulator or `adb`. A Hermes export is not proof that this Kotlin module builds. No Android SDK licence was accepted and no global toolchain was installed.

The shared runtime now also requires a verified `storageIsolated` capability. This deferred adapter does not implement it, so its quick actions fail closed even on a supported Android version. Revisit storage isolation and tests before re-enabling the platform. The generated local debug keystore is ignored; a future Android setup must create its own development signing material.

## Bridge

Class: `expo.modules.atepdf.AtepdfPdfModule`; module: `AtepdfPdf`.

| Method or constant | Contract |
|---|---|
| `readerAvailable` | `true` only on Android 15 / API 35 or later, where native independent text extraction exists. This describes OS support, not release certification. |
| `ocrAvailable` | `false`. |
| `inspectAsync(uri)` | `{pages: [{width, height, rotation: 0, text}]}`. Counts pages, extracts text and actually renders each page at a small size before reporting success. Rejects forms and page counts outside 1–100. |
| `renderPageAsync(uri, page, maxDimension)` | One-based physical page; returns `{uri, width, height}` for a real PNG in this app's cache. Maximum requested dimension is 4096 and decoded pixel area is at most 12 million. |
| `reencodeJpegAsync(base64, width, height, quality)` | Local JPEG bytes only; returns local base64 JPEG bytes. `quality` is greater than zero and at most one. Preserves requested proportions, never upscales, rejects invalid dimensions and decoded images over 12 million pixels. |
| `recognizeAsync(uri)` | Explicit unsupported error. No blank OCR result is presented as success. |
| `cancelAsync()` | Constant-time synchronous bridge function (safe to `await`). Invalidates queued/running result generations; cannot pre-empt an individual OS decoder call. |
| `removePreviewAsync(uri)` | Removes only an app-generated `page-*.png` inside the dedicated preview cache folder. |

The bridge accepts only `file:` URIs resolving inside the current app's private files/cache directories. HTTP, content providers, remote authorities, query strings, fragments and external filesystem paths fail closed. The document picker must first copy into app-owned storage. PDF descriptors are opened read-only; native code never writes a source PDF. OS/parser exception details are replaced with fixed error messages before returning to JavaScript.

## Geometry admission

Android's current `PdfRenderer.Page` exposes integer width/height, but does not expose the PDF `/Rotate` or full CropBox/MediaBox semantics. **The shared native runtime rejects nonzero rotation, non-origin or differing crop/media boxes and non-default UserUnit before this adapter receives a transformable document.** `rotation: 0` describes that admitted subset; it is not a claim that arbitrary source rotation was independently measured. Fractional point dimensions are admitted because the shared brief fixture uses them; the independent reader compares original/output dimensions at integer-point precision, while the shared writer preserves the actual PDF page boxes. Sub-point geometry drift is not independently detectable by this API. Expanded geometry support remains a conformance task.

## Dependency and privacy review

- Android platform `PdfRenderer` text extraction is API 35+. Rendering and JPEG codec are supplied by the OS, separate from the shared `pdf-lib` writer. Sources: [PdfRenderer](https://developer.android.com/reference/android/graphics/pdf/PdfRenderer), [PdfRenderer.Page](https://developer.android.com/reference/android/graphics/pdf/PdfRenderer.Page), [Bitmap](https://developer.android.com/reference/android/graphics/Bitmap).
- Expo Module DSL matches the installed Expo 57 module patterns and [official module API](https://docs.expo.dev/modules/module-api/). `AsyncFunction` work runs away from the JavaScript thread. Access to native decoding is serialized.
- Test-only dependencies are pinned to AndroidX Test runner `1.7.0` and JUnit extension `1.3.0`, Apache-2.0, as listed by [AndroidX Test](https://developer.android.com/jetpack/androidx/releases/test). They are not shipped in the application runtime.
- ML Kit text recognition was reviewed and **not added**: its [terms](https://developers.google.com/ml-kit/terms) and [data disclosure](https://developers.google.com/ml-kit/android-data-disclosure) describe automatic API usage and performance metrics. There is no need to introduce that analytics path to this app's processing workspace.
- [Tesseract4Android 4.9.0](https://github.com/adaptech-cz/Tesseract4Android) is an Apache-2.0 offline OCR candidate. It needs a reviewed native artifact/model bundle, reproducible build, complete notices, cancellation and independent OCR geometry/search tests. No JitPack repository or unverified native binary was added here.

## Pending device proof

Six Android instrumentation tests are implemented in `tests/native/android/AtepdfPdfEngineTest.kt`. They exercise the shared `brief.pdf`, independent platform-generated PDFs, actual PNG pixels, original hash preservation, JPEG reopen/geometry, private error canaries, invalid page requests, scoped preview deletion and the 100-page workload boundary. They have **not run**.

Three host regression tests in `tests/regressions/android-preflight.test.ts` exercise real PDF dictionaries: shared sample admission without mutation; direct, indirect, inherited and malformed UserUnit rejection; rotation, cropped/offset page boxes and degenerate geometry rejection. These tests are separate from native build/device evidence.

With an approved existing Android toolchain and API 35+ test device, build the generated Expo Android application and run the local module's `connectedDebugAndroidTest` task. Then run the shared merge → removal → undo and compression conformance journey in the application. Before enabling a tested production capability, capture the release build's network traffic during import, render, compression, cancellation and error paths. Source absence of a network call is not runtime privacy proof.

The decoder currently runs on an app background thread, not in a separately isolated process. Android recommends process isolation for untrusted PDFs; an isolated worker service remains a hardening task before broad public release. Cancellation rejects late results but cannot forcibly interrupt a single platform decode; native temporary previews also need the app's scoped session/startup cleanup.

The next Android implementation task is bundled English OCR with independent search/copy and before/after render validation. Android versions below 15 remain unavailable in this conservative reader slice. There is no cloud fallback.
