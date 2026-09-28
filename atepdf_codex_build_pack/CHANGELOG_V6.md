# v6 change record
**28 September 2026**

Scope: the owner approved the public name atepdf and the gradient numeral 8 logo, and explicitly rejected using the accompanying mock-ups as product requirements.

The new entrypoints and brand contract make that precedence explicit. Current prose and marketing copy are branded atepdf; internal identifiers and protected historical records remain unchanged. Root folder is `atepdf_codex_build_pack` for the new archive. Existing paths within the pack are retained.

No source file from the 181-file v5 archive is removed. The [preservation ledger](V5_PRESERVATION_FOR_V6.json) lists every original source hash, final hash and change status. The untouched v5 inventory and old reports are provenance, not current-file assertions. [V6_FILE_MANIFEST.json](V6_FILE_MANIFEST.json) is the current integrity inventory.

Use [scripts/validate_v6_handoff.py](scripts/validate_v6_handoff.py) for this version. It reruns applicable reference suites and checks current integrity rather than rewriting historical manifests to conceal changes.
