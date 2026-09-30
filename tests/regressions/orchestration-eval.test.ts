import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadInputs,loadKeys,loadRecordings,ROOT} from '../evals/orchestration/corpus';
import {currentAdapter} from '../evals/orchestration/current-adapter';
import {grade} from '../evals/orchestration/graders';
import {normalizePlan,equal} from '../evals/orchestration/normalize';
import {defaultPrivacyPolicy} from '../evals/orchestration/privacy-grader';
import {metrics,compare} from '../evals/orchestration/report';
import type {AnswerKey,Observation,Scenario,Scope} from '../evals/orchestration/types';

async function fixture(id='O107-001'){
  const scenarios=await loadInputs('dev'),scenario=scenarios.find(s=>s.id===id)!;
  const key=(await loadKeys('dev',scenarios)).get(id)!;
  const observed=await currentAdapter(await loadRecordings('dev')).evaluate(scenario,{});
  return {scenario,key,observed};
}
const caught=(scenario:Scenario,key:AnswerKey,observed:Observation,group:string)=>{
  const result=grade(scenario,key,observed);assert.equal(result.passed,false);assert.ok(result.failures.some(f=>f.group===group),JSON.stringify(result.failures));return result;
};
test('orchestration corpus: closed schema, deterministic disjoint split and multi-turn keys',async()=>{
  const dev=await loadInputs('dev'),held=await loadInputs('held-out');
  assert.equal(dev.length,41);assert.equal(held.length,23);
  assert.equal(new Set([...dev,...held].map(s=>s.id)).size,64);
  assert.equal(new Set([...dev,...held].map(s=>s.family)).size,64);
  assert.equal(new Set([...dev,...held].map(s=>s.category)).size,14);
  assert.ok(dev.some(s=>s.turns.length>1)&&held.some(s=>s.turns.length>1));
  await loadKeys('dev',dev);await loadKeys('held-out',held);
  assert.deepEqual(await loadInputs('dev'),dev);
});
test('eval grader catches wrong tool and invented tool even when admission refused',async()=>{
  const {scenario,key,observed}=await fixture();
  (observed.turns[0].rawResponse as any).steps[0].operation='run_shell';
  observed.turns[0].toolInvocations[0].operation='run_shell' as never;
  observed.turns[0].accepted=false;
  const result=caught(scenario,key,observed,'unsupported_tool');assert.equal(result.hallucinations,1);assert.equal(result.invalidPlans,1);
});
test('eval grader catches a supported but wrong tool',async()=>{
  const {scenario,key,observed}=await fixture('O107-004');
  (observed.turns[0].rawResponse as any).steps[0].operation='compress_pdf';
  observed.turns[0].toolInvocations[0].operation='compress_pdf';caught(scenario,key,observed,'tool_selection');
});
test('eval grader catches wrong operation order',async()=>{
  const {scenario,key,observed}=await fixture('O107-009');
  (observed.turns[0].rawResponse as any).steps.reverse();caught(scenario,key,observed,'ordering');
});
test('eval grader catches reversed file order with an actionable expected/got message',async()=>{
  const {scenario,key,observed}=await fixture();
  (observed.turns[0].rawResponse as any).steps[0].inputs.reverse();
  const result=caught(scenario,key,observed,'references');assert.match(result.failures.find(f=>f.group==='references')!.message,/expected merge_pdf refs \["A","B"\], got \["B","A"\]/);
});
test('eval grader catches wrong physical page selectors',async()=>{
  const {scenario,key,observed}=await fixture('O107-002');
  (observed.turns[0].rawResponse as any).steps[0].params.pages.indices=[2];caught(scenario,key,observed,'pages');
});
test('eval grader penalizes needless clarification',async()=>{
  const {scenario,key,observed}=await fixture('O107-002');observed.turns[0].status='clarify';
  const result=caught(scenario,key,observed,'clarification');assert.equal(result.clarification.false,1);
});
test('eval grader penalizes missing clarification and wrong choices',async()=>{
  const {scenario,key,observed}=await fixture('O107-018');observed.turns[0].status='unsupported';
  assert.equal(caught(scenario,key,observed,'clarification').clarification.missed,1);
  observed.turns[0].status='clarify';(observed.turns[0].rawResponse as any).clarification.choices=['Page 1'];caught(scenario,key,observed,'clarification');
});
test('eval grader catches malformed and missing proposed plans',async()=>{
  const {scenario,key,observed}=await fixture();observed.turns[0].rawResponse={status:'plan',steps:[]};
  assert.equal(caught(scenario,key,observed,'schema').invalidPlans,1);
  observed.turns[0].rawResponse=null;assert.equal(caught(scenario,key,observed,'schema').invalidPlans,1);
  for(const raw of [{steps:'malformed',resultRefs:[]},{steps:[null],resultRefs:[]},{steps:[{operation:'merge_pdf',outputRef:'out_bad',inputs:null}],resultRefs:[]}]){observed.turns[0].rawResponse=raw;assert.equal(caught(scenario,key,observed,'schema').invalidPlans,1);}
});
test('eval grader catches stale revision acceptance and stale target acceptance',async()=>{
  const {scenario,key,observed}=await fixture('O107-024');assert.equal(grade(scenario,key,observed).passed,true);
  observed.turns[0].accepted=true;observed.turns[0].rejection=null;
  assert.equal(caught(scenario,key,observed,'stale_revision').staleAcceptances,1);
  const stale=await fixture('O107-025');stale.observed.turns[1].accepted=true;stale.observed.turns[1].rejection=null;caught(stale.scenario,stale.key,stale.observed,'stale_revision');
});
test('eval grader catches forbidden provider calls and missing legitimate provider calls',async()=>{
  const {scenario,key,observed}=await fixture('O107-056');observed.turns[0].providerCalls=1;
  assert.equal(caught(scenario,key,observed,'provider_calls').unnecessaryProviderCalls,1);
  const live=await fixture();live.observed.turns[0].providerCalls=0;
  assert.equal(caught(live.scenario,live.key,live.observed,'provider_calls').missingProviderCalls,1);
});
test('eval grader catches forbidden tool invocation and premature quality execution',async()=>{
  const {scenario,key,observed}=await fixture('O107-044');
  observed.turns[0].toolInvocations=(observed.turns[0].rawResponse as any).steps;
  key.turns[0].forbiddenTools=['compress_pdf'];caught(scenario,key,observed,'entitlement_safety');
});
test('eval grader catches document, derived, filename, path and secret canaries in nested outbound data',async()=>{
  for(const kind of ['document','derived','filename','path','secret'] as const){
    const {scenario,key,observed}=await fixture();scenario.canaries=[{kind,value:'EVAL-CANARY'}];
    const payload=observed.turns[0].outbound[0].payload as any;payload.nested={deep:['EVAL-CANARY']};
    assert.ok(caught(scenario,key,observed,'privacy').privacyViolations>0);
  }
});
test('privacy policy detects absent, stale, revoked and expanded permission and provider mismatch',async()=>{
  const {scenario}=await fixture();
  const scope:Scope={operation:'analyse',purpose:'invoice',recipients:['openai','atepdf-relay'],refs:['A'],pages:[1],revision:4,categories:['ocr']};
  const event={kind:'content' as const,recipient:'openai',payload:{ocr:'synthetic'},scope};
  assert.match(defaultPrivacyPolicy(scenario,event).join(' '),/without current affirmative consent/);
  scenario.consent.receipt={...scope,revoked:false};assert.deepEqual(defaultPrivacyPolicy(scenario,event),[]);
  for(const patch of [{revision:5},{purpose:'different'},{operation:'other'},{refs:['A','B']},{pages:[1,2]},{recipients:['new-provider']},{categories:['ocr','image']}]){
    assert.ok(defaultPrivacyPolicy(scenario,{...event,scope:{...scope,...patch}}).length>0);
  }
  assert.match(defaultPrivacyPolicy(scenario,{...event,recipient:'other-provider'}).join(' '),/recipient/);
  scenario.consent.receipt.revoked=true;assert.ok(defaultPrivacyPolicy(scenario,event).length>0);
  scenario.canaries=[{kind:'secret',value:'EVAL-PASSWORD'}];scenario.consent.receipt.revoked=false;
  assert.match(defaultPrivacyPolicy(scenario,{...event,payload:{password:'EVAL-PASSWORD'}}).join(' '),/secret/);
});
test('privacy grader policy is replaceable without changing runner/corpus contracts',async()=>{
  const {scenario,key,observed}=await fixture();
  const result=grade(scenario,key,observed,()=>['future SHR-36 gate denied']);assert.equal(result.privacyViolations,1);assert.match(result.failures[0].message,/future SHR-36/);
});
test('eval grader catches allowance bypass and permits safe controls',async()=>{
  const {scenario,key,observed}=await fixture('O107-053');assert.equal(caught(scenario,key,observed,'entitlement_safety').entitlementBypasses,1);
  const safe=await fixture('O107-031');assert.equal(grade(safe.scenario,safe.key,safe.observed).passed,true);
});
test('plan equivalence ignores labels/object key order and removal index order, preserving dependency and input order',async()=>{
  const {key}=await fixture('O107-060');const expected=key.turns[0].plan as any,other=structuredClone(expected);
  other.steps[0].id='s_different';other.steps[0].outputRef='out_other';other.resultRefs=['out_other'];other.steps[0].params.pages.indices.reverse();
  assert.ok(equal(normalizePlan(expected),normalizePlan(other)));
  const chain=(await fixture('O107-009')).key.turns[0].plan as any;
  const renamed=structuredClone(chain);const old=renamed.steps[0].outputRef;renamed.steps[0].outputRef='out_alias';renamed.steps[1].inputs=[renamed.steps[0].outputRef];
  assert.ok(equal(normalizePlan(chain),normalizePlan(renamed)));
  renamed.steps[1].inputs=['A'];assert.equal(equal(normalizePlan(chain),normalizePlan(renamed)),false);
  assert.equal(typeof old,'string');
});
test('protect-last constraints catch encryption before content changes even for unavailable tools',async()=>{
  const {scenario,key,observed}=await fixture('O107-042');
  observed.turns[0].rawResponse={schemaVersion:'1.0',status:'plan',reasonCode:null,clarification:null,steps:[{id:'s_1',operation:'protect_pdf',inputs:['A'],outputRef:'out_protected',params:{algorithm:'aes256',requiresLocalSecret:true}},{id:'s_2',operation:'compress_pdf',inputs:['out_protected'],outputRef:'out_final',params:{targetBytes:null,preset:'balanced',batchMode:'single'}}],resultRefs:['out_final']};
  const result=caught(scenario,key,observed,'ordering');assert.ok(result.failures.some(f=>f.message==='expected compress_pdf before protect_pdf'));
});
test('ordered collections and final result refs are not collapsed by normalization',()=>{
  const p={steps:[{id:'s_1',operation:'split_pdf',inputs:['A'],outputRef:'out_collection',params:{ranges:[{start:1,end:2},{start:3,end:4}]}}],resultRefs:['out_collection','out_other']};
  const bad=structuredClone(p);bad.resultRefs.reverse();assert.equal(equal(normalizePlan(p),normalizePlan(bad)),false);
  bad.resultRefs=[...p.resultRefs];bad.steps[0].params.ranges.reverse();assert.equal(equal(normalizePlan(p),normalizePlan(bad)),false);
});
test('current mocked adapter preserves dynamic follow-up state and rejects missing fixtures',async()=>{
  const held=await loadInputs('held-out'),s=held.find(s=>s.id==='O107-016')!;
  const observed=await currentAdapter(await loadRecordings('held-out')).evaluate(s,{});
  assert.equal(observed.turns[1].request!.focusedResultRef,observed.turns[0].focus);
  assert.equal(observed.turns[1].request!.workspaceRevision,observed.turns[0].revision);
  assert.equal(grade(s,(await loadKeys('held-out',held)).get(s.id)!,observed).passed,true);
  await assert.rejects(currentAdapter({}).evaluate((await loadInputs('dev'))[0],{}),/Missing deterministic recording/);
});
test('baseline comparison rejects safety increases, selection changes and visible-only gains',async()=>{
  const {scenario,key,observed}=await fixture();const m=metrics([grade(scenario,key,observed)]);
  const base={corpusVersion:'1',splitVersion:'1',provenance:{corpusHash:'same'},sets:{dev:{selectionHash:'dev',metrics:m},'held-out':{selectionHash:'held',metrics:m}}};
  const candidate=structuredClone(base);candidate.sets['held-out'].metrics.privacyViolations++;
  assert.equal(compare(candidate,base).accepted,false);candidate.sets['held-out'].metrics.privacyViolations=0;candidate.sets['held-out'].metrics.score=0;
  assert.equal(compare(candidate,base).accepted,false);candidate.sets.dev.selectionHash='different';assert.throws(()=>compare(candidate,base),/different scenario selections/);
});
test('runner suppresses held-out keys/details, filters cases, exports dev only and isolates candidate inputs',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'atepdf-eval-cli-'));
  const run=(...args:string[])=>JSON.parse(execFileSync(process.execPath,['--import','tsx','tests/evals/orchestration/run.mts',...args],{encoding:'utf8',maxBuffer:4_000_000,stdio:['pipe','pipe','pipe']}));
  try{
    const result=run('--set','held-out');assert.equal(result.sets['held-out'].metrics.scenarios,23);assert.equal(result.sets['held-out'].details,undefined);assert.equal(JSON.stringify(result).includes('expected'),false);
    const single=run('--set','dev','--scenario','O107-001','--output-dir',join(dir,'result'));assert.equal(single.sets.dev.metrics.scenarios,1);assert.equal(single.sets.dev.metrics.passed,1);
    assert.match(await readFile(join(dir,'result','summary.md'),'utf8'),/scripted provider responses/);
    const filtered=run('--set','full','--category','collections');assert.equal(filtered.sets.dev.metrics.scenarios,1);assert.equal(filtered.sets['held-out'].metrics.scenarios,1);
    const heldDetails=run('--set','held-out','--scenario','O107-005','--held-out-details');assert.equal(heldDetails.sets['held-out'].details.length,1);
    execFileSync(process.execPath,['--import','tsx','tests/evals/orchestration/run.mts','--export-dev',join(dir,'dev.json')]);
    const exported=JSON.parse(await readFile(join(dir,'dev.json'),'utf8'));assert.equal(exported.scenarios.length,41);assert.equal(exported.keys.length,41);assert.equal(exported.split,'dev');
    assert.throws(()=>run('--set','dev','--scenario','not-present'),/No scenarios matched/);
    const adapter=join(dir,'candidate.mts');const workerSource=`export default {name:'input-isolation-test', async evaluate(scenario,config){if('expected' in scenario||'keys' in scenario||'responses' in scenario)throw new Error('oracle leak');if(config.model!=='fixture-only')throw new Error('config missing');let denied=false;try{await fetch('https://example.invalid')}catch{denied=true}if(!denied)throw new Error('network enabled');return ${JSON.stringify((await fixture('O107-056')).observed)};}};`;
    await writeFile(adapter,workerSource);await writeFile(join(dir,'config.json'),JSON.stringify({model:'fixture-only'}));
    const candidate=run('--set','dev','--scenario','O107-056','--adapter',adapter,'--config',join(dir,'config.json'));assert.equal(candidate.sets.dev.metrics.passed,1);
    assert.throws(()=>run('--set','dev','--config',join(dir,'config.json')),/Current baseline is fixed/);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('a matching consent receipt alone cannot allow content in a local-only scenario',async()=>{
  const {scenario,key,observed}=await fixture();
  const scope:Scope={operation:'analyse',purpose:'invoice',recipients:['openai'],refs:['A'],pages:[1],revision:4,categories:['ocr']};
  scenario.consent.receipt={...scope,revoked:false};
  observed.turns[0].outbound.push({kind:'content',recipient:'openai',payload:{ocr:'synthetic'},scope});
  const result=caught(scenario,key,observed,'privacy');assert.ok(result.failures.some(f=>f.message.includes('even with a receipt')));
});
