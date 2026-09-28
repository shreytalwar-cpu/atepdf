# Current validation report: v5
**28 September 2026 | Handoff/reference validation only**

## Reproduction
From the extracted handoff root, with Python 3.11+ and `reference/requirements-dev.txt` installed in an isolated environment:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/validate_v5_handoff.py
```

The current wrapper runs the retained protocol validator, growth validator, request-boundary tests, marketing-control tests and the new launch-preflight reference tests. It does not run the older v3 whole-package manifest check against this changed v5 snapshot.

## Checks
- Source v4 ZIP CRC integrity and safe extraction.
- All 146 source paths retained, with every modified original explicitly listed in `V4_PRESERVATION_FOR_V5.json`.
- Financial models, original financial notes/charts, approved design images, contracts, examples and synthetic fixtures unchanged by hash.
- Retained 118 command expectations and 21 invalid-plan cases rechecked against the reference validator. These are not live-model evaluations.
- Retained 54 lifecycle policy cases and 12 request-boundary unit tests rerun.
- Retained 16 marketing-control tests rerun.
- 32 new launch-preflight reference tests pass, including inactive defaults, missing/untrusted approval, account/currency/version mismatches, cap arithmetic, dates, required evidence and rejection of unexpected payload fields.
- All JSON/JSONL parses; five inactive MCP examples parse as TOML; no embedded keys.
- Sixteen OP tasks have valid dependencies and links to the retained PM backlog.
- Relative Markdown file links resolve; source references resolve to the dated source register.
- Whole-package SHA-256 manifest is `V5_FILE_MANIFEST.json`, excluding itself. No fonts, symlinks or Python cache files are included.
- Final ZIP is checked and re-extracted into a fresh folder; the v5 validator is rerun there.

## Not verified
No app-source build or UI benchmark, real engine output in this update, on-device privacy audit, selected-model quality/cost, authenticated connector, advertising or email execution, real store/merchant checkout, paid-service eligibility, consent implementation or actual marketing performance. Existing earlier fixture/render reports remain historical evidence, not new tests.

`marketing/ops/preflight.py` is a non-executing reference checklist. It cannot authenticate a human, enforce a platform cap, prevent concurrent spending or authorise a launch. Those require real implementation evidence and external controls.

No production action, tool installation, account connection, campaign, publication, scheduled report or email has been performed by building this handoff.
