import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PDFDocument,degrees} from 'pdf-lib';
import {JobController} from '../../packages/core/src/job-controller';
import {LocalFileStore} from '../../packages/core/src/local-file-store';
import {preflight,transform} from '../../packages/web-pdf/src/engine';
import type {EngineRequest,EngineResult} from '../../packages/web-pdf/src/types';
import {independentPDF} from '../helpers/independent-pdf';
import {expectPages,verifyPages} from '../../packages/core/src/page-verification';
import Ajv2020 from 'ajv/dist/2020.js';

const bytes=async(name:string)=>new Uint8Array(await readFile('tests/fixtures/'+name));
type Mutation=(request:Extract<EngineRequest,{kind:'transform'}>,result:EngineResult)=>Promise<Uint8Array>;
async function setup(names:string[]){
  if(names.length===1)names=[...names,...names];
  const store=new LocalFileStore(),normal={worker:async(r:EngineRequest)=>r.kind==='inspect'?{pages:(await preflight(r.bytes)).getPageCount()}:transform(r,()=>{}),inspect:independentPDF,recognize:async()=>[]};
  const controller=new JobController(store,normal);
  await controller.import(await Promise.all(names.map(async n=>new File([await bytes(n)],n))));assert.equal(controller.state.error,null);
  await controller.quick('merge');assert.equal(controller.state.error,null);
  await controller.quick('merge');assert.equal(controller.state.error,null);
  return {store,normal};
}
async function reject(names:string[],action:'merge'|'remove',mutation:Mutation){
  const {store,normal}=await setup(names),focus=store.focus,history=store.history,originals=store.originals.map(r=>store.get(r).meta.checksum),refs=store.list.map(f=>f.ref);
  const controller=new JobController(store,{...normal,worker:async(r:EngineRequest)=>{
    const result=await normal.worker(r);if(r.kind==='inspect')return result;
    return {...result,bytes:await mutation(r,result as EngineResult)};
  }});
  await controller.quick(action,2);
  assert.equal(controller.state.stage,'failed','wrong actual PDF artifact must not be promoted');
  assert.match(controller.state.error??'',/validation|verification/i);
  assert.equal(store.focus,focus);assert.deepEqual(store.history,history);assert.deepEqual(store.list.map(f=>f.ref),refs);
  assert.deepEqual(store.originals.map(r=>store.get(r).meta.checksum),originals);
  controller.undo();assert.equal(store.focus,history.at(-2),'Undo restores only an earlier verified result');
}
const reverse:Mutation=async(_r,result)=>{
  const source=await PDFDocument.load(result.bytes),out=await PDFDocument.create();
  for(const p of await out.copyPages(source,source.getPageIndices().reverse()))out.addPage(p);
  return out.save();
};
test('SHR-47 swapped same-size empty-text scanned pages are rejected before promotion',async()=>{
  await reject(['corpus/blank-noisy-scan.pdf'],'merge',reverse);
});
test('SHR-47 shifted crop origin with unchanged size is rejected before promotion',async()=>{
  await reject(['corpus/geometry-font.pdf'],'merge',async(_r,result)=>{
    const doc=await PDFDocument.load(result.bytes),page=doc.getPage(2),box=page.getCropBox();
    page.setCropBox(box.x+5,box.y,box.width,box.height);return doc.save();
  });
});
test('SHR-47 wrong retained scanned source page is rejected despite correct count and dimensions',async()=>{
  await reject(['corpus/blank-noisy-scan.pdf'],'remove',async(r)=>{
    const source=await PDFDocument.load(r.inputs[0].bytes),out=await PDFDocument.create();
    // Requested remove page 2, but the synthetic faulty writer keeps it instead.
    for(const p of await out.copyPages(source,source.getPageIndices().filter(i=>i!==0)))out.addPage(p);return out.save();
  });
});
test('SHR-47 wrong rotation is rejected on an actual PDF artifact',async()=>{
  await reject(['usability/brief.pdf'],'merge',async(_r,result)=>{
    const doc=await PDFDocument.load(result.bytes);doc.getPage(0).setRotation(degrees(180));return doc.save();
  });
});
test('SHR-47 changed digital page order is rejected on an actual PDF artifact',async()=>{
  await reject(['usability/brief.pdf','usability/appendix.pdf'],'merge',reverse);
});
test('SHR-47 missing page is rejected on an actual PDF artifact',async()=>{
  await reject(['usability/brief.pdf'],'merge',async(_r,result)=>{
    const doc=await PDFDocument.load(result.bytes);doc.removePage(0);return doc.save();
  });
});
test('SHR-47 MediaBox origin drift is rejected even with unchanged size',async()=>{
  await reject(['corpus/geometry-font.pdf'],'merge',async(_r,result)=>{
    const doc=await PDFDocument.load(result.bytes),p=doc.getPage(2),b=p.getMediaBox();p.setMediaBox(b.x+1,b.y,b.width,b.height);return doc.save();
  });
});
test('SHR-47 positive corpus merge/removal, saved reopening and Undo preserve source mapping',async()=>{
  for(const name of ['usability/brief.pdf','scanned-note.pdf','mixed-text-and-scan.pdf','corpus/geometry-font.pdf','corpus/blank-noisy-scan.pdf']){
    const {store,normal}=await setup([name,'usability/appendix.pdf']),controller=new JobController(store,normal),previous=store.focus;
    await controller.quick('remove',2);assert.equal(controller.state.error,null,name);assert.equal(controller.state.pageVerification?.status,'passed');
    const folder=await mkdtemp(join(tmpdir(),'atepdf-shr47-saved-'));
    try{
      const path=join(folder,'saved.pdf');await writeFile(path,store.get(store.focus!).bytes);
      const again=await independentPDF(new Uint8Array(await readFile(path)));
      assert.equal(again.pages.length,store.get(previous!).meta.pageCount-1,name);
      assert.deepEqual(again.structure,store.get(store.focus!).meta.inspection.structure);
    }finally{await rm(folder,{recursive:true,force:true});}
    controller.undo();assert.equal(store.focus,previous);
  }
});
test('SHR-47 reusable mapping allows intentional reorder/rotation without executing later tools',async()=>{
  const source=await bytes('usability/brief.pdf'),inspection=await independentPDF(source),doc=await PDFDocument.load(source),out=await PDFDocument.create();
  for(const p of await out.copyPages(doc,[1,0]))out.addPage(p);out.getPage(0).setRotation(degrees(90));
  const expected=expectPages([{ref:'file_source',inspection}],7,[{input:0,page:2,rotation:90},{input:0,page:1}]);
  verifyPages(expected,await independentPDF(await out.save()),7,new AbortController().signal);
  assert.equal(expected.pages[0].sourcePage,2);assert.throws(()=>expectPages([{ref:'file_source',inspection}],7,[{input:0,page:99}]));
});
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};};
for(const phase of ['engine','validation'] as const)test(`SHR-47 revision change during ${phase} rejects the late actual output`,async()=>{
  const {store,normal}=await setup(['usability/brief.pdf']),previous=store.focus,history=store.history,entered=deferred<void>(),release=deferred<void>();
  const controller=new JobController(store,{...normal,
    worker:async(r:EngineRequest)=>{const result=await normal.worker(r);if(r.kind==='transform'&&phase==='engine'){entered.resolve();await release.promise;}return result;},
    inspect:async(b,s)=>{const inspected=await independentPDF(b,s);if(phase==='validation'){entered.resolve();await release.promise;}return inspected;},
  });
  const running=controller.quick('remove',2);await entered.promise;
  const added=await bytes('usability/appendix.pdf');store.commit([await store.prepare(added,'synthetic.pdf',await independentPDF(added),true)],store.revision);
  release.resolve();await running;assert.equal(controller.state.stage,'failed');assert.match(controller.state.error??'',/Files changed/);
  assert.equal(store.focus,previous);assert.deepEqual(store.history,history);assert.equal(controller.state.pageVerification,undefined);
});
test('SHR-47 cancellation during real independent validation keeps previous result and staged bytes unpublished',async()=>{
  const {store,normal}=await setup(['usability/brief.pdf']),previous=store.focus,refs=store.list.map(f=>f.ref),history=store.history,entered=deferred<void>(),release=deferred<void>();
  const controller=new JobController(store,{...normal,inspect:async(b,s)=>{const actual=await independentPDF(b,s);entered.resolve();await release.promise;return actual;}});
  const running=controller.quick('remove',2);await entered.promise;assert.equal(controller.state.stage,'validating');controller.cancel();release.resolve();await running;
  assert.equal(controller.state.stage,'cancelled');assert.equal(store.focus,previous);assert.deepEqual(store.list.map(f=>f.ref),refs);assert.deepEqual(store.history,history);
  assert.equal(controller.state.pageVerification,undefined);
});
test('SHR-47 missing independent source/output evidence fails closed rather than counting as verified',async()=>{
  const {store,normal}=await setup(['usability/brief.pdf']),previous=store.focus;
  const controller=new JobController(store,{...normal,inspect:async(b)=>({pages:(await independentPDF(b)).pages})});
  await controller.quick('remove',2);assert.equal(controller.state.stage,'failed');assert.match(controller.state.error??'',/evidence unavailable/);assert.equal(store.focus,previous);
  const plain={pages:(await independentPDF(await bytes('usability/brief.pdf'))).pages};
  assert.throws(()=>expectPages([{ref:'file_plain',inspection:plain}],1),/source evidence unavailable/);
});
test('SHR-47 source expectations cannot be rewritten by a yielding engine',async()=>{
  await reject(['corpus/blank-noisy-scan.pdf'],'merge',async(r,result)=>{
    const wrong=await reverse(r,result),inspection=await independentPDF(wrong);let cursor=0;
    for(const input of r.inputs){
      const count=input.inspection.pages.length;
      input.inspection.structure={...inspection.structure!,pages:inspection.structure!.pages.slice(cursor,cursor+count)};
      cursor+=count;
    }
    return wrong;
  });
});
test('SHR-47 empty-text scan identities differ without OCR and geometry includes both origins',async()=>{
  const scanned=await independentPDF(await bytes('corpus/blank-noisy-scan.pdf'));
  assert.ok(scanned.pages.every(p=>p.text===''));assert.equal(scanned.pages[0].width,scanned.pages[1].width);
  assert.notEqual(scanned.structure!.pages[0].identity,scanned.structure!.pages[1].identity);
  const geometry=await independentPDF(await bytes('corpus/geometry-font.pdf'));
  assert.deepEqual(geometry.structure!.pages[2].mediaBox,{x:20,y:30,width:600,height:800});
  assert.deepEqual(geometry.structure!.pages[2].cropBox,{x:40,y:50,width:560,height:730});
  assert.equal(geometry.structure!.pages[1].rotation,90);
});
test('SHR-47 matrix v2 cannot treat historical missing production-gate evidence as a pass',async()=>{
  const old=JSON.parse(await readFile('docs/evidence/SHR-46-2026-09-30/matrix.json','utf8'));
  const schema=JSON.parse(await readFile('tests/compatibility/matrix.schema.v2.json','utf8'));
  const validate=new Ajv2020({allErrors:true}).compile(schema);
  old.schemaVersion=2;assert.equal(validate(old),false,'v1 observations must not acquire a new gate pass');
  for(const row of old.cases)row.execution.pageIdentity={required:['merge_pdf','select_pages'].includes(row.operation),
    status:'not_run'};
  assert.equal(validate(old),false,'missing actual receipt cannot count as supported');
  for(const row of old.cases)if(row.execution.pageIdentity.required&&row.classification==='SUPPORTED')
    row.execution.pageIdentity={required:true,status:'passed',receipt:{version:1,operation:row.operation,status:'passed'}};
  assert.equal(validate(old),true,JSON.stringify(validate.errors));
  // Test values above demonstrate schema shape only; they are not saved evidence.
});
