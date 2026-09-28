#!/usr/bin/env python3
"""Validate the v6 branded handoff, not the application or connected accounts. No network."""
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
                 'marketing/ops/tests/test_preflight.py']:
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
    preserved=load('V5_PRESERVATION_FOR_V6.json')
    snapshot=load('V5_SOURCE_SNAPSHOT.json')
    require(preserved['source_file_count']==snapshot['source_file_count']==181,'Wrong v5 source count')
    require(not preserved['removed_files'],'v5 paths were removed')
    require(len(preserved['files'])==181,'Incomplete preservation ledger')
    source_records={r['path']:r for r in snapshot['files']}
    unchanged=0;protected=0
    for row in preserved['files']:
        p=ROOT/row['path'];require(p.is_file(),'Missing original '+row['path'])
        require(row['source_sha256']==source_records[row['path']]['sha256'],'Source hash drift '+row['path'])
        require(digest(p)==row['final_sha256'],'Preservation hash mismatch '+row['path'])
        equal=row['source_sha256']==row['final_sha256']
        require(row['status']==('unchanged' if equal else 'modified'),'Incorrect change status')
        if equal:unchanged+=1
        if row['protected']:
            require(equal,'Protected source modified: '+row['path']);protected+=1
    stats['v5_files_unchanged']=unchanged
    stats['v5_files_explicitly_modified']=181-unchanged
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
    manifest=load('V6_FILE_MANIFEST.json')
    actual={str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file() and p.name!='V6_FILE_MANIFEST.json'}
    require(actual=={r['path'] for r in manifest['files']},'Manifest file-set mismatch')
    for r in manifest['files']:
        p=ROOT/r['path'];require(p.stat().st_size==r['bytes'] and digest(p)==r['sha256'],'Manifest mismatch '+r['path'])
    stats['total_files_including_manifest']=len(actual)+1
    print('\nPASS: v6 atepdf identity, preserved originals, references, configuration and policy tests')
    print(json.dumps(stats,indent=2))
    print('NOT RUN: application builds/UI, real PDF engines, live model, OAuth/account setup, billing/ad SDKs, emails, campaigns, schedules, conversion or financial forecasts.')
    return 0
if __name__=='__main__':
    try:raise SystemExit(main())
    except (AssertionError,ValueError,OSError,subprocess.TimeoutExpired) as e:
        print('FAIL: '+str(e),file=sys.stderr);raise SystemExit(1)
