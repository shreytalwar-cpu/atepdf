import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument,PDFName,PDFDict} from 'pdf-lib';
import {preflight,transform} from '../../packages/web-pdf/src/engine';
import {LocalFileStore} from '../../packages/core/src/local-file-store';
import {JobController} from '../../packages/core/src/job-controller';
import {buildRequest,quickPlan,validateEnvelope} from '../../packages/contracts/src/protocol';
import {savePDF} from '../../apps/web/src/services/export';
import type {Inspection,EngineRequest} from '../../packages/web-pdf/src/types';
import {productionOutbound,OutboundDenied} from '../../packages/planner/src/outbound/gate';
import {projectHosted} from '../../packages/planner/src/outbound/schema';
const fixture=async(name:string)=>new Uint8Array(await readFile(`tests/fixtures/${name}`));
import {independentPDF as independent} from '../helpers/independent-pdf';
const service={worker:async(r:EngineRequest)=>r.kind==='inspect'?{pages:(await preflight(r.bytes)).getPageCount()}:transform(r,()=>{}),inspect:independent,recognize:async()=>[]};
async function setup(){const store=new LocalFileStore(),controller=new JobController(store,service);await controller.import(await Promise.all(['brief.pdf','appendix.pdf'].map(async n=>new File([await fixture(n)],n))));assert.equal(controller.state.error,null);return {store,controller};}
test('SHR-36 outbound denial leaves real local PDFs, preview facts, save/reopen, Undo and Clear usable',async()=>{
  const {store,controller}=await setup();await controller.quick('merge');const focus=store.focus!,before=store.list,request=controller.request('Remove page 2');let outboundBytes=0;
  await assert.rejects(productionOutbound.write(()=>({kind:'hosted',payload:projectHosted(request),route:['unapproved'],endpoint:'https://unapproved.example.test/transfer',purposeCode:'interpret_instruction',idempotencyKey:request.requestId,transferId:request.requestId}),async body=>{outboundBytes+=body.length;}),OutboundDenied);
  assert.equal(outboundBytes,0);assert.deepEqual(store.list,before);assert.equal(store.focus,focus);assert.equal(store.get(focus).meta.inspection.pages.length,3);
  await controller.quick('remove',2);assert.equal(controller.state.error,null);let exported=new Uint8Array();
  assert.equal(await savePDF(store.get(store.focus!).bytes,async()=>({createWritable:async()=>({write:async data=>{exported=new Uint8Array(data as Uint8Array);},close:async()=>{},abort:async()=>{}})})),'saved');
  assert.equal((await independent(exported)).pages.length,2);await controller.undo();assert.equal(store.focus,focus);await controller.clear();assert.equal(store.list.length,0);
});
test('L01/L02: actual merge, physical-page follow-up, independent text order, immutable originals and undo',async()=>{
  const {store,controller}=await setup();const hashes=store.list.map(f=>f.checksum);
  await controller.quick('merge');assert.equal(controller.state.error,null);const merged=store.focus!;
  assert.equal(store.get(merged).meta.pageCount,3);
  const texts=store.get(merged).meta.inspection.pages.map(p=>p.text);for(const [i,marker]of ['A1','A2','B1'].entries())assert.match(texts[i],new RegExp(marker));
  await controller.quick('remove',2);assert.equal(controller.state.error,null);assert.equal(store.get(store.focus!).meta.pageCount,2);assert.match(store.get(store.focus!).meta.inspection.pages[1].text,/B1/);
  controller.undo();assert.equal(store.focus,merged);assert.deepEqual(store.originals.map(r=>store.get(r).meta.checksum),hashes);
  const copy=store.get(merged);copy.bytes.fill(0);copy.meta.inspection.pages[0].text='changed';assert.notEqual(store.get(merged).bytes[0],0);assert.match(store.get(merged).meta.inspection.pages[0].text,/A1/);
});
test('complete plans only; stale, duplicate and malicious envelopes never execute',async()=>{
  const {store,controller}=await setup(),request=controller.request(),envelope=quickPlan(request,'merge');
  assert.throws(()=>validateEnvelope({schemaVersion:'1.0',planner:{steps:[]}},request,store.revision));
  assert.throws(()=>validateEnvelope({...envelope,workspaceRevision:99},request,store.revision));
  const malicious=structuredClone(envelope);(malicious.planner.steps[0] as unknown as {operation:string}).operation='run_shell';assert.throws(()=>validateEnvelope(malicious,request,store.revision));
  await controller.execute(envelope,request);await assert.rejects(controller.execute(envelope,request));assert.equal(store.list.filter(f=>!f.original).length,1);
});
test('remove all, out-of-range, duplicate input, future output and unsupported language rejected',async()=>{
  const {store,controller}=await setup();await controller.quick('merge');const req=controller.request();
  assert.throws(()=>quickPlan(req,'remove',4));
  const p=quickPlan(req,'remove',2);p.planner.steps[0].params.pages={mode:'explicit',indices:[1,2,3]};assert.throws(()=>validateEnvelope(p,req,store.revision));
  const m=quickPlan(req,'merge');m.planner.steps[0].inputs=[req.selectionRefs[0],req.selectionRefs[0]];assert.throws(()=>validateEnvelope(m,req,store.revision));
  const f=quickPlan(req,'merge');f.planner.steps[0].inputs[0]='out_future';assert.throws(()=>validateEnvelope(f,req,store.revision));
  const o=quickPlan(req,'ocr');o.planner.steps[0].params.languages=['hin'];assert.throws(()=>validateEnvelope(o,req,store.revision));
});
test('L03: save cancellation and browser initiation never claim persistent save',async()=>{
  assert.equal(await savePDF(new Uint8Array([1]),async()=>{throw new DOMException('','AbortError');}),'cancelled');
  const calls:string[]=[];assert.equal(await savePDF(new Uint8Array([1]),async()=>({createWritable:async()=>({write:async()=>{calls.push('write');},close:async()=>{calls.push('close');},abort:async()=>{calls.push('abort');}})})),'saved');assert.deepEqual(calls,['write','close']);
  await assert.rejects(savePDF(new Uint8Array([1]),async()=>({createWritable:async()=>({write:async()=>{},close:async()=>{throw new Error('disk');},abort:async()=>{calls.push('abort');}})})));assert.equal(calls.at(-1),'abort');
});
test('L04: cancellation and failed independent validation cannot promote a candidate',async()=>{
  const {store}=await setup();const c=new JobController(store,{...service,worker:(r,s)=>r.kind==='inspect'?service.worker(r):new Promise((_,reject)=>s.addEventListener('abort',()=>reject(new DOMException('','AbortError')),{once:true}))});
  const running=c.quick('merge');c.cancel();await running;assert.equal(c.state.stage,'cancelled');assert.equal(store.focus,null);
  const bad=new JobController(store,{...service,inspect:async()=>({pages:[]})});await bad.quick('merge');assert.equal(bad.state.stage,'failed');assert.equal(store.focus,null);
});
test('local metadata cannot leak through the positive planner projection',()=>{
  const extras={ref:'file_a',kind:'pdf' as const,pageCount:1,sizeBytes:10,encrypted:false as const,name:'SECRET.pdf',checksum:'LOCAL_HASH',bytes:new Uint8Array([1,2]),password:'LOCAL_PASSWORD',path:'/private/path',ocr:'LOCAL_OCR'};
  const request=buildRequest({revision:1,files:[extras],selected:['file_a'],focus:null,originals:['file_a']},'Merge these');const json=JSON.stringify(request);
  for(const forbidden of ['SECRET.pdf','LOCAL_HASH','LOCAL_PASSWORD','/private/path','LOCAL_OCR','"bytes"'])assert.ok(!json.includes(forbidden));
});
test('damaged, active, form and oversized PDF features fail closed',async()=>{
  await assert.rejects(preflight(new Uint8Array([1,2,3])));
  for(const field of ['AcroForm','StructTreeRoot','Outlines','OpenAction']){const doc=await PDFDocument.create();doc.addPage();doc.catalog.set(PDFName.of(field),PDFDict.withContext(doc.context));await assert.rejects(preflight(await doc.save()));}
  const doc=await PDFDocument.create();doc.addPage([10000,10000]);await assert.rejects(preflight(await doc.save()));
});
test('unhelpful compression retains actual input bytes with honest result',async()=>{
  const bytes=await fixture('brief.pdf'),inspection=await independent(bytes);
  const result=await transform({kind:'transform',inputs:[{bytes,inspection}],step:{id:'s_1',operation:'compress_pdf',inputs:['file_a'],outputRef:'out_a',params:{preset:'lossless',batchMode:'single',targetBytes:1}}},()=>{});
  assert.ok(result.bytes.length<=bytes.length);assert.equal((await independent(result.bytes)).pages.length,2);
});

test('large PDFs: real >20 MB inputs, >40 MB merge, >100 MB retained history, page removal and undo',async()=>{
  const {largePDF}=await import('../helpers/large-pdf');const a=await largePDF('LARGE-A1'),b=await largePDF('LARGE-B1');assert.ok(a.length>20_000_000);assert.ok(b.length>20_000_000);
  const store=new LocalFileStore(),controller=new JobController(store,service);
  await controller.import([new File([a],'large-a.pdf'),new File([b],'large-b.pdf')]);assert.equal(controller.state.error,null);assert.equal(store.originals.length,2);
  const originalHashes=store.list.map(f=>f.checksum);await controller.quick('merge');assert.equal(controller.state.error,null);const merged=store.focus!;
  assert.ok(store.get(merged).bytes.length>40_000_000);assert.equal(store.get(merged).meta.pageCount,2);assert.match(store.get(merged).meta.inspection.pages[1].text,/LARGE-B1/);
  await controller.quick('remove',2);assert.equal(controller.state.error,null);assert.ok(store.retainedBytes>100_000_000);assert.equal(store.get(store.focus!).meta.pageCount,1);assert.match(store.get(store.focus!).meta.inspection.pages[0].text,/LARGE-A1/);
  controller.undo();assert.equal(store.focus,merged);assert.deepEqual(store.originals.map(r=>store.get(r).meta.checksum),originalHashes);
});
