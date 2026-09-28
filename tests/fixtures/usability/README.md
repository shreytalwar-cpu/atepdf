# Neutral usability-study PDFs

Created 29 September 2026 for [the moderated study](../../../docs/UX_USABILITY_STUDY.md). These are original fictional practice-event materials, not customer files or app output. Give participants only the two PDFs. Keep this README and the generator with the moderator because they contain verification expectations.

The PDFs contain a fictional Community Makers Morning brief and schedule. They visibly identify themselves as synthetic. They contain no atepdf instructions, workflow answers, customer/contact details, canaries, links or form annotations. The existing engineering fixtures and the app's bundled samples remain unchanged.

## Source and reproduction

Source: [generate.mjs](generate.mjs), authored for this study. Generation uses the already installed `pdf-lib` **1.17.1**, standard Helvetica/Helvetica Bold fonts and A4 page dimensions. Creation/modification timestamps are fixed to `2026-09-29T00:00:00.000Z`; the generator makes no network requests.

Generator SHA-256: `65af8f892ba98a54cd4de03a4ac1716610ce4f14faedc24f5187654bbe6ce716`.

From the repository root, with its existing Node/package environment:

```sh
node tests/fixtures/usability/generate.mjs
node tests/fixtures/usability/generate.mjs --verify-only
```

The first command recreates only these two fixture PDFs. Both commands use the independent **PDF.js 6.3.289** reader to verify actual saved-file page counts, expected headings, synthetic disclosure and absence of workflow coaching text/annotations; they print each file's facts and hash. This is fixture verification, not evidence that the app merged or exported a document.

## Verified saved inputs

| File | Pages | Neutral page headings, in order | Bytes | SHA-256 |
| --- | ---: | --- | ---: | --- |
| `brief.pdf` | 2 | Event Overview; Venue and Materials | 3000 | `a96268f0b140302c62dbf5747558f6af4adff4628247066dfc7d8aba6f88b702` |
| `appendix.pdf` | 1 | Morning Schedule | 1804 | `7032fca149367388889994751fff118003c5a2cef90f97e0eaa4722bc5587e56` |

Independent PDF.js inspection passed on both saved inputs. Poppler **26.05.0** rendered every page at 100 dpi, and all three rendered pages were visually inspected: headings, body text and footers were legible without clipping or overlap. The bundled renderer reported fontconfig configuration/cache warnings but completed successfully; the rendered images were checked, not inferred from exit status. Temporary render images were removed after inspection.

## Moderator answer key — do not show participants

| Study state | Expected page count | Expected neutral heading order |
| --- | ---: | --- |
| Starting brief | 2 | Event Overview → Venue and Materials |
| Starting appendix | 1 | Morning Schedule |
| Brief then appendix merged | 3 | Event Overview → Venue and Materials → Morning Schedule |
| Second physical page removed | 2 | Event Overview → Morning Schedule |
| Previous result restored | 3 | Event Overview → Venue and Materials → Morning Schedule |
| Invalid page-99 request rejected | 3 | Event Overview → Venue and Materials → Morning Schedule; last valid result retained |

The heading sequence is the stable content-order check; it is ordinary document content, not a visible test marker or task hint. Footer numbering belongs to each source document, so the appendix retains its source page number when merged. Do not interpret source footer numbering as the merged physical-page index.

The originals must remain byte-identical to the hashes above throughout the app study. Independently reopen the participant's exact exported file and check its heading sequence. Do not use these input checks, a generated replacement result or a screenshot as proof of the participant's export. Record actual app source/build, platform, planner mode and study evidence separately.
