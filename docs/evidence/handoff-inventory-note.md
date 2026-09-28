# Handoff validation
Original command ran: initial missing jsonschema fixed in isolated /private/tmp/atepdf-handoff-venv. Original pack then fails final manifest file-set equality because owner-provided atepdf_Codex_Start_v7.txt and atepdf_Fresh_Start_Handoff_v7.md are additional wrappers not in V7_FILE_MANIFEST.json. No missing manifest files. Source pack preserved untouched.

A disposable copy of exactly the manifested files passed the same v7 validator. This is package proof only, not an app build. See handoff-manifest-only-validation.txt.
