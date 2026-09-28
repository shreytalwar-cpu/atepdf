# 05 | Privacy contract, threats and tests

## The promise
**Cloud AI interprets your instructions. Your device processes your documents.**

This is not fully offline AI and not a promise that no information ever leaves the device. Instructions and limited metadata are networked. User-selected cloud file providers may download source files, and user-directed exports/shares may upload results. The application's own processing pipeline does not send document contents to its backend or model provider.

## Data map
| Data | Local | Backend/model | Stored by app service |
|---|---|---|---|
| PDF/image bytes, rendered pages, OCR text | Yes | Never automatically | Never |
| User-entered instruction | Draft/session | Yes, after disclosure | No raw-body logging by default |
| Original filename/path | Yes | No manifest field; typed mentions may reveal them unless aliased | Never deliberately |
| Anonymous file/version ref, kind, page/byte count | Yes | Minimal needed subset | No unnecessary persistence |
| Passwords | Secure local control only | Never | Never |
| Recipe without file bindings/secrets | Yes | Only as necessary to interpret follow-up; prefer local reuse | No cross-device sync in initial scope |
| Account and purchase status | Optional | Entitlement services | Minimal necessary account records |
| Metrics | Sanitised | Optional aggregate events | Retention documented |

`store:false` controls relevant provider application storage, not all provider retention. OpenAI documents default abuse-monitoring retention and separately governed retention controls [S04]. Do not write “zero retention”, “HIPAA compliant” or “no data stored anywhere” without verified agreements and implementation evidence.

## Threat model
1. **Malicious PDF:** malformed object graphs, decompression bombs, huge pages, recursive resources, active content and remote-resource references.
2. **Malicious model response:** unknown action, invalid page indexes, secret request, path traversal, injected script, unexpected URL, privilege escalation or stale refs.
3. **Prompt injection:** instructions embedded in filenames or document contents. Document contents never go to the planner; filename mapping must not treat metadata as commands. User requests cannot override operation allowlists.
4. **Accidental leak:** app error serializer sends a whole file model; analytics captures composer/file labels; session replay records previews; PDF engine emits content in error logs.
5. **Browser supply chain/XSS:** compromised script can read selected files. Local processing is not a substitute for application security.
6. **Device limits and interruption:** crashes, OS suspension, storage exhaustion or concurrent edits produce corrupt/partial files.
7. **Abuse of gateway:** anonymous clients consume paid model capacity or bypass superficial web limits.

## Required mitigations
- Positive serialization allowlist with distinct local/cloud DTO types. Static module boundary checks where feasible; runtime validation on client and server.
- No upload endpoints, `input_file`, base64 attachments, remote file URLs, hosted containers or PDF cloud SDKs in the production path.
- CSP and trusted asset origins; no third-party marketing pixels/session replay in the processing workspace. Disable dangerous preview actions and external resource fetches where possible.
- Prefer self-hosted, pinned worker/WASM/language assets with integrity/version tracking. Loading a CDN script dynamically into the file workspace is a security decision.
- Sandbox/unprivileged engine execution as supported by platform. Workers improve scheduling but are not a magical security boundary against all same-origin code.
- Bound file size, page count, rendered pixel area, object recursion, expanded ZIP size, step count, concurrency and runtime. Limits are defensive engineering settings, not billing promises.
- Local file handles/URIs are resolved by trusted code. Never concatenate model strings into filesystem paths or shell commands. Disallow path traversal and dangerous filename characters during export.
- Reject unknown operations even if they look plausible. Never `eval`/run model-authored code.
- Secret entry is masked and kept out of undo/history/logging. Do not make absolute claims of guaranteed memory erasure on managed runtimes.
- Atomic output commit after validation; temporary files excluded from backups where possible; scoped read grants; correct resource cleanup and object-URL revocation.
- No hidden cloud fallback when local engine fails. The error card offers smaller batches, supported alternatives or a tested native app, not a document upload.
- Dependency SBOM, locked versions, licence inventory, vulnerability checks and update procedures.

## Local storage policy
Default proposed policy: session-scoped working files; persisted recents only with a clear local-history setting; temporary spill files cleaned on completion/clear plus startup sweep for abandoned jobs. Do not rely on browser tab-close hooks for guaranteed deletion. Native backup exclusions and storage encryption policies must be checked by platform. Do not promise secure erasure on SSD/OS storage.

Saved output goes only to a user-selected destination or the app's explicit local results area. A system “Share” action is user-directed; no background upload to an account vault. The UI can keep recipe titles locally without sending customer filenames to analytics.

## Privacy regression tests
Create synthetic canaries in PDF text, image pixels/OCR, metadata, filename, password and filesystem path. For each core journey, inspect all outgoing HTTP/WebSocket/beacon/SDK events, including gateway, analytics and crash-report paths.

Pass condition: no document canary, password, full path or unapproved metadata is transmitted. Allowed test instruction and opaque refs may appear. Test first import, preview, cloud planning, OCR, compression, cancellation, error, retry, batch, history and support-report generation. Test in release builds, not only debug builds.

Inject provider responses containing scripts, network URLs, unsupported actions and output paths. Ensure they never execute. Corrupt/stale responses must fail before engines run. Test same-origin asset loading policy and ensure document preview does not fetch embedded external content.

Support reports must be useful without documents: app/OS version, anonymous job ID, operation IDs, engine build, error class, counts and timing. Any optional user-supplied attachment is a separate explicit action; do not add it to core V1 by default.

## Release controls
A privacy engineer/reviewer should examine the actual network capture and serializers. “The code looks local” is not evidence. Store privacy declarations must describe the real instruction/metadata network path; pure on-device PDF processing does not mean there is zero data collection. Review current Apple/Google requirements before submission [S20, S21].
