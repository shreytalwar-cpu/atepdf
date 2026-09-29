# Product

Current implementation record: audited `prototype-v0` plus the separately recorded quick-action working-tree change. The authoritative approved destination is [PRODUCT_V1.md](PRODUCT_V1.md). Its Mac-first launch, AI orchestration, 13 tools, local understanding, continuity, persistence and commercial requirements are targets, not implemented features. See [the source audit](AUDIT_PROTOTYPE_V0.md), [audit index](PROTOTYPE_V0_AUDIT.md) and [later status](IMPLEMENTATION_STATUS.md) for evidence.

## Current product and interface

**atepdf** helps everyday users doing occasional PDF tasks add files, describe a change, inspect its result and save a copy in one conversation. The approved identity is the lowercase name and rounded blue/violet/pink numeral 8. The brand board governs name/logo only. Chat contains instructions, choices, progress, results, previews, saving and follow-ups. No tool sidebar or editing suite is established.

The active implementation is one Expo/React Native/assistant-ui interface for web, iPhone/iPad and Mac Catalyst. Android is deferred. These owner decisions supersede the initial Next/SwiftUI/Compose/no-assistant-ui handoff choices; see [DECISIONS.md](DECISIONS.md).

## Current capability boundary

Supported simple PDFs can be imported, merged in original import order, have physical pages removed, receive English OCR on eligible scanned pages, and undergo bounded JPEG image recompression. The local controller validates outputs with an independent reader before exposing results. Inline preview is read-only; Undo returns to an earlier result during the same session. Original bytes are immutable. Browser download, Mac confirmed document export and iOS share-sheet completion are different events.

This is not a general PDF editor. Password-protected/encrypted PDFs and several complex PDF structures are rejected. Forms, annotations/links and bookmarks are not supported merely because an upstream library can read them. OCR is bounded and the current preview does not expose recognized text for quality review. See [TESTING.md](TESTING.md) and [the engine audit](audit/PDF_AND_TESTING_AUDIT.md).

In the current prototype, AI is optional. When enabled and authorized, GPT-6 Luna selects local workflow tools or answers bounded product questions; the gateway does not process PDFs. The preserved uncommitted quick-action change dispatches explicit buttons locally regardless of AI status. That behavior conflicts with v1 D-04/CONV-01, which intentionally retain enabled-AI orchestration; no routing change is authorized by this documentation task. Arbitrary conversation, document question-answering and reliable multi-turn clarification are not established capabilities. No app-defined 2,000-output-token cap remains; request allowances remain bounded. No allowance is extended by this document.

Imported files, chat, drafts and results live in session memory. **Saving creates a copy; it does not persist the workspace.** No autosave, crash recovery, account history or sync is implemented. Removing arbitrary byte limits does not remove device-memory, page-count or decoded-work limits.

## Release boundary

Current product truth is a private local prototype with source-specific browser/simulator evidence. Physical-device acceptance, current Mac interaction, production authentication/distribution, commercial/legal decisions and broad compatibility remain open. The audit approved no public release or commercial setup. V1 now selects both Mac distribution channels and monthly/annual Pro, but does not approve actual publication, prices, allowances, a seller or payment implementation.

Existing detailed context: [historical implementation-era product record](../apps/universal/PRODUCT.md), [platform capabilities](PLATFORM_CAPABILITIES.md), [retained task mapping](IMPLEMENTATION_STATUS.md). Historical next-task instructions are paused by the freeze.

## Remaining target decisions

Use [PRODUCT_V1.md Section 19](PRODUCT_V1.md#19-open-decisions-and-bounded-investigations), OPEN-01–10. Mac-first, both distribution channels, company-supplied AI, workspace restoration, the 13 tools and guest-to-paid subscriptions are settled direction. Their implementation and acceptance are not established; exact limits, prices, compatibility envelope, providers and storage/account/update designs remain open. V2 editing exclusions are in Section 4.2. Do not expand runtime claims from this target.
