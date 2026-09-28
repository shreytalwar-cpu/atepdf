# Prototype v0 freeze

29 September 2026. The owner stopped exploratory development and requested a read-only product/repository audit. The prior build-and-polish goal is paused. No application feature, architecture, dependency, interface or test change is authorized by this audit.

The application and existing evidence were committed through `036a722` on `codex/atepdf-chat-workflows`. There were no modified tracked files at freeze entry. The `prototype-v0` tag points to the subsequent preservation commit containing this note and the pre-existing untracked files listed below, unchanged.

## Preserved pre-existing files

- `.codex/config.toml` and `scripts/codex/stitch-auth.py`: existing project-scoped Stitch configuration and credential helper. Configuration declares the public service and helper, not a literal API key. The helper reads an existing credential outside this repository. Neither was installed, executed or reconfigured by this audit.
- `apps/web/public/fixtures/brief 2.pdf`, `brief 3.pdf`, `appendix 2.pdf`, `appendix 3.pdf`: byte-identical numbered copies of the existing synthetic fixtures.
- `apps/web/public/metadata 2.json`, `metadata 3.json`: byte-identical copies of the existing generated metadata.
- `apps/web/public/index 2.html`, `index 3.html`: generated historical HTML shells referencing different hashed JavaScript entries. They contain no inline script and are preserved rather than silently removed or substituted for the active build.

The numbered public files are preservation evidence, not a newly endorsed deployment configuration. Their duplication and accidental public exposure are audit findings to disposition later.

## Recovery and exclusions

Use `git show prototype-v0:<path>` to inspect preserved files. A future isolated checkout of this tag recovers tracked prototype source and evidence without resetting the current directory. Do not reset or clean the current checkout as an audit action.

Existing `.gitignore` exclusions remain unchanged: local credentials/configuration in `.local`/environment files, dependency directories, compiled web/native outputs, build caches and generated test products are not included in the Git tag. No credential file was read or copied into the snapshot. A source tag does not promise restoration of installed runtimes, signing identities, owner chat sessions, ignored build products or external service state.

The running owner beta and its in-memory session are left untouched. Old Attenlo source is not needed for this audit and is not accessed. Findings and the requested canonical documentation are separate documentation changes after this snapshot.
