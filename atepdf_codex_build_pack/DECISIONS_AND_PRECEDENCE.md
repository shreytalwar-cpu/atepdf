> **v6 brand override:** The final product name is **atepdf** (lowercase), with the approved gradient numeral **8** logo. Read [brand/APPROVED_BRAND.md](brand/APPROVED_BRAND.md) and [brand/brand.json](brand/brand.json). The uploaded brand board is not a UI specification. Keep the earlier approved drop-and-instruct interface, scope and local-processing architecture. Older filenames and protected source labels are retained for compatibility.

# Decisions, precedence and authority
**Version 7.0 | 28 September 2026**

This file resolves the conversation's changes of direction. It does not override higher-priority system instructions, repository safety rules or an explicit later owner decision.

## Fresh-start decision
The latest owner instruction authorises a fresh atepdf build. Work in a new separate Git root, not the Attenlo PDF checkout or a worktree/fork of it. Read-only source learning and narrowly justified helpers/tests preserve useful knowledge; they do not preserve the old app by default. No old customer/data/purchase migration is authorised. Create new development namespaces and approve production identities later.

`fresh-start/README.md`, `fresh-start/NEW_REPOSITORY_BLUEPRINT.md` and `fresh-start/LEGACY_LEARNING_PROTOCOL.md` settle destination and learning questions. Historical summaries/manifests from v6 and earlier are non-executable provenance. Unavailable old source means learning is pending, not that the build must stop.

## Priority within this handoff
1. This final decision register and `STACK_DECISION.md` settle product/stack conflicts in prior briefs.
2. `DESIGN.md` and the approved image files settle presentation, with documented privacy/accessibility/capability adjustments.
3. `contracts/` defines protocol shape; engine, security and integration documents define required semantics. A new wire change needs a versioned migration and matching fixtures, not an ad-hoc UI property.
4. `growth/` defines onboarding, paywall, lifecycle and commercial hypotheses.
5. Original technical backlog plus growth backlog remain; `implementation/` sequences and integrates them.
6. `MASTER_BUILD_PLAN.md` is a consolidated reading copy. The individual current documents above are authoritative if the copy drifts.
7. Earlier validation reports are historical package checks. Financial workbooks and Appllama observations are evidence/hypotheses, not implementation instructions or approval to spend.

## Settled build defaults
| Topic | Decision |
|---|---|
| Product | Friendly one-screen file processor, not a generic chatbot or PDF editor. |
| Visual direction | Approved original atepdf pastel iPhone/iPad designs, with secondary desktop style reference. |
| Final public name | atepdf (all lowercase); approved gradient numeral 8 logo; centralised brand config; do not reopen naming. |
| Web stack | shadcn/ui + AI SDK; minimal shadcn chatbot reused selectively. |
| Alternative | assistant-ui reserved behind evidence gate; do not install initially. |
| Source strategy | NEW independent atepdf repository; Attenlo PDF read-only; no wholesale fork or in-place rewrite. |
| Native | New SwiftUI Apple targets and Kotlin/Compose Android source; old native code informs lessons only. |
| Platforms | Web, Android, iOS/iPadOS, Mac; Windows/Linux through tested browsers initially. |
| AI location | Hosted planner; no local LLM dependency. |
| Processing location | Local browser/native only; no remote document fallback. |
| Scope excluded | Text/layout editing, annotation, forms, signing, redaction, stamps, watermarks and positioned headers/footers. |
| Preview | Read-only with zoom/page navigation. |
| File ownership | Immutable originals, versioned outputs, reversible focus/history. |
| Interaction | Multi-step commands and follow-ups are core. Quick actions and compiled recipes need no AI call. |
| First work | Real local merge/output/follow-up, then cloud planner, OCR/compression and lifecycle. |
| Accounts | Optional before first free result; entitlement linking does not sync documents. |

## Hypotheses to implement as configuration, not live promises
Prices: India INR 249/month or 1,999/year; USD 5.99/month or 39.99/year anchors. Free 3 / Pro 300 completed AI intents monthly. No auto-renew trial, weekly renewal, lifetime unlimited AI, pass or ads at launch. Current sample configuration remains production-disabled.

Paid feature language must match implemented capabilities. A larger Pro batch allowance cannot exceed safe device limits. Annual billing does not mean annual AI allowance. Retention, CAC, revenue and profits in the workbooks are scenarios until measured. No one has approved automatic acquisition spending by approving this handoff.

Pilot audience and staged releases are operating recommendations, not permission to recruit or publish. Keep English-first testing and verify OCR languages separately; do not imply multilingual guarantees.

## Technical choices delegated to evidence
Codex should inspect the actual source and choose compatible package releases, existing adapters, worker implementations and safe tested limits. It should benchmark a low-cost hosted model against the command corpus and maintain a model-independent gateway. Full app source has not been inspected during preparation of this pack.

Published model IDs/prices in older notes are dated research. Reconfirm availability and pricing through current official sources and the real API project. Keep fixed financial copies as historical assumptions; change production model configuration only after an approved access/budget setup. No need to ask Shrey to choose parser internals that tests can resolve.

## Founder decisions before live commerce
- Legal product owner, developer-account seller and merchant entity.
- Domain and legal clearance, store metadata and distribution accounts. The public name atepdf and gradient 8 identity are already approved.
- Final live prices/local tax treatment and customer-facing legal copy.
- Approved provider credentials, cap for any billable model testing and new paid services.
- Merchant acceptance, signing identities and actual billing product IDs.
- Bounded permission for publication, customer communications, campaigns and production charges.

These do not block local development. Use sandbox modes and documented placeholders that clearly fail closed, not invented merchant IDs or fake purchase success.

## Contradictions explicitly closed
| Older idea | Final treatment |
| Modify the existing Attenlo PDF repo | Superseded by an owner-approved fresh independent atepdf repo; old source read-only. |
| Keep old production identifiers by default | No. New dev namespaces; any old product/customer migration needs separate explicit approval. |
|---|---|
| Apple on-device model as required foundation | Rejected. Hosted interpretation is allowed. |
| PDFello/Melo or another new design | Rejected as active visual spec. |
| assistant-ui installed by default | Superseded by selected minimal shadcn approach. |
| Full Vercel/LibreChat application fork | Not the default. |
| Broad file conversion and content Q&A promised up front | No. Only registry-backed local capabilities; no cloud document analysis. |
| Finance plan means spend is approved | No. Hypotheses stay disabled until authority is granted. |
| Reusable chat library supplies all security and billing | No. atepdf owns those boundaries. |
| More reference screens required before coding | No. Approved design is sufficient; refresh research only where useful. |
| Package tests mean application release ready | No. Separate evidence required. |

Build changes are traceable through task IDs and evidence. Material scope/architecture changes require a short ADR, not a silent departure from this register.

## Version 5 marketing operations precedence
`marketing/ops/` completes tool selection, access verification, creative evidence, discovery, email, feedback, reporting and approval runbooks. It does not alter the retained pricing, financial files, scope or initial campaign budget. Third-party skills never override these constraints. The selected Buffer/Windsor/etc. services are unverified on the future Codex host until an authorised read demonstrates the exact capability. Remotion uses current skills, not its deprecated MCP.

No new service budget is additive by default. All incremental costs must be allocated once inside an approved existing budget. Templates, suggested cadences, reference checks and a draft “approved” flag are not authenticated authority or an enabled automation. Current whole-package manifest: `V7_FILE_MANIFEST.json`.
