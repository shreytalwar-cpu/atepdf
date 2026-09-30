# SHR-45 PR #82 checkout-path reproducibility review

Source boundary: PR #82's original head `bd342cbd0c92502e0c2ecdd2613f226e52797100`, followed by the fixture-only correction `9a9284f209c75892b3d465c72414a80e346c9eb6`. The generator, one generated PDF, its manifest hash, the corpus README and the corpus regression changed. No PDF engine or product behavior changed. Existing installed Node and bundled Python libraries were reused; no network, provider or paid call was made.

The original generator passed the absolute checkout path of `tests/fixtures/image-input.png` to ReportLab. Its image resource name consequently varied with the path. Before the fix, generation in the SHR-45 worktree matched the committed `geometry-font.pdf` SHA-256 `78d746e65f238f27b27ebc3aa4f7659727220af8728862f383038502682253db`, while a local `git clone --no-hardlinks` at `/tmp/atepdf-shr45-path-repro.82nEQT/checkout` produced `3cd5d1e299902391e60ef1bf1353f0e4abe74b985ad3b09744542e04eddfa57e`. A new regression copied the generator and synthetic source image to a different temporary source root; it failed before the fix with `geometry-font must reproduce from a different source path` (5 passed, 1 failed).

The generator now wraps the image bytes in an in-memory ReportLab `ImageReader`. The regenerated canonical PDF SHA-256 is `fe0762826b3b62e7ef3bbc9892f856720a2da3cd01a9503ba299ef3b9ebfebf9`. The manifest was updated to that hash. The fixture count remains 14, with eight deterministic generated outputs and one deliberately nondeterministic AES output.

## Verification on 30 September 2026

Commands ran from the SHR-45 worktree unless otherwise stated. `NODE` below is `/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`; `PYTHON` is `/Users/shrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`. The existing repository `node_modules` was linked only in this worktree for test execution and is not part of the commit.

| Command / check | Actual result |
| --- | --- |
| `"$PYTHON" tests/fixtures/corpus/generate.py --output-dir /tmp/atepdf-shr45-path-repro.82nEQT/fixed-current` | Generated all nine files in temporary output. Only `geometry-font.pdf` was copied back into the fixture directory. |
| `ATEPDF_CORPUS_PYTHON="$PYTHON" "$NODE" --import tsx --test tests/regressions/pdf-corpus.test.ts` | **6/6 passed, 0 skipped**. The new test compares eight deterministic files byte-for-byte across two temporary source roots and checks the manifest hashes. |
| `ATEPDF_CORPUS_PYTHON="$PYTHON" "$NODE" --import tsx --test tests/regressions/*.test.ts` | **115/115 passed, 0 skipped**. The existing loopback-only TLS test needed local listener permission; provider behavior remained mocked. |
| `PATH="$(dirname "$NODE"):$PATH" ./node_modules/.bin/tsc --noEmit -p apps/universal/tsconfig.json` | Passed. |
| `PATH="$(dirname "$NODE"):$PATH" ./node_modules/.bin/tsc --noEmit --tsBuildInfoFile /tmp/atepdf-shr45-review-web.tsbuildinfo -p apps/web/tsconfig.json` | Passed. |
| `pdftoppm -f 1 -l 3 -r 72 -png` on old and new geometry PDFs | All **3/3 corresponding PNGs were byte-identical**. Corpus checks also reconfirmed page order, geometry, embedded font and image XObject. This bounded render comparison is not a complete visual-fidelity guarantee. |

For a separate full checkout, `git clone --quiet --no-hardlinks --branch shreytalwar/shr-45-assemble-a-documented-corpus-of-ordinary-and-difficult-pdfs /Users/shrey/Documents/ChatGPT/atepdf /tmp/atepdf-shr45-final-crosspath.Cb1yrv/checkout` checked out exact correction commit `9a9284f209c75892b3d465c72414a80e346c9eb6`. The documented generator was run from both that checkout and the SHR-45 worktree with temporary `--output-dir` locations. A byte and SHA-256 comparison against the committed PDFs and manifest passed for **all 8/8 deterministic outputs**. The AES PDF was excluded because its salt and IV intentionally change each run.

Remaining limits are unchanged: the corpus is test input, not an engine compatibility or post-transform fidelity claim. SHR-46/47/48 retain those acceptance checks. No interactive native app test was performed for this fixture-only correction.
