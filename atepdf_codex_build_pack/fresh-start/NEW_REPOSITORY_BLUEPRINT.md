# New repository blueprint

## Independent destination
Use one new owner-selected project directory and new Git history. The new directory is neither within the old project nor a parent of it. Do not use an Attenlo PDF worktree, fork, copied `.git`, cloned application skeleton or bulk `cp`/`rsync` as the starting source tree. The old project remains available as a read-only reference.

If Codex is opened on the old repository, do not create or modify application files there. Ask to open the new directory, or use an explicitly authorised new writable destination. Resolve symlinks and check parent repository membership before initialisation. Do not change global permissions/configuration automatically.

Only the handoff and ordinary OS metadata may exist in a genuinely uninitialised destination. A separately started atepdf project may be resumed after identity/source-history checks. Never remove such work to satisfy the word “fresh.” Create a local `.atepdf-project.json` marker only after verifying identity; do not treat a marker as an access-control boundary or proof that unknown copied source is clean.

## Proposed new source layout
```text
atepdf/                         NEW repository root
  AGENTS.md                     scoped instructions for the new app
  .gitignore                    excludes secrets/private refs/output caches
  .atepdf-project.json           records fresh-build origin, no private paths
  handoff/atepdf/                this pack, reference docs and tests
  apps/
    web/                        Next.js/React UI and client-only workspace
    apple/                      new SwiftUI iOS/iPadOS and Mac targets
    android/                    new Kotlin/Compose app
  packages/
    contracts/                  versioned schema source and generated DTOs
    design-tokens/              shared source tokens, per-platform exports
    web-pdf/                    worker-based PDF adapters
  prompts/                      versioned planner instruction
  tests/
    fixtures/                   authorised synthetic documents
    contracts/                  common semantic conformance
    privacy/                    request boundaries and no-content checks
    e2e/                        real new-app workflow tests
    regressions/                reproduced old lessons, with evidence IDs
  docs/
    adr/                        concise architecture decisions
    legacy-learning/            sanitised findings; no private source dumps
    IMPLEMENTATION_STATUS.md    actual new-build progress
  marketing/                    working drafts when product is ready
```
Do not create empty target folders and call them implemented. Start `apps/web/` and shared contracts with the first slice. Track new native targets from day one; add their executable scaffolds when their toolchain/slice is ready.

## The planner has one implementation
Start with a server-only route in the new web/backend project and shared DTOs, callable by all platforms. Browser PDF work never uses that route. Do not simultaneously create a second `services/planner` implementation unless there is an explicit deployment need. A later extraction keeps the public contract stable.

## Dependency and identity hygiene
Choose compatible stable package releases at implementation time, pin and test them. Do not copy the old lockfile, SDK list or all scripts. Use maintained upstream libraries rather than cloning every prior dependency. Do not execute unreviewed template setup against the destination.

New development configuration must be independent of old production: new local databases/caches, separate analytics environment, independent local entitlement tests and non-production placeholders. Do not connect the new app to old storage, live payment products, remote Git origin, push credentials or customer data by default. Developer account/seller/production bundle identities and deliberate purchase migration need owner approval. Reusing an existing service account under a new sandbox project is a separate scoped decision, not forbidden universally and not assumed.

The brand remains atepdf. Historical handoff paths and schema IDs containing `attenlo` may remain as reference protocol labels. They are not new production bundle IDs. Runtime public labels use the approved brand config.

## Source independence acceptance
No dependency resolves outside the new project to the old checkout; no old source symlink, runtime file path, dynamic import, build script or local package link. A clean-checkout build with the reference unavailable must pass. Record this evidence in `docs/legacy-learning/INDEPENDENCE_CHECK.md`.

Preflight optional command from the handoff root:
```text
python3 fresh-start/reference/guard.py --new-root /absolute/new/atepdf --legacy-root /absolute/old/AttenloPDF
```
Paths are supplied by the owner. Without a reference, omit `--legacy-root` and proceed with reference learning pending. This command does not create or mutate either directory. Reference-path errors must never be interpreted as proof that the old repo is empty.
