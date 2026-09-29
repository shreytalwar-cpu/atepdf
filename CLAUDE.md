# CLAUDE.md

This is Claude Code's entry point for atePDF. It adds no rules of its own: Claude follows the same process as every other agent. Where this file and a source below disagree, the source wins.

## Authority

1. **`AGENTS.md`** holds the shared repository and agent instructions. Read it first, every session.
2. **`docs/PRODUCT_V1.md`** is the product authority for the approved v1 scope. It describes the target, not what has been implemented.
3. **The assigned live Linear SHR** is the task authority for the current job. It is the "new bounded task" that `AGENTS.md` requires before any implementation.
4. **Merged ADRs in `docs/adr/`** are the authority for approved architectural decisions, as reconciled in `docs/DECISIONS.md`. Where an older ADR conflicts with `PRODUCT_V1.md`, the ADR is superseded.
5. **Historical audits, evidence, session notes and handoffs** describe earlier states of the project. They do not authorize reviving old implementation directions.

The latest explicit owner instruction overrides all of these.

## One SHR at a time

- Work on exactly one assigned, executable SHR at a time.
- Before starting, check the issue's live Linear status, its parent and its dependencies. Proceed only if its prerequisites are merged or approved.
- Never restructure or take over an issue that another agent has In Progress or In Review.
- Start every engineering SHR from current `origin/main` on a dedicated branch or worktree. Never build on another agent's unmerged branch.
- Do not expand the scope or opportunistically fix unrelated findings. Record them for Linear triage instead.

## Invariants

Preserve the approved invariants. They are defined in `PRODUCT_V1.md` and `AGENTS.md`; do not reinterpret them.

- Mac-first v1.
- Conversation-first experience.
- AI orchestration is intentional; do not route around it.
- PDF execution is deterministic, validated and local.
- PDF processing and document understanding happen locally first.
- Document content, or content derived from it, leaves the Mac only with explicit, informed permission.
- No silent cloud fallback.
- Passwords and secrets stay out of ordinary chat and out of model context.

## Data and external actions

- Use synthetic, local or mock data by default.
- No paid calls, production credentials, spending, deployment, publication or customer-impacting actions unless the assigned issue explicitly authorizes them.

## Finishing an SHR

1. Meet the issue's acceptance criteria and run the tests it calls for.
2. Open a bounded PR against `main` and link the Linear issue.
3. Move the issue to In Review, then STOP.

Never self-merge. Never mark an issue Done before a reviewed merge. Never start the next issue automatically. Once a PR is merged, current `origin/main` becomes the starting point for future work.
