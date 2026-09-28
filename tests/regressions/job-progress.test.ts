import test from 'node:test';
import assert from 'node:assert/strict';
import {JobController,type JobState} from '../../packages/core/src/job-controller';
import {LocalFileStore} from '../../packages/core/src/local-file-store';
import type {EngineResult,Inspection} from '../../packages/web-pdf/src/types';

// Synthetic values isolate orchestration timing; PDF validity is tested with real fixtures separately.
const inspection=(count:number):Inspection=>({pages:Array.from({length:count},()=>({width:612,height:792,rotation:0,text:''}))});
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};};
async function inputs(){const store=new LocalFileStore();for(const ref of ['file_a','file_b']){const file=await store.prepare(new Uint8Array([1]),'PRIVATE-NAME.pdf',inspection(1),true,ref);store.commit([file],store.revision);}return store;}
const statuses=(state:JobState)=>state.progress?.steps.map(step=>step.status);

test('progress completes only after the independent reader validates a candidate',async()=>{
  const store=await inputs(),engine=deferred<EngineResult>(),reader=deferred<Inspection>(),entered=deferred<void>();let report!:(text:string)=>void;
  const controller=new JobController(store,{worker:async(_request,_signal,progress)=>{report=progress!;return engine.promise;},inspect:async()=>{entered.resolve();return reader.promise;},recognize:async()=>[]});
  const running=controller.quick('merge');
  assert.deepEqual(statuses(controller.state),['active']);assert.equal(controller.state.progress?.currentStep,0);
  report('Merged 1 of 2 files');assert.equal(controller.state.message,'Merged 1 of 2 files');
  const earlier=controller.snapshot();engine.resolve({bytes:new Uint8Array([2]),note:''});await entered.promise;
  assert.equal(controller.state.stage,'validating');assert.deepEqual(statuses(controller.state),['validating']);assert.equal(store.focus,null);
  report('Late engine update');assert.equal(controller.state.stage,'validating');assert.equal(controller.state.message,'Checking the PDF with an independent reader…');
  reader.resolve(inspection(2));await running;
  assert.equal(controller.state.stage,'complete');assert.deepEqual(statuses(controller.state),['complete']);assert.equal(controller.state.progress?.currentStep,null);assert.ok(store.focus);
  assert.deepEqual(statuses(earlier),['active'],'previous external-store snapshots stay immutable');
});

test('multi-step progress follows actual validated engine order and hides local filenames',async()=>{
  const store=await inputs(),observations:JobState[]=[];const calls:string[]=[];
  const controller=new JobController(store,{worker:async(request,_signal,progress)=>{assert.equal(request.kind,'transform');if(request.kind!=='transform')throw new Error('Unexpected request');calls.push(request.step.operation);progress?.(`Engine: ${request.step.operation}`);return {bytes:new Uint8Array([request.inputs.reduce((n,input)=>n+input.inspection.pages.length,0)]),note:''};},inspect:async bytes=>inspection(bytes[0]),recognize:async(_bytes,_inspection,_signal,progress)=>{progress('Recognised synthetic page');return [];}});
  controller.subscribe(()=>observations.push(controller.snapshot()));
  await controller.quick('chain');
  assert.deepEqual(calls,['merge_pdf','ocr_pdf','compress_pdf']);assert.deepEqual(statuses(controller.state),['complete','complete','complete']);
  for(let index=0;index<3;index++){
    const active=observations.find(state=>state.progress?.currentStep===index&&state.progress.steps[index].status==='active');assert.ok(active);
    assert.ok(active.progress!.steps.slice(0,index).every(step=>step.status==='complete'));
    assert.ok(active.progress!.steps.slice(index+1).every(step=>step.status==='pending'));
    assert.ok(observations.some(state=>state.progress?.currentStep===index&&state.progress.steps[index].status==='validating'));
  }
  assert.ok(!JSON.stringify(controller.state.progress).includes('PRIVATE-NAME'));
});

test('failed validation leaves remaining steps pending and commits no result',async()=>{
  const store=await inputs();let engineCalls=0;
  const controller=new JobController(store,{worker:async()=>{engineCalls++;return {bytes:new Uint8Array([2]),note:''};},inspect:async()=>inspection(1),recognize:async()=>[]});
  await controller.quick('chain');
  assert.equal(controller.state.stage,'failed');assert.deepEqual(statuses(controller.state),['failed','pending','pending']);assert.equal(engineCalls,1);assert.equal(store.focus,null);
});

test('cancellation during independent validation cannot mark the step complete',async()=>{
  const store=await inputs(),reader=deferred<Inspection>(),entered=deferred<void>();
  const controller=new JobController(store,{worker:async()=>({bytes:new Uint8Array([2]),note:''}),inspect:async()=>{entered.resolve();return reader.promise;},recognize:async()=>[]});
  const running=controller.quick('chain');await entered.promise;controller.cancel();reader.resolve(inspection(2));await running;
  assert.equal(controller.state.stage,'cancelled');assert.deepEqual(statuses(controller.state),['cancelled','pending','pending']);assert.equal(store.focus,null);
});

test('old engine progress cannot overwrite a new running job and clear resets progress',async()=>{
  const store=await inputs(),second=deferred<EngineResult>();let count=0,oldReport!:(text:string)=>void;
  const controller=new JobController(store,{worker:async(_request,_signal,progress)=>{count++;if(count===1){oldReport=progress!;return {bytes:new Uint8Array([2]),note:''};}return second.promise;},inspect:async bytes=>inspection(bytes[0]),recognize:async()=>[]});
  await controller.quick('merge');const running=controller.quick('compress');const before=controller.snapshot();oldReport('Stale first job');assert.equal(controller.snapshot(),before);
  second.resolve({bytes:new Uint8Array([2]),note:''});await running;controller.undo();assert.equal(controller.state.progress,undefined);controller.clear();assert.equal(controller.state.progress,undefined);assert.equal(controller.state.stage,'idle');
});

test('import counts only independently checked PDFs and never includes their names',async()=>{
  const reader=deferred<Inspection>(),entered=deferred<void>();let checks=0;
  const controller=new JobController(new LocalFileStore(),{worker:async()=>({pages:1}),inspect:async()=>{checks++;if(checks===1){entered.resolve();return reader.promise;}return inspection(1);},recognize:async()=>[]});
  const files=['PRIVATE-A.pdf','PRIVATE-B.pdf'].map(name=>({name,size:1,arrayBuffer:async()=>new Uint8Array([1]).buffer}));
  const running=controller.import(files);await entered.promise;
  assert.deepEqual(statuses(controller.state),['validating','pending']);assert.equal(controller.store.originals.length,0);
  reader.resolve(inspection(1));await running;assert.deepEqual(statuses(controller.state),['complete','complete']);assert.equal(controller.state.message,'Ready. Your originals are unchanged.');assert.equal(controller.store.originals.length,2);
  assert.ok(!JSON.stringify(controller.state.progress).includes('PRIVATE-'));
});
