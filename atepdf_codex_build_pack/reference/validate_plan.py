"""Reference semantic validator for this handoff, NOT a PDF engine or full security boundary.

It validates JSON shape, references, capabilities, page math, simple type/cardinality
propagation and terminal outputs. The production app must also perform local preflight,
resource limits, signature/preservation checks, real execution and output validation.
"""
from __future__ import annotations
from copy import deepcopy
from pathlib import Path
from typing import Any
import json

try:
    from jsonschema import Draft202012Validator
except ImportError as exc:
    raise RuntimeError("Install jsonschema in a development virtual environment to run pack checks.") from exc

ROOT = Path(__file__).resolve().parents[1]

class PlanError(ValueError):
    """The proposed plan does not satisfy the reference protocol."""


def _schema_check(name: str, value: dict[str, Any]) -> None:
    schema = json.loads((ROOT / 'contracts' / name).read_text())
    errors = list(Draft202012Validator(schema).iter_errors(value))
    if errors:
        first = sorted(errors, key=lambda e: str(list(e.path)))[0]
        # Avoid echoing potentially sensitive field values in production error logs.
        raise PlanError(f"SCHEMA_INVALID: {name}, path={list(first.path)}")


def selected_pages(selector: dict[str, Any], count: int | None) -> list[int]:
    if count is None:
        raise PlanError('NEEDS_LOCAL_PREFLIGHT: page count is unresolved')
    mode = selector['mode']
    if mode == 'all':
        pages = list(range(1, count + 1))
    elif mode == 'explicit':
        pages = selector['indices']
    elif mode == 'first':
        pages = list(range(1, selector['count'] + 1))
    elif mode == 'last':
        pages = list(range(count - selector['count'] + 1, count + 1))
    elif mode == 'odd':
        pages = list(range(1, count + 1, 2))
    elif mode == 'even':
        pages = list(range(2, count + 1, 2))
    else:
        raise PlanError('INVALID_SELECTOR')
    if not pages or len(set(pages)) != len(pages) or any(p < 1 or p > count for p in pages):
        raise PlanError('INVALID_PAGE_RANGE')
    return pages


def validate_plan(
    request: dict[str, Any],
    plan: dict[str, Any],
    *,
    received_request_id: str | None = None,
    received_workspace_revision: int | None = None,
) -> dict[str, Any]:
    """Validate a plan and return predicted artifact TYPE/PAGE metadata, not actual files.

    Gateway-envelope binding is demonstrated through optional received_* values.
    Production must always bind its actual pending request and workspace revision.
    """
    _schema_check('planner-request.schema.json', request)
    _schema_check('planner-response.schema.json', plan)
    if received_request_id is not None and received_request_id != request['requestId']:
        raise PlanError('REQUEST_MISMATCH')
    if received_workspace_revision is not None and received_workspace_revision != request['workspaceRevision']:
        raise PlanError('STALE_WORKSPACE')
    records = request['files']
    state = {f['ref']: {'kind': f['kind'], 'pageCount': f['pageCount'], 'encrypted': f['encrypted']} for f in records}
    if len(state) != len(records):
        raise PlanError('DUPLICATE_INPUT_REF')
    refs = request['selectionRefs'] + request['originalRefs']
    if request['focusedResultRef']:
        refs.append(request['focusedResultRef'])
    if any(r not in state for r in refs):
        raise PlanError('UNKNOWN_CONTEXT_REF')
    status = plan['status']
    if status != 'plan':
        if plan['steps'] or plan['resultRefs'] or plan['reasonCode'] is None:
            raise PlanError('INVALID_NONPLAN')
        if status == 'clarify' and plan['clarification'] is None:
            raise PlanError('MISSING_CLARIFICATION')
        if status == 'unsupported' and plan['clarification'] is not None:
            raise PlanError('UNEXPECTED_CLARIFICATION')
        return {'status': status, 'outputs': {}}
    if not plan['steps'] or not plan['resultRefs'] or plan['reasonCode'] is not None or plan['clarification'] is not None:
        raise PlanError('INVALID_PLAN_SHAPE')

    produced: set[str] = set()
    consumed: set[str] = set()
    step_ids: set[str] = set()

    def expand(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        flat: list[dict[str, Any]] = []
        for item in items:
            if item['kind'] == 'collection':
                flat.extend(item['members'])
            else:
                flat.append(item)
        if len(flat) > 1000:
            raise PlanError('TOO_MANY_ARTIFACTS')
        return flat

    def one_pdf(items: list[dict[str, Any]]) -> dict[str, Any]:
        if len(items) != 1 or items[0]['kind'] != 'pdf':
            raise PlanError('EXPECTED_SINGLE_PDF')
        return deepcopy(items[0])

    for step in plan['steps']:
        op, inputs, out, p = step['operation'], step['inputs'], step['outputRef'], step['params']
        if step['id'] in step_ids:
            raise PlanError('DUPLICATE_STEP_ID')
        step_ids.add(step['id'])
        if op not in request['capabilities']:
            raise PlanError('UNAVAILABLE_CAPABILITY')
        if out in state:
            raise PlanError('OUTPUT_REF_COLLISION')
        if any(r not in state for r in inputs):
            raise PlanError('UNKNOWN_OR_FORWARD_REF')
        consumed.update(r for r in inputs if r in produced)
        items = expand([state[r] for r in inputs])
        if any(x.get('encrypted', False) for x in items) and op not in ('unlock_pdf', 'export_zip'):
            raise PlanError('NEEDS_LOCAL_UNLOCK')

        if op == 'merge_pdf':
            if len(items) < 2 or any(x['kind'] != 'pdf' for x in items):
                raise PlanError('MERGE_REQUIRES_MULTIPLE_PDFS')
            count = None if any(x['pageCount'] is None for x in items) else sum(x['pageCount'] for x in items)
            result = {'kind': 'pdf', 'pageCount': count, 'encrypted': False}
        elif op in ('compress_pdf', 'ocr_pdf'):
            if op == 'ocr_pdf' and not set(p['languages']).issubset(set(request['ocrLanguages'])):
                raise PlanError('UNAVAILABLE_OCR_LANGUAGE')
            if not items or any(x['kind'] != 'pdf' for x in items):
                raise PlanError('EXPECTED_PDFS')
            if p['batchMode'] == 'single':
                result = one_pdf(items)
            else:
                result = {'kind': 'collection', 'members': deepcopy(items), 'pageCount': None, 'encrypted': False}
        elif op == 'images_to_pdf':
            if not items or any(x['kind'] != 'image' for x in items):
                raise PlanError('EXPECTED_IMAGES')
            result = {'kind': 'pdf', 'pageCount': len(items), 'encrypted': False}
        elif op == 'export_zip':
            if not items:
                raise PlanError('EMPTY_ARCHIVE')
            result = {'kind': 'archive', 'pageCount': None, 'encrypted': False}
        else:
            result = one_pdf(items)
            count = result['pageCount']
            if op == 'select_pages':
                chosen = selected_pages(p['pages'], count)
                result['pageCount'] = len(chosen) if p['action'] == 'extract' else count - len(chosen)
                if result['pageCount'] < 1:
                    raise PlanError('EMPTY_PDF')
            elif op == 'rotate_pdf':
                selected_pages(p['pages'], count)
            elif op == 'reorder_pdf':
                if count is None:
                    raise PlanError('NEEDS_LOCAL_PREFLIGHT')
                if sorted(p['pageOrder']) != list(range(1, count + 1)):
                    raise PlanError('REORDER_NOT_PERMUTATION')
            elif op == 'split_pdf':
                if count is None:
                    raise PlanError('NEEDS_LOCAL_PREFLIGHT')
                if p['mode'] == 'each_page':
                    if p['pagesPerFile'] is not None or p['ranges']:
                        raise PlanError('INVALID_SPLIT_PARAMETERS')
                    counts = [1] * count
                elif p['mode'] == 'fixed_size':
                    n = p['pagesPerFile']
                    if n is None or p['ranges']:
                        raise PlanError('INVALID_SPLIT_PARAMETERS')
                    counts = [min(n, count - i) for i in range(0, count, n)]
                else:
                    if p['pagesPerFile'] is not None or not p['ranges']:
                        raise PlanError('INVALID_SPLIT_PARAMETERS')
                    if any(r['start'] > r['end'] or r['end'] > count for r in p['ranges']):
                        raise PlanError('INVALID_SPLIT_RANGE')
                    counts = [r['end'] - r['start'] + 1 for r in p['ranges']]
                if len(counts) > 1000:
                    raise PlanError('TOO_MANY_ARTIFACTS')
                result = {'kind': 'collection', 'pageCount': None, 'encrypted': False,
                          'members': [{'kind': 'pdf', 'pageCount': n, 'encrypted': False} for n in counts]}
            elif op == 'pdf_to_images':
                pages = selected_pages(p['pages'], count)
                if len(pages) > 1000:
                    raise PlanError('TOO_MANY_ARTIFACTS')
                result = {'kind': 'collection', 'pageCount': None, 'encrypted': False,
                          'members': [{'kind': 'image', 'pageCount': None, 'encrypted': False} for _ in pages]}
            elif op == 'extract_text':
                selected_pages(p['pages'], count)
                if p['ocrIfNeeded'] and 'ocr_pdf' not in request['capabilities']:
                    raise PlanError('OCR_CAPABILITY_REQUIRED')
                result = {'kind': 'text', 'pageCount': None, 'encrypted': False}
            elif op == 'protect_pdf':
                result['encrypted'] = True  # Requires actual secure local prerequisite before execution.
            elif op == 'unlock_pdf':
                if not result['encrypted']:
                    raise PlanError('NOT_ENCRYPTED')
                result['encrypted'] = False
            elif op in ('reverse_pdf', 'remove_metadata'):
                pass
            else:
                raise PlanError('NO_REFERENCE_SEMANTICS')
        state[out] = result
        produced.add(out)
    if set(plan['resultRefs']) != produced - consumed:
        raise PlanError('TERMINAL_OUTPUT_MISMATCH')
    return {'status': 'plan', 'outputs': {r: state[r] for r in plan['resultRefs']}}
