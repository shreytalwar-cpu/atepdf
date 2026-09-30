# atePDF v1: Product Specification

**Product:** atePDF  
**Studio:** Attenlo Labs  
**Product owner:** Shrey Talwar  
**Version:** 1.0  
**Date:** 29 September 2026  
**Primary platform:** macOS  
**Distribution:** Mac App Store and direct download  
**Intended repository path:** `docs/PRODUCT_V1.md`

**Status:** Canonical statement of the product decisions approved in this conversation. Detailed acceptance requirements below operationalise those decisions; explicitly marked open decisions are not approved defaults. This document does not certify implementation, authorise a rebuild, or instruct an agent to implement the entire specification in one task.

## 1. Product definition and north star

> **The easiest and quickest way to get PDF work done, without giving up control of your files.**

atePDF is an AI-first PDF workspace for Mac. Users add documents, explain the outcome they want, and continue working through a conversation. AI interprets intent and orchestrates validated tools. Deterministic local engines perform document operations and return actual files.

The product is not primarily a PDF question-answering chatbot, a cloud document repository, or a traditional tools dashboard with chat added beside it. **The conversation is the workspace; the finished file is the primary output.**

The owner's desired recommendation is: “I use atePDF because it's the easiest and quickest way to do this. My files remain mine, and I am explicitly informed before anything needs to leave my device.” This is a product objective, not a benchmarked superiority claim.

Initial intended users are Mac users handling everyday document tasks who want less tool navigation and explicit control over their files. Specific vertical positioning remains a commercial hypothesis, not an approved restriction to accountants, lawyers, or any other profession.

## 2. Authority and change control

For product intent, the order of authority is: latest explicit owner decisions; this specification; compatible architecture decisions; implementation guidance; historical plans and handoffs. Applicable security and tool-use restrictions still apply. This specification does not make an unimplemented capability real or convert a proposed implementation into an approved one.

The supplied repository audit is evidence about a particular source snapshot, not the product roadmap. This document describes the target; the audit describes the observed starting point. Conflicts must be recorded, not silently resolved by deleting tests or weakening safeguards.

Use stable requirement identifiers from this document in implementation tasks. Preserve existing repository task mappings and real Linear identifiers; the identifiers below are specification references, not Linear tickets. Changes to platforms, monetisation, privacy, AI routing or launch scope require an explicit owner decision recorded with its rationale.

## 3. Approved decisions

| ID | Decision |
|---|---|
| D-01 | Build and launch on Mac first, through both the Mac App Store and direct download. |
| D-02 | Preserve web and iPhone/iPad implementations; their launches must not delay Mac. Android remains deferred. |
| D-03 | atePDF supplies the hosted AI service. A consumer must not need an API key or local development gateway. |
| D-04 | AI remains the conversational orchestration layer, including intentional quick-action routing when AI is enabled. |
| D-05 | PDF processing and document understanding are local first. No document-content transfer without explicit, informed, operation-specific permission. |
| D-06 | No silent local-to-cloud fallback. Declining a proposed transfer leaves the documents unchanged. |
| D-07 | A limited guest allowance leads directly to paid Pro. Registering does not grant an additional free tier or allowance. |
| D-08 | Allowance exhaustion blocks new processing and AI work. It is not an unlimited manual-tools tier. |
| D-09 | Pro offers monthly and annual subscriptions. No lifetime purchase or credit packs in v1. |
| D-10 | Restore the previous conversation, documents and results after relaunch. Retention is configurable. |
| D-11 | Local document understanding and reliable conversational continuity are v1 requirements, not deferred enhancements. |
| D-12 | All 13 capabilities in Section 7 are the v1 target. Protect and Unlock are included. |
| D-13 | Reject unsupported PDFs safely while actively improving compatibility. Never silently discard important document features. |
| D-14 | Use a dedicated local secure password input. Passwords must never enter ordinary chat or model context. |
| D-15 | Ask or confirm when ambiguity warrants it; warn before material quality loss. |
| D-16 | Use brief traditional onboarding, then concise, personable assistant replies and factual result cards. |
| D-17 | Text editing, drawing, signatures, form filling, redaction and annotation creation belong to v2. |

## 4. Release boundary

### 4.1 Included

The Mac release includes the conversational workspace, the 13 local tool capabilities, bounded local document understanding, safe plan execution, result verification, preview/export, result history, local recovery, configurable retention, consent controls, guest metering, Pro subscriptions and both distribution channels.

A small website is required for direct downloads, product information, privacy, support and direct purchase/account management as applicable. **Deferring the web PDF application does not defer this distribution website or the hosted AI/entitlement service.**

The two Mac builds should deliver the same core document experience. Purchasing, packaging and update mechanisms may differ by channel. A temporary channel sequencing change requires owner approval rather than silently redefining the launch.

### 4.2 Excluded

V1 excludes editing existing PDF text, inserting text, drawing, signature workflows, form filling, redaction and annotation creation. Preserving existing forms or annotations during an otherwise supported operation is a separate compatibility requirement, not approval to build an editor.

Also excluded: collaboration, cloud workspace sync, enterprise document management, general-purpose document Q&A/RAG, mobile/web product launches, Android completion, a custom agent-management platform, standalone ZIP tooling, and unapproved additional business models. Setapp is not excluded: it is an intended atePDF v1 distribution channel (owner decision ENV-7, 30 September 2026, recorded in `docs/adr/0011-mac-launch-envelope.md`). Its technical and commercial requirements have not been verified, and Setapp acceptance remains pending SHR-91.

Do not add a local LLM, new framework, new engine or new backend platform simply because it appears in an old handoff. A dependency change must solve a demonstrated requirement through a bounded decision.

## 5. Primary user journey

Install and open atePDF, complete short onboarding, add PDFs or supported images, describe the desired outcome, answer a necessary clarification, review any quality or transfer permission, receive a verified result, preview/save it, and continue working on it in the same conversation.

A representative acceptance journey is:

> **User:** Merge these three PDFs.  
> **atePDF:** I've combined them in the order you added them.  
> **User:** Remove pages 2 and 7.  
> **atePDF:** I've removed those pages. Your originals are unchanged.  
> **User:** Try to get it below 5 MB, then password-protect it.  
> **atePDF:** I may need to reduce image quality. Shall I continue?  
> **User:** Yes.  
> **atePDF:** Enter the password in the secure field below.  
> **Result:** A verified protected PDF, with actual size and an honest statement about whether the target was achieved.  
> **User:** Undo that.  
> **Result:** The preceding committed result is restored.

Example replies are voice and behaviour requirements, not assertions that the prototype supports this complete journey. Protect must execute after operations that require unlocked content; passwords must not be supplied in the conversation.

## 6. Conversation and orchestration

**CONV-01: One coherent workspace.** Chat submissions, quick actions, local discoveries, confirmations and results must share the same authoritative operation history. Quick actions are intentional conversation inputs, not a parallel execution system. Do not implement the previously proposed “bypass AI for quick actions” repair.

**CONV-02: Local state remains authoritative.** AI proposes intent and plans; it does not own document truth, entitlements, permission decisions or success status. The local controller validates references, revisions, supported operations, resource limits and consent before execution.

**CONV-03: Bounded context.** Preserve the current result or collection, selected originals, stable document/page references, relevant previous actions, pending clarification and choices, draft parameters, confirmation state, and permitted local understanding. Model context is a privacy-filtered projection of that state, not the entire transcript or retained file history.

**CONV-04: Reliable continuation.** A question such as “Which page?” followed by “The second one” must continue the pending task. Changes to files, selection or revision invalidate stale choices. A user can cancel a clarification or replace the request without an old answer later executing it.

**CONV-05: Ambiguity.** Resolve clear references locally where supported. Ask a specific question when important information is missing; show a proposed action when the user needs to verify its target or consequences. Do not use model confidence alone as permission to remove uncertain content.

**CONV-06: Multi-step execution.** Validate the complete supported plan before starting. Keep intermediate files staged. Promote only a verified result or explicitly supported result collection. A failed step must not replace the previous valid result or make earlier stages look like a completed request.

**CONV-07: Cancellation and failure.** Cancellation owns import/sample fetching, planning, analysis, transformation and pending result promotion. Late responses cannot mutate a cancelled or restarted workspace. Report actual interruption limits honestly. A provider outage offers a clear retry/status path; it does not silently switch architecture or reset quotas.

**CONV-08: Safe controls.** Cancel, help, privacy controls and access to existing files must not depend on a successful model call. Local UI events can preserve conversational continuity without every non-processing control becoming a paid model request. Offline creation of new results remains an explicit open decision, not an implied free manual mode.

**CONV-09: Execution boundary.** Models cannot run arbitrary scripts, choose unrestricted filesystem paths, alter billing, waive privacy checks or mark outputs verified. Document text is untrusted data, never an instruction source capable of overriding the user or system policy.

## 7. V1 capability requirements

All rows are required target capabilities. Their presence here is not proof of current implementation. Every capability needs a declared support envelope, error path, independent output checks and real Mac acceptance.

| ID | Capability | Minimum v1 behaviour |
|---|---|---|
| TOOL-01 | Merge PDF | Combine selected documents in an explicit order; preserve admitted page appearance, geometry and supported structures. |
| TOOL-02 | Split PDF | Split into specified ranges or individual pages; return a clearly named, ordered collection with usable Mac export. |
| TOOL-03 | Remove pages | Remove explicit physical pages; allow local semantic selection only where validated; refuse removal of every page. |
| TOOL-04 | Reorder pages | Apply an explicit, validated page order. Whole-document and content-derived ordering must resolve to inspectable local references. |
| TOOL-05 | Rotate pages | Rotate selected pages by supported angles while preserving admitted geometry and content. |
| TOOL-06 | Compress PDF | Offer lossless or disclosed quality-changing processing; report actual size reduction; retain the better original when no benefit exists. Size targets are best-effort, never guaranteed before measurement. |
| TOOL-07 | OCR PDF | Add searchable text locally for declared languages and document types; preserve appearance, identify uncertain recognition and allow meaningful recognition review. |
| TOOL-08 | Images to PDF | Convert supported images in an explicit order; handle orientation and page fit predictably; show resulting page count. |
| TOOL-09 | PDF to images | Export selected pages as an ordered image collection with explicit format/resolution choices and stable naming. |
| TOOL-10 | Protect PDF | Create an encrypted PDF requiring the chosen password to open; verify password behaviour independently. Do not describe permission flags as unbreakable access control. |
| TOOL-11 | Unlock PDF | Accept a user-supplied valid password locally and create an unlocked working copy/output. Handle incorrect passwords safely. No password guessing, cracking or undisclosed protection bypass. |
| TOOL-12 | Extract Text | Produce a usable text output with clear page separation/reading-order expectations. Scans require supported OCR or a clear explanation. |
| TOOL-13 | Remove Metadata | Remove an explicitly declared set of metadata fields and verify the saved result. Do not describe this as redaction, sanitisation of all hidden content, or guaranteed anonymisation. |

**TOOL-14: Collections.** Split and PDF-to-images require real multi-output handling, not a success message listing inaccessible files. Display count, names, order and save state. Export to a user-selected destination with collision handling. Standalone ZIP functionality is not necessary to satisfy this requirement.

**TOOL-15: Product truth.** The runtime tool catalogue, compiler, assistant capability descriptions, documentation and exposed controls must agree. Unsupported options must not appear executable. The prototype's single-result contract and narrower page-selection semantics require scoped implementation work, not relaxed validation.

## 8. Local document understanding

**UNDERSTAND-01: Purpose.** The app must interpret relevant document characteristics locally to support natural requests, including distinguishing a likely invoice among imported documents and detecting scanned or blank-page candidates. This must add value beyond filename guessing.

**UNDERSTAND-02: Minimum acceptance scenarios.** Test “put the invoice first,” “OCR the scanned pages,” and identification/confirmation of blank-page candidates on a labelled local corpus. These combine local analysis with the approved tools; they do not authorise a general-purpose document-reasoning platform.

**UNDERSTAND-03: Evidence and uncertainty.** Retain local evidence, provenance and uncertainty for detections. Distinguish an actually blank page from faint marks, signatures, white-on-white content or failed rendering. When a selector is uncertain, ask the user to confirm the specific document/pages rather than inventing certainty.

**UNDERSTAND-04: Private resolution.** Prefer an abstract selector in the AI plan, resolved to concrete files/pages locally. A hosted planner does not inherently need invoice text, dates or vendor names to request “resolve the invoice selector locally.” Bind resolved references to the workspace revision before execution.

**UNDERSTAND-05: Derived data remains content.** Labels, summaries, dates, extracted fields, embeddings, thumbnails and document-content hashes are not automatically safe to transmit merely because they are smaller than a PDF. They require the content-transfer permission boundary in Section 9.

**UNDERSTAND-06: Scope and feasibility.** Local understanding is mandatory; a particular model, hardware feature or inference framework is not. Choose an implementation only after checking the supported Mac envelope. Duplicate-page removal, broad chronological sorting and arbitrary semantic extraction are candidate extensions, not silently added standalone launch requirements. Expand their promise only through explicit scope decisions and verification.

## 9. Privacy and external transmission

### 9.1 Data boundaries

**PRIV-01: Local by default.** PDF/image bytes, rendered pages, OCR/extracted text, document names/paths, content-derived facts, analysis and workspace history remain local unless the user authorises a specified transfer. Passwords and secret material are never eligible for model transmission.

**PRIV-02: Hosted commands are disclosed.** atePDF's AI is hosted. Before first use, explain that user instructions and approved minimal workspace metadata are sent to named services. Keep the send destination clear in the conversation. Free-form instructions can themselves contain sensitive information; pattern matching must never be presented as a guarantee of anonymisation.

**PRIV-03: Separate consents.** Enabling hosted command interpretation is not permission to upload documents, automatically append extracted facts, or send the full local conversation. Pasted document content must not evade the content-transfer flow. The pre-send experience must make any such payload and destination explicit; exact UI treatment is to be designed and tested, not assumed solved by a secret detector.

**PRIV-04: Content-transfer permission.** Before any application-controlled external transfer of document content or derived content, show the exact document/pages or data categories, purpose, all material recipients including an atePDF relay, relevant retention/training information, whether atePDF stores the content, and the local alternative or consequence of declining. Approval must be an affirmative action for this operation.

**PRIV-05: Scope binding.** Bind permission to the content revision, payload scope, recipients, purpose and operation. A multi-step workflow can use one permission only if all proposed transfers are specifically covered. New content, changed recipients or a materially changed purpose requires renewed permission. Do not pre-upload while a permission screen is open.

**PRIV-06: Decline and revoke.** Cancel means no content from that proposed transfer is sent. Existing work remains intact. Revoking permission prevents further covered transfers; do not promise to retract data already transmitted. No background retry may enlarge the approved payload.

**PRIV-07: Technical enforcement.** Enforce permissions at every outbound content boundary, not just a dialog. Include telemetry, crash reports, diagnostics, caches and model context construction in the data-flow review. The controller and gateway must reject unauthorised payloads even if a UI path is wrong.

### 9.2 Provider and export rules

**PRIV-08: Retention claims.** Publish only retention statements supported by the deployed provider, endpoint, features and account settings. For OpenAI, `store:false` alone does not establish zero retention across abuse monitoring and other mechanisms; its documentation separates these controls. [S3]

**PRIV-09: No training-for-discounts.** Do not enable optional provider data sharing or training use for production customer traffic merely to receive free tokens. Any proposal to change that boundary requires a separate owner/privacy decision and appropriate user permission; no such use is approved here.

**PRIV-10: User-directed export.** Saving to a cloud-backed Finder destination is different from an atePDF processing upload. Make that distinction clear; do not claim control over the user's chosen storage, system backups or already-exported copies. No background document sync is authorised.

**PRIV-11: Optional cloud capability.** A consent mechanism does not itself approve a cloud PDF processing service. The 13 tools target local execution. A local failure cannot silently become a hosted job. Any cloud-content feature needs a separately reviewed provider, support promise and task before it can be offered.

Apple's current review guidelines also require disclosure and explicit permission for sharing personal data with third-party AI. That is an external constraint, not a substitute for the stricter document-level product rule here. [S1: 5.1.2(i)]

## 10. Compatibility, integrity and passwords

**PDF-01: Originals are immutable.** Imported source files must not be overwritten. Transformations create new results. Export collisions require an explicit decision; failed jobs leave originals and the previous valid result available.

**PDF-02: Per-operation support matrix.** Record supported/rejected forms, annotations, links, outlines, tagged structures, fonts, crops, rotations, images, encryption and malformed inputs per tool. “Opens in the preview” is not proof that every transformation safely preserves the file.

**PDF-03: Expand safely.** Improving real-world compatibility is v1 work. Do not perpetuate blanket exclusions without investigation; do not remove guards just to raise acceptance. If a structure cannot be preserved, reject with a specific explanation. This specification does not approve flattening or discarding it after a generic warning.

**PDF-04: Independent verification.** Match checks to the operation: structure/readability; expected pages/order; boxes/rotation; text; representative rendering; annotation/destination preservation where supported; encryption behaviour; metadata fields; output collection completeness. Count and normalised text alone are not a visual-fidelity certificate.

**PDF-05: Semantic correctness.** Verify that the requested pages were changed, not merely that an output has the expected count. Keep evidence for image-only pages, crop origins, OCR placement and mixed sizes. A model saying “done” is not evidence.

**PDF-06: Secure password path.** Password prompts use a dedicated secure control and opaque local secret references in plans. Never log, persist in chat, copy into analytics or include passwords in provider requests. Wrong passwords fail without partial import or false success. Recognised secrets accidentally typed in chat must be withheld from outbound requests and redacted from the retained transcript; detection is defence-in-depth, not a guarantee that arbitrary free text is harmless.

**PDF-07: Decrypted copies.** Explain when an unlocked local copy is retained. Workspace persistence must not quietly leave decrypted copies in unprotected generic caches. Use a reviewed protected local storage design; do not retain the user's document password by default. Exporting an unlocked PDF is an explicit user operation.

**PDF-08: Encryption implementation.** Select a maintained local engine and supported encryption profile through a technical decision and independent interoperability tests. Do not assume the current writer supplies Protect/Unlock simply because an API/schema exists. Signed/permission-restricted PDFs need an explicit support policy; do not imply signature validity survives modification.

## 11. Workspace persistence and resource management

**STATE-01: Restore previous work.** Relaunch must restore the previous conversation, retained originals/results, current selection, committed operation history and a safe draft state. Restore from durable local state, not from a model-provider transcript. A full multi-workspace library is not required in v1.

**STATE-02: Crash consistency.** Save state atomically and recover the last valid checkpoint. Never resume a paid request, document transfer or destructive/quality-changing step automatically after a crash. Revalidate expired confirmations, permissions, file access and credentials before resuming.

**STATE-03: Configurable retention.** Provide visible retention controls, storage usage and clear-workspace/delete-local-data actions. Explain effects on imported copies, results, previews, extracted text, local analysis, chat and diagnostics. Exact retention choices/defaults remain open; they must support the chosen restore experience unless the user selects an ephemeral mode.

**STATE-04: Protected persistence.** Keep app-owned files in an appropriate private local store with a reviewed at-rest protection/key-management design. Authentication tokens belong in appropriate secure OS storage, not plaintext project files. Backups and decrypted-document handling must be part of that review. “Delete” means removing app-controlled data, not a promise of forensic erasure of SSDs or third-party backups.

**STATE-05: Bounded memory.** Do not keep every original, preview and intermediate as an ever-growing collection of full in-memory copies. Separate durable history, active references and evictable caches. Never silently prune the current result or data needed for a promised Undo state.

**STATE-06: History and Undo.** One Undo restores the preceding committed user workflow, including a result collection where relevant. It is not a redo implementation and does not unsave an already-exported file. History projection must not breach planner file-count limits merely because the user has completed many tasks.

**STATE-07: Missing files and storage pressure.** Recover or request access explicitly if an external file was moved or its permission expired. Handle disk-full, sleep/wake, backgrounding and temporary-file cleanup without corrupting durable state. Technical limits are based on measurements and must be communicated before predictable failure where practical.

## 12. Guest allowance, accounts and Pro

### 12.1 Approved commercial structure

**BILL-01:** Offer a useful limited guest experience without mandatory account creation or a personal AI key. atePDF pays for the hosted AI service.

**BILL-02:** After the allowance is exhausted, block new PDF processing and new paid AI work until a valid entitlement or approved allowance becomes available. Do not offer additional free credits merely for registration. Do not introduce an unlimited manual-tool escape around this commercial boundary.

**BILL-03:** Pro is available monthly and annually. Exact prices, currencies, allowance size, reset schedule, Pro limits and refund rules are not selected by this specification. Do not advertise “unlimited” before a sustainable and disclosed service policy exists.

### 12.2 User-control safeguards

The operational interpretation of “everything stops” is **new work stops**, not “the user's documents become inaccessible.” These safeguards implement the stated file-ownership promise:

**BILL-04:** At exhaustion or expiry, retain access to existing originals/results, preview, saving/exporting already-created outputs, recovery/Undo to retained results, deletion, privacy settings, help, restore-purchase and subscription management. Do not charge twice to release a result already produced within the user's allowance.

**BILL-05:** Show the applicable allowance and consequence before starting new work. Once an admitted workflow begins, a renewal-status or quota change must not unexpectedly trap its output. Further cloud-content transfer still needs its own permission.

### 12.3 Enforcement and unresolved metering

**BILL-06:** Enforce hosted quotas and entitlements server-side. Use a privacy-conscious guest installation identity and anti-abuse controls; do not rely on a client-side counter as proof of entitlement. Accept that anonymous use is not perfect person-level identity. No invasive device fingerprinting is authorised.

**BILL-07:** Keep commercial metering separate from resource safety and provider cost controls. A safety limit must never falsely say “upgrade” when payment cannot make that job safe. Provider budgets need per-request/concurrency bounds, idempotency and global spending protection independent of marketing allowances.

**BILL-08:** The visible meter must not unexpectedly charge for every clarification, internal model retry or tool step. Recommended accounting unit: a user-requested workflow, with provider calls metered separately internally. The exact charging event and failure/cancellation refund policy remain open and must be resolved before implementing the production ledger.

**BILL-09:** Support valid purchase restoration and channel-aware subscription management. A product account may link purchases and devices but is not a free top-up mechanism. The need for account creation at purchase, login method, device limit and cross-channel linking design remain open. Do not force a separate account merely because one was present in an older plan.

**BILL-10:** Test purchase success, cancellation, pending transactions, renewal, expiry, billing problems, refund/revocation, reinstall/restore and duplicate events. Verified server/payment state, not a model reply or client toggle, determines entitlement. Local recovery remains available during service outages.

## 13. Mac experience and assistant voice

**MAC-01: Desktop acceptance.** Validate Finder drag/drop, native file selection, mouse/trackpad behaviour, resizable windows, focus, keyboard navigation, clipboard, native save/export and reopening saved outputs on the actual Mac build. An iPhone simulator or resized Chrome window is not Mac acceptance.

**MAC-02: Navigation and control.** Provide predictable Mac commands for opening files, saving, settings and cancellation, with correct focus-sensitive Undo behaviour. Do not steal text-editing shortcuts while the user is editing a message. Avoid adding Finder extensions or multiwindow features merely to satisfy “Mac-native.”

**MAC-03: Accessibility.** Test the critical journey with keyboard-only interaction and VoiceOver. Result/step announcements must be understandable, focus must restore appropriately, and large text/window resizing must remain usable. OCR review needs a selectable/searchable or otherwise accessible text presentation; a raster-only preview is insufficient for that promise.

**MAC-04: Existing design.** Preserve the approved atePDF name, 8-based identity and conversational layout. Fix observed usability problems, not the entire visual direction. Mac-first does not authorise a SwiftUI rewrite. Dark mode is not a launch gate unless separately approved.

**UX-01: Onboarding.** Use a short traditional introduction covering how to ask for outcomes, local files versus hosted instructions, content-transfer permissions, local workspace retention, and the limited free allowance. Do not require signup or payment before the guest experience. A privacy explanation cannot substitute for later operation-specific content permission.

**UX-02: Voice.** Sound like a capable assistant: brief, specific, warm and factual. Avoid generic “operation completed successfully,” exaggerated certainty and long explanations after routine work. Personalise through the actual task, not invented observations.

| Situation | Example voice |
|---|---|
| Successful merge | “I've combined the three PDFs in the order you added them.” |
| Successful compression | “That brought it from 8.2 MB to 3.7 MB. I reduced image quality slightly.” |
| Missed size target | “I got it to 5.4 MB, but couldn't reach 5 MB within the approved quality setting.” |
| Unsupported structure | “This file has annotations I can't safely preserve in this operation yet. I haven't changed it.” |
| Ambiguous target | “Which of these two files should come first?” |
| Password needed | “Enter the password in the secure field below. It stays on your Mac.” |
| Free allowance exhausted | “You've used your free allowance. Upgrade to keep working. Your existing files are still available.” |

**UX-03: Receipts, not guesses.** Result cards show actual name, type, size, page/item count, current/earlier status, quality caveats and local save state. Distinguish “created,” “verified,” “saved” and “share sheet opened.” Never say “saved” before the destination write succeeds.

**UX-04: Honest progress.** Display real stages and cancellation state; do not fabricate percentage progress or expose supposed model thoughts. Do not promise a compressed size or document classification before it has been established.

## 14. Architecture and production services

**ARCH-01: Preserve the working foundation.** The supplied audit describes Expo/React Native/assistant-ui, Mac Catalyst, a local store/controller, strict contracts, shared PDF writing and Apple-specific inspection/preview/OCR bridges. Keep those boundaries unless a bounded technical investigation proves an approved requirement cannot be met appropriately. [A1: Sections 3, 16]

**ARCH-02: Local and remote separation.** Keep documents, local understanding, secret handling and execution on the Mac. Use production services for authenticated AI access, approved metering, purchases/entitlements and minimal operations support. Hosted document processing is not implied.

**ARCH-03: Safe provider access.** Production users must not run developer pairing scripts, install Node or supply the company's API key. Company provider credentials stay server-side. Fix/validate provider destinations and response sizes; reject untrusted endpoint overrides. A private-development token is not production identity.

**ARCH-04: Boundaries to preserve.** Keep presentation, workspace state, planning/context projection, local selectors, consent, tool execution, verification, persistence and commercial authorisation separately testable. Do not let a model output bypass any of them.

**ARCH-05: Controlled engine changes.** Protect/Unlock, collections, persistence and local understanding may require new implementation. Each change needs a compatibility, resource and licensing assessment. Do not mandate that every new capability use the current library, and do not replace the entire engine family to add one tool.

**ARCH-06: Reproducibility.** Pin supported build/runtime prerequisites; bind generated assets and product knowledge to the release source; make relevant checks runnable from a clean checkout. Preserve original evidence, the fixed prototype tag, user work and private configuration.

## 15. Distribution and commercial delivery

**DIST-01: Mac App Store.** Implement the channel-appropriate purchase, restore and entitlement path. The baseline plan is StoreKit in-app subscriptions, compliant with the applicable storefront rules. Apple governs feature purchases, subscriptions and access to purchases made elsewhere; do not assume direct-checkout links or cross-channel unlocking are permitted identically everywhere. [S1: 3.1.1–3.1.3]

**DIST-02: Direct distribution.** Use a properly Developer ID-signed, notarised release and a verified update path. Apple's Developer ID documentation covers distribution outside the Mac App Store and notarisation. Local ad-hoc builds are not the shipping process. [S2]

**DIST-03: Channel integrity.** Keep receipts, update delivery, bundle identifiers, storage ownership and sandbox entitlements explicit. App Store builds must use the permitted App Store delivery/update path; direct builds require their own reviewed updating mechanism. Sandbox and packaging constraints must be verified for the Store build. [S1: 2.4.5]

**DIST-04: One product, not duplicate charges.** Aim for one recognised Pro entitlement across the chosen channels where the verified payment/account design permits. Show where to manage the active subscription and prevent accidental double subscription. Do not promise cross-channel purchase recognition until both policy and implementation are verified.

**DIST-05: Launch materials.** Provide accurate listing/download copy, real screenshots, supported Mac/OS requirements, limitations, privacy policy, support/contact information, subscription terms and complete required notices. The legal seller, payment provider and territorial rollout remain open. No incorporation or seller identity is presumed.

**DIST-06: Release authority.** Testing and preparing distribution do not authorise publishing, charging customers, accepting new provider terms or spending money. Owner release approval is a separate gate. Recheck current external policies at implementation and submission rather than treating this dated document as permanent policy advice.

## 16. Verification and release gates

All 13 capabilities and the approved local-understanding/persistence promises are public-v1 scope. Internal builds can be narrower and clearly labelled. Removing a launch requirement requires an explicit scope change, not relabelling an unfinished item as “later.”

| Gate | Evidence required |
|---|---|
| G-01 Product truth | Approved capability/support matrix, accurate assistant knowledge and UI; no advertised unimplemented feature. |
| G-02 Conversation | Real multi-turn continuation, clarification, quick-action routing, current-result references, confirmation, cancel and failure recovery. |
| G-03 Document correctness | Representative real/synthetic corpus, per-operation saved-output checks, page identity, geometry, text/rendering and declared structure preservation. |
| G-04 Local understanding | Labelled local examples for invoice selection, scanned pages and blank-page candidates; uncertainty and correction tests. |
| G-05 Privacy and secrets | Outbound-payload inspection proving no unauthorised content, derived-data or secret transfer, including negative/cancel/retry/crash paths. |
| G-06 Persistence/resources | Quit/relaunch, force termination, retained history, long-session use, memory/storage pressure, retention cleanup and no stale-job replay. |
| G-07 Mac usability | Actual supported Mac builds/devices, keyboard/VoiceOver, Finder import, save/reopen, resizing and sleep/wake. |
| G-08 Commercial | Guest exhaustion, no registration top-up, valid Pro, channel-specific restore/renewal/revocation, duplicate-event safety and access to existing work after expiry. |
| G-09 Delivery/security | Reproducible builds, relevant CI, reviewed network/auth boundaries, required notices, verified signing/distribution and recovery/update procedure. |
| G-10 Owner release | Remaining defects/limitations and source/build identities reviewed; explicit approval for each public channel. |

The corpus must include supported ordinary PDFs and explicit rejection cases: real annotations/links/forms/outlines, scans/hybrid pages, mixed sizes/crops/rotation, unusual fonts, image-heavy files, correct/wrong passwords, damaged structures and resource-boundary inputs. Measure rejected-file rate separately from failed transformations; never inflate compatibility by excluding rejects from the denominator.

Tests must bind evidence to a source/build and distinguish current from historical runs, helpers from applications, simulators from physical devices, and generated screenshots from reviewed visual comparisons. No missing critical test is a pass. A known unauthorised transfer, source-file corruption, secret leak, purchase bypass or unrecoverable data-loss defect blocks release.

Performance budgets for representative jobs, startup, cancellation, memory and storage must be measured on the chosen minimum Mac and recorded before release. This document does not invent page/byte limits, latency promises, launch dates or completion percentages.

## 17. Learning and diagnostics

**MEASURE-01:** Measure whether people finish intended tasks, save useful results, continue a conversation, return and convert. Track import rejection separately from processing failure, clarification failure and user cancellation.

**MEASURE-02:** The proposed first learning milestone is 100 genuine external users completing tasks, with repeat-use and willingness-to-pay evidence. This is a learning target, not a substitute for release safety or an already approved conversion threshold.

**MEASURE-03:** Keep compulsory service metering separate from optional product analytics. Never collect document bytes, names, content, prompts, screenshots or semantic document labels by default for analytics. Event taxonomy, opt-in behaviour, vendor, retention and access policy require a privacy-reviewed decision. No session replay is authorised.

**MEASURE-04:** Support diagnostics must be redacted and user-reviewable before upload. Synthetic fixtures, not customer documents, belong in routine regression evidence. Necessary billing/security records require their own accurate retention disclosure.

## 18. Audit-to-requirement mapping

The source here is the owner-supplied `AUDIT_PROTOTYPE_V0.md`, dated 29 September 2026. The owner reported audit commit `05bd7b1` and unchanged snapshot `prototype-v0` at `5a6c0c5`. The report itself identifies audited HEAD `06539eb28460cd3055e846b7caf509e1b0794a8a` and says the source differences were documentation only. These identities and findings have not been independently rechecked for this specification. [A1]

| Supplied finding | Product treatment | Requirement references |
|---|---|---|
| Quick actions use AI when enabled | Intentional; preserve routing. Outage handling is a separate issue. | D-04; CONV-01, 07–08 |
| Clarification context/choices lost | Conversational v1 blocker. | CONV-03–05; G-02 |
| Sample-fetch cancellation not owned | Fix lifecycle ownership and late completions. | CONV-07; STATE-02 |
| Retained outputs breach 40/100 request boundaries | Separate active context, durable history and memory. Do not merely raise caps. | STATE-05–06 |
| Four real executors versus broader registry | Implement the missing approved tools; align actual capability descriptions. | TOOL-01–15; G-01 |
| Broad complex-PDF rejection | Investigate and expand safe support; keep precise refusal until proven. | PDF-02–05; G-03 |
| Weak visual/order preservation oracle | Add operation-appropriate independent evidence. | PDF-04–05 |
| No substantial local semantic document understanding established | New bounded v1 work; do not imply model sees contents today. | UNDERSTAND-01–06 |
| Memory-only workspace | Implement protected local persistence and recovery. | STATE-01–07 |
| Provider endpoint/privacy/secret concerns | Enforce production boundaries and truthful disclosures. | PRIV-01–11; ARCH-03 |
| Decode/resource and native acceptance gaps | Test actual Mac allocation/cancellation and release envelopes. | STATE-05–07; G-06–07 |
| Private gateway, disabled commerce, no public pipeline | Build reviewed production AI, entitlements and channel delivery. | BILL-01–10; DIST-01–06 |
| Conflicting documents and historical evidence | Reconcile active authority; preserve historical provenance. | Section 2; ARCH-06 |

Mapping is not a new audit, proof of reproduction or authority to fix every row simultaneously.

## 19. Open decisions and bounded investigations

These do not reopen the approved product direction. Resolve them before their dependent implementation or public claim; do not fill them with attractive defaults.

| ID | Decision/investigation | Must precede |
|---|---|---|
| OPEN-01 | Minimum macOS version, supported CPU/hardware envelope and real-device matrix | Local inference/engine selection and release claims |
| OPEN-02 | Guest quantity, one-time versus recurring allowance, charging event and failure/refund accounting | Production metering |
| OPEN-03 | Monthly/annual prices, currencies, Pro limits and actual cost budget | Checkout/paywall and public pricing |
| OPEN-04 | Direct payment provider, legal seller, account/linking method and device policy | Billing implementation and channel linking |
| OPEN-05 | Retention defaults/options, encrypted local store, backup treatment and recovery policy | Persistence implementation |
| OPEN-06 | Tested local-understanding method, scope/confidence standards, languages and correction UI | Semantic claims and understanding rollout |
| OPEN-07 | OCR languages, image formats/export settings, encryption profile, metadata fields and complex-PDF support envelope | Capability contracts and public tool claims |
| OPEN-08 | Exact pre-send consent experience for sensitive user-entered text and document-derived payloads | Hosted production use |
| OPEN-09 | Hosting/model choice, provider retention/settings, operational budgets and outage/offline policy | Production AI launch |
| OPEN-10 | Update mechanism, territory rollout, privacy/analytics/support policy and evidence retention | Channel release |

Engineering investigations must be bounded, use explicit hypotheses and produce a decision/evidence rather than speculative infrastructure. A model or library being mentioned in the audit does not settle these choices.

## 20. Development handoff and Linear

### 20.1 Immediate next task: documentation reconciliation only

Add this specification at `docs/PRODUCT_V1.md`, preserving existing unrelated work. Update the existing README/AGENTS product-authority references and canonical product/decision documents only where necessary to eliminate active contradictions. Keep historical handoffs/audits intact and clearly marked historical rather than deleting them.

Record Mac-first, intentional AI routing, strict content-transfer consent, local understanding, the 13 tools, guest-to-paid structure and v2 editing exclusions as explicit decisions. Do not create a second sprawling documentation tree or duplicate all content into every file.

Do not overwrite runtime-facing `AI_PRODUCT_KNOWLEDGE.md` with the target roadmap or make it advertise unimplemented tools. Runtime capability knowledge must continue to describe what the current build actually supports; the PRD describes what is to be built.

Return a concise list of changed documents, remaining contradictions and open decisions. Do not change application code, relax guards, install dependencies, run paid requests, rewrite history, create unrequested external issues, push, merge or deploy. Stop after the documentation task.

### 20.2 Then establish the atePDF Linear project

Use one atePDF v1 project initially, with milestones or labels for conversation/privacy, document tools/compatibility, persistence/Mac quality, commercial delivery and release. Reuse existing workspace/team/project identities where appropriate; do not create duplicates. Do not invent issue IDs.

First populate a small prioritised set of ready tasks and bounded decision/investigation tasks. Preserve other approved scope as backlog; do not make every task “ready” at once. Link each issue to this specification, relevant audit evidence and existing task mapping.

Every ready issue must contain: one outcome; source references; explicit in/out scope; dependencies; acceptance criteria; required tests/evidence; privacy/entitlement implications; and an instruction to stop after its bounded deliverable. A verified behaviour change, not a large diff, is the completion criterion.

The first engineering work must follow the accepted dependency order. Do not reinstate the withdrawn quick-action bypass task. A reproducible current-source Mac baseline and the conversation/privacy architecture decisions are appropriate foundation work; their exact tickets follow source-aware planning, not automatic execution of this document.

### 20.3 Product safeguard

> **Do not optimise away the conversation, privacy boundaries, or user control to make implementation easier. Do not expand the scope merely because an agent can generate more code.**

## 21. Source and decision record

**Owner decisions:** Explicit choices in this conversation, including the Mac-first change, consent requirement, Protect/Unlock additions, intentional AI routing, and answers to the 20 product questions. Earlier assistant proposals are not owner decisions where contradicted or left unresolved.

**[A1] Supplied source audit:** `docs/AUDIT_PROTOTYPE_V0.md`, pasted in full by the owner, dated 29 September 2026, plus the owner's audit closeout. Relevant sections are identified above. No fresh repository access or tests were performed to write this specification.

**[S1] Apple, App Review Guidelines.** Reviewed 29 September 2026. Relevant sections: 2.4.5, 3.1.1–3.1.3 and 5.1.2(i). Policy statements in this document are limited implementation constraints and must be rechecked for the intended storefront before release.  
`https://developer.apple.com/app-store/review/guidelines/`

**[S2] Apple, Signing Mac Software with Developer ID.** Reviewed 29 September 2026. Reference for direct Mac distribution, signing and notarisation.  
`https://developer.apple.com/developer-id/`

**[S3] OpenAI, Data controls in the OpenAI platform.** Reviewed 29 September 2026. Reference for distinguishing application-state settings, abuse monitoring and other retention mechanisms. Not a verification of atePDF's actual account settings or contractual eligibility.  
`https://developers.openai.com/api/docs/guides/your-data`

---

**End of specification.** This is the product destination and its guardrails. Implementation proceeds through prioritised, reviewable tasks, not one instruction to “build everything.”
