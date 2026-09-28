# atepdf
Operating mode: **prototype-v0 freeze and audit**, owner-directed 29 September 2026. The prior build/polish goal is paused. Do not add features, redesign flows, change architecture, install tools/frameworks/MCPs, refactor broadly, remove functionality or implement new tests without a new explicit instruction. Preserve the tagged prototype and running owner sessions. Audit recommendations are not permission to implement them.
Read `docs/PROTOTYPE_V0_AUDIT.md` and `docs/DECISIONS.md` for the current factual baseline and precedence. The nine canonical documents under `docs/` index existing product, architecture, design, privacy, security, testing, analytics and monetization truth; unknowns stay explicit.
Fresh independent app. Resume current source; do not recreate it.
Handoff: `atepdf_codex_build_pack/00_READ_FIRST.md`, `START_HERE.md`, `DECISIONS_AND_PRECEDENCE.md`, `DESIGN.md`, `fresh-start/README.md`.
Apply the handoff fresh-start, local-processing, UI-fidelity, command-eval and chat-integration skills as relevant; read them in place.
Attenlo PDF is read-only reference, never a dependency or write target. No old scripts/builds/tests. Record exact evidence in docs/legacy-learning.
Keep local store, job controller, planner serialization and UI separate. Immutable originals; independently validated outputs. Never transmit document data, names, checksums, secrets or paths. No partial plan execution.
No production identities, publication, spending, migration or live billing without explicit bounded authority.
Retain the M/F/G task mapping in docs/IMPLEMENTATION_STATUS.md. Its prior next-action instructions are paused; continue only when the owner authorizes a bounded next phase.
