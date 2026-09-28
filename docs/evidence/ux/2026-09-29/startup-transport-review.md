# Candidate 10 startup transport review

Reviewed 2026-09-29. **Recommend one bounded static gzip change, with no client or server caching change.** Compression materially reduces the bytes in the constrained-transfer profile. An improvement to ordinary loopback startup remains unmeasured; browser caching does not improve a first visit with an empty cache.

## Evidence and source binding

The preserved export is [candidate-web-10](/Users/shrey/Documents/ChatGPT/atepdf/.build/ux-20260929/candidate-web-10). Its `index.html` SHA-256 is `e9c07d03c77cab35ab9e9c3732a94aa7e07999cb5c8e4d5ff288deb9faf82c47`. The mutable `apps/universal/dist-web` currently differs, so none of its asset sizes are used below.

Local, in-memory compression of the four JS/CSS assets referenced directly by that HTML produced these exact byte counts using Node v24.19.0. Every gzip and Brotli-quality-6 result decompressed byte-for-byte to its original. These are calculated representations, not responses from the running host.

| Initial asset | Original | gzip level 6 | Brotli quality 6 |
| --- | ---: | ---: | ---: |
| `index-630012e833bbef46f5441d9899bb7fda.js` | 2,240,317 | 486,133 | 418,914 |
| `global-418e89804c5c99244db2be82f33419f6.css` | 23,915 | 5,314 | 4,999 |
| `preview-4a592c39668f775437665576652be491.css` | 2,503 | 978 | 850 |
| `workspace-9ca8942114a70307784c156bddc23a49.css` | 1,315 | 470 | 392 |
| **Total** | **2,268,050** | **492,895** | **425,155** |

Gzip removes **78.3%** of those transfer bytes. At an ideal 1.6 megabits/second, their combined transfer floor changes from **11.34 seconds to 2.46 seconds**. This excludes request latency, headers, HTML, fonts, other/lazy assets, decompression, and JavaScript execution. The supplied earlier 12.197-second readiness measurement under 4× CPU throttling was not rerun. Its reported 483,456-byte gzip entry used unspecified compression settings; this review explicitly uses level 6. Neither calculation predicts an exact new readiness time.

The actual beta binds both loopback addresses, not a remote web connection ([server.mjs:120](/Users/shrey/Documents/ChatGPT/atepdf/scripts/beta/server.mjs:120)). Unthrottled local use may be dominated by parsing/execution; compression leaves that work intact and adds compression/decompression work. The constrained-profile opportunity is strong, while a universal first-use speed claim would exceed this evidence.

Reviewed host SHA-256: `adb53b79b1b6fb02c30f3c3a5b12a80baac8ae241b5284db42a56fec955cdfa0`.

## Delivery behavior and bounded change

[server.mjs:72](/Users/shrey/Documents/ChatGPT/atepdf/scripts/beta/server.mjs:72) sets `no-store` globally. Its static branch at [line 109](/Users/shrey/Documents/ChatGPT/atepdf/scripts/beta/server.mjs:109) validates method, resolves the real file beneath the export root, chooses its MIME type, and sends raw `readFile` bytes. It has no compression, encoding negotiation, ETag, conditional response, or explicit content length. The launcher records build identity in [web.mjs:15](/Users/shrey/Documents/ChatGPT/atepdf/scripts/beta/web.mjs:15); the host rejects a changed index before serving API or static content at [server.mjs:95](/Users/shrey/Documents/ChatGPT/atepdf/scripts/beta/server.mjs:95).

The smallest useful implementation is:

- Add asynchronous builtin `node:zlib.gzip`, level 6, only for successful static `.js`, `.mjs`, and `.css` responses of at least 1 KiB. Retain an uncompressed representation when compression is larger and identity is acceptable. Do not alter HTML, PDFs, images, fonts, WASM, JSON, management, planner/native APIs, or errors.
- Negotiate `Accept-Encoding` correctly, including weighted values, explicit `gzip;q=0`, wildcard, and identity refusal. Set `Vary: Accept-Encoding`, the selected `Content-Encoding`, and its exact `Content-Length`; preserve MIME and all existing security headers. HEAD sends the corresponding representation headers without a body. Preserve existing Range-request behavior rather than introducing partial-response support in this patch.
- Compress per request asynchronously after the existing Host, build, path, and file checks. Do not introduce raw/compressed memory caching in this first patch: it adds invalidation and retention behavior without improving the first compression. Measure concurrent-request and compression latency as part of acceptance. Handle compression errors before writing encoding headers; fall back to identity only when acceptable.
- Keep browser `no-store` and existing launcher/authentication boundaries. This change belongs to the actual beta host; [serve-expo.mjs](/Users/shrey/Documents/ChatGPT/atepdf/scripts/serve-expo.mjs) and the separate hosted export path are not automatically covered.

Node v24.19.0 already provides asynchronous gzip and Brotli. Its documentation explains their threadpool use and recommends caching repeated compression results. This bounded loopback proposal deliberately leaves caching unchanged; repeated compression/threadpool contention is a measured acceptance concern, not assumed free. No new npm package is needed. Brotli quality 6 saves another 67,740 bytes across these assets, but its compression-time tradeoff was not measured; gzip alone captures most of the opportunity. [Node v24.19.0 zlib documentation](https://nodejs.org/download/release/v24.19.0/docs/api/zlib.html#threadpool-usage-and-performance-considerations)

Node's version-specific licence contains the Node permission notice and separate zlib/Brotli notices. Calling the existing builtin adds no npm dependency to [scripts/licenses.mjs](/Users/shrey/Documents/ChatGPT/atepdf/scripts/licenses.mjs); a later redistribution of the runtime must retain the applicable notices. No new licensing tool or runtime installation is proposed. [Node v24.19.0 licence](https://raw.githubusercontent.com/nodejs/node/v24.19.0/LICENSE)

Long-lived browser `immutable` caching is not recommended in this batch. It helps repeat visits, while allowing cached assets to bypass the beta's deliberate per-request build-change gate. If warm-start caching is later justified, validated hashed assets with private revalidation and representation-specific ETags merit a separate decision; HTML and API responses should remain `no-store`.

## Acceptance checks before adopting it

Extend the synthetic local-only fixtures in [beta.test.mjs:17](/Users/shrey/Documents/ChatGPT/atepdf/scripts/beta/beta.test.mjs:17), using raw `node:http` responses so automatic fetch decompression cannot conceal missing or incorrect transport behavior:

1. Gzip JS/CSS bytes independently gunzip to the original; MIME, encoding, Vary, length, no-store, and security headers are correct. Check bodyless HEAD, small/incompressible files, and excluded asset types.
2. Cover missing/empty encoding headers, weighted gzip, `gzip;q=0`, wildcard exclusions, and no acceptable supported representation. Never return a forbidden encoding or mislabel identity bytes.
3. Verify concurrent same-file requests with different accepted encodings, changed/replaced files, and failed compression. Retain symlink containment, foreign-Host rejection, and the changed-build 503, including after an earlier successful asset response.
4. Retain existing management ownership and local-only planner/key rejection tests. API and management response bytes/headers stay outside compression; no provider request is required.
5. After implementation, compare cold readiness and transferred bytes against the same preserved export under both the earlier constrained profile and ordinary unthrottled loopback. Confirm a local synthetic import/operation still works. Report transfer savings separately from readiness; do not infer reduced parsing cost.

This review changed only this note. It did not launch browser probes, run server tests, restart either app host, inspect owner credentials, install dependencies, change exported assets/source, or make paid calls. No native, physical-device, or release-performance claim is made.
