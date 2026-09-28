# Dependency and reuse review — 2026-09-28

Versions are exact in package.json and pnpm-lock.yaml. Registry metadata was reviewed before installation; Expo's installed bundledNativeModules.json supplied compatible React/React Native/SVG versions. The installed SBOM is docs/dependency-sbom.json (603 packages; no missing declared licence). Metadata is not a legal compliance opinion or complete security audit.

| Library | Installed version | Licence / scope |
| --- | --- | --- |
| Expo / React Native / React / React Native Web | 57.0.25 / 0.86.3 / 19.2.3 / 0.21.3 | MIT; shared UI and native entrypoints |
| Next | 16.3.6 | MIT; optional host and disabled gateway |
| pdf-lib | 1.17.1 | MIT; local PDF writing |
| PDF.js | 6.3.289 | Apache-2.0; separate parser, renderer and output validation |
| Tesseract.js / English data | 7.0.0 / 1.0.0 | Apache-2.0; self-hosted worker/WASM/language, English only |
| Vercel AI SDK | 7.0.118 | Apache-2.0; schema adapter only, provider execution disabled |
| Ajv | 8.20.0 | MIT; ahead-of-time contract validation avoids runtime eval |
| shadcn/ui | 98a1fe67b439324ddc857f47fbdce056600a4329 | MIT; isolated Button source retained with licence |
| shadcn chatbot | f79416827acd90244683903a34343f58193432ac | MIT (see retained upstream licence); minimal interaction patterns only, no app/template transplanted |

React 19.3 was an initial review candidate; React 19.2.3 is installed for Expo compatibility. The old metadata file is preserved as review history; the lockfile and SBOM identify actual installed versions. The shared RN UI supersedes DOM-only shadcn controls; no assistant-ui dependency was added. The old pre-RN screen is transitional new source, not imported legacy code.

Transitive review: node-forge 1.4.0 offers BSD-3-Clause OR GPL-2.0; use the BSD-3-Clause alternative. @img/sharp-libvips-darwin-arm64 1.3.3 is LGPL-3.0-or-later, optional Next image tooling. The app does not use it as a PDF engine. The Expo static export does not include this native package. Any future distribution containing that binary requires its notices/source/relinking obligations to be reviewed before release; no distribution is approved here. No AGPL PDF engine is used.

Source references: https://github.com/expo/expo (MIT), https://github.com/Hopding/pdf-lib (MIT), https://github.com/mozilla/pdf.js (Apache-2.0), https://github.com/naptha/tesseract.js (Apache-2.0). Exact upstream UI commit links and licence text are in docs/shadcn-upstream.json, docs/chatbot-upstream.json and docs/upstream/. Keep upstream licence files when packaging assets. Generated paper illustration is new; approved name/8/logo pixels and synthetic fixtures were reused from the handoff with their manifest provenance. No old application helper, navigation, configuration, dependency tree or production identity was copied.

Release notices, vulnerability audit and native package/distribution review remain open F10 work. No live price, purchase product, subscription or seller decision is made by this review.

Install-script policy: esbuild 0.28.2 is an explicit pinned development dependency. Its reviewed installer selects/checks the platform binary; it is allowed. Tesseract's optional opencollective funding-message postinstall is disabled. The isolated frozen offline install passes with this policy.
