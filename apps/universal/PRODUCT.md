# Product: atepdf

<!-- impeccable:product-schema 1 -->

Recorded 29 September 2026 from the owner's confirmed audience and established repository decisions. Applies to the existing shared application in this directory. Resume this application; do not recreate it. Visual values live in [DESIGN.md](DESIGN.md), and interaction requirements live in [UX_STATE_CONTRACT.md](../../docs/UX_STATE_CONTRACT.md).

## Platform

adaptive

One React Native/Expo conversation serves web, iPhone/iPad and Mac Catalyst, with platform adapters for local engines, file selection, preview, saving and keyboard behavior. Web captures establish browser behavior only. Android is deferred. Current Mac interactive checks are deferred at the owner's request; this does not remove Mac from product scope.

## Users

The owner selected **everyday users doing occasional PDF tasks**. They should be able to return after time away, add their files, describe a change, inspect the result and save a copy without remembering a command language or learning a catalogue of tools. Do not infer an enterprise-admin, developer or professional-editor audience from the private beta's connection controls.

## Product Purpose

Help a person finish a PDF task in one conversation. Success means the person understands which files are selected, what is happening, which output is current, how to inspect and save it, and how to recover from a failed or unwanted change.

## Positioning

The established mechanism combines conversational instructions with local PDF operations. Optional AI interprets privacy-checked instructions and limited anonymous file metadata; document processing remains on the device. This is an architectural commitment, not a claim of unique market position or wholly offline AI.

## Operating Context

The primary workflow is add PDFs → request or choose an action → observe factual progress → inspect the inline result → save → continue with the current result. Merge uses originals in their visible import order. Follow-up removal, OCR and compression use the appropriate current document; ambiguity requires a question. Undo restores a previous result within the same session.

The app uses official `@assistant-ui/react-native` primitives and an external-store runtime. The local store, job controller, planner serialization and UI remain separate. File bytes and local artifact objects do not become assistant-ui model attachments. The browser and Apple platforms use their existing local engine adapters; the optional host is not a second app shell.

## Capabilities and Constraints

- Implemented, bounded workflows include supported-PDF import, merge, physical-page removal, Undo, read-only preview, export, OCR and image compression. Capability and output claims must remain tied to the platform and tested corpus in [IMPLEMENTATION_STATUS.md](../../docs/IMPLEMENTATION_STATUS.md).
- The current file picker accepts PDFs. Broader handoff ideas do not establish current support for importing images or every PDF feature.
- Originals are immutable. New output must pass independent reading/validation before being presented as ready. Complete validated plans execute; no response fragments or partial plans execute.
- AI is optional. Local supported actions remain usable when AI is disconnected, unavailable or paused. Ordinary Send and safe copy-producing operations do not require repeated consent cards. Meaningful image-quality choices still require a choice.
- Never transmit PDF contents, page images, recognised text, local filenames, paths, checksums, passwords or secrets to the planner or analytics. Do not add a remote-processing fallback.
- **Conversation, drafts, imported files and result history are session data. Persistent recovery across termination is not implemented.** Save creates an external copy; it does not save the conversation. Do not promise saved history, autosave or restoration after restart.
- “Ready”, “download started”, “share sheet closed”, “save cancelled” and “saved” are different facts. A destination copy must actually exist and reopen before acceptance evidence calls export successful.
- Fresh independent product identity and storage boundaries remain in force. Attenlo PDF is a read-only reference, never a dependency or write target.
- Production identities, deployment/publication, spending, migration and live billing need explicit bounded authority. No public domain, support address, pricing or legal seller is inferred from the brand name.

## Brand Commitments

The name is **atepdf**, exactly lowercase. Use the approved rounded gradient numeral **8** and existing wordmark assets. The owner's brand board governs name and logo only. It does not approve a new application layout.

Preserve the friendly, simple drop-and-instruct workspace in the [handoff design contract](../../atepdf_codex_build_pack/DESIGN.md) and [approved brand record](../../atepdf_codex_build_pack/brand/APPROVED_BRAND.md). Keep instructions, confirmations, progress, outputs, preview, save and follow-ups inside the conversation. No sidebar, permanent preview rail or separate editing suite is approved.

Voice is concise and practical. Explain what happened and the next useful step. Describe supported behavior in familiar words; preserve necessary precision such as physical page number when it affects the operation. Avoid exaggerated delight, fake reasoning, invented progress and default success celebrations.

## Evidence on Hand

- [Architecture decisions](../../docs/adr/): React Native/Expo, conversational workflows, official assistant-ui, Apple/web priority and seamless execution supersede earlier handoff stack and per-request consent rules.
- [Implementation status](../../docs/IMPLEMENTATION_STATUS.md) and [UI/UX execution plan](../../docs/UI_UX_EXECUTION_PLAN.md): retained tasks and explicit acceptance gaps.
- [Apple QA](../../docs/BETA_APPLE_QA.md) and [iPhone QA](../../docs/BETA_IPHONE_QA.md): native/simulator evidence with stated limitations.
- Bundled `assets/fixtures/brief.pdf` and `appendix.pdf`: synthetic workflow inputs, not customer documents.
- Independent browser design assessment on source `8d71ac0`: real 1440 × 1000 and 390 × 844 import/merge/preview/remove/Undo/error states. Its local captures are in `.build/ux-20260929/assessment-a/` at repository root. That assessment is neither a moderated user study nor native, screen-reader, physical-device or release proof.

## Product Principles

1. Let occasional users finish a task without learning the implementation.
2. Keep file truth, processing and recovery local and independent of conversation presentation.
3. Make the current document and the effect of the next action understandable.
4. Preserve originals, usable results and recoverable user work when a request fails or stops.
5. State what evidence proves; keep unverified capabilities and release gates explicit.

## Accessibility & Inclusion

The approved contract requires targets of at least 44 points on Apple and 44 CSS pixels for web touch controls; ordinary-text contrast of 4.5:1 and applicable large-text/control contrast of 3:1; visible keyboard focus; accessible names; support for larger text and Reduce Motion. Screen-reader announcements should report meaningful state changes without narrating every engine event.

These are requirements, not blanket conformance claims. Verify actual web, Apple simulator and physical-device behavior separately. A browser at phone width does not establish software-keyboard clearance or Dynamic Type support. Preserve the existing native uncontrolled composer, which protects fast typing and caret state.
