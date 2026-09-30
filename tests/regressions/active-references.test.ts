import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LocalFileStore} from '../../packages/core/src/local-file-store';
import {JobController} from '../../packages/core/src/job-controller';
import {CONTEXT_RESOURCE_REFUSAL} from '../../packages/core/src/request-context';
import {WorkspaceVault,savedArtifacts} from '../../packages/core/src/workspace-vault';
import {buildRequest,quickPlan,validateEnvelope,type Request as PlannerRequest} from '../../packages/contracts/src/protocol';
import {validateRequest} from '../../packages/planner/src/request';
import {privateInstruction,safeOrdinaryText} from '../../packages/planner/src/privacy';
import {isClarificationAnswer,pendingFromResponse,withPendingClarification} from '../../packages/planner/src/clarification';
import {createGateway} from '../../packages/planner/src/gateway';
import {preflight,transform} from '../../packages/web-pdf/src/engine';
import type {Inspection,EngineRequest} from '../../packages/web-pdf/src/types';
import {NodeVaultBackend,newKeychain} from '../helpers/workspace-backend';

// Metadata sequences deliberately exercise catalog/projection rather than memory
// reclamation. The engine integration below separately uses real bundled PDFs.
const inspection:Inspection={pages:[{text:'LOCAL SYNTHETIC DOCUMENT FACT CANARY',width:612,height:792,rotation:0},{text:'LOCAL OCR CANARY',width:612,height:792,rotation:0}]};
const ref=(original:boolean,n:number)=>`${original?'file':'out'}_${n.toString(16).padStart(32,'0')}`;
const unavailable=async()=>{throw new Error('No engine expected in a metadata sequence.');};
async function seed(originalCount=2,resultCount=0){
  const store=new LocalFileStore();
  const controller=new JobController(store,{worker:unavailable,inspect:unavailable,recognize:unavailable});
  async function add(original:boolean,count:number){
    for(let i=0;i<count;i++){
      const n=store.list.filter(f=>f.original===original).length+1;
      const artifact=await store.prepare(new Uint8Array([original?1:2,n%256]),original?`synthetic-original-${n}.pdf`:`synthetic-result-${n}.pdf`,inspection,original,ref(original,n),'LOCAL UNRELATED RESULT METADATA CANARY');
      store.commit([artifact],store.revision);
    }
  }
  await add(true,originalCount);await add(false,resultCount);
  return {store,controller,add};
}
const clarify={schemaVersion:'1.0' as const,status:'clarify' as const,reasonCode:'ambiguous_reference' as const,steps:[],resultRefs:[],clarification:{question:'Which PDF should I use?',choices:['First selected PDF','Second selected PDF']}};
const requestRefs=(r:PlannerRequest)=>r.files.map(f=>f.ref);
function legacy(store:LocalFileStore,instruction:string){
  return buildRequest({revision:store.revision,files:store.list.map(f=>({ref:f.ref,kind:'pdf',pageCount:f.pageCount,sizeBytes:f.sizeBytes,encrypted:false})),selected:store.originals,focus:store.focus,originals:store.originals},instruction);
}

for(const boundary of [40,100])test(`SHR-42: crossing the audited ${boundary}-reference boundary retains history and admits current-result planning`,async()=>{
  const {store,controller,add}=await seed(2,boundary-2);
  if(boundary===40)assert.equal(validateRequest(legacy(store,'Compress current result')).files.length,40);
  else assert.throws(()=>validateRequest(legacy(store,'Compress current result')),/active file reference limit/);
  await add(false,1);
  if(boundary===40)assert.throws(()=>validateRequest(legacy(store,'Compress current result')),/active file reference limit/);
  else assert.throws(()=>legacy(store,'Compress current result'),/Invalid instruction or local manifest/);
  const before=store.mark(),request=validateRequest(controller.request('Compress the current result'));
  assert.deepEqual(requestRefs(request),[store.focus]);
  assert.deepEqual(request.originalRefs,[]);assert.deepEqual(request.selectionRefs,[]);
  assert.doesNotThrow(()=>quickPlan(request,'compress'));
  assert.equal(store.list.length,boundary+1);assert.deepEqual(store.mark(),before);
});

test('SHR-42: multiple import batches preserve global file numbers after many results',async()=>{
  const {store,controller,add}=await seed(2,110),firstTwo=store.originals;
  await add(true,3);
  for(let n=1;n<=5;n++){
    const request=controller.request(`Remove page 1 from file ${n}`);
    assert.equal(request.instruction,`Remove page 1 from ${ref(true,n)}`);
    assert.deepEqual(request.selectionRefs,[ref(true,n)]);
    assert.deepEqual(request.originalRefs,[ref(true,n)]);
    assert.deepEqual(requestRefs(validateRequest(request)),[ref(true,n),store.focus]);
  }
  assert.deepEqual(store.originals.slice(0,2),firstTwo);
  assert.equal(controller.request('Merge all originals').selectionRefs.length,5);
});

test('SHR-42: early file aliases and explicit file lists never rebind to projected positions',async()=>{
  const {store,controller}=await seed(8,105);
  for(const text of ['Remove page 1 from the second file','Remove page 1 from file number 2','Remove page 1 from file #2']){
    const request=controller.request(text);assert.deepEqual(request.selectionRefs,[ref(true,2)]);assert.ok(request.instruction.includes(ref(true,2)));
  }
  for(const text of ['Merge files 2 and 1','Merge file 2 and 1','Merge files 2 and file 1','Merge the second and first files','Merge the second and first file']){
    const request=controller.request(text);assert.deepEqual(request.selectionRefs,[ref(true,2),ref(true,1)]);assert.deepEqual(request.originalRefs,[ref(true,2),ref(true,1)]);
  }
  const mixed=controller.request(`Merge ${ref(true,1)} and file 2`);assert.deepEqual(mixed.selectionRefs,[ref(true,1),ref(true,2)]);
  const three=controller.request('Merge files 3, 2, and 1');assert.deepEqual(three.selectionRefs,[ref(true,3),ref(true,2),ref(true,1)]);
  const named=controller.request(privateInstruction('Remove page 1 from synthetic-original-2.pdf',store.list));
  assert.deepEqual(named.selectionRefs,[ref(true,2)]);assert.doesNotMatch(named.instruction,/\.pdf/);
  for(const text of ['Compress file 0','Compress file(2)','Compress file2','Compress file -2','Compress file 99','Compress result 0','Compress result 999','Merge files 1-3','Merge results 1 through 3','Merge first through third results','Merge results first-third','Compress the twenty-first result','Compress the second-to-last result',`Compress ${ref(true,99)}`])assert.throws(()=>controller.request(text));
});

test('SHR-42: earlier result identity survives follow-ups, Undo and reselecting an undone artifact',async()=>{
  const {store,controller,add}=await seed(2,105);
  const early=ref(false,1),oldLast=store.focus!,previous=ref(false,104);
  assert.deepEqual(controller.request('Remove page 1 from the first result').selectionRefs,[early]);
  assert.deepEqual(controller.request('Remove page 1 from result 1').selectionRefs,[early]);
  assert.deepEqual(controller.request('Remove page 1 from the previous result').selectionRefs,[previous]);
  await controller.undo();assert.equal(store.focus,previous);
  assert.deepEqual(requestRefs(controller.request('Compress current result')),[previous]);
  assert.deepEqual(controller.request('Compress result 105').selectionRefs,[oldLast]);
  await add(false,1);assert.equal(store.focus,ref(false,106));
  assert.deepEqual(controller.request('Compress result 105').selectionRefs,[oldLast]);
  assert.deepEqual(controller.request('Compress the first result').selectionRefs,[early]);
  assert.equal(store.list.length,108);assert.equal(store.get(oldLast).meta.ref,oldLast);
});

test('SHR-42: bounded ambiguous candidates and clarification retain the intended selection',async()=>{
  const {store,controller}=await seed(3,110);
  const request=controller.request('Remove page 1 from one of the files');
  assert.deepEqual(request.selectionRefs,store.originals);assert.equal(request.files.length,4);
  const pending=pendingFromResponse(request,clarify);
  const continuation=withPendingClarification(controller.request('The second one',pending),pending);
  assert.deepEqual(validateRequest(continuation).pendingClarification,pending);
  assert.deepEqual(continuation.selectionRefs,request.selectionRefs);
  assert.equal(continuation.instruction,'The second one');
  const explicit=withPendingClarification(controller.request('File 2',pending),pending);
  assert.equal(explicit.instruction,ref(true,2));
  const subset=controller.request('Remove a page from file 2');
  const subsetPending=pendingFromResponse(subset,clarify);
  assert.throws(()=>controller.request('File 1',subsetPending),/not a candidate/);
});

test('SHR-42: imports cannot retarget a clarification; stale answers refuse and global numbering survives',async()=>{
  const {store,controller,add}=await seed(2,110);
  const first=controller.request('Remove a page from one of the files'),pending=pendingFromResponse(first,clarify),snapshot=structuredClone(pending);
  await add(true,2);
  assert.throws(()=>controller.request('The second one',pending),/stale/i);
  assert.throws(()=>withPendingClarification(controller.request('File 2'),pending),/stale/i);
  assert.deepEqual(pending,snapshot);assert.deepEqual(pending.selectionRefs,[ref(true,1),ref(true,2)]);
  assert.deepEqual(controller.request('Remove page 1 from file 2').selectionRefs,[snapshot.selectionRefs[1]]);
  assert.equal(store.originals.length,4);
});

test('SHR-42: Undo and commit invalidate pending revision without losing candidates',async()=>{
  const {controller,add}=await seed(2,5);
  const pending=pendingFromResponse(controller.request('Remove a page from current result'),clarify);
  await controller.undo();assert.throws(()=>controller.request('Page 1',pending),/stale/i);
  const next=pendingFromResponse(controller.request('Remove a page from current result'),clarify);
  await add(false,1);assert.throws(()=>controller.request('Page 1',next),/stale/i);
});

test('SHR-42: ambiguous earlier results retain every candidate up to the unchanged envelope',async()=>{
  const {controller,store}=await seed(2,40);
  const request=validateRequest(controller.request('Compress an earlier result'));
  assert.equal(request.files.length,40);assert.deepEqual(request.selectionRefs,store.list.filter(f=>!f.original).map(f=>f.ref));
  const pending=pendingFromResponse(request,clarify);
  assert.equal(validateRequest(withPendingClarification(controller.request('The second one',pending),pending)).files.length,40);
  assert.equal(isClarificationAnswer('Result 2',pending),true);
  assert.equal(isClarificationAnswer('The first result',pending),true);
  const explicit=withPendingClarification(controller.request('Result 2',pending),pending);
  assert.equal(explicit.instruction,ref(false,2));assert.deepEqual(explicit.selectionRefs,request.selectionRefs);
});

test('SHR-42: required active sets over 40 refuse without arbitrary subset, billing or retention changes',async()=>{
  const {store,controller}=await seed(2,41),before=store.mark();
  assert.throws(()=>controller.request('Compress an earlier result'),{message:CONTEXT_RESOURCE_REFUSAL});
  assert.throws(()=>controller.request('Merge all results'),{message:CONTEXT_RESOURCE_REFUSAL});
  const all=store.list.filter(f=>!f.original).map(f=>f.ref);
  assert.throws(()=>controller.request(`Merge ${all.join(' and ')}`),{message:CONTEXT_RESOURCE_REFUSAL});
  assert.deepEqual(store.mark(),before);assert.equal(store.list.length,43);assert.ok(store.canUndo);
  assert.doesNotMatch(CONTEXT_RESOURCE_REFUSAL,/upgrade|Pro|pay|subscription/i);
  assert.equal(validateRequest(controller.request('Compress result 1')).files.length,2);
});

test('SHR-42: planner payload excludes unrelated historical refs, names, OCR, facts and metadata',async()=>{
  const {store,controller}=await seed(5,120),before=store.mark();
  const request=validateRequest(controller.request(privateInstruction('Remove page 1 from synthetic-original-2.pdf',store.list)));
  const json=JSON.stringify(request);
  assert.deepEqual(requestRefs(request),[ref(true,2),ref(false,120)]);
  for(const file of store.list){
    if(file.ref!==ref(true,2)&&file.ref!==store.focus)assert.ok(!json.includes(file.ref));
    for(const excluded of [file.name,file.checksum,file.note,...file.inspection.pages.map(p=>p.text)])assert.ok(!json.includes(excluded),excluded);
  }
  for(const key of ['inspection','bytes','name','checksum','note','ocr','path','history'])assert.ok(!Object.hasOwn(request.files[0],key));
  assert.deepEqual(store.mark(),before);
  // Local checks still inspect historical text before projection.
  assert.throws(()=>privateInstruction(inspection.pages[0].text,store.list),/text from your PDF/);
});

test('SHR-42: unrelated historical metadata does not reach the gateway provider; out-of-projection plans reject',async()=>{
  const {controller,store}=await seed(2,110);
  const request=controller.request('Remove page 1 from current result');let calls=0,reservations=0;
  const gateway=createGateway({status:async()=>({connected:true,enabled:true,remaining:1}),reserve:async()=>{reservations++;return {key:'sk-synthetic-never-network',release:async()=>{}};}},async projected=>{
    calls++;assert.deepEqual(requestRefs(projected),[store.focus]);return quickPlan(projected,'remove',1).planner;
  },{minIntervalMs:0});
  const status=await(await gateway(new Request('http://localhost:3211/api/planner/status'))).json();
  const response=await gateway(new Request('http://localhost:3211/api/planner',{method:'POST',headers:{origin:'http://localhost:3211','content-type':'application/json','x-atepdf-token':status.token},body:JSON.stringify(request)}));
  assert.equal(response.status,200);assert.equal(calls,1);assert.equal(reservations,1);
  const bad=quickPlan(request,'remove',1);bad.planner.steps[0].inputs=[ref(false,1)];
  assert.throws(()=>validateEnvelope(bad,request,store.revision),/Unknown/);
});

async function independent(bytes:Uint8Array):Promise<Inspection>{
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=getDocument({data:bytes.slice(),useSystemFonts:true,verbosity:0}),doc=await task.promise;
  try{const pages=[];for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n),v=page.getViewport({scale:1}),text=await page.getTextContent();pages.push({text:text.items.map(i=>'str'in i?i.str:'').join(' ').replace(/\s+/g,' ').trim(),width:v.width,height:v.height,rotation:page.rotate});}return {pages};}finally{await task.destroy();}
}
const engine={worker:async(r:EngineRequest)=>r.kind==='inspect'?{pages:(await preflight(r.bytes)).getPageCount()}:transform(r,()=>{}),inspect:independent,recognize:async()=>[]};

test('SHR-42: actual PDF follow-up and Undo work beyond 100 retained refs; saved history restores stable result numbers',async()=>{
  const store=new LocalFileStore(),controller=new JobController(store,engine);
  const bytes=new Uint8Array(await readFile('tests/fixtures/brief.pdf'));
  await controller.import([new File([bytes],'brief.pdf')]);assert.equal(controller.state.error,null);
  const originalHash=store.list[0].checksum;
  await controller.quick('compress');assert.equal(controller.state.error,null);const early=store.focus!;
  // Retained copies of actual independently inspected fixture bytes; no fake engine success.
  const checked=await independent(bytes);
  for(let n=2;n<=103;n++)store.commit([await store.prepare(bytes,'atepdf-result.pdf',checked,false,ref(false,n))],store.revision);
  const previous=store.focus!,count=store.list.length;
  await controller.quick('remove',2);assert.equal(controller.state.error,null);assert.equal(store.get(store.focus!).meta.pageCount,1);
  assert.match(store.get(store.focus!).meta.inspection.pages[0].text,/A1/);assert.equal(store.list.length,count+1);
  await controller.undo();assert.equal(store.focus,previous);assert.equal(store.get(store.originals[0]).meta.checksum,originalHash);
  const request=controller.request('Remove page 2 from the first result'),plan=quickPlan(request,'remove',2);
  plan.planner.steps[0].inputs=[early];await controller.execute(plan,request);assert.equal(controller.state.error,null);assert.equal(store.get(store.focus!).meta.pageCount,1);
  assert.equal(store.get(early).meta.pageCount,2);
  const directory=await mkdtemp(join(tmpdir(),'atepdf-shr42-')),keys=newKeychain();
  try{
    const vault=new WorkspaceVault(new NodeVaultBackend(directory,keys),{redact:safeOrdinaryText});await vault.open();
    const conversation=store.list.filter(f=>!f.original).map((f,i)=>({id:i+1,role:'assistant' as const,text:'Synthetic result',artifactRef:f.ref}));
    await vault.save(()=>({...controller.durableState(true),bytes:r=>store.get(r).bytes,conversation,draft:null}));
    const restored=await new WorkspaceVault(new NodeVaultBackend(directory,keys),{redact:safeOrdinaryText}).open();assert.equal(restored.kind,'restored');if(restored.kind!=='restored')throw new Error('Restore failed');
    const nextStore=new LocalFileStore(),next=new JobController(nextStore,engine);
    await next.restore(savedArtifacts(restored.checkpoint,restored.bytes),restored.checkpoint.originals,restored.checkpoint.history,restored.checkpoint.revision);
    assert.equal(restored.checkpoint.conversation.length,conversation.length);assert.equal(nextStore.list.length,store.list.length);
    assert.deepEqual(next.request('Remove page 1 from first result').selectionRefs,[early]);
    assert.equal(validateRequest(next.request('Compress current result')).files.length,1);
    await next.undo();assert.equal(nextStore.focus,previous);assert.equal(nextStore.get(early).meta.checksum,store.get(early).meta.checksum);
  }finally{await rm(directory,{recursive:true,force:true});}
});
