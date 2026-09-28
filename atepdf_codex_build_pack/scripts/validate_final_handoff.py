#!/usr/bin/env python3
"""Validate final handoff materials, not an Attenlo application implementation.

Run from any working directory. Uses jsonschema from requirements-dev.txt.
--with-fixtures adds optional pypdf inspection of the synthetic input PDFs.
"""
from __future__ import annotations
import argparse, hashlib, importlib.util, json, os, re, subprocess, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def require(value: bool, message: str) -> None:
    if not value: raise AssertionError(message)
def load(path: str): return json.loads((ROOT/path).read_text(encoding='utf-8'))
def rows(path: str):return [json.loads(x) for x in (ROOT/path).read_text(encoding='utf-8').splitlines() if x.strip()]
def digest(path: Path):return hashlib.sha256(path.read_bytes()).hexdigest()
def run(path: str):
    env=os.environ.copy();env['PYTHONDONTWRITEBYTECODE']='1'
    result=subprocess.run([sys.executable,str(ROOT/path)],cwd=ROOT,env=env,text=True,capture_output=True,timeout=90)
    print(result.stdout,end=''); print(result.stderr,end='')
    require(result.returncode==0,f'Child validation failed: {path}')

def main() -> int:
    parser=argparse.ArgumentParser();parser.add_argument('--with-fixtures',action='store_true');args=parser.parse_args()
    checks={}
    run('scripts/validate_handoff.py')
    run('scripts/validate_growth_handoff.py')
    run('tests/test_request_boundary.py')
    checks['reference_request_boundary_unittests']=12

    for path in ROOT.rglob('*.json'):json.loads(path.read_text(encoding='utf-8'))
    for path in ROOT.rglob('*.jsonl'):
        for line in path.read_text(encoding='utf-8').splitlines():
            if line.strip():json.loads(line)
    checks['all_json_jsonl_parse']=True
    required=['00_READ_FIRST.md','CODEX_PROMPT.txt','START_HERE.md','STACK_DECISION.md','DECISIONS_AND_PRECEDENCE.md',
              'FINAL_HANDOFF.md','MASTER_BUILD_PLAN.md','DESIGN.md','AGENTS.md','implementation/FIRST_BUILD_SEQUENCE.md',
              'implementation/SHADCN_INTEGRATION.md','implementation/RELEASE_AND_AUTHORITY.md','implementation/VALIDATION_LEVELS.md',
              'research/CHAT_STACK_SOURCES.json','fixtures/startup/expectations.json','FINAL_VALIDATION_REPORT.md']
    for path in required:require((ROOT/path).is_file(),f'Missing required file: {path}')
    checks['entry_and_core_documents']=len(required)
    decision=load('implementation/decisions.json')
    require(decision['primary_web_stack']=='shadcn_ui_plus_ai_sdk','Wrong default web stack')
    require(decision['assistant_ui'].startswith('fallback_only'),'Fallback must not be installed by default')
    for key in ['native_rewrite_authorized','application_source_included','production_ready','live_model_evaluated_in_handoff',
                'live_billing_authorized','ads_authorized','public_deployment_authorized']:
        require(decision[key] is False,f'Unsafe/unverified decision: {key}')
    require(decision['document_processing']=='local_only','Wrong execution location')
    env=(ROOT/'reference/.env.example').read_text()
    for pair in ['ENABLE_LIVE_PLANNER=false','PLANNER_DAILY_BUDGET_USD=0','ENABLE_LIVE_BILLING=false','ENABLE_REMOTE_DOCUMENT_PROCESSING=false']:
        require(pair in env,f'Unsafe environment default: {pair}')
    env_values=dict(line.split('=',1) for line in env.splitlines() if '=' in line and not line.lstrip().startswith('#'))
    require(env_values['OPENAI_API_KEY']=='','Credential must be blank')
    checks['selected_stack_and_safe_authority_defaults']=True

    technical={t['id'] for t in load('docs/BUILD_TASKS.json')['tasks']}
    growth={t['id'] for t in load('growth/BUILD_TASKS.json')['tasks']}
    cases=rows('implementation/STACK_ACCEPTANCE_CASES.jsonl');caseids={r['id'] for r in cases}
    require(len(cases)==len(caseids)==26,'Integration cases count/IDs wrong')
    require(all(r['status']=='not_run_in_application' for r in cases),'False application test claims')
    tasks=load('implementation/INTEGRATION_TASKS.json');seen=set()
    for task in tasks['tasks']:
        require(task['id'] not in seen,'Duplicate integration task')
        require(set(task['depends_on'])<=seen,'Cyclic/out-of-order integration dependency')
        require(set(task['technical_task_ids'])<=technical,'Unknown technical task mapping')
        require(set(task['growth_task_ids'])<=growth,'Unknown lifecycle task mapping')
        require(set(task['acceptance_ids'])<=caseids,'Unknown integration acceptance ID')
        require(task['status']=='not_started_in_application','False task implementation claim')
        seen.add(task['id'])
    require(len(seen)==tasks['taskCount']==10,'Integration task count wrong')
    checks['mapped_integration_checkpoints']=10;checks['specified_unrun_integration_cases']=26

    # Input fixture manifests are checked even without optional parser dependency.
    fixtures=load('fixtures/startup/expectations.json')
    require(fixtures['synthetic_only'] and not fixtures['production_app_tested'],'Bad fixture claim')
    for name,rec in fixtures['files'].items():
        path=ROOT/'fixtures/startup'/name
        require(path.is_file() and path.stat().st_size==rec['bytes'] and digest(path)==rec['sha256'],'Fixture mismatch: '+name)
    checks['synthetic_input_hashes']=len(fixtures['files'])
    if args.with_fixtures:
        require(importlib.util.find_spec('pypdf') is not None,'Optional fixture inspection requires pypdf in this environment')
        run('scripts/validate_startup_fixtures.py');checks['input_pdf_pages_parser_checked']=7
    else:print('SKIPPED: optional input PDF parser check; add --with-fixtures with pypdf installed.')

    preservation=load('V2_PRESERVATION.json')
    require(preservation['source_file_count']==95,'Wrong v2 source count')
    require(len(preservation['files'])==95,'Missing v2 preservation entry')
    require(not preservation['removed_files'],'Original v2 files removed')
    changed=0
    for rec in preservation['files']:
        path=ROOT/rec['path'];require(path.is_file(),'Original v2 path missing: '+rec['path'])
        if rec['path']=='FILE_MANIFEST.json':
            require(rec['status']=='regenerated_self_excluded' and rec['final_sha256'] is None,'Manifest preservation convention invalid')
            changed+=1
            continue
        require(digest(path)==rec['final_sha256'],'Preservation current hash mismatch: '+rec['path'])
        equal=rec['source_sha256']==rec['final_sha256']
        require(rec['status']==('unchanged' if equal else 'modified'),'Wrong preservation status')
        if not equal:changed+=1
        if rec['path'].startswith(('growth/models/','design/references/','contracts/','examples/')) or rec['path'] in [
           'docs/BUILD_TASKS.json','growth/BUILD_TASKS.json','tests/planner_seed_cases.jsonl','tests/invalid_plan_cases.jsonl']:
            require(equal,'Protected original changed: '+rec['path'])
    checks['v2_paths_preserved']=95;checks['v2_files_explicitly_modified']=changed

    linkcount=0
    for path in ROOT.rglob('*.md'):
        text=re.sub(r'```.*?```','',path.read_text(encoding='utf-8'),flags=re.S)
        for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)',text):
            if '://' in target or target.startswith(('#','mailto:')):continue
            target=target.split('#')[0].split(' "')[0]
            if not target:continue
            require((path.parent/target).exists(),f'Unresolved local link: {path.relative_to(ROOT)} -> {target}')
            linkcount+=1
    checks['resolving_markdown_file_links']=linkcount
    forbidden=[]
    for path in ROOT.rglob('*'):
        if path.is_symlink():forbidden.append(str(path))
        if path.is_file() and (path.suffix.lower() in {'.ttf','.otf','.woff','.woff2','.pyc'} or '__pycache__' in path.parts):forbidden.append(str(path))
    require(not forbidden,'Disallowed packaged files: '+str(forbidden))
    checks['no_font_files_symlinks_or_python_cache']=True

    manifest=load('FILE_MANIFEST.json')
    listed={r['path'] for r in manifest['files']}
    actual={str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file() and p.name!='FILE_MANIFEST.json'}
    require(listed==actual,'Whole-package manifest does not match file set')
    for rec in manifest['files']:
        path=ROOT/rec['path']
        require(path.stat().st_size==rec['bytes'] and digest(path)==rec['sha256'],'Final manifest mismatch: '+rec['path'])
    checks['whole_package_files_hashed']=len(listed)
    print('\nPASS: final v3 handoff integration, links, fixtures, references, safety defaults and preservation checks')
    print(json.dumps(checks,indent=2))
    print('NOT RUN: application builds, local product engines, live AI, browser/native UI, billing sandbox, production privacy/security, user conversion or growth.')
    return 0

if __name__=='__main__':
    try:raise SystemExit(main())
    except (AssertionError,ValueError,OSError,subprocess.TimeoutExpired) as exc:
        print('FAIL: '+str(exc),file=sys.stderr);raise SystemExit(1)
