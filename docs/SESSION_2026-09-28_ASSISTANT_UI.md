# Session: assistant-ui, local planner setup and PDF size policy

New repository: `/Users/shrey/Documents/ChatGPT/atepdf`, branch `codex/atepdf-chat-workflows`; resumed from b775bae. The final implementation commit is in Git history. No application scaffold was recreated.

Old reference: `/Users/shrey/Documents/attenlo/attenlo-docs`, read-only. Resolved roots and Git common directories remain distinct. All seven files from the bounded learning snapshot still match their recorded hashes; no old application code was ported, and no old install, build, test, migration or runtime execution occurred. Evidence: evidence/planner/repository-boundaries.json. Historical handoff source is unchanged.

## Result

The official assistant-ui React Native/Expo thread/composer/message recipes replace the handwritten chat shell, with local PDF artifacts and confirmations in the conversation. Same interface exports to web/iOS/Android. Next serves the Expo export and local API routes. Upstream provenance and owner override are in ADR 0003 and upstream/assistant-ui.md.

Masked OpenAI key entry is inside the chat through a dedicated local-only field, with a terminal alternative. The local gateway is implemented with Vercel AI SDK/OpenAI structured output. Keys remain in ignored private local storage. No calls are enabled without a bounded allowance; routine implementation tests use mocks. The owner subsequently saved a key through the masked field and approved exactly two live tests; both passed and the allowance is exhausted. See OPENAI_LOCAL_SETUP.md for scope and limitations.

Owner subsequently requested removal of the PDF size restriction. Audited active app, core store/controller, engine, planner, platform adapters, scripts, schema copies, tests and current capability docs. Removed per-file, aggregate-input, engine-output and retained-history byte gates plus UI text. The original handoff and historical evidence retain their source content. The remaining limits concern supported document features, decoded image workload, page counts, job deadlines and the small planner JSON transport. No cloud PDF fallback was introduced.

## Verification

- Actual Expo web export and production Next application build passed. These are distinct from package/handoff checks.
- iOS/Android Hermes exports passed; no native binary/simulator/device PDF processing claim.
- 19 regression tests passed: real PDF engine/controller, immutable originals, independent validation, larger-than-20-MB inputs, larger-than-40-MB output, retained history beyond 100 MB, privacy projection, safe configuration, request cap, concurrency, timeout, cancellation, malformed output and actual SDK HTTP mocked at fetch.
- 10 Chrome browser workflows passed at localhost:3211. Includes real merge/preview/save/remove/undo, local OCR/compression, planner consent/redaction/cancellation with explicitly mocked responses, masked credential setup with a dummy key, and the actual large-file browser journey. No live API key was used by these tests.
- Two owner-approved live OpenAI calls passed: model-planned merge and follow-up removal, locally executed and independently reopened as A1/B1. Actual browser DTOs contain only synthetic instructions and anonymous metadata; no PDF uploads. The gateway has zero requests remaining and is disabled. Evidence: evidence/planner/live-test.json and live-budget-final.json. A subsequent local request returned 503 without another provider call.
- Four mocked planner browser tests and two production-host smoke tests were rerun after the final status refresh fix; no additional paid calls.
- Large synthetic files contain real visible RGB image streams, not fake size metadata/padding. Exact measurements and local-only network record: evidence/planner/large-files.json. The browser test rendered and saved the merged output and verified byte-identical undo.
- UI checked at desktop, phone, 320px compact, tablet orientations and a reduced-height keyboard proxy. Horizontal overflow and welcome/composer overlap were found and fixed. Checks now cover vertical separation. Console errors absent in tested flows. Source-backed project Playwright tests complement in-app browser inspection. The in-app browser displayed the final app without console errors, but automated Pressable activation again produced no state change; the real Chrome browser journeys passed. The owner successfully saved the key through the in-app browser.
- Native/shared TypeScript checks passed. 619 installed licences inventoried; no missing declarations. This is not a release legal/security audit.
- Original v7 validation reran. Its 24 repository guard tests pass; final manifest check still reports the two extra owner wrapper files recorded previously. The original pack was not edited to suppress that result.

## Failures and boundaries

Fixed: initial Expo build attempted a global telemetry directory (telemetry disabled in scripts), ESM gateway bundle needed Node createRequire for generated validator helpers, stale Next schema-only adapter type mismatch, compact horizontal overflow and an overflowing empty-state welcome. The live runner initially failed at TypeScript startup before making any provider call; wrapping its entry point fixed it. Live verification exposed a stale ready label after the allowance was consumed; status now refreshes after attempts and masked key save. Final build/test logs reflect successful reruns.

The two live calls establish hosted planning for this development project only. Production authentication, broader planner evaluations, invoiced cost, billing and deployment remain open. Native PDF adapters remain disabled pending F09 actual platform work. No billing implementation/sandbox tests, purchase SKU, entitlement migration, signing, publication, seller choice or user migration was added. Large-file admission is no longer artificially capped, but actual device memory and engine support remain finite.

## Next executable task

Resume F09 native local PDF adapters and conformance using the shared protocol and synthetic corpus. Additional paid planner calls require a new bounded allowance; local quick actions work with the current exhausted allowance. No marketing tooling blocks local app execution.
