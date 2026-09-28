#!/usr/bin/env python3
"""Check v2 packaging/reference policy only. No live billing or app tests are run."""
import json, sys, hashlib, re
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'growth/reference'))
from growth_policy import Context, decide

def load(p): return json.loads((ROOT/p).read_text())
def lines(p): return [json.loads(s) for s in (ROOT/p).read_text().splitlines() if s.strip()]
checks={}
for row in lines('growth/tests/growth_policy_cases.jsonl'):
    got=decide(Context.from_mapping(row['context']))
    assert got==row['expected'], (row['id'],got,row['expected'])
checks['reference_gate_cases']=len(lines('growth/tests/growth_policy_cases.jsonl'))
for bad in [{'jobs_remaining':-1},{'jobs_remaining':True},{'action':'run_arbitrary_code'},{'entitlement':'invented'},{'raw_prompt':'private'},{'ai_consent':'yes'}]:
    try: Context.from_mapping(bad)
    except (ValueError,TypeError): pass
    else: raise AssertionError('Invalid context accepted')
checks['invalid_contexts_rejected']=6
schema=load('growth/contracts/growth-event.schema.json'); Draft202012Validator.check_schema(schema)
v=Draft202012Validator(schema,format_checker=FormatChecker())
v.validate(load('growth/examples/event-valid.json'))
assert list(v.iter_errors(load('growth/examples/event-forbidden.json')))
bad=load('growth/examples/event-valid.json'); bad.update(event='purchase_verified',origin='client')
assert list(v.iter_errors(bad))
bad['origin']='verified_server'; v.validate(bad)
checks['event_privacy_origin_checks']=4
cfg=load('growth/config/monetization-hypotheses.json')
assert cfg['production_enabled'] is False and cfg['experiments']['production_enabled'] is False
assert cfg['acquisition']['autonomous_spend_authorized'] is False
assert not cfg['offers']['trial_enabled'] and cfg['allowances']['free_monthly_completed_ai_jobs']==3
assert cfg['allowances']['pro_monthly_completed_ai_jobs']==300
checks['safe_default_config']=True
refs=load('research/appllama/SOURCE_REGISTRY.json')
assert len(refs['sources'])==refs['selected_screen_count']==26
assert len(set(r['app_id'] for r in refs['sources']))==refs['app_count']==8
assert all(not r['pixel_reviewed'] and r['refresh_tool']['arguments']['screen_ref']==r['screen_ref'] for r in refs['sources'])
checks['appllama_metadata_refs']=26
accept=lines('growth/tests/growth_acceptance_cases.jsonl'); ids={r['id'] for r in accept}
assert len(ids)==len(accept) and all(r['status'].startswith('not_run') for r in accept)
tasks=load('growth/BUILD_TASKS.json'); tids={t['id'] for t in tasks['tasks']}
assert tasks['taskCount']==len(tids)==len(tasks['tasks'])
seen=set()
for t in tasks['tasks']:
    assert set(t['acceptance_ids'])<=ids
    assert set(t['depends_on'])<=seen, ('unordered dependency',t['id'])
    seen.add(t['id'])
checks['additional_tasks']=len(tids); checks['specified_not_run_app_acceptance_cases']=len(ids)
for src in load('growth/models/ORIGINALS_MANIFEST.json')['files']:
    b=(ROOT/src['path']).read_bytes()
    assert hashlib.sha256(b).hexdigest()==src['sha256'] and len(b)==src['bytes']
checks['unchanged_financial_artifacts']=len(load('growth/models/ORIGINALS_MANIFEST.json')['files'])
assert len(load('growth/config/screen-inventory.json')['states'])==32
checks['specified_ui_states']=32
# Local links in newly authored growth Markdown must resolve (external/anchors ignored).
for p in (ROOT/'growth').glob('*.md'):
    for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', p.read_text()):
        if '://' in target or target.startswith('#'): continue
        assert (p.parent/target.split('#')[0]).exists(),(p,target)
print('PASS: v2 reference policy, evidence registry, financial copies and configuration checks')
print(json.dumps(checks,indent=2))
print('NOT RUN: app UI, local PDF engines, live model, store purchases, subscription webhooks, production privacy or conversion tests.')
