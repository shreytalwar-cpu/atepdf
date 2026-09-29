# Security

Canonical internal security record at `prototype-v0`, 29 September 2026. No penetration test, vulnerability-feed query, secret-history scan, runtime exploit or production assurance was performed. Full source citations and conditions are in [the security audit](audit/SECURITY_PRIVACY_AI_COMMERCE_AUDIT.md).

## Approved target authority

[PRODUCT_V1.md](PRODUCT_V1.md), especially Sections 9–11 and 14–16, defines target privacy/secret, persistence, production-service and Mac release requirements. Findings below remain findings; adopting those requirements does not fix them or certify compliance. Current restrictions remain until separately authorized changes implement and verify the required boundaries.

## Implemented controls

- Independent new development identities; local-only browser hosts; no inherited production/customer integration found in reviewed application source. Private configuration and environment contents were deliberately not inspected.
- Strict planner request projection/schema checks, complete-response binding, current revision/ref/capability validation, bounded steps, no remote code/shell executor and no partial-plan execution.
- Atomic local result commit after independent reading; immutable originals; cancellation/stale-plan protection.
- Browser gateway checks loopback Host, same-origin/token requirements and cross-site metadata. This is local CSRF/session protection, not account authentication.
- Private key/config files have ownership/permission and no-follow handling; allowance is reserved durably before a call, one shared lock, no retries and a provider timeout. Request count is bounded; dollar cost is not capped by that count.
- Native development pairing uses a 256-bit one-use code, five-minute expiry, expiring bearer sessions and revocation. Optional private TLS pins the certificate and restricts endpoints. Physical-device acceptance remains open.
- Beta launcher authenticates management operations, checks static Host and canonical path containment and preserves process ownership. CSP restricts assets/connections, but permits inline script/style and WASM; it is not an XSS proof.

## Source-backed risks awaiting disposition

| Finding | Severity and preconditions | Proposed disposition |
|---|---|---|
| Provider endpoint inherits `OPENAI_BASE_URL` | Medium; enabled AI through an environment-inheriting launcher with an alternate override. The detached beta launcher filters it out. No current override or leak observed. | REFACTOR explicit endpoint trust boundary |
| Alternate `serve-expo` host follows escaping static symlinks and lacks static Host allowlist | Medium; that host must run and a readable outside-target symlink must exist. Hostile-browser access additionally requires its network/origin conditions. Gateway auth is separate. | REPLACE duplicate host path after approval |
| Privacy wording exceeds heuristic filtering | Medium; unrecognized sensitive text in a user instruction may be sent. Automatic artifact projection remains separate. | REFACTOR disclosure/contract with explicit outcomes |
| Rejected secret remains in visible chat | Low; raw composer submission is appended before rejection. No network leak established. | REFACTOR rejection retention behavior |
| Browser JPEG decoder preflight | Suspected resource-exhaustion risk; metadata/encoded-dimension mismatch may be decoded before actual-size checks | Investigate with synthetic bounded fixture before changing engine |

Provider response reading has an SDK 2 GiB default bound, too large to count as an application memory safeguard. Native's 256 KB response limit does not protect gateway memory. Owner removal of the 2,000-output-token cap is distinct from a future transport-byte safety limit.

## Not implemented or not established

Production identity/authentication/authorization, account recovery, key custody service, Keychain storage, multi-user gateway isolation, release signing/notarization, CI security gates, current CVE review, fuzzing, comprehensive parser/dependency audit, crash-report redaction, authentic payment validation and completed distribution licence/privacy-policy review remain open. A same-user malicious process is inside the current development trust boundary. Descriptive `productionEnabled` app flags are not runtime kill switches.

Security findings do not authorize fixes during the freeze. Preserve their reproducible preconditions, prioritize the smallest relevant regression proposals and obtain a scoped implementation instruction. No public disclosure channel/contact or legal policy is invented here.
