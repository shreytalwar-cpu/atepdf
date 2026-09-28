# Protocol artifacts
The schemas are canonical JSON Schema 2020-12 contracts. They are starter production-design artifacts, not an assertion that every hosted API accepts the schema verbatim. Adapt/test the provider-supported schema subset without weakening local semantic validation.

The request contains no document content, filename, password or path fields. Free-form `instruction` is still user-supplied text and can contain sensitive information; the UI must disclose this and use local file-reference chips/secure password controls.

`planner-response` is the model payload. `gateway-envelope` adds the original request ID and workspace revision outside the model's control. The client compares both to its pending request before considering execution.

`local-job-event` is local-only. Do not send arbitrary event bodies or engine exceptions to the cloud. Result-ready must follow actual output validation. Percentages are computed from real units, and indeterminate progress is allowed.

The registry is a specification, not a list of available product features. Every handler begins unimplemented in this pack. Production capabilities are generated from actual engine tests, platform support, local asset availability and file-specific preflight.

Reference semantics:
- Page selectors are one-based, apply to the immediate input of a step, and are resolved locally.
- A split/image export/per-file batch creates an ordered collection behind one output ref. It is not a fake single PDF.
- Merge may accept multiple PDF refs or a collection that expands to multiple PDFs.
- `single` compression/OCR requires exactly one PDF. `per_file` permits independent multiple PDFs.
- ZIP packaging flattens ordered artifact collections and preserves safe unique output names.
- Password operations request a local secret; no secret enters the plan.
- Every terminal output must be returned unless a future explicitly modelled discard action exists. No silent lost outputs.
- Save/share/undo/recipe persistence are trusted client actions, not autonomous model tools.

`reference/validate_plan.py` demonstrates selected semantic checks and size/page propagation. It does not execute PDFs, check file signatures, assess quality or provide a complete production security review. Production must implement all preservation/resource/network checks in the main plan.
