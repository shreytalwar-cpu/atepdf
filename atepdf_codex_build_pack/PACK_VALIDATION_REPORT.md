# Build-pack validation report

Date: 27 September 2026.

The following checks were executed against the included schemas, reference validator, example plans and synthetic test definitions. This is **handoff consistency validation**, not a claim that Attenlo's app, PDF engines or chosen AI model have been built or tested.

```text
PASS: handoff schema, reference semantics and artifact consistency checks
{
  "adversarial_cases_rejected": 21,
  "backlog_tasks": 65,
  "context_binding_checks": 3,
  "declared_operations": 15,
  "defined_sources": 26,
  "example_envelopes_events": 2,
  "example_plan_pairs": 4,
  "json_documents": 18,
  "present_design_references": 3,
  "seed_cases_validated": 118,
  "valid_schemas": 4
}
NOT RUN: live model evaluation, PDF processing, application builds, device/browser UI tests, production network/privacy audit.
```

The invalid-plan suite verifies rejection of unsupported actions, unknown/forward file references, scripts/unknown fields, invalid page ranges, deleting every page, wrong types, output collisions, missing terminal outputs, secret fields, encrypted inputs without local prerequisites and unsupported OCR languages. Additional checks bind request/workspace revisions and reject duplicate input references.

The reference validator is illustrative implementation support. Production must add engine preflight, resource limits, actual output integrity, platform adapters, defence in depth and independent review. The seed corpus is not an independent holdout and none of its expected responses came from a measured live model evaluation.
