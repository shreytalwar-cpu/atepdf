#!/usr/bin/env python3
"""Validate the v5 handoff, not the application or connected accounts. No network."""
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
    preserved=load('V4_PRESERVATION_FOR_V5.json')
    require(preserved['source_file_count']==146,'Wrong v4 source count')
    require(not preserved['removed_files'],'v4 paths were removed')
    require(len(preserved['files'])==146,'Incomplete preservation ledger')
    unchanged=0
    for row in preserved['files']:
        p=ROOT/row['path'];require(p.is_file(),'Missing original '+row['path'])
        require(digest(p)==row['final_sha256'],'Preservation hash mismatch '+row['path'])
        equal=row['source_sha256']==row['final_sha256']
        require(row['status']==('unchanged' if equal else 'modified'),'Incorrect change status')
        if equal:unchanged+=1
        if row['path'].startswith(('growth/models/','design/references/','contracts/','examples/','fixtures/','marketing/models/')):
            require(equal,'Protected source modified: '+row['path'])
    stats['original_files_unchanged']=unchanged;stats['original_files_explicitly_modified']=146-unchanged
    forbidden=[str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_symlink() or (p.is_file() and (p.suffix.lower() in {'.ttf','.otf','.woff','.woff2','.pyc'} or '__pycache__' in p.parts))]
    require(not forbidden,'Forbidden packaged file '+str(forbidden))
    manifest=load('V5_FILE_MANIFEST.json')
    actual={str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file() and p.name!='V5_FILE_MANIFEST.json'}
    require(actual=={r['path'] for r in manifest['files']},'Manifest file-set mismatch')
    for r in manifest['files']:
        p=ROOT/r['path'];require(p.stat().st_size==r['bytes'] and digest(p)==r['sha256'],'Manifest mismatch '+r['path'])
    stats['total_files_including_manifest']=len(actual)+1
    print('\nPASS: v5 package, preserved originals, references, configuration and policy tests')
    print(json.dumps(stats,indent=2))
    print('NOT RUN: application builds/UI, real PDF engines, live model, OAuth/account setup, billing/ad SDKs, emails, campaigns, schedules, conversion or financial forecasts.')
    return 0
if __name__=='__main__':
    try:raise SystemExit(main())
    except (AssertionError,ValueError,OSError,subprocess.TimeoutExpired) as e:
        print('FAIL: '+str(e),file=sys.stderr);raise SystemExit(1)
