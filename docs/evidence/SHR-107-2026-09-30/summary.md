# atePDF orchestration eval baseline

Corpus 1.0.0; split 1.0.0; adapter current-mocked-v1.

**Evidence:** current local boundaries with scripted provider responses and synthetic engines. This is not live-model language understanding, PDF fidelity, Mac UI acceptance or production readiness.

| Set | Scenarios | Pass | Score | Plan accuracy | Tool accuracy |
| --- | ---: | ---: | ---: | ---: | ---: |
| dev | 41 | 35 | 85.4% | 100.0% | 97.7% |
| held-out | 23 | 20 | 87.0% | 100.0% | 100.0% |

## Diagnostics

**dev:** clarification false=0, missed=0, correct=8, direct=15; invalid=0; privacy=1; unsupported=0; unnecessary provider=4; missing provider=1; unnecessary tool=2; stale admissions=0; entitlement bypasses=1.

Failure groups: {"provider_calls":5,"tool_selection":4,"entitlement_safety":5,"privacy":1}.

- O107-032 (unsupported): turn 1: expected 0 provider calls, got 1
- O107-033 (unsupported): turn 1: expected 0 provider calls, got 1
- O107-049 (quality_permission): turn 1: expected status rejected, got plan; turn 1: expected admission false, got true; turn 1: expected rejection privacy, got null; turn 1: expected 0 provider calls, got 1; turn 1: expected admitted tools [], got ["merge_pdf"]; turn 1: expected planner tool/status rejected with [], got plan with ["merge_pdf"]; turn 1: hosted command sent without instruction consent
- O107-053 (entitlement): turn 1: expected admission false, got true; turn 1: expected rejection allowance, got null; turn 1: expected admitted tools [], got ["merge_pdf"]; turn 1: exhausted allowance was bypassed for new work
- O107-055 (single_tool): turn 1: expected 1 provider calls, got 0
- O107-061 (no_work): turn 1: expected 0 provider calls, got 1
**held-out:** clarification false=0, missed=0, correct=2, direct=10; invalid=0; privacy=0; unsupported=0; unnecessary provider=3; missing provider=0; unnecessary tool=0; stale admissions=0; entitlement bypasses=0.

Failure groups: {"provider_calls":3}.


Held-out details and answer keys are omitted by default. Tokens, provider latency and cost are unavailable in mocked mode.

Runtime source: ca052694c178c68c9d61b5fb39b16df7363dbd84; harness source: ca052694c178c68c9d61b5fb39b16df7363dbd84; content hashes are in the JSON report.
