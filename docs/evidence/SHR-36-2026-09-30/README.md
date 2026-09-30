# SHR-36 — Payload-bound outbound enforcement

Scope: implementation of the approved [ADR 0012](../../adr/0012-pre-send-privacy-consent.md) at outbound boundaries. The branch started from `origin/main` at `ff3e29184b5bf039cc8938f71bbdb60f93f4ba7b`, which includes approved SHR-35. Latest main was refreshed before publication; the later changes are documentation only and do not overlap this implementation. No production recipient, relay, content-processing feature, paid request, deployment or merge is included.

## Boundary architecture

`packages/planner/src/outbound/schema.ts` owns the H/C/N field table and positive projection. Unknown keys, accessors, prototype data, sparse/extended arrays, unexpected nested values and unclassified fields fail closed. The controller supplies live local revision/artifact facts to the Mac-side guard. Browser and native JavaScript transports project H immediately before same-Mac IPC; the native Swift transport independently validates the decoded wire schema and secrets immediately before URLSession writes. A regression checks Swift field sets against the central table.

The gateway accepts only the H wire schema, checks permission before reserving an AI call, and rechecks at provider dispatch. The existing provider's final fetch boundary verifies the entire SDK envelope against build-owned system/tool metadata plus the validated H projection, reconstructs that envelope, and calls the gate again immediately before the actual write. Arbitrary SDK fields, redirects and inherited endpoint overrides cannot be forwarded. AI orchestration and local plan validation remain in place.

`gate.ts` implements the ADR's deterministic validity order. Classification and N checks precede recipient, enabled-state and disclosure checks; only then can H pass or C reach purpose/grant checks. After asynchronous hashing it rereads trusted source state and compares exact bytes, with no asynchronous gap between final validation and invoking the writer. Errors and `diagnostics.ts` expose only allowlisted reason codes. The live evidence writer no longer records request bodies, full URLs, page-error messages or rendered error text (ADR gap G6); historical evidence is unchanged.

## Allowed H fields

Guarded instruction; bounded pending question/choices and up to three clarification answers; opaque request/file refs; selected order and focused ref; active original refs; PDF kind and active page counts; the four approved size buckets; capability names; OCR locale/language; schema and workspace revision. Optional reserved H fields are abstract selector vocabulary and active result status/page-count/outcome enums. Local selector matches and labels are excluded. `previousPlan` is null and `previousActionIds` is empty. Unrelated artifact history, filenames, exact sizes, content hashes and derived text are excluded.

Known full/extensionless display-name aliases resolve locally to refs; ambiguous aliases and local document-text overlap block. Recognized secrets block the whole request. Luhn-valid 13–19-digit cards are N-08 and never have a Send anyway override. Other ADR PRIV-5 financial/identifier patterns in H instruction or clarification text require a trusted, exact-payload and route-bound confirmation capability; ordinary email and page/size numbers remain valid H. This is a boundary hook for SHR-37, not an implemented consent interface.

## Content grants and never-transfer data

C has an empty production approved-purpose list. Synthetic `test_purpose` exists only in test fixtures. No content upload path is enabled.

Memory-only grants bind workspace/deletion epoch, operation/plan ID and digest, approved purpose/version, enumerated transfer/idempotency identity, source refs/revisions and freshly computed SHA-256 identities, pages, derivation engine/version/parameters/run, exact payload digest, ordered route and pinned endpoint, recipient disclosure versions/text digest, policy/copy versions, five-minute TTL and state. Digests stay local. The trusted source resolver overrides caller-supplied bindings. Only a trusted consent-view capability can create a grant; planner/model objects cannot supply a trusted gesture. Cancel, AI-off, Clear, expiry, backward wall/monotonic clock and changed state prevent sending. Invalidated grants cannot revive if a source change is reverted. A new process/restore has no grants or transfer replay queue.

N presence hard-denies regardless of consent: passwords, secure handles, encryption/provider keys, payload bearer/pairing/refresh/CSRF tokens, recognized chat secrets, filesystem paths/bookmarks, device identifiers/fingerprints, payment credential fields and unrelated clipboard/app data. Intended transport authentication is confined to a pinned transport header or same-Mac pairing/secure-key IPC; it never enters model context. Release native routing has no approved registry yet and denies before even pairing bytes leave. Explicit DEBUG native routing permits synthetic loopback endpoints only.

## Routes, retries and relay contract

Routes require complete recipient records, all declared plaintext recipients, current disclosure versions and an exact approved endpoint. Production has no approved records or acknowledgement and therefore denies external sends. `OPENAI_BASE_URL` cannot silently redirect the existing development adapter; redirects are errors. Synthetic test injection is explicit and is not imported by app code.

A failed logical transfer can retry only identical bytes, route, recipient, purpose and idempotency identity while permission remains valid. Automatic retries are bounded to one H and zero C; the SDK's automatic retry is disabled. Expansion or provider failover requires reconsent. Successful transfers cannot replay, including individual entries in a multi-transfer grant.

`relay-contract.ts` reuses classification and recipient checks and validates route, categories, approved purpose, current disclosure versions and exact retry/idempotency identity. It accepts no local grant or content digests. This is reusable validation logic only; SHR-80's service/authentication/storage is not built.

## Historical author verification

The counts and linked JSON below describe the original branch at its recorded hashes, not the integrated closeout candidate. G3a now hard-denies D26 with no override; the historical D26 confirmation result is superseded, not a current pass. New closeout evidence is recorded separately.

- Approved ADR case mapping: **40/40 passed**. Every blocking phase asserts writer bytes equal **0**. P03 checks missing disclosure despite its P prefix; D26/D33/D34 check zero bytes before explicit synthetic confirmation. D06 first requires updated hosted disclosure, then reconsent, preserving ADR check order.
- SHR-36 focused suite: **58/58**, zero failures/skips. Includes positive H, clarification, active refs/counts/buckets, exact no-content retry, all declared C/N classes, hidden fields/arrays/descriptors, TOCTOU, source/page/recipient/payload changes, retry expansion, cancellation/restore, diagnostics and mocked SDK fetch.
- Full regression suite: **185/185**, zero failures/skips, with the bundled synthetic corpus Python environment enabled. Includes planner, protocol conformance, native planner, local workflow, persistence and secret/privacy regressions.
- TypeScript: web and universal app checks passed.
- Actual Swift URLSession DEBUG helper passed: valid H planning/clarification plus **21 canaries with zero outbound planner bytes**, redirect/body bounds, cancellation and disconnect.
- Actual Swift release helper passed: **zero pairing/planner bytes** for an unapproved route.
- Actual Swift pinned TLS helper passed: stale code, wrong pin, correctly pinned wrong hostname/expired leaf rejected before HTTP, plus valid synthetic pairing/plan/disconnect.
- After denial, a real local PDF workflow still imports, previews via independently checked facts, removes a page, exports and independently reopens, undoes and clears. Existing persistence/relaunch/clear tests also pass.

All provider responses were mocked or came from synthetic loopback servers. Native helpers compile the actual transport on this Mac; they are not a Mac Catalyst UI, signed app, device or release acceptance claim. No real provider calls or real document transfers were used. Temporary test servers were stopped after validation.

Commands: `node --import tsx --test tests/regressions/outbound-privacy.test.ts`; `ATEPDF_CORPUS_PYTHON=<bundled Python> node --import tsx --test tests/regressions/*.test.ts`; `tsc --noEmit -p apps/web/tsconfig.json`; `tsc --noEmit -p apps/universal/tsconfig.json`. Native DEBUG/TLS commands are in [the harness README](../../../tests/native/planner/README.md); release uses the same transport plus `permission-main.swift` without `-D DEBUG`.

See [policy-case-results.json](policy-case-results.json) for all 40 test mappings and [test-results.json](test-results.json) for the contentless run summary. Tracked evidence contains no request bodies or denied canary values.

## Explicit remaining boundaries

- SHR-37: rendered disclosure/consent interface, accessibility/default-focus behavior, redraw cooldown UI, user-facing explanations and inert permission receipts. D14/D23/D29 and PRIV-5 cases verify boundary capabilities, not rendered UI.
- SHR-79: verified signed/versioned recipient records and approved release configuration/acknowledgement integration. Until then real hosted sends remain denied. Production purpose approval remains separate.
- SHR-80: authenticated relay and its response/version/idempotency enforcement; this PR supplies validation logic only.
- Support export, seven-day log storage/rotation and receipt rendering are later diagnostics/UI work. D30 verifies support-content rejection and contentless diagnostics, not an implemented support-export flow.
- SHR-42 was coordinated while separate: the internal Request/ManifestFile contract and controller selection/history logic are preserved; H projection handles privacy beneath that layer. No other PR was reviewed.

No work on SHR-37/79/80 was started, no runtime product knowledge or historical audits were changed, and no merge is authorized by this evidence.

S36-03 scope clarification: in-process writer counters, fixture grants, SDK equality checks and native transport helpers prove only the exercised boundaries. They do not establish an app-wide traffic inventory, cross-process consent synchronization, a rendered consent UI, authenticated remote relay enforcement, signed Keychain persistence, or production recipient availability. Those remain separately owned acceptance gates.
