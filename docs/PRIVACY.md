# Privacy

Current-source record based on `prototype-v0` and the separately recorded quick-action change, 29 September 2026. This is not a public privacy policy, provider-retention contract or legal approval.

## Implemented data boundary

PDF processing runs on the device. The browser uses local workers/readers/OCR; Apple uses local PDFKit/Vision/ImageIO plus the shared writer. No cloud PDF-processing fallback is implemented. Store, controller and planner serialization are separate.

The preserved prior uncommitted change makes explicit quick-action buttons local: they send no model-planning request and consume no provider allowance. Background/user-initiated connection controls are separate. This describes current behavior, not v1 D-04/CONV-01; the approved target retains intentional enabled-AI orchestration and this documentation task does not change routing.

The planner DTO positively projects opaque file refs, page counts, byte sizes, selections/focus, revision and supported capabilities. It does not serialize file bytes, preview images, extracted/OCR text, local filenames, paths, passwords or local checksums from artifacts. Only completed, validated responses can propose local operations. Output PDF bytes and document content are not automatically sent; later requests can include permitted metadata about retained results. User-entered instruction risks are described below.

**Free-form instructions are a separate boundary.** They are sent to the provider when AI is enabled. Local guards alias known filenames and reject some paths, secrets and extracted-text matches, but cannot guarantee that arbitrary sensitive typed text or short document excerpts are detected. “Anonymous metadata” means opaque references, not formal anonymity: exact sizes/counts and session context can remain linkable. The current UI disclosure overstates exclusion guarantees; record this as a defect, not a reason to silently change the approved Send flow.

## Approved v1 privacy target

[PRODUCT_V1.md Section 9](PRODUCT_V1.md#9-privacy-and-external-transmission) is authoritative. Documents and derived content stay local by default; enabling hosted commands does not authorize content upload or full-history projection. Before a separately approved content transfer, disclose what leaves, why, all material recipients, relevant retention/training facts, whether atePDF stores it, and the consequence of declining; obtain affirmative operation-specific permission bound to scope and revision. Cancel means no proposed payload is sent. No silent local-to-cloud fallback. Passwords/secrets never enter ordinary chat or model context.

This supersedes a blanket product-level prohibition on all possible future consented content transfer; it does not relax current runtime exclusions or approve a cloud processing feature. Operation-specific enforcement, sensitive pasted-text handling and protected persistence are target requirements, not proven implemented controls. Exact consent UI and provider settings remain OPEN-08/09. The supplied spec's external policy references must be rechecked for implementation/release; no current policy or account-setting verification was performed here.

## Storage and deletion truth

| Data | Current handling | Limit |
|---|---|---|
| Browser documents, chat and history | Session memory, immutable originals, retained results | No persistent workspace recovery; Clear is not secure erasure |
| Apple selected/working/export copies | Local app/cache and OS file/share surfaces | Some share copies persist until next startup; full physical-device protection/backup evidence incomplete |
| Saved PDF | User-directed destination copy | Files/cloud destinations are controlled by the user's OS/provider; app cannot promise all destinations remain on-device |
| OpenAI key | Masked local entry, private plaintext local config and gateway memory | Not OS Keychain; no credential inspected during audit |
| Pairing/bearer | Expiring one-use code; native memory-only bearer/server hashed session | User-initiated clipboard copy is OS-managed; no production account model |
| Rejected composer secret | Transport blocked if recognized, but raw submitted text is already displayed in chat | Local retention defect; dedicated masked key field has a separate path |
| Logs/evidence | Local operational metadata and synthetic test artifacts | Evidence publication requires review; provider/OS retention not established |

No active application analytics integration was found. Provider calls explicitly request `store:false` and disable SDK telemetry; neither establishes complete provider-side deletion/retention guarantees. See [ANALYTICS.md](ANALYTICS.md).

## Required decisions and evidence

Before public distribution, resolve accurate user-facing disclosures, provider/key ownership and retention terms, workspace recovery/retention, native scratch-copy lifecycle, export destinations, OS privacy declarations, and production logging. Preserve the existing positive-projection and outbound canary tests. Add explicit synthetic cases for free-form short excerpts and rejected-secret chat retention only in an authorized testing phase.

Detailed source citations and historical test limits: [security/privacy audit](audit/SECURITY_PRIVACY_AI_COMMERCE_AUDIT.md), especially F03/F04. No document, credential or current owner session was read or sent as part of this audit.
