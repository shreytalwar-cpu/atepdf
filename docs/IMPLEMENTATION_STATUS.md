# Implementation status — 2026-09-28

This updates the retained integration tasks; it is not a second roadmap. Original technical/lifecycle/commercial tasks remain in the unmodified v7 pack. The M0/F01–F03 fresh-start interpretation controls. Owner subsequently approved React Native/Expo for all three interfaces and all workflows/results inside chat (ADRs 0001–0002).

## Retained task mapping

| Task | Existing technical / growth tasks | Current evidence boundary |
| --- | --- | --- |
| F01 — Fresh repository boundary and scoped handoff installation | M0-01, M0-02, M0-03, M0-04 | Implemented: separate existing new Git root resumed; realpath/common-directory/parent checks and bounded read-only source snapshot recorded. M0 is fresh setup, not migration. |
| F02 — Approved shadcn workspace integration | M1-01, M1-02, M1-05, G02, G27 | Implemented for browser slice: owner-approved shared React Native/Expo conversation, approved brand/drop/composer, responsive and visual checks. Native UI bundles only. |
| F03 — Real local merge, result and save | M1-06, M1-07, G19 | Implemented for simple supported PDFs: local merge, independent reader validation, inline read-only preview, save and actual downloaded-fixture checks. |
| F04 — Independent job controller, lineage, undo and cancellation | M1-08, M2-07, M3-01, G06, G07 | Implemented bounded controller: opaque refs, immutable originals, revision binding, physical-page removal, byte-identical undo, cancellation and result-bound receipts. Persistence across restarts remains unimplemented. |
| F05 — Allowlisted planner transport and consent | M2-01, M2-02, M2-03, M2-04, G04, G05 | Partial: canonical schemas and positive metadata projection tested. Hosted transport/consent/redaction not enabled; approved secure credentials and hosted privacy proof required. |
| F06 — Safe gateway, request binding and bounded spend | M2-05, M2-08, M2-09, M2-10, G06, G07, G18 | Partial: request binding, schema/semantic validation and disabled gateway. Provider integration, bounded spend and hosted failure tests remain open. |
| F07 — Genuine merge/OCR/compress proof | M0-05, M0-06, M4-01, M4-02, M4-03, M4-04, M4-05, M4-06, M4-07, G03, G10 | Bounded proof passed: real local merge → English OCR → JPEG compression; independent text/page/geometry checks and visual metrics. Broad capability/performance corpus remains open. |
| F08 — Commercial lifecycle integrated with retained local work | M6-01, M6-02, M6-03, G01, G08, G09, G10, G11, G12, G13, G14, G15, G16, G17, G21, G24, G25, G28, G29 | Not implemented: commercial hypotheses retained in handoff; no billing product, sandbox entitlement implementation, live price, seller choice or user migration. Billing sandbox tests not run. |
| F09 — Native conformance and platform capability evidence | M0-07, M1-03, M1-04, M4-08, M5-07, G15, G18, G19, G27, G29 | Partial: same React Native source plus iOS/Android Hermes exports and independent development IDs. No native engine adapters, native binaries/device conformance or native Mac target yet. |
| F10 — Release evidence and founder-approved rollout | M7-01, M7-02, M7-03, M7-04, M7-05, M7-06, M7-07, M7-08, M7-09, G28, G29, G30 | Not release-ready: no signing, deployment, publication, purchase migration, legal approval or distribution. Release/production checks remain open. |

## Runnable result and verification

Source: apps/universal/App.tsx (shared conversation); packages/core/src (local store/controller); packages/web-pdf/src (local engines/independent reader); packages/contracts (canonical protocol and shared synthetic corpus). Browser workflow: import brief.pdf + appendix.pdf → merged A1/A2/B1 → inline preview/save → remove physical page 2 → A1/B1 → undo identical merged bytes.

- Production Next web build passed; shared RN UI is live inside the optional host.
- Expo web export passed; all five browser workflows pass on the standalone export, including the three-step recipe in one chat turn.
- Expo iOS/Android Hermes compilation passed. This is not Xcode/Gradle, signing, simulator or device execution.
- Eight controller/fixture regression tests pass. Five browser workflows pass on Expo web; the four shared workflow checks also pass on the Next host. Native/shared TypeScript checks pass.
- Real 4-page chain: 7,702,303 bytes merged → 7,708,424 bytes searchable → 406,034 bytes compressed. Exact measured bytes in evidence/chain-measurements.json. Text order/search phrase preserved. OCR pixels unchanged on all four rendered pages; compression visual metrics and pages retained.
- Handoff validator: original pack fails only on two extra owner wrapper files outside its file manifest. Manifest-only scratch copy passes. No original pack was altered. This is separate from application builds.

## Failures and gaps

Fixed during development: CSP-incompatible runtime schema compilation (replaced with generated validators), save/engine edge cases, and 320px privacy badge overflow. Test evidence reflects the reruns. Clean dependency installation initially encountered sandbox store access and explicit install-script policy; dependency policy is now scoped in pnpm-workspace.yaml. The isolated frozen offline install and actual application build pass (legacy-learning/INDEPENDENCE_CHECK.md).

Hosted AI is disconnected; parser is explicitly labelled local commands. Secure credentials, consent, hosted redaction/transport and bounded budget are required before a real provider is enabled. Local work does not wait for these. Native PDF adapters deliberately fail closed. No billing sandbox test can be claimed without a billing implementation. PDF feature support is intentionally bounded (see PLATFORM_CAPABILITIES.md); original handoff acceptance breadth is not all complete.

## Next executable task

Continue F09: implement a local native PDF adapter behind the existing controller, starting with merge → independent validation → read-only preview/save → remove → undo using the same synthetic corpus on iOS and Android. Produce actual native binary/simulator evidence before enabling those capabilities. Keep F05/F06 provider work disabled until its credentials/authority exist. Mac remains a separate scheduled native target. Commercial and lifecycle work remains linked to its retained task IDs; no marketing tooling blocks this implementation.
