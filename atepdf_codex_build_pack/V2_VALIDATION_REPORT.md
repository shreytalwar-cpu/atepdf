# Version 2 validation report
**28 September 2026 | Checks of the handoff, not of a shipped application**

## Passed
- Original handoff validator: 15 declared operations, four schemas, four example pairs, two event/envelope examples, 118 planner seed cases, 21 rejected adversarial plans, three context-binding checks, 65 original build tasks and all three approved design references.
- New pure gate policy: 54 scenario checks and six invalid input rejections.
- New event envelope: valid example, forbidden filename, rejection of client-claimed verified purchase and valid verified-server event shape.
- Safe disabled production/experiment/trial/spending defaults.
- Thirty new dependency-ordered tasks and 52 uniquely identified application acceptance specifications, all explicitly not run.
- Thirty-two UI/state definitions.
- Twenty-six distinct Appllama screen metadata references across eight apps; all tagged as not pixel reviewed with exact refresh calls.
- Two original financial workbooks, two original financial notes and two original charts copied byte-for-byte and SHA-256 verified.
- All original ZIP files retained. Only documented entrypoints/overview material updated, plus the regenerated file manifest.
- No font files, Python bytecode, external credentials or downloaded competitor production assets included.

## Not performed and not claimed
No new application implementation, live PDF-engine execution, deployed model benchmark, store sandbox purchase, live web checkout, refund/webhook integration, production privacy audit, conversion experiment or financial-model recalculation was performed in this update. The original financial files remain hypotheses, not audited accounts or sales forecasts.

## Research media limitation
Appllama connector retrieval succeeded for profiles/flow records/UI-element metadata. Direct media retrieval failed due to container DNS/access limits, and alternate retrieval did not provide the assets. No competitor screenshot pixels were inspected or bundled. The offline HTML catalog contains text and stable source references, not inaccessible image placeholders. Refresh the exact IDs in a Codex environment with working Appllama media access when visual comparison is needed.

## Application validation still needed
Implement and execute `growth/tests/growth_acceptance_cases.jsonl` on real app builds and appropriate store sandboxes. Real app tests must supplement, not be replaced by, `scripts/validate_handoff.py` and `scripts/validate_growth_handoff.py`. Gate diagrams and typed policies are not production authorization boundaries.
