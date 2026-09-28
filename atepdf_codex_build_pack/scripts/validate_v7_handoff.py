#!/usr/bin/env python3
"""Validate the v7 fresh-start handoff, not the application or connected accounts. No network."""
from __future__ import annotations
import csv, hashlib, json, os, re, subprocess, sys, tomllib
from pathlib import Path
from urllib.parse import unquote
ROOT=Path(__file__).resolve().parents[1]

def require(ok,message):
    if not ok:raise AssertionError(message)
def load(path):return json.loads((ROOT/path).read_text(encoding='utf-8'))
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(path):
    env=os.environ.copy();env['PYTHONDONTWRITEBYTECODE']='1'
    r=subprocess.run([sys.executable,str(ROOT/path)],cwd=ROOT,env=env,capture_output=True,text=True,timeout=120)
    print(r.stdout,end='');print(r.stderr,end='')
    require(r.returncode==0,'Reference test failed: '+path)

def main():
    for path in ['scripts/validate_handoff.py','scripts/validate_growth_handoff.py',
                 'tests/test_request_boundary.py','marketing/tests/test_marketing_controls.py',
                 'marketing/ops/tests/test_preflight.py','fresh-start/tests/test_guard.py']:
        run(path)
    stats={}
    for p in ROOT.rglob('*.json'):json.loads(p.read_text(encoding='utf-8'))
    for p in ROOT.rglob('*.jsonl'):
        for line in p.read_text(encoding='utf-8').splitlines():
            if line.strip():json.loads(line)
    cfg=tomllib.loads((ROOT/'marketing/ops/codex-mcp.example.toml').read_text())
    require(len(cfg['mcp_servers'])==5,'Expected five inactive known-endpoint examples')
    require(all(s.get('enabled') is False for s in cfg['mcp_servers'].values()),'MCP examples must be disabled')
    require(all('http_headers' not in s for s in cfg['mcp_servers'].values()),'No inline auth headers')
    stats['disabled_mcp_examples']=5
    tools=load('marketing/ops/tool-access-register.json')
    require(all(not t['installed'] and not t['authenticated'] and not t['verified_read'] for t in tools['tools']),'False connected-tool claim')
    stats['unverified_tool_records']=len(tools['tools'])
    approval=load('marketing/ops/templates/launch-approval.json')
    require(approval['approved'] is False and approval['cash_cap_minor']==0,'Approval template is live')
    require(not load('marketing/ops/templates/asset-record.json')['publication_allowed'],'Asset marked publishable')
    require(load('marketing/ops/templates/voice-of-customer.json')['records']==[],'Fake customer observations')
    require(all(not r['passed'] for r in load('marketing/ops/templates/launch-checklist.json')['checks']),'False launch proof')
    exp=load('marketing/ops/templates/experiment.json')
    require(not exp['approved'] and exp['actuals'] is None and exp['approved_cash_cap_minor']==0,'Experiment claims live data')
    stats['safe_draft_templates']=True
    known_pm={row['task_id'] for row in csv.DictReader((ROOT/'marketing/codex/TASKS.csv').open())}
    ts=load('marketing/ops/tasks.json');seen=set()
    require(ts['task_count']==len(ts['tasks'])==16,'Wrong operation task count')
    for t in ts['tasks']:
        require(t['id'] not in seen and set(t['depends_on'])<=seen,'Bad operation dependency graph')
        require(set(t['existing_marketing_tasks'])<=known_pm,'Unknown PM mapping')
        require(t['status']=='not_started_in_application','False application completion')
        seen.add(t['id'])
    stats['mapped_operational_tasks']=len(seen)
    sources=load('marketing/ops/source-register.json')
    source_ids={s['id'] for s in sources['sources']}
    for p in (ROOT/'marketing/ops').rglob('*.md'):
        for ref in re.findall(r'\bT\d{2}\b',p.read_text()):require(ref in source_ids,'Unknown tool source '+ref)
    stats['tool_launch_sources']=len(source_ids)
    linkcount=0
    for p in ROOT.rglob('*.md'):
        txt=re.sub(r'```.*?```','',p.read_text(encoding='utf-8'),flags=re.S)
        for raw in re.findall(r'\[[^\]]*\]\(([^)]+)\)',txt):
            if '://' in raw or raw.startswith(('#','mailto:')):continue
            raw=raw.split(' "')[0].split('#')[0]
            if not raw:continue
            require((p.parent/unquote(raw)).exists(),f'Broken local link {p.relative_to(ROOT)} -> {raw}')
            linkcount+=1
    stats['resolving_relative_markdown_links']=linkcount
    preserved=load('V6_PRESERVATION_FOR_V7.json')
    snapshot=load('V6_SOURCE_SNAPSHOT_FOR_V7.json')
    require(preserved['source_file_count']==snapshot['source_file_count']==199,'Wrong v6 source count')
    require(not preserved['removed_files'],'v6 paths were removed')
    source_records={r['path']:r for r in snapshot['files']}
    require(len(preserved['files'])==199 and {r['path'] for r in preserved['files']}==set(source_records),'Incomplete preservation ledger')
    unchanged=0;protected=0
    for row in preserved['files']:
        p=ROOT/row['path'];require(p.is_file(),'Missing source '+row['path'])
        require(row['source_sha256']==source_records[row['path']]['sha256'],'Source hash drift '+row['path'])
        require(digest(p)==row['final_sha256'],'Preservation hash mismatch '+row['path'])
        equal=row['source_sha256']==row['final_sha256']
        require(row['status']==('unchanged' if equal else 'modified'),'Incorrect change status')
        if equal:unchanged+=1
        if row['protected']:
            require(equal,'Protected source modified: '+row['path']);protected+=1
    stats['v6_files_unchanged']=unchanged
    stats['v6_files_explicitly_modified']=199-unchanged
    stats['protected_source_files_unchanged']=protected
    brand=load('brand/brand.json')
    require(brand['public_name']=='atepdf' and brand['wordmark_text']=='atepdf','Incorrect canonical name')
    require(brand['paid_plan_name']=='atepdf Pro','Incorrect plan name')
    require(brand['casing']=='lowercase','Brand must be lowercase')
    require(brand['approval_scope']=={'name':True,'logo_identity':True,'new_ui_mockups':False,'new_feature_claims':False,'new_onboarding_or_splash':False},'Wrong approval scope')
    require(brand['domain'] is None and brand['support_email'] is None and brand['legal_seller'] is None,'Invented domain or business details')
    require(not brand['publication_authorized'] and not brand['new_spend_authorized'],'Unauthorized launch')
    require(not brand['logo']['production_vector_supplied'] and not brand['logo']['production_store_icon_supplied'] and not brand['logo']['exact_font_identified'],'False production-asset claim')
    assets=load('brand/asset-manifest.json')['assets'];require(len(assets)==4,'Expected original plus three exact reference crops')
    for asset in assets:
        p=ROOT/asset['path']
        require(p.is_file() and digest(p)==asset['sha256'],'Brand asset mismatch '+asset['path'])
        require(not asset['production_ready'],'Raster reference labelled production ready')
        if 'crop_box_left_top_right_bottom' in asset:
            l,t,r,b=asset['crop_box_left_top_right_bottom']
            require(r-l==asset['width'] and b-t==asset['height'],'Invalid crop geometry')
            require(asset['background_retained'] and not asset['redrawn'] and not asset['upscaled'],'False source crop claim')
    decisions=load('implementation/decisions.json')
    require(decisions['public_brand']=='atepdf' and decisions['public_brand_approved'],'Missing final brand decision')
    require(not decisions['brand_board_mockups_approved'] and decisions['existing_ui_layout_preserved'],'New UI accidentally approved')
    require(decisions['document_processing']=='local_only' and decisions['planner']=='hosted_allowed','Architecture changed')
    require(set(brand['ui_source_of_truth'])==set(decisions['design_refs']),'UI references drifted')
    require({'annotation','signing','text_layout_editing'}<=set(decisions['excluded_features']),'Scope drifted')
    for rel in ['CODEX_PROMPT.txt','00_READ_FIRST.md','brand/APPROVED_BRAND.md']:
        text=(ROOT/rel).read_text().lower()
        require('atepdf' in text and 'mock-up' in text,'Missing explicit brand/mock-up instruction '+rel)
    cases=load('brand/acceptance-cases.json')
    require(len(cases['cases'])==10 and len({r['id'] for r in cases['cases']})==10,'Brand acceptance count/IDs')
    require(all(r['status']=='not_run_in_application' for r in cases['cases']),'False application-brand test claim')
    require('Brand: “atepdf”' in (ROOT/'DESIGN.md').read_text(),'Old public name in design copy')
    require('Tell atepdf' in (ROOT/'DESIGN.md').read_text(),'Old composer copy')
    stats['canonical_brand_and_approval_scope']=True
    stats['verified_brand_reference_assets']=len(assets)
    stats['brand_app_cases_specified_not_run']=len(cases['cases'])
    forbidden=[str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_symlink() or (p.is_file() and (p.suffix.lower() in {'.ttf','.otf','.woff','.woff2','.pyc'} or '__pycache__' in p.parts))]
    require(not forbidden,'Forbidden packaged file '+str(forbidden))
    # The owner-approved source strategy must be machine-readable and reflected in active docs.
    require(decisions['handoff_version']=='7.0' and decisions['source_strategy']=='new_independent_repository','Wrong source strategy')
    require(decisions['fresh_build_authorized'] is True and decisions['native_new_implementation_authorized'] is True,'Fresh build not authorised')
    require(decisions['legacy_project_role']=='read_only_learning_reference','Legacy role drift')
    for k in ['legacy_project_writes_authorized','legacy_application_clone_authorized','legacy_runtime_dependency_allowed','legacy_source_audited_in_handoff','legacy_reference_required_to_start','production_migration_authorized','old_checkout_is_destination']:
        require(decisions[k] is False,'Unsafe fresh-start flag '+k)
    legacy=load('fresh-start/reference-project.example.json')
    require(legacy['new_project_root'] is None and legacy['legacy_reference_root'] is None,'Invented user path')
    require(not legacy['legacy_writes_authorized'] and not legacy['whole_repository_copy_authorized'],'Old source write/copy permission')
    lessons=load('fresh-start/templates/learning-register.json')
    require(lessons['legacy_source_audited'] is False and lessons['legacy_source_identity'] is None,'Fake old-source audit')
    require(len(lessons['entries'])==8 and len({x['id'] for x in lessons['entries']})==8,'Wrong seeded learning IDs')
    for row in lessons['entries']:
        require(row['evidence_level']=='handoff_requirement' and row['source_path_or_commit'] is None and not row['code_ported'],'Unsupported legacy finding')
        require(row['test_status']=='not_run_in_new_application','False new-app test evidence')
        require((ROOT/row['source_reference']).is_file(),'Unknown seeded requirement source')
    active_roots=['00_READ_FIRST.md','START_HERE.md','CODEX_PROMPT.txt','AGENTS.md','DECISIONS_AND_PRECEDENCE.md','FINAL_HANDOFF.md','HANDOFF_SUMMARY_V7.md','MASTER_BUILD_PLAN.md','STACK_DECISION.md','DESIGN.md']
    active=[ROOT/x for x in active_roots]
    for folder in ['docs','implementation','brand','fresh-start','.agents','growth','marketing']:
        active.extend(p for p in (ROOT/folder).rglob('*') if p.suffix in {'.md','.txt','.json','.jsonl','.csv'} and 'models' not in p.relative_to(ROOT).parts and 'reference' not in p.relative_to(ROOT).parts and p.name not in {'SOURCES.md','source-register.json'})
    forbidden_directions=['Implement in the existing application repository','inside the existing application repository','in the existing React web project','Preserve existing SwiftUI code and Swift packages','Keep Apple native work intact','Run existing tests and launch current Apple/web products','Implemented in the existing repository','Implementation: existing web/native repository','Reuse working engines; do not rewrite the product']
    for p in active:
        text=p.read_text(encoding='utf-8')
        for phrase in forbidden_directions:
            require(phrase.lower() not in text.lower(),'Superseded direction '+str(p.relative_to(ROOT))+' : '+phrase)
    for rel in ['CODEX_PROMPT.txt','00_READ_FIRST.md','START_HERE.md']:
        text=(ROOT/rel).read_text().lower()
        require('new' in text and 'read-only' in text and 'old' in text and 'atepdf' in text,'Missing source separation '+rel)
    tasks=load('docs/BUILD_TASKS.json')
    require(tasks['taskCount']==65 and tasks['setup_strategy']=='fresh_repository_with_read_only_legacy_learning','Technical tasks wrong')
    tm={t['id']:t for t in tasks['tasks']}
    require('NEW' in tm['M0-01']['task'] and 'old source/tests' in tm['M0-02']['task'],'M0 still assumes old destination')
    growth_ids={x['id'] for x in load('growth/BUILD_TASKS.json')['tasks']}
    integration=load('implementation/INTEGRATION_TASKS.json');seen=set()
    require(integration['version']==7 and len(integration['tasks'])==10,'Integration overlay drift')
    for task in integration['tasks']:
        require(set(task['technical_task_ids'])<=set(tm),'Unknown technical dependency')
        require(set(task['growth_task_ids'])<=growth_ids,'Unknown growth dependency')
        require(set(task['depends_on'])<=seen,'Bad integration order')
        seen.add(task['id'])
    require('Fresh' in cases['cases'][7]['name'],'Brand case still assumes old-app migration')
    stats['source_strategy_fresh_and_legacy_read_only']=True
    stats['new_path_guard_tests']=24
    stats['seeded_requirements_not_legacy_findings']=8
    stats['active_files_scanned_for_stale_startup_rules']=len(active)
    manifest=load('V7_FILE_MANIFEST.json')
    actual={str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file() and p.name!='V7_FILE_MANIFEST.json'}
    require(actual=={r['path'] for r in manifest['files']},'Manifest file-set mismatch')
    for r in manifest['files']:
        p=ROOT/r['path'];require(p.stat().st_size==r['bytes'] and digest(p)==r['sha256'],'Manifest mismatch '+r['path'])
    stats['total_files_including_manifest']=len(actual)+1
    print('\nPASS: v7 fresh-start identity, source boundaries, preserved originals, references and policy tests')
    print(json.dumps(stats,indent=2))
    print('NOT RUN: old Attenlo PDF source audit or new atepdf application builds/UI, real PDF engines, live model, OAuth/account setup, billing/ad SDKs, emails, campaigns, schedules, conversion or financial forecasts.')
    return 0
if __name__=='__main__':
    try:raise SystemExit(main())
    except (AssertionError,ValueError,OSError,subprocess.TimeoutExpired) as e:
        print('FAIL: '+str(e),file=sys.stderr);raise SystemExit(1)
