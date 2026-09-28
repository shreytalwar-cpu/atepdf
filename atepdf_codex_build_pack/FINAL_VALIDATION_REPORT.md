# v7 fresh-start handoff validation
**28 September 2026 | Package and reference checks only**

## Source and preserved material
The input was `atepdf_Codex_FINAL_v6_2026-09-28.zip`, SHA-256:
`e78148b7fbe460b92af318d1baa9d4b69816731c332f5036fca003168df67d6d`.
Its 199 file paths remain; the current preservation ledger identifies unchanged/modified files individually. Source strategy, active setup prose, task meaning, identity defaults and current packaging metadata changed intentionally. No original financial workbook/note/chart, brand/UI pixel asset, protocol contract, example, synthetic fixture or core reference-test input changed. Earlier manifests/reports describe older snapshots only.

## Reproducible check
From this handoff root:
```text
PYTHONDONTWRITEBYTECODE=1 python3 scripts/validate_v7_handoff.py
```
Use Python 3.11+ and `reference/requirements-dev.txt` in an isolated development environment. No network or account setup is needed for these checks. No font files, secrets, Python bytecode or symlinks are bundled.

## Passed reference suites
| Suite | Observed check |
|---|---|
| Planner/contract reference | 118 seed expectations, 21 rejected invalid plans, four example plan pairs, binding and schema checks |
| Commercial lifecycle reference | 54 gate cases, invalid contexts, event privacy/origin and safe quota configuration |
| Outbound request boundary | 12 unit tests |
| Marketing controls | 16 unit tests |
| Launch-preflight reference | 32 unit tests |
| NEW destination/source guard | 24 synthetic path tests: separation, symlinks, nesting, parent Git, linked worktree marker, safe resume, missing old source and read-only behaviour |

The gate checks also verify the 65 technical task IDs, 30 lifecycle tasks, 10 integration-overlay tasks, draft marketing controls, 26 Appllama metadata references, approved brand scope, source-image hashes, disabled MCP examples, pending old-source audit and no stale in-place startup directives in the active document set.

Eight seed learning entries are explicitly `handoff_requirement`; none claims old-source review or an application test. The 10 brand application cases and 52 lifecycle application cases remain NOT RUN until the app is built.

## Integrity checks
Every bundled file is covered by `V7_FILE_MANIFEST.json` except that manifest's own bytes. `V6_SOURCE_SNAPSHOT_FOR_V7.json` and `V6_PRESERVATION_FOR_V7.json` give source/final hashes and the protected-file rule. Relative Markdown file links resolve. JSON/JSONL and inactive TOML examples parse. The final ZIP is tested and its freshly extracted copy is checked with the same validator before delivery.

## Not tested or established
No owner repository was opened, edited, cloned, built or source-audited. The old Attenlo PDF checkout and new atepdf app are not included. No real processing implementation, UI render, current API-model benchmark, native build, purchase, OAuth/MCP session, advertisement, email, scheduled task or revenue forecast was validated here.

The source guard is a reference check, not filesystem permission enforcement or proof that an existing repo has clean history. Codex must establish those boundaries in the owner's actual environment. Package validation is not release readiness.
