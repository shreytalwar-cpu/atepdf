# Apple local PDF adapter

New source in `apps/universal/modules/atepdf-pdf/ios`. No old application source was read, copied, or executed for this adapter. It uses OS-supplied PDFKit/CoreGraphics, Vision and ImageIO; these frameworks add no bundled third-party PDF/OCR engine or cloud service. Shared pdf-lib remains the writer under the repository's existing licence review.

## Interface

The Expo module is `AtepdfPdf`, class `AtepdfPdfModule`. Inputs must be `file:` URLs resolving inside the dedicated Caches/atepdf-work directory; the JavaScript adapter first copies picker results there. URI hosts, queries, fragments, external paths and escaping symlinks are rejected. Preview writes use the separately trusted Caches/atepdf-preview directory and reject a substituted preview-directory symlink. No method accepts a network URL. No input file is written.

The module exposes `storageIsolated`. On iOS the OS supplies the application sandbox. Catalyst additionally requires the running process's `com.apple.security.app-sandbox` entitlement to be an actual Boolean true from [Security's entitlement API](https://developer.apple.com/documentation/security/sectaskcopyvalueforentitlement(_:_:_:)), the exact `dev.atepdf.fresh.mac` bundle identity, a resolved home ending in `Library/Containers/dev.atepdf.fresh.mac/Data`, and caches exactly inside that home. An unsigned/global-home launch fails closed before native engine construction; JavaScript must also gate its storage cleanup/import paths on this constant. A configured entitlement file alone is not proof of an isolated running process.

Before exporting that constant on either Apple platform, the native policy also rejects substituted `Library`, `Caches`, `atepdf-work`, `atepdf-preview` and `atepdf-previews` directories. Symlinks (including dangling links and loops) and ordinary files cannot stand in for cleanup directories. The OS home is canonicalised first, allowing normal system aliases such as `/var` without trusting symlinks inside the app-owned hierarchy. Missing cleanup directories are allowed so the app can create them on first use. This is a startup gate and a repeated native-operation check, not an atomic filesystem guarantee against another process replacing paths after the check.

| Method | Result / semantics |
|---|---|
| `inspectAsync(uri)` | `{pages:[{width,height,rotation,text}]}`; physical page order, crop viewport points after rotation, normalised whitespace. PDFKit text plus a bounded CoreGraphics render independently checks shared-writer outputs. |
| `renderPageAsync(uri,page,maxDimension)` | `{uri,width,height}`; one-based physical page, white-backed PNG in Caches/atepdf-preview. Caller deletes the temporary preview. |
| `recognizeAsync(uri)` | `OCRPage[]`; English Vision recognition on image-only pages. Existing digital text is skipped. `OCRWord` boxes are **PDF points with bottom-left origin**, matching the shared writer. |
| `reencodeJpegAsync(base64,width,height,quality)` | JPEG base64; ImageIO verifies actual format and dimensions before decoding. Original image dimensions are retained. No document leaves the process. |
| `cancelAsync()` | Cancels active Vision work and invalidates ongoing work at the next checkpoint. |

All ordinary PDF operations run on one native queue with independent document instances. Cancellation is cooperative around PDFKit/CoreGraphics calls; a synchronous CoreGraphics draw cannot be interrupted halfway through. A 120-second deadline interrupts an active Vision request and is checked between PDF calls. JavaScript rejects cancelled/stale results before committing them and drains its cancellation request before unlocking the controller. A native call already queued behind another render can still begin after the cancellation generation advances; its cancelled JavaScript caller discards the result, but this remains a cancellation-latency limitation rather than immediate queue removal.

Picker cleanup is limited to the returned copies selected during this import. If the upstream system-picker adapter copies an earlier selection and then rejects a later copy, it returns no successful-copy handles; that partial orphan may remain in the picker cache until OS eviction. The app deliberately does not sweep the provider's entire picker directory. User-selected source files are never deleted.

## Supported bounds

No PDF byte admission cap. Existing defensive bounds remain: 1–100 pages, page dimensions 10–4,000 points, 12 million pixels per XObject image/output raster, no more than 15 scanned pages per OCR job, and preview maximum dimension 4,096. XObject image dimensions, inherited resources, Form resources and image masks are checked before rasterisation; recursive resources are bounded. Native dimension checks do not parse inline BI/ID/EI image operators; the mandatory shared preflight conservatively rejects all inline-image PDFs before native inspection/transforms. See `docs/CONTENT_ADMISSION.md` for tested coverage and bounds. This is not a claim that every hostile PDF construct is safely supported.

OCR rejects rotated or non-origin-aligned crop pages until their text-layer transforms are tested. Recognition language availability is checked at execution. Vision text can be inaccurate even when its confidence is high; outputs still require review. Non-ASCII OCR text is rejected by the current shared text-layer writer. Password-protected documents remain unsupported. Preview data is excluded from backup and is written with restricted local permissions; neither those permissions nor cleanup imply secure erasure.

## Evidence on 2026-09-28

`node tests/native/apple/run.mjs` compiles the new Swift engine in a temporary directory, runs only bundled synthetic fixtures, then exercises the shared TypeScript writer with native recognition/codec output. No install, build, test or runtime operation occurs in the old checkout. Host Vision services require an unrestricted local test process; the restricted command sandbox returned a Vision `nilError`, while the host run passed.

- `docs/evidence/native/apple-engine-tests.json`: actual PDF page markers, rotation/crop dimensions, rendered preview, local-file/symlink rejection, malformed/range failures, cancellation, OCR and immutable original hashes.
- `docs/evidence/native/apple-raster-geometry.json`: 20 pixel-anchor checks at maximum dimensions 96, 724, 1024 and 1800, including every right-angle rotation and a nonzero crop origin. These check the drawn content, not only canvas dimensions. `apple-preview-1800.png` is the corrected full-size reference.
- `docs/evidence/native/apple-shared-writer-tests.json`: 66 recognized word boxes produced a searchable OCR PDF; both PDFKit and PDF.js found the target phrase and invoice reference. Digital text and page geometry are unchanged. The before/after OCR PNGs are byte-identical.
- The real shared job controller imported brief/scan/appendix, merged four pages, used native Vision OCR and ImageIO compression, independently validated each step through PDFKit, removed physical page 2, then restored the prior four-page output through undo. Original hashes stayed unchanged.
- Compression used the native JPEG codec through the shared writer: 7,571,813 bytes → 1,125,798 bytes on the synthetic image-heavy PDF. PDFKit independently confirmed unchanged text/page geometry. Before/after preview images are retained for visual comparison.
- Native engine source typechecked against the arm64 iOS Simulator SDK. This is distinct from a complete application build or physical-device proof; see the session report for Expo/iOS integration results.

Independent PDFKit validation found that separate OCR word draws without explicit spaces could concatenate adjacent words. The shared writer now writes an explicit invisible separator after each measured word. Both PDFKit and PDF.js regressions cover this correction.

Final visual review also found a native raster scaling defect: `CGPDFPage.getDrawingTransform` did not upscale the page, so larger canvases contained a smaller centered page. The shared raster path now explicitly maps the logical page to bitmap pixels before applying crop/rotation. This corrects preview scale and Vision coordinate projection together. The scan fixture's `Scanned` title is now recognized at approximately (45.3, 718.3) PDF points instead of the earlier padded-raster projection (196.0, 539.6). The new absolute-position assertion and raster anchors catch what the earlier page-size/OCR-text checks missed. The full helper/controller workflow was rerun successfully after this correction; final application rebuilds are tracked separately.

The retained before/after compression previews were visually inspected: text remains readable, page bounds and layout match, and no visible content is lost at the recorded preview scale. This is fixture evidence, not a general image-quality guarantee. The malformed-input negative test emits an expected generic CoreGraphics warning. The repeatable runner passed after adding the pre-Vision cancellation checkpoint; no failing native fixture is left outstanding.

Remaining release evidence: signed physical-device launch, on-device cancellation/memory pressure, local network capture, save/reopen using the system share destination, app lifecycle interruption and OS-version coverage. No App Store, seller, purchase, migration or signing identity was configured by this adapter task.

API references: [PDFKit](https://developer.apple.com/documentation/pdfkit), [Vision text recognition](https://developer.apple.com/documentation/vision/vnrecognizetextrequest), [CoreGraphics drawing transform](https://developer.apple.com/documentation/coregraphics/cgpdfpage/getdrawingtransform(_:rect:rotate:preserveaspectratio:)).

## Scene lifecycle adoption

The first release simulator build launched into UIKit's `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke` assertion on iOS 27. Building an application successfully did not establish a working launch. The generated Expo 57 template still created its window in AppDelegate.

Following [Expo's SDK 57/Xcode 27 migration](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md), `AppDelegate` now conforms to `ExpoReactNativeFactoryProvider`, keeps its factory, and lets the installed `EXExpoAppSceneDelegate` create the scene window and start React Native. `Info.plist` declares the single application scene with that built-in delegate. No custom scene implementation or UIKit check bypass was added. Expo 57.0.25's installed scene delegate also forwards lifecycle/deep-link events and supplies initial connection options to React Native; existing AppDelegate subscribers stay active.

Source/plist validation and an actual unsigned Release application build passed. The app installed and sustained its home screen on the iPhone 17 Pro iOS 27 simulator. `docs/evidence/native/apple-ios-application.json` records the explicit successful build, source hashes, and inspected home screenshot; interactive workflows are separate evidence. The current native project is hand-managed; before a future clean prebuild, configure the official `expo-build-properties` option `ios.enableSceneSupport: true` or carry these native changes through explicitly. Do not revert to the legacy window startup block.

## Native template styling

The initial native launch exposed a collapsed thread: the scoped `@assistant-ui/react-native` package matched Uniwind's React Native internals exclusion, so upstream primitive `className` props did not become native styles. The local upstream-derived thread template now uses Uniwind's `withUniwind` wrapper for those third-party primitives on native platforms. Web keeps the original component aliases. A rebuilt Release app visibly restores the sample panel, composer, and quick actions without adding another interface implementation. Native tablet quick actions retain visible text, and the file-picker welcome says “Add your files”; drag-and-drop wording stays on the web surface that implements it. Before/after screenshots are retained in `docs/evidence/native/`.

## Rebuild the current iOS app

Use the checked-in native workspace; a clean prebuild currently needs the scene configuration carried forward as described above. Install locked JavaScript dependencies from this new repository, then use the local CocoaPods runner described in `docs/NATIVE_MAC.md` when Pods need regeneration. Do not regenerate Pods during another platform build.

For an already-booted arm64 simulator, replace `SIMULATOR_UDID` with its identifier. These commands build the actual Release application with an embedded JavaScript bundle and no production signing:

```sh
xcodebuild -workspace apps/universal/ios/atepdf.xcworkspace \
  -scheme atepdf -configuration Release \
  -destination 'platform=iOS Simulator,id=SIMULATOR_UDID' \
  -derivedDataPath .build/ios \
  CODE_SIGNING_ALLOWED=NO ONLY_ACTIVE_ARCH=YES ARCHS=arm64 \
  IPHONEOS_DEPLOYMENT_TARGET=16.4 build
xcrun simctl install SIMULATOR_UDID .build/ios/Build/Products/Release-iphonesimulator/atepdf.app
xcrun simctl launch SIMULATOR_UDID dev.atepdf.fresh
```

XcodeBuildMCP can run the same workspace/scheme/configuration with those build arguments, then install and launch separately. A tool timeout alone does not prove build failure or success: check the original process before starting another build, and retain an explicit successful build result. The final incremental simulator build on 2026-09-28 completed in 36.981 seconds after the final storage guard (the preceding layout build took 41.4 seconds). Its embedded bundle was produced after the final shared admission guard and follow-up copy edits. Native AI planning remains disabled; quick actions and the bounded local command planner operate without any network credentials.
