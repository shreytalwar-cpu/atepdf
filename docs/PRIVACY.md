# Privacy

Source-based record at `prototype-v0`, 29 September 2026. This is not a public privacy policy, provider-retention contract or legal approval.

## Implemented data boundary

PDF processing runs on the device. The browser uses local workers/readers/OCR; Apple uses local PDFKit/Vision/ImageIO plus the shared writer. No cloud PDF-processing fallback is implemented. Store, controller and planner serialization are separate.

The planner DTO positively projects opaque file refs, page counts, byte sizes, selections/focus, revision and supported capabilities. It does not serialize file bytes, preview images, extracted/OCR text, local filenames, paths, passwords or local checksums from artifacts. Only completed, validated responses can propose local operations. Output PDF bytes and document content are not automatically sent; later requests can include permitted metadata about retained results. User-entered instruction risks are described below.

**Free-form instructions are a separate boundary.** They are sent to the provider when AI is enabled. Local guards alias known filenames and reject some paths, secrets and extracted-text matches, but cannot guarantee that arbitrary sensitive typed text or short document excerpts are detected. “Anonymous metadata” means opaque references, not formal anonymity: exact sizes/counts and session context can remain linkable. The current UI disclosure overstates exclusion guarantees; record this as a defect, not a reason to silently change the approved Send flow.

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
