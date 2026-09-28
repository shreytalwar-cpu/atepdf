# Static delivery and startup confirmation

29 September 2026. Implementation commit **30d98d0** adds asynchronous gzip to successful public JavaScript/CSS responses from the local beta host. It adds no dependency or response cache. HTML, PDFs, images, fonts, WASM, JSON, planner/native APIs and management responses retain their existing behavior. `no-store`, Host checks, realpath containment and the changed-build guard remain in place. This is compression of application code in transit, not PDF processing or a new file-size limit.

The app itself is the unchanged **7935daa / candidate10** export. HTML SHA256 `e9c07d03c77cab35ab9e9c3732a94aa7e07999cb5c8e4d5ff288deb9faf82c47`; entry SHA256 `1689e2e2cdd9a47626f15c477509e41f9b3d4d58aa5b8d83d04bd08893b166d1`. [profile.json](profile.json) records the exact server/helper hashes, response headers, resource sizes, browser errors and CPU observations. Actual browser response bodies decoded to those same hashes in all four contexts.

## Measured result

Installed headless Chrome 154.0.8037.58; 1440 × 1000; reduced motion; fresh context and disabled cache per measurement; JavaScript coverage enabled in both representations. The constrained profile uses 4× CPU slowdown, 1.6 Mbps download, 0.75 Mbps upload and 150 ms latency. Both representations were served by the same host/export at `http://localhost:3213`, selected through the actual Accept-Encoding request header. These are one pair per profile, not p75, INP, production CDN or physical-device results.

| Observed metric | Identity | Gzip |
| --- | ---: | ---: |
| Entry bytes transferred in the HTTP body | 2,240,317 | 486,133 |
| Constrained: Choose files visible | 12,320 ms | 3,342 ms |
| Constrained: privacy dialog responded, from navigation start | 12,430 ms | 3,428 ms |
| Ordinary loopback: Choose files visible | 156 ms | 183 ms |
| Ordinary loopback: privacy dialog responded, from navigation start | 203 ms | 218 ms |

The entry transfer shrank **78.3%**, and first-control visibility improved **72.9%** in the constrained pair. Ordinary local startup was slightly slower in this sample, as expected for additional encoding/decoding work; no general local speedup is claimed. Four simultaneous gzip and four identity requests all independently decoded to the entry hash. Their full-response elapsed times were 29.9–39.8 ms for gzip and 5.2–12.7 ms for identity. There is no new representation cache or cross-request file retention.

First-control visibility does **not** mean the artwork finished. The initial timing screenshots capture that early state. A separate [complete-artwork check](complete-artwork.json) found the control at 3,188 ms and all three images loaded at **7,131 ms** under the same constrained conditions. Root visually inspected [the complete screen](complete-artwork.png), confirming the approved identity and welcome artwork. The unchanged 688 KB paper image remains a constrained-network opportunity; this patch does not claim full performance acceptance.

## Verification

- [Final launcher tests](beta-tests-final.log): **16/16 passed**, including raw gzip/identity round trips, MIME, exact length, bodyless HEAD, quality weights/refusals, malformed/duplicate weights, concurrent representations, incompressible and small assets, revision freshness, symlink escape, changed-build rejection and unchanged private launcher/TLS boundaries. Synthetic test settings only; no owner credential opened by fixtures.
- [Actual browser workflows](workflow-results.json): **2/2 passed**, 7.7 seconds. Existing assertions exercised bundled import → actual merge → preview/save → physical page removal → Undo and independent PDF reopen; then real merge → English OCR → PDF compression, saved output inspection and local-only network assertions. No test assertion was relaxed.
- [PDF chain measurements](workflow/chain-measurements.json): four pages; 7,702,303-byte merged source; 7,708,437-byte searchable copy; 406,046-byte final PDF; original text and recognised synthetic phrase preserved. The saved final copy is [chain-final.pdf](workflow/chain-final.pdf).
- Browser page identity, meaningful initial content, privacy-dialog interaction, page/console errors and same-origin request rules passed in all four profile contexts. The two PDF workflows also asserted no unexpected egress or planner call. Root visually inspected the complete initial screen and [Undo result](workflow/desktop-result.png).
- This pass reuses an already built source-matched Expo export; **no new Expo or Next application build is claimed for the transport patch**. The native test agent's separate build is recorded separately.

The dedicated Browser-plugin skill was unavailable; the installed project Playwright was used in headless isolated contexts. Existing tests ran from a task-owned temporary directory so they did not overwrite earlier tracked evidence. Their captured outputs are retained under [workflow/](workflow/). `profile-source.mjs` and `playwright-source.ts` are snapshots of the actual temporary harness, whose original execution location was `.build/ux-20260929/transport`.

Two harness setup failures are preserved: [one incorrect relative import](profile-import-failure.log), corrected before profiling, and [an over-anchored test filter](workflow-filter-failure.log), corrected before either workflow ran. Neither was an application failure. The test runner's terminal colour-environment warning is not an application console error.

Owner beta3211 was not restarted, reloaded or replaced. No paid calls, old-source access, installation, publication or production identity changes occurred. The isolated QA host is stopped after verification; the same candidate export remains available for the next session. Owner beta promotion remains pending the already-requested saved-session confirmation.
