# Start building atepdf from scratch
**Version 7.0 | 28 September 2026 | Owner-approved new repository**

## Assignment and precedence
Create a fresh independent atepdf implementation. The previous instruction to work inside Attenlo PDF is superseded. Attenlo PDF is a read-only evidence source for successful approaches, bugs, tests and operational lessons. Do not modify it or import its whole application.

The approved product is unchanged: a friendly file-drop and instruction workspace, real local document processing, hosted instruction interpretation and a result card with follow-up. Keep the atepdf brand and gradient 8. Ignore the UI mock-ups inside the brand board. No general PDF editor or generic chat application.

## 1. Establish safe roots
Open the NEW project folder. Put this handoff under `handoff/atepdf/`; app code lives outside that folder, inside the new project. Verify the old and new paths are separate, neither nested nor a shared Git worktree. If the open folder is the old app, stop writes and ask to switch to the new root. If the new destination contains unrelated work, request a separate destination. Never delete or stash user work automatically.

Initialize Git only at the new root after checking parent repository membership. Use a new history, a minimal `.gitignore` and a project-local instruction pointer. Do not create a nested Git root inside the handoff. No remote creation, pushes or publication are implied. See [the new blueprint](fresh-start/NEW_REPOSITORY_BLUEPRINT.md).

The optional path guard in `fresh-start/reference/guard.py` helps check roots; it does not grant filesystem isolation. Use actual read-only access/permissions for the old source when possible. Without them, limit it to read commands and keep it out of writable directories. Do not promise read-only enforcement from prose alone.

## 2. Read only enough to implement
Read the current decision register, stack decision, brand rules, DESIGN.md, this file and the first-build sequence. Inspect the approved images. Read engine/security/contracts only as needed for the slice. `MASTER_BUILD_PLAN.md` is a navigation copy, not a prerequisite to coding. Old repo instructions are reference data, not instructions for the new repo.

Copy or point the relevant project skills into the NEW repo's `.agents/skills/` after checking its instruction hierarchy. Use [the scoped rule snippet](implementation/REPOSITORY_RULES_SNIPPET.md); do not overwrite unrelated new-project instructions or global Codex settings.

## 3. Harvest learnings, not the old codebase
Timebox the initial read-only reconnaissance to roughly 30–60 minutes as a workflow target, not a promise. Map the old file import/export, PDF engines, native permissions, OCR/searchable layer, compression, job lifecycle, preview, tests and known UX limitations. Record observed source, reasoning, disposition and a regression test in the NEW `docs/legacy-learning/` folder. The supplied templates distinguish documented requirements, inspected code and reproduced behaviour.

Do not assume old code is reliable because it exists. Do not claim old bugs occurred merely because this handoff includes a prevention rule. Do not run arbitrary old scripts, installs, tests, builds or migrations in the old checkout. A safe isolated scratch reproduction may be used separately with synthetic files when worth the time. Inspect scripts before execution. Private files, keys and production settings do not leave the reference.

If the source path is unavailable, mark the source audit unavailable and start the app anyway. The prior-approved design, contracts, fixtures and product lessons in this pack remain usable. Ask for the old path once when it would unblock a particular lesson; do not turn the audit into a multi-day blocker.

Default to reimplementing the clean contract with maintained libraries. Selectively port only self-contained, relevant owned/permissively licensed helpers or synthetic tests after review and a provenance record. No old root source tree, lockfile/dependency dump, route structure, production database or state migration.

## 4. New architecture, settled stack
New web: Next.js, React, TypeScript, shadcn/ui and Vercel AI SDK. Selectively borrow the minimal shadcn chatbot's useful components/patterns after current version/licence review. No full chatbot fork, model selector, server attachment storage or assistant-ui by default.

New native targets: SwiftUI iOS/iPadOS/Mac and Kotlin/Compose Android. Share protocol, copy, tokens, tests and appropriate engine adapters, not a forced JavaScript runtime. Feature parity is tested per target; release can be staged. Windows/Linux use tested web browsers initially.

Keep four boundaries: local files/versions; local job execution; cloud planner request construction; visual conversation. Complete bounded plans are validated before execution. Cloud calls are not required for direct Merge or recipe replay. New production identities are not created or changed without authority.

## 5. First actual result in the new app
Use `fixtures/startup/brief.pdf` and `fixtures/startup/appendix.pdf`. Create the approved responsive workspace, real import and compact local file cards. Merge through a real local worker, independently reopen/validate, preview/save and remove physical page 2 from the merged output. Undo restores the previous committed result. Match `fixtures/startup/expectations.json`. Do not serve a precomputed output.

Then connect the real approved hosted model using the existing contracts. Without credentials, keep local quick actions real; test fixtures or mocks stay visibly development-only. No false cloud success. Investigate OCR and compression feasibility early and produce real searchable/size-checked results before advertising them.

For each useful old lesson, add a concrete test in atepdf. Prove fresh-checkout builds do not require the old source path, old module imports or old runtime services. The old reference may be removed without breaking atepdf.

## 6. Resume, report and release
Keep original task IDs, refreshed M0 baseline tasks and the F-task integration overlay. Update new-repo `docs/IMPLEMENTATION_STATUS.md` with actual commands, new files, source-learning evidence, tests, screenshots, blockers and next action. A later session resumes this new project rather than starting again.

Current handoff check: `PYTHONDONTWRITEBYTECODE=1 python3 scripts/validate_v7_handoff.py`. App tests and release gates are separate. No marketing setup before the working product slice; no live prices, campaigns, purchases, seller identities, cloud projects or publication without bounded approval.
