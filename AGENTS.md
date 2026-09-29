# atepdf

Operating mode: **documentation/context adoption only**, owner-directed 29 September 2026. The approved v1 target does not unfreeze implementation. Do not add features, change application behavior, redesign flows, refactor architecture, fix audit defects, install dependencies/tools/MCPs, add tests or create Linear issues without a new bounded task. Preserve `prototype-v0`, existing user work and running owner sessions. Stop after the assigned deliverable.

## Required reading and authority

Read in order:
1. Applicable `AGENTS.md` files.
2. `docs/PRODUCT_V1.md` — authoritative **approved v1 target**, not implemented capability.
3. Relevant `docs/DECISIONS.md`, `docs/ARCHITECTURE.md` and other canonical records for the assigned area.
4. The specific assigned task and its scope/acceptance constraints.

Latest explicit owner instructions control. For product intent, `PRODUCT_V1.md` supersedes incompatible ADRs, implementation guidance and historical handoffs. `docs/AUDIT_PROTOTYPE_V0.md` and `docs/PROTOTYPE_V0_AUDIT.md` describe audited snapshots; preserve them unchanged. `docs/PRODUCT.md` describes current implementation; `docs/IMPLEMENTATION_STATUS.md` records later source-bound evidence and retained M/F/G mapping. Do not turn requirements into completion claims or update runtime-facing `docs/AI_PRODUCT_KNOWLEDGE.md` / generated knowledge to advertise unimplemented tools.

## Product safeguards

Mac is the v1 launch and acceptance platform, with both Mac App Store and direct distribution. Preserve web/iPhone/iPad work without delaying Mac; Android is deferred. The existing foundation remains; Mac-first does not authorize a rebuild.

AI intentionally orchestrates conversational work, including enabled-AI quick actions (`D-04`, `CONV-01`). Do not independently optimize away this routing. The earlier uncommitted local-bypass change is a documented current-source/target mismatch, not the v1 decision. Do not revert or expand it in a documentation task. Provider recovery/offline policy remains a separate open decision.

Deterministic engines manipulate PDFs. Keep local state, planning/context projection, validation and JobController execution separate. Preserve immutable originals, full schema/semantic/capability/ref/revision validation, staged commit, cancellation, independent inspection and Undo. No partial plans or weakened admission checks. Existing count/text checks are not complete visual-fidelity proof.

Documents and derived content stay local by default. Any future application-controlled content transfer requires the operation-specific informed permission and enforced boundaries in `PRODUCT_V1.md` Section 9; Cancel sends nothing, and no silent cloud fallback is allowed. Passwords/secrets never enter ordinary chat or model context. Current runtime exclusions remain until separately authorized, implemented and verified; adopting the spec is not permission to transmit data or add a cloud-processing service.

The 13 tools, local understanding, continuity, persistence, guest-to-Pro model, onboarding and v2 exclusions are targets defined only in `PRODUCT_V1.md`; do not duplicate the specification or invent prices, allowances or implementation defaults. Technical safety and commercial entitlement limits are distinct. Existing results and privacy/deletion/subscription controls must remain accessible under the approved target.

## Repository boundaries

Fresh independent app. Resume current source; do not recreate it. Attenlo PDF is read-only reference, never a dependency or write target. No old scripts/builds/tests. Record authorized source learning in `docs/legacy-learning`.

The retained `atepdf_codex_build_pack/` handoff (`00_READ_FIRST.md`, `START_HERE.md`, `DECISIONS_AND_PRECEDENCE.md`, `DESIGN.md`, `fresh-start/README.md`) is historical guidance, subordinate to current owner instructions and `PRODUCT_V1.md`. Apply its fresh-start, local-processing, UI-fidelity, command-eval and chat-integration skills only as relevant to a separately authorized task; read them in place and resolve superseded instructions through `docs/DECISIONS.md`.

No production identities, publication, spending, migration, live billing, paid model calls or release without explicit bounded authority. Preserve the existing M/F/G task mapping; specification IDs are requirement references, not Linear IDs or a second roadmap. Historical next-action instructions are paused.
