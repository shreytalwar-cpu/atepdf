"""Reference positive-allowlist boundary. Not production DLP, app code or an executor.

Extra UI/file fields are omitted rather than serialised. Schema validates allowed
values. Free-form instruction text is deliberately transmitted after consent;
secure entry and user disclosure belong to the actual application.
"""
from __future__ import annotations
from copy import deepcopy
import json
from pathlib import Path
from typing import Any, Mapping
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = json.loads((ROOT / "contracts/planner-request.schema.json").read_text())
VALIDATOR = Draft202012Validator(SCHEMA)
WORKSPACE_KEYS = (
    "workspaceRevision", "locale", "selectionRefs", "focusedResultRef",
    "originalRefs", "previousActionIds", "capabilities", "previousPlan", "ocrLanguages",
)
FILE_KEYS = ("ref", "kind", "pageCount", "sizeBytes", "encrypted")


def build_request(*, workspace: Mapping[str, Any], instruction: str,
                  request_id: str, ai_consent: bool) -> dict[str, Any]:
    """Build a fresh schema-valid request from a potentially richer local snapshot.

    Does not resolve semantic file refs, assess credentials typed in text, bind a
    response, reserve quota, run a PDF engine or establish a security proof.
    """
    if ai_consent is not True:
        raise PermissionError("Explicit AI consent is required")
    if not isinstance(workspace, Mapping):
        raise TypeError("workspace must be a mapping")
    files = workspace.get("files")
    if not isinstance(files, list):
        raise TypeError("files must be a list")
    request: dict[str, Any] = {
        "schemaVersion": "1.0", "requestId": request_id, "instruction": instruction,
    }
    for key in WORKSPACE_KEYS:
        if key in workspace:
            request[key] = deepcopy(workspace[key])
    request["files"] = []
    for file in files:
        if not isinstance(file, Mapping):
            raise TypeError("each local file must be a mapping")
        request["files"].append({key: deepcopy(file[key]) for key in FILE_KEYS if key in file})
    VALIDATOR.validate(request)
    # Reject values that cannot be a JSON request, without serialising all local state.
    json.dumps(request, allow_nan=False)
    return request
