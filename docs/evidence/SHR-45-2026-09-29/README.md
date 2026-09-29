# SHR-45 corpus construction and validation evidence

Source boundary: dedicated SHR-45 branch created from fetched `origin/main` `c11a19e24b82de171cd7e74b3e7e5fcbe6ac2e74`; the only changes under test are the SHR-45 fixture, manifest, validator test and documentation files in this PR. No PDF engine or product behavior file changed. The local checkout used already-installed repository Node dependencies through a worktree-only symlink and the bundled Python generator libraries; no package was installed. All document content and passwords were synthetic. No live model/provider call was made.

## Commands and results

Commands below ran from the SHR-45 worktree on 29 September 2026. The executable names in the table expand to these exact local paths:

```sh
NODE=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
PYTHON=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3
NODE_DIR=/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin
```

| Command | Actual result |
| --- | --- |
| `"$PYTHON" tests/fixtures/corpus/generate.py` | Generated 9 synthetic files; 8 have deterministic bytes, while AES encryption uses fresh randomness. No existing fixture was overwritten. |
| `ATEPDF_CORPUS_PYTHON="$PYTHON" "$NODE" --import tsx --test tests/regressions/pdf-corpus.test.ts` | 6/6 pass, 0 skipped; includes byte regeneration of 8 non-encrypted files into a temporary directory. Repeated after the final raster/XObject assertions: 6/6 pass. |
| `"$NODE" --import tsx --test tests/regressions/local-workflow.test.ts tests/regressions/content-admission.test.ts tests/regressions/pdf-corpus.test.ts` | 22 pass, 0 fail, 1 optional regeneration test skipped because the Python environment variable was absent. Existing merge/remove/Undo, admission and large-PDF cases passed. |
| `ATEPDF_CORPUS_PYTHON="$PYTHON" "$NODE" --import tsx --test tests/regressions/*.test.ts` | First sandbox run: 114 pass, 1 fail solely at a temporary `127.0.0.1` bind (`listen EPERM` in the existing private TLS test). Rerun with loopback test permission: **115/115 pass, 0 skip**. Test uses a random local port and mocked provider behavior. |
| `PATH="$NODE_DIR:$PATH" ./node_modules/.bin/tsc --noEmit -p apps/universal/tsconfig.json` | Pass. |
| `PATH="$NODE_DIR:$PATH" ./node_modules/.bin/tsc --noEmit --tsBuildInfoFile /tmp/atepdf-shr45-web.tsbuildinfo -p apps/web/tsconfig.json` | Pass. Initial attempt lacked `node` on `PATH`; a subsequent attempt without the temp build-info path could not write its cache in the sandbox. Both were environment/output-location errors, not source errors. |

The manifest test verified existence, regular-file paths under `tests/fixtures`, unique IDs/paths, SHA-256, required provenance/permission/generation metadata, 14 declared page counts and bounded page order. PDF.js independently reopened all readable files (including the encrypted one with its fixture-only test password), extracted digital markers in physical order, and checked scan text-layer absence. It checked actual annotation types, URI and GoTo links, nested outlines and connected tag content. The test also used pdf-lib to inspect actual form fields, embedded font stream, crop/media origins and the JPEG XObject dictionary versus encoded SOF dimensions; pdf-lib is not an independent writer/reader pair for product-result fidelity. The malformed input was inspected only in a capped child process. The automated checks do **not** prove every visual marker or absence of private content in arbitrary future additions.

Independent Poppler `pdfinfo` 26.05.0 inspection of the generated files found 2 interactive pages with AcroForm, 1 tagged page, 3 geometry/font pages with rotation and offset boxes, a password-required AES-256 page, 100/101-page boundaries, and the malformed missing-child error. pypdf 6.10.0 read both filled form fields. Representative existing scan and new noisy-scan pages were rendered to temporary files and visually reviewed; the interactive highlight was adjusted so its heading remains legible. Temporary render images are not acceptance artifacts. See the [corpus README](../../../tests/fixtures/corpus/README.md) for the bounded observations.

Known limits: the original generator for the two archived synthetic scan inputs is unavailable, though the exact bytes are recoverable from Git and hash-locked. Cryptographic encryption is intentionally non-deterministic. PDF.js reads page counts and structures, but compatibility and post-transform fidelity remain unclassified until SHR-46/47/48; SHR-49 retains the complex-PDF support decision. No current Mac app runtime or cross-platform corpus matrix was run for this fixture-only issue.
