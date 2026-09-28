import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalFileStore} from '../../packages/core/src/local-file-store';
import {JobController} from '../../packages/core/src/job-controller';
import {quickPlan,type Operation} from '../../packages/contracts/src/protocol';
import type {Inspection,EngineRequest,EngineResult} from '../../packages/web-pdf/src/types';

// Synthetic byte counts isolate orchestration; real PDF engine tests live separately.
const inspection=(count:number):Inspection=>({pages:Array.from({length:count},()=>({width:612,height:792,rotation:0,text:''}))});
async function storeWithInputs(){
  const store=new LocalFileStore();
  for(const [ref,pages] of [['file_a',3],['file_b',2]] as const){const entry=await store.prepare(new Uint8Array([pages]),'synthetic.pdf',inspection(pages),true,ref);store.commit([entry],store.revision);}
  return store;
}
function services(operations:Operation[],worker:(request:EngineRequest)=>Promise<EngineResult|{pages:number}>){return {capabilities:operations,worker,inspect:async(bytes:Uint8Array)=>inspection(bytes[0]),recognize:async()=>[]};}

test('store snapshots bytes and inspection before asynchronous hashing',async()=>{
  const store=new LocalFileStore(),bytes=new Uint8Array([1,2,3]),checked=inspection(1);
  const pending=store.prepare(bytes,'synthetic.pdf',checked,true,'file_snapshot');bytes.fill(9);checked.pages[0].width=999;checked.pages.push(...inspection(1).pages);
  const entry=await pending;store.commit([entry],0);const saved=store.get('file_snapshot');
  assert.deepEqual([...saved.bytes],[1,2,3]);assert.equal(saved.meta.pageCount,1);assert.equal(saved.meta.inspection.pages[0].width,612);
  const checksum=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array([1,2,3])))].map(n=>n.toString(16).padStart(2,'0')).join('');assert.equal(saved.meta.checksum,checksum);
});

test('store batch commit is atomic when a staged metadata copy fails',async()=>{
  const store=new LocalFileStore(),first=await store.prepare(new Uint8Array([1]),'first.pdf',inspection(1),true,'file_first'),second=await store.prepare(new Uint8Array([1]),'second.pdf',inspection(1),true,'file_second');
  Object.assign(second.meta,{unexpectedFunction:()=>{}});assert.throws(()=>store.commit([first,second],0));assert.equal(store.list.length,0);assert.deepEqual(store.originals,[]);assert.equal(store.revision,0);
});

test('controller snapshots the accepted recipe while a native-style asynchronous engine yields',async()=>{
  const store=await storeWithInputs();let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});const operations:Operation[]=[];
  const controller=new JobController(store,services(['merge_pdf','select_pages'],async(request)=>{
    assert.equal(request.kind,'transform');if(request.kind!=='transform')throw new Error('Unexpected input');operations.push(request.step.operation);
    if(operations.length===1)await gate;
    const count=request.inputs.reduce((sum,input)=>sum+input.inspection.pages.length,0)-(request.step.operation==='select_pages'?(request.step.params.pages as {indices:number[]}).indices.length:0);
    return {bytes:new Uint8Array([count]),note:'Synthetic local engine'};
  }));
  const request=controller.request(),plan=quickPlan(request,'merge'),merged=plan.planner.resultRefs[0];
  plan.planner.steps.push({id:'s_2',operation:'select_pages',inputs:[merged],outputRef:'out_trimmed',params:{action:'remove',pages:{mode:'explicit',indices:[2]}}});plan.planner.resultRefs=['out_trimmed'];
  const running=controller.execute(plan,request);plan.planner.steps.splice(1);plan.planner.resultRefs=['out_mutated'];request.workspaceRevision=999;release();await running;
  assert.equal(controller.state.error,null);assert.deepEqual(operations,['merge_pdf','select_pages']);assert.equal(store.focus,'out_trimmed');assert.equal(store.get(store.focus!).meta.pageCount,4);
});

test('controller rejects capability inflation and changed manifest facts before entering an engine',async()=>{
  const store=await storeWithInputs();let calls=0;const controller=new JobController(store,services(['merge_pdf'],async()=>{calls++;return {bytes:new Uint8Array([1]),note:''};}));
  const nativeRequest=controller.request();assert.deepEqual(nativeRequest.capabilities,['merge_pdf']);assert.deepEqual(nativeRequest.ocrLanguages,[]);
  nativeRequest.capabilities.push('compress_pdf');nativeRequest.selectionRefs=['file_a'];await assert.rejects(controller.execute(quickPlan(nativeRequest,'compress'),nativeRequest),/unavailable on this device/);
  const changed=controller.request();changed.files[0].pageCount++;await assert.rejects(controller.execute(quickPlan(changed,'merge'),changed),/Files changed/);assert.equal(calls,0);assert.equal(store.focus,null);
});

test('native input cleanup releases unread copies after import rejection and cancellation',async()=>{
  for(const cancel of [false,true]){
    const read:string[]=[],released:string[]=[];const files=['first','unread'].map(name=>({name:`${name}.pdf`,size:1,arrayBuffer:async()=>{read.push(name);return new Uint8Array([1]).buffer;},release:()=>{released.push(name);}}));
    let entered!:()=>void;const started=new Promise<void>(resolve=>{entered=resolve;});
    const controller=new JobController(new LocalFileStore(),{worker:async(_request,signal)=>{entered();if(!cancel)throw new Error('Synthetic invalid PDF');return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('Cancelled')),{once:true}));},inspect:async()=>inspection(1),recognize:async()=>[]});
    const importing=controller.import(files);await started;if(cancel)controller.cancel();await importing;
    assert.deepEqual(read,['first']);assert.deepEqual(released,['first','unread']);assert.equal(controller.store.list.length,0);assert.equal(controller.state.stage,cancel?'cancelled':'failed');
  }
});

test('native input cleanup runs on success, busy rejection and other cleanup failures',async()=>{
  const released:string[]=[];let finish!:()=>void;const gate=new Promise<void>(resolve=>{finish=resolve;});
  const controller=new JobController(new LocalFileStore(),{worker:async()=>{await gate;return {pages:1};},inspect:async()=>inspection(1),recognize:async()=>[]});
  const file=(name:string,throws=false)=>({name:`${name}.pdf`,size:1,arrayBuffer:async()=>new Uint8Array([1]).buffer,release:()=>{released.push(name);if(throws)throw new Error('Synthetic cache error');}});
  const first=controller.import([file('first',true)]);await assert.rejects(controller.import([file('busy')]));assert.deepEqual(released,['busy']);finish();await first;
  assert.deepEqual(released,['busy','first']);assert.equal(controller.store.originals.length,1);assert.equal(controller.state.error,null);
});
