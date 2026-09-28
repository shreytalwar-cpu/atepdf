# Independence check — 2026-09-28

New source root: /Users/shrey/Documents/ChatGPT/atepdf.
Read-only old source: /Users/shrey/Documents/attenlo/attenlo-docs.

Real paths and Git common directories were resolved and compared. They are distinct, neither contains the other, and there is no parent Git repository at the new root. The already-initialized new repository was resumed, not erased or scaffolded over. Both roots were initially unborn branches, so the old read pass is pinned by exact hashes in source-snapshot.json rather than an invented commit.

All seven inspected old files still match their recorded SHA-256 values (evidence/repository-boundaries.json). No old installs, scripts, tests, builds, migrations, configuration changes or runtime reproduction occurred. Read-only findings distinguish source-reviewed evidence from dated documentation. No old helper or test was ported.

A clean verification directory at the path in evidence/clean-build-path.txt received only the new app source, shared packages, build scripts, manifests and lockfile. It did not receive the old checkout, old dependencies, old settings or the handoff archive. A frozen offline installation from the upstream package cache and an actual production Next build succeeded there; logs are evidence/clean-install.txt and clean-build.txt. This demonstrates that the new build does not require the legacy source. It does not claim that the entire host filesystem was inaccessible to the compiler.

Separately, the standalone Expo web export passes actual local PDF browser workflows. Native Hermes exports compile, but native execution remains unproven. Independent development IDs are dev.atepdf.fresh; no old signing identities, app groups, databases, buckets, OAuth apps, deployments, entitlements, SKUs or user migrations are configured.
