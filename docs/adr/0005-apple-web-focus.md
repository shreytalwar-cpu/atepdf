# 0005 — iOS, Mac and web; Android deferred

Date: 2026-09-28. Owner decision during implementation: abandon Android for now, focus on iOS, Mac and web, and return to Android later.

The React Native/Expo and assistant-ui shared conversation remains the selected interface. PDF bytes stay in the shared local store/controller and device engines. Native Apple PDFKit/Vision/ImageIO provide independent reading, raster preview, OCR and image codecs behind a narrow Expo module; pdf-lib remains the shared local writer.

Existing Android source and synthetic tests are preserved as deferred experimental work. No Android SDK licence was accepted, no Android toolchain installed, and no Android native build/device claim is made. Default native bundle work now targets iOS only. Android will require renewed platform work and evidence before being enabled for release.

Mac Catalyst is the verified Mac application path, using the same Apple native reader and React Native interface. The actual application compiles, passes strict local ad-hoc signature verification, and launches in its independent sandbox. This is development evidence, not distribution proof. See `../NATIVE_MAC.md` for the reproducible build and signing boundary. Production signing, distribution and commercial identity decisions retain their existing approval gates.
