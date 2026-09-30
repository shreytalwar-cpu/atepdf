import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PDFDocument} from 'pdf-lib';
import Ajv2020 from 'ajv/dist/2020.js';
import {classify,observe,summarizeCases,verifyOutput,type Verification} from '../compatibility/matrix-core';

const source=()=>readFile('tests/fixtures/usability/brief.pdf');
const passed:Verification={reader:'passed',structural:'passed',visual:'not_run',issues:[]};
test('SHR-46 verifier supports independently reopened, unchanged saved PDF properties',async()=>{
  const bytes=new Uint8Array(await source()),expected=await observe(bytes);
  const verification=await verifyOutput(bytes,expected);
  assert.equal(classify({implemented:true,ran:true,verification}),'SUPPORTED');
  assert.equal(verification.visual,'not_run');
});
test('SHR-46 only specific intentional refusal with unchanged originals and no promotion is safe',()=>{
  const error='This PDF has document features this build cannot safely preserve. Your original is unchanged.';
  assert.equal(classify({implemented:true,ran:true,error,noPromotion:true,originalUnchanged:true}),'SAFELY_REJECTED');
  assert.equal(classify({implemented:true,ran:true,error,noPromotion:false,originalUnchanged:true}),'FAILED');
  assert.equal(classify({implemented:true,ran:true,error,noPromotion:true,originalUnchanged:false}),'FAILED');
});
test('SHR-46 generic crashes and unsafe upstream exceptions are failures, never safe refusals',()=>{
  for(const error of ['Unexpected parser failure.','Input document to PDFDocument.load is encrypted.']){
    assert.equal(classify({implemented:true,ran:true,error,noPromotion:true,originalUnchanged:true}),'FAILED');
  }
});
test('SHR-46 deliberate truncated/corrupt output cannot be called supported',async()=>{
  const bytes=new Uint8Array(await source()),expected=await observe(bytes);
  const verification=await verifyOutput(bytes.slice(0,32),expected);
  assert.equal(verification.reader,'failed');
  assert.equal(classify({implemented:true,ran:true,verification}),'FAILED');
});
test('SHR-46 reordered known-good pages produce a fidelity mismatch',async()=>{
  const bytes=new Uint8Array(await source()),expected=await observe(bytes);
  const input=await PDFDocument.load(bytes),swapped=await PDFDocument.create();
  for(const page of await swapped.copyPages(input,[1,0]))swapped.addPage(page);
  const verification=await verifyOutput(await swapped.save(),expected);
  assert.equal(classify({implemented:true,ran:true,verification}),'FIDELITY_MISMATCH');
  assert.ok(verification.issues.some(issue=>issue.includes('text/order')));
});
test('SHR-46 missing page and changed crop geometry are distinct verified mismatches',async()=>{
  const bytes=new Uint8Array(await source()),expected=await observe(bytes);
  const fewer=await PDFDocument.load(bytes);fewer.removePage(1);
  const count=await verifyOutput(await fewer.save(),expected);
  assert.ok(count.issues.some(issue=>issue.includes('page count')));
  assert.equal(classify({implemented:true,ran:true,verification:count}),'FIDELITY_MISMATCH');
  const cropped=await PDFDocument.load(bytes);cropped.getPage(0).setCropBox(20,30,400,500);
  const geometry=await verifyOutput(await cropped.save(),expected);
  assert.ok(geometry.issues.some(issue=>issue.includes('geometry')));
  assert.equal(classify({implemented:true,ran:true,verification:geometry}),'FIDELITY_MISMATCH');
});
test('SHR-46 unreadable arbitrary result, absent executor and unrun scenario are not passes',async()=>{
  const expected=await observe(new Uint8Array(await source()));
  const verification=await verifyOutput(new Uint8Array([1,2,3]),expected);
  assert.equal(classify({implemented:true,ran:true,verification}),'FAILED');
  assert.equal(classify({implemented:false,ran:false}),'NOT_IMPLEMENTED');
  assert.equal(classify({implemented:true,ran:false}),'NOT_RUN');
});
test('SHR-46 incomplete verification and explicit unresolved coverage remain unverified',()=>{
  assert.equal(classify({implemented:true,ran:true,verification:passed,partialCoverage:true}),'UNVERIFIED');
  assert.equal(classify({implemented:true,ran:true,verification:{...passed,structural:'not_run'}}),'UNVERIFIED');
  assert.equal(classify({implemented:true,ran:true,verification:passed,originalUnchanged:false}),'FAILED');
});
test('SHR-46 schema rejects false support and records missing/unrun executors explicitly',async()=>{
  const schema=JSON.parse(await readFile('tests/compatibility/matrix.schema.json','utf8'));
  const validate=new Ajv2020({allErrors:true}).compile(schema);
  const row={id:'fixture/split_pdf',fixtureId:'fixture',operation:'split_pdf',classification:'NOT_IMPLEMENTED',
    reason:'No active executor.',environment:'none',executor:null as string|null,reader:null,
    input:[{fixtureId:'fixture',sha256:'a'.repeat(64),pageCount:1,pageOrder:['one'],features:['text']}],
    parameters:null,policy:[],admission:{status:'not_run',reason:null},execution:{status:'not_run',reason:null},
    result:null,independent:{reader:'not_run',structural:'not_run',issues:[]},
    visual:{status:'NOT_RUN',reason:'No output.'},originalUnchanged:true,noPartialPromotion:true,evidenceLocation:'matrix.json#fixture/split_pdf'};
  const matrix={schemaVersion:1,source:{commit:'a'.repeat(40),files:{engine:'b'.repeat(64)},manifestSha256:'c'.repeat(64)},
    environment:{node:'test',browser:'test',platform:'test',architecture:'test',nativeApp:'NOT_RUN',externalRequests:0},
    operationInventory:[{operation:'split_pdf',status:'NOT_IMPLEMENTED'}],
    summary:{total:1,executed:0,counts:{SUPPORTED:0,SAFELY_REJECTED:0,FAILED:0,FIDELITY_MISMATCH:0,UNVERIFIED:0,NOT_IMPLEMENTED:1,NOT_RUN:0}},
    cases:[row]};
  assert.equal(validate(matrix),true,JSON.stringify(validate.errors));
  row.classification='SUPPORTED';
  assert.equal(validate(matrix),false,'an absent executor/unread output must not become supported');
  row.classification='NOT_IMPLEMENTED';row.executor='pretend-engine';
  assert.equal(validate(matrix),false,'NOT_IMPLEMENTED cannot advertise an executor');
});
test('SHR-46 summary keeps refusals/failures in the executed denominator and excludes unrun/absent work',()=>{
  const summary=summarizeCases(['SUPPORTED','SAFELY_REJECTED','FAILED','FIDELITY_MISMATCH','UNVERIFIED','NOT_RUN','NOT_IMPLEMENTED']
    .map(classification=>({classification})));
  assert.equal(summary.total,7);assert.equal(summary.executed,5);
  assert.equal(summary.counts.SAFELY_REJECTED,1);assert.equal(summary.counts.FAILED,1);
  assert.throws(()=>summarizeCases([{classification:'pretend-pass'}]));
});
test('SHR-46 runner refuses to overwrite an existing evidence destination',async()=>{
  const destination=await mkdtemp(join(tmpdir(),'atepdf-matrix-no-overwrite-'));
  try{
    await writeFile(join(destination,'owner-evidence.txt'),'preserve');
    const {runMatrix}=await import('../compatibility/run.mts');
    await assert.rejects(runMatrix(destination),/new, nonexistent output directory/);
    assert.equal(await readFile(join(destination,'owner-evidence.txt'),'utf8'),'preserve');
  }finally{await rm(destination,{recursive:true,force:true});}
});
