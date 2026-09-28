import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildRequest,quickPlan,validateEnvelope,validateEnvelopeBinding,type Request,type Envelope} from '../../packages/contracts/src/protocol';
import {bindResponse} from '../../packages/planner/src/schema';
import {LocalFileStore} from '../../packages/core/src/local-file-store';

const files=[{ref:'file_a',kind:'pdf' as const,pageCount:3,sizeBytes:3000,encrypted:false as const},{ref:'file_b',kind:'pdf' as const,pageCount:2,sizeBytes:2000,encrypted:false as const}];
const request=()=>buildRequest({revision:2,files,selected:files.map(f=>f.ref),focus:null,originals:files.map(f=>f.ref)},'Combine the two PDFs.');
const envelope=(req:Request,planner:unknown)=>({schemaVersion:'1.0',requestId:req.requestId,workspaceRevision:req.workspaceRevision,planner});

test('protocol corpus: all 21 retained adversarial plans fail before execution',async()=>{
  const rows=(await readFile('packages/contracts/corpus/invalid_plan_cases.jsonl','utf8')).trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(rows.length,21);
  for(const row of rows)assert.throws(()=>validateEnvelope(envelope(row.request,row.response),row.request,row.request.workspaceRevision),undefined,row.id);
});

test('protocol seed corpus: 25 supported golden plans preserve exact order, negation and operation sequence',async()=>{
  // Golden responses are supplied by the handoff. This tests the compiler, not model accuracy.
  const supported=new Set([1,4,5,6,7,8,9,10,11,14,17,43,44,45,46,47,48,49,50,52,53,54,55,69,70].map(n=>`SEED-${String(n).padStart(3,'0')}`));
  const rows=(await readFile('packages/contracts/corpus/planner_seed_cases.jsonl','utf8')).trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(rows.length,118);
  const checked=rows.filter(row=>supported.has(row.id));assert.equal(checked.length,25);
  for(const row of checked){const accepted=validateEnvelope(envelope(row.request,row.expected),row.request,row.request.workspaceRevision);assert.deepEqual(accepted.planner,row.expected,row.id);}
  for(const id of ['SEED-002','SEED-003','SEED-018','SEED-051','SEED-073','SEED-074','SEED-117']){
    const row=rows.find(item=>item.id===id);assert.throws(()=>validateEnvelope(envelope(row.request,row.expected),row.request,row.request.workspaceRevision),undefined,id);
  }
});

test('local context: invalid metadata and missing selection/focus/original references reject independently',()=>{
  const req=request(),plan=quickPlan(req,'merge');
  for(const change of [
    {files:[{...files[0],kind:'image'},files[1]]},
    {files:[{...files[0],encrypted:true},files[1]]},
    {files:[{...files[0],pageCount:null},files[1]]},
    {files:[{...files[0],pageCount:101},files[1]]},
    {files:[{...files[0],name:'PRIVATE-CANARY.pdf'},files[1]]},
    {files:[files[0],files[0]]},
    {selectionRefs:['file_missing']},{originalRefs:['file_missing']},{focusedResultRef:'out_missing'},
  ])assert.throws(()=>validateEnvelope(plan,{...req,...change} as Request,req.workspaceRevision));
  assert.throws(()=>buildRequest({revision:Number.MAX_SAFE_INTEGER+1,files,selected:['file_a'],focus:null,originals:['file_a']},'Compress this.'));
});

test('quick actions: never guess the first of multiple files; focused result takes precedence',()=>{
  const req=request();
  const isolated=quickPlan(req,'merge');isolated.planner.steps[0].inputs[0]='file_changed';assert.deepEqual(req.selectionRefs,['file_a','file_b']);
  for(const action of ['remove','ocr','compress'] as const)assert.throws(()=>quickPlan(req,action),/Choose one PDF/);
  req.selectionRefs=['file_b'];assert.deepEqual(quickPlan(req,'compress').planner.steps[0].inputs,['file_b']);
  req.files.push({ref:'out_current',kind:'pdf',pageCount:5,sizeBytes:4000,encrypted:false});req.focusedResultRef='out_current';
  assert.deepEqual(quickPlan(req,'remove').planner.steps[0].inputs,['out_current']);
  req.selectionRefs=['file_b','file_a'];assert.deepEqual(quickPlan(req,'merge').planner.steps[0].inputs,['file_b','file_a']);
});

test('page selectors use immediate input counts and reject duplicate/zero/fractional/all-page removal',()=>{
  const req=request(),plan=quickPlan(req,'merge');
  const merged=plan.planner.resultRefs[0];plan.planner.steps.push({id:'s_2',operation:'select_pages',inputs:[merged],outputRef:'out_trimmed',params:{action:'remove',pages:{mode:'explicit',indices:[5]}}});plan.planner.resultRefs=['out_trimmed'];
  assert.doesNotThrow(()=>validateEnvelope(plan,req,2));
  for(const indices of [[6],[0],[1.5],[2,2],[1,2,3,4,5]]){
    const bad=structuredClone(plan);bad.planner.steps[1].params.pages={mode:'explicit',indices};assert.throws(()=>validateEnvelope(bad,req,2));
  }
  const beforeMerge=structuredClone(plan);beforeMerge.planner.steps[1].inputs=['file_b'];assert.throws(()=>validateEnvelope(beforeMerge,req,2));
});

test('plan limits: hidden terminal results, future refs, duplicate IDs and unavailable language reject',()=>{
  const req=request();req.selectionRefs=['file_a'];const plan=quickPlan(req,'ocr');
  req.ocrLanguages=[];assert.throws(()=>validateEnvelope(plan,req,2),/English OCR/);req.ocrLanguages=['eng'];
  const duplicate=structuredClone(plan);duplicate.planner.steps.push({...plan.planner.steps[0],outputRef:'out_other'});assert.throws(()=>validateEnvelope(duplicate,req,2));
  const hidden=structuredClone(plan);hidden.planner.steps.push({...plan.planner.steps[0],id:'s_2',outputRef:'out_hidden'});assert.throws(()=>validateEnvelope(hidden,req,2),/final output/);
  const future=structuredClone(plan);future.planner.steps[0].inputs=['out_future'];assert.throws(()=>validateEnvelope(future,req,2));
  const many=structuredClone(plan);many.planner.steps=Array.from({length:5},(_,i)=>({...plan.planner.steps[0],id:`s_${i}`,inputs:[i?'out_'+(i-1):'file_a'],outputRef:`out_${i}`}));many.planner.resultRefs=['out_4'];assert.throws(()=>validateEnvelope(many,req,2),/executable/);
});

test('undo and clear advance revision so pending plans cannot be revived',async()=>{
  const store=new LocalFileStore(),inspection={pages:[{width:612,height:792,rotation:0,text:'synthetic'}]};
  for(const [ref,original] of [['file_a',true],['out_first',false],['out_second',false]] as const){const entry=await store.prepare(new Uint8Array([1,2,3]),'synthetic.pdf',inspection,original,ref);store.commit([entry],store.revision);}
  const req=buildRequest({revision:store.revision,files:store.list.map(f=>({ref:f.ref,kind:'pdf',pageCount:f.pageCount,sizeBytes:f.sizeBytes,encrypted:false})),selected:store.originals,focus:store.focus,originals:store.originals},'Compress the current result.');
  const plan=quickPlan(req,'compress');store.undo();assert.throws(()=>validateEnvelope(plan,req,store.revision),/Files changed/);store.clear();assert.throws(()=>validateEnvelope(plan,req,store.revision),/Files changed/);assert.equal(store.list.length,0);
});

test('binding rejects extra envelope fields and partial JSON; remapped model output labels retain chain references',()=>{
  const req=request(),plan=quickPlan(req,'chain');
  assert.throws(()=>validateEnvelopeBinding({...plan,debug:'PRIVATE-CANARY'},req,2));
  for(const partial of [JSON.stringify(plan).slice(0,-1),{...plan,planner:{steps:plan.planner.steps}}])assert.throws(()=>validateEnvelopeBinding(partial,req,2));
  const bound=bindResponse(plan.planner,req) as Envelope;
  assert.equal(bound.planner.steps.length,3);assert.notEqual(bound.planner.steps[0].outputRef,plan.planner.steps[0].outputRef);
  for(const [i,step] of bound.planner.steps.entries()){assert.match(step.outputRef,/^out_[a-f0-9]{32}$/);if(i)assert.deepEqual(step.inputs,[bound.planner.steps[i-1].outputRef]);}
  assert.deepEqual(bound.planner.resultRefs,[bound.planner.steps[2].outputRef]);
});
