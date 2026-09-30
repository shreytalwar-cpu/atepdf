import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import Ajv2020 from 'ajv/dist/2020.js';
import {capabilities} from '../../packages/contracts/src/protocol';

const json=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const ajv=new Ajv2020({strict:false,allErrors:true});
const files=['planner-request','planner-response','gateway-envelope','local-job-event'];
const contracts=Object.fromEntries(await Promise.all(files.map(async name=>{
  const schema=await json(`packages/contracts/schemas/${name}.schema.json`);
  ajv.compile(schema);return [name,schema];
})));
const registry=await json('packages/contracts/schemas/operation-registry.json');
const fields=['id','protocolVersion','execution','implementationStatus','platformsPlanned',
  'requiresRealEngineTest','requiresLocalSecret','releaseGate','parameters'];
assert.ok(typeof registry.note==='string'&&Array.isArray(registry.operations));
const branches=contracts['planner-response'].properties.steps.items.anyOf;
const operationIDs=branches.map((entry:any)=>entry.properties.operation.const);
assert.equal(new Set(operationIDs).size,operationIDs.length,'Duplicate response operation');
const ids=new Set<string>();
for(const entry of registry.operations){
  assert.deepEqual(Object.keys(entry).sort((a:string,b:string)=>a.localeCompare(b)),[...fields].sort((a:string,b:string)=>a.localeCompare(b)),`Malformed catalogue entry ${entry.id}`);
  assert.match(entry.id,/^[a-z][a-z_]+$/);assert.ok(!ids.has(entry.id),`Duplicate catalogue ID ${entry.id}`);ids.add(entry.id);
  assert.equal(entry.protocolVersion,'1.0');assert.equal(entry.execution,'local');
  assert.equal(typeof entry.implementationStatus,'string');assert.equal(typeof entry.releaseGate,'string');
  assert.ok(Array.isArray(entry.platformsPlanned)&&entry.platformsPlanned.length>0);
  assert.equal(new Set(entry.platformsPlanned).size,entry.platformsPlanned.length);
  for(const platform of entry.platformsPlanned)assert.ok(['web','android','ios','ipados','macos'].includes(platform));
  assert.equal(typeof entry.requiresRealEngineTest,'boolean');assert.equal(typeof entry.requiresLocalSecret,'boolean');
  assert.equal(entry.parameters.type,'object');ajv.compile(entry.parameters);
  const branch=branches.find((item:any)=>item.properties.operation.const===entry.id);
  assert.ok(branch,`Catalogue operation missing from response schema: ${entry.id}`);
  assert.ok(isDeepStrictEqual(entry.parameters,branch.properties.params),`Catalogue/schema parameter drift: ${entry.id}`);
}
assert.deepEqual([...ids].sort((a:string,b:string)=>a.localeCompare(b)),[...operationIDs].sort((a:string,b:string)=>a.localeCompare(b)),'Catalogue/response operation drift');
assert.deepEqual([...ids].sort((a:string,b:string)=>a.localeCompare(b)),[...contracts['planner-request'].properties.capabilities.items.enum].sort((a:string,b:string)=>a.localeCompare(b)),'Catalogue/request capability drift');
for(const capability of capabilities)assert.ok(ids.has(capability),`Runtime capability absent from catalogue: ${capability}`);
// The broad retained catalogue is a specification, not an executable-tool claim.
for(const [file,schemaFile]of [
  ['tests/fixtures/corpus/manifest.json','tests/fixtures/corpus/manifest.schema.json'],
  ['docs/evidence/SHR-46-2026-09-30/matrix.json','tests/compatibility/matrix.schema.json'],
]){
  const validate=ajv.compile(await json(schemaFile));
  assert.ok(validate(await json(file)),`${file}: ${JSON.stringify(validate.errors)}`);
}
for(const [file,key]of [['planner_seed_cases','expected'],['invalid_plan_cases','response']]){
  const rows=(await readFile(`packages/contracts/corpus/${file}.jsonl`,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
  const unique=new Set<string>();
  const requestValid=ajv.compile(contracts['planner-request']);
  const responseValid=ajv.compile(contracts['planner-response']);
  for(const row of rows){
    assert.ok(typeof row.id==='string'&&!unique.has(row.id));unique.add(row.id);
    assert.ok(row.request&&row[key]&&typeof row[key]==='object',`${file}: malformed eval row ${row.id}`);
    if(file==='planner_seed_cases'){
      assert.ok(requestValid({...row.request,pendingClarification:null}),`Eval request schema: ${row.id}`);
      assert.ok(responseValid(row.expected),`Eval response schema: ${row.id}`);
    }
    // Adversarial rows deliberately contain invalid requests/responses; the existing
    // protocol regression asserts their rejection rather than making them valid.
  }
}
console.log(`Schemas and catalogue consistent: ${ids.size} specification operations; ${capabilities.length} current runtime capabilities. Retained eval plans are tested by protocol-conformance.`);
