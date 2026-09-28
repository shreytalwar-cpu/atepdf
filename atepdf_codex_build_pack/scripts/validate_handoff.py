#!/usr/bin/env python3
"""Validate this BUILD HANDOFF, not a model, PDF engine or finished application.

Requires only Python and the development-only jsonschema package. No network calls.
"""
from __future__ import annotations
from collections import Counter
from copy import deepcopy
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'reference'))
from validate_plan import PlanError, validate_plan  # noqa: E402
from jsonschema import Draft202012Validator  # noqa: E402


def load(relative: str):
    return json.loads((ROOT / relative).read_text(encoding='utf-8'))


def rows(relative: str):
    return [json.loads(line) for line in (ROOT / relative).read_text(encoding='utf-8').splitlines() if line.strip()]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def expect_error(request, plan, expected: str, **kwargs) -> None:
    try:
        validate_plan(request, plan, **kwargs)
    except PlanError as exc:
        require(str(exc).split(':', 1)[0] == expected, f'Expected {expected}; got {exc}')
    else:
        raise AssertionError(f'Invalid case was accepted; expected {expected}')


def main() -> int:
    checks = Counter()
    # Parse every JSON artifact independently.
    for path in ROOT.rglob('*.json'):
        if '.venv' in path.parts:
            continue
        json.loads(path.read_text(encoding='utf-8'))
        checks['json_documents'] += 1
    for path in (ROOT / 'contracts').glob('*.schema.json'):
        Draft202012Validator.check_schema(json.loads(path.read_text(encoding='utf-8')))
        checks['valid_schemas'] += 1

    operations = load('contracts/operation-registry.json')
    # Registry is intentionally a declared capability list, never actual implementation proof.
    if isinstance(operations, dict):
        entries = operations.get('operations', operations.get('tools', []))
    else:
        entries = operations
    checks['declared_operations'] = len(entries)
    require(checks['declared_operations'] == 15, 'Expected the 15-operation reference protocol')

    for name in ('hero', 'follow-up', 'batch', 'repeat'):
        request, response = load(f'examples/{name}.request.json'), load(f'examples/{name}.response.json')
        result = validate_plan(request, response,
                               received_request_id=request['requestId'],
                               received_workspace_revision=request['workspaceRevision'])
        require(result['status'] == 'plan', f'{name} example not a plan')
        if name == 'hero':
            require(result['outputs']['out_final']['pageCount'] == 25, 'Hero should retain 25 pages')
        if name == 'follow-up':
            require(next(iter(result['outputs'].values()))['pageCount'] == 23, 'Follow-up should leave 23 pages')
        if name == 'repeat':
            output = result['outputs']['out_final_batch']
            require(output['kind'] == 'collection' and len(output['members']) == 3, 'Repeat should keep three separate PDFs')
        checks['example_plan_pairs'] += 1

    for schema, example in (
        ('gateway-envelope.schema.json', 'hero.gateway-envelope.json'),
        ('local-job-event.schema.json', 'local-progress.event.json'),
    ):
        Draft202012Validator(load('contracts/' + schema)).validate(load('examples/' + example))
        checks['example_envelopes_events'] += 1

    manifest = load('tests/dataset_manifest.json')
    seeds = rows('tests/planner_seed_cases.jsonl')
    require(len(seeds) == manifest['seedCaseCount'], 'Seed count differs from manifest')
    require(len({c['id'] for c in seeds}) == len(seeds), 'Duplicate seed IDs')
    for case in seeds:
        try:
            validate_plan(case['request'], case['expected'])
        except Exception as exc:
            raise AssertionError(f"Seed {case['id']} failed: {exc}") from exc
        checks['seed_cases_validated'] += 1

    adversarial = rows('tests/invalid_plan_cases.jsonl')
    require(len(adversarial) == manifest['adversarialCaseCount'], 'Adversarial count differs from manifest')
    require(len({c['id'] for c in adversarial}) == len(adversarial), 'Duplicate invalid-case IDs')
    for case in adversarial:
        try:
            expect_error(case['request'], case['response'], case['expectedError'])
        except AssertionError as exc:
            raise AssertionError(f"Adversarial case {case['id']} failed: {exc}") from exc
        checks['adversarial_cases_rejected'] += 1

    request, plan = load('examples/hero.request.json'), load('examples/hero.response.json')
    expect_error(request, plan, 'STALE_WORKSPACE', received_workspace_revision=request['workspaceRevision'] + 1)
    expect_error(request, plan, 'REQUEST_MISMATCH', received_request_id='req_wrong')
    bad_request = deepcopy(request)
    bad_request['files'].append(deepcopy(bad_request['files'][0]))
    expect_error(bad_request, plan, 'DUPLICATE_INPUT_REF')
    checks['context_binding_checks'] += 3

    for p in ('approved-iphone.jpeg', 'approved-ipad.jpeg', 'desktop-style-reference.png'):
        q = ROOT / 'design' / 'references' / p
        require(q.exists() and q.stat().st_size > 1000, f'Missing reference {p}')
        checks['present_design_references'] += 1

    sources = (ROOT / 'SOURCES.md').read_text(encoding='utf-8')
    known = set(re.findall(r'^## (S\d+) \|', sources, flags=re.MULTILINE))
    for p in list((ROOT / 'docs').glob('*.md')) + [ROOT / 'DESIGN.md']:
        for code in re.findall(r'\bS\d{2}\b', p.read_text(encoding='utf-8')):
            require(code in known, f'{p.name} uses undefined source {code}')
    checks['defined_sources'] = len(known)
    tasks = load('docs/BUILD_TASKS.json')
    require(tasks['taskCount'] == len(tasks['tasks']), 'Backlog count inconsistent')
    require(len({t['id'] for t in tasks['tasks']}) == len(tasks['tasks']), 'Duplicate task IDs')
    require(len({t['phase'] for t in tasks['tasks']}) == 8, 'Missing implementation phase')
    checks['backlog_tasks'] = len(tasks['tasks'])

    require(manifest['modelEvaluated'] is False and manifest['independentHoldout'] is False,
            'This artifact must not claim live model evaluation')
    forbidden = [p for p in ROOT.rglob('*') if p.is_file() and p.suffix.lower() in {'.ttf', '.otf', '.woff', '.woff2'}]
    require(not forbidden, 'Do not distribute font files in this handoff')
    print('PASS: handoff schema, reference semantics and artifact consistency checks')
    print(json.dumps(dict(sorted(checks.items())), indent=2))
    print('NOT RUN: live model evaluation, PDF processing, application builds, device/browser UI tests, production network/privacy audit.')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (AssertionError, PlanError, OSError, ValueError) as exc:
        print(f'FAIL: {exc}', file=sys.stderr)
        raise SystemExit(1)
