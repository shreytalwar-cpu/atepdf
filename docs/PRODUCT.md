# Product

Canonical index as of the 29 September 2026 freeze, `prototype-v0`. Describes established intent and verified source, not a new specification or permission to develop. See [the consolidated audit](PROTOTYPE_V0_AUDIT.md) for capability statuses and unresolved questions.

## Established purpose and audience

**atepdf** helps everyday users doing occasional PDF tasks add files, describe a change, inspect its result and save a copy in one conversation. The approved identity is the lowercase name and rounded blue/violet/pink numeral 8. The brand board governs name/logo only. Chat contains instructions, choices, progress, results, previews, saving and follow-ups. No tool sidebar or editing suite is established.

The active implementation is one Expo/React Native/assistant-ui interface for web, iPhone/iPad and Mac Catalyst. Android is deferred. These owner decisions supersede the initial Next/SwiftUI/Compose/no-assistant-ui handoff choices; see [DECISIONS.md](DECISIONS.md).

## Current capability boundary

Supported simple PDFs can be imported, merged in original import order, have physical pages removed, receive English OCR on eligible scanned pages, and undergo bounded JPEG image recompression. The local controller validates outputs with an independent reader before exposing results. Inline preview is read-only; Undo returns to an earlier result during the same session. Original bytes are immutable. Browser download, Mac confirmed document export and iOS share-sheet completion are different events.

This is not a general PDF editor. Password-protected/encrypted PDFs and several complex PDF structures are rejected. Forms, annotations/links and bookmarks are not supported merely because an upstream library can read them. OCR is bounded and the current preview does not expose recognized text for quality review. See [TESTING.md](TESTING.md) and [the engine audit](audit/PDF_AND_TESTING_AUDIT.md).

AI is optional. When enabled and authorized, GPT-6 Luna selects local workflow tools or answers bounded product questions; the gateway does not process PDFs. Local supported quick actions remain available without AI. Arbitrary conversation, document question-answering and reliable multi-turn clarification are not established capabilities. No app-defined 2,000-output-token cap remains; request allowances remain bounded. No allowance is extended by this document.

Imported files, chat, drafts and results live in session memory. **Saving creates a copy; it does not persist the workspace.** No autosave, crash recovery, account history or sync is implemented. Removing arbitrary byte limits does not remove device-memory, page-count or decoded-work limits.

## Release boundary

Current product truth is a private local prototype with source-specific browser/simulator evidence. Physical-device acceptance, current Mac interaction, production authentication/distribution, commercial/legal decisions and broad compatibility remain open. No public release, migration, price, subscription, entitlement or seller is approved by this audit.

Existing detailed context: [application product record](../apps/universal/PRODUCT.md), [platform capabilities](PLATFORM_CAPABILITIES.md), [retained task mapping](IMPLEMENTATION_STATUS.md). Historical next-task instructions are paused by the freeze.

## Unresolved

Decide the minimum supported PDF structures, recovery promise, supported browser/OS versions, AI account/key ownership and failure behavior, local-first offline meaning, acceptable resource limits, production distribution, and free/paid product boundary before choosing implementation work. No answer is invented here.
