import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {buildRequest} from '../../packages/contracts/src/protocol';
import {validateHosted,projectHosted} from '../../packages/planner/src/outbound/schema';
import {assertProviderWire,providerWire} from '../../packages/planner/src/provider';
import {privateInstruction} from '../../packages/planner/src/privacy';
import {OutboundDenied,hostedAck} from '../../packages/planner/src/outbound/gate';
import {developmentGate,openaiDevelopmentRecipient} from '../../packages/planner/development/recipient';
import {fixture} from '../helpers/outbound-fixture';
import {loadInputs,loadKeys,loadRecordings} from '../evals/orchestration/corpus';
import {currentAdapter} from '../evals/orchestration/current-adapter';
import {grade} from '../evals/orchestration/graders';
import {defaultPrivacyPolicy} from '../evals/orchestration/privacy-grader';
import type {Artifact} from '../../packages/core/src/local-file-store';
const ref='file_00000000000000000000000000000001';
const request=()=>buildRequest({revision:1,files:[{ref,kind:'pdf',pageCount:2,sizeBytes:500,encrypted:false}],selected:[ref],originals:[ref],focus:null},'Remove page 1');
const proposal=()=>({kind:'hosted' as const,payload:projectHosted(request()),route:['provider-a'],endpoint:'https://api.openai.com/v1/responses',purposeCode:'interpret_instruction',idempotencyKey:'same',transferId:'same'});

test('G1 development record remains disclosure/ack gated and is absent from release entry graphs',async()=>{
  let ack=await hostedAck(['openai-development'],[openaiDevelopmentRecipient]);let writes=0;
  const gate=developmentGate(()=>ack),p={...proposal(),route:['openai-development']};
  await assert.rejects(gate.write(()=>p,async()=>{writes++;}),OutboundDenied);assert.equal(writes,0);
  const f=await fixture(['openai-development']);f.authority.ack=null;
  await assert.rejects(f.gate.write(()=>p,async()=>{writes++;}),OutboundDenied);
  f.authority.ack=ack=await hostedAck(['openai-development'],f.registry);
  await f.gate.write(()=>p,async()=>{writes++;});assert.equal(writes,1,'only explicit synthetic fixture authority permits the mocked writer');
  const release=await build({entryPoints:['packages/planner/src/gateway.ts','packages/planner/src/client.ts'],outdir:'release-check',bundle:true,write:false,metafile:true,platform:'node',format:'esm',packages:'external',tsconfig:'apps/web/tsconfig.json'});
  assert.equal(Object.keys(release.metafile!.inputs).some(path=>path.includes('/development/')),false);
  assert.equal(release.outputFiles.some(file=>file.text.includes('synthetic development only')),false);
});

test('S36-05 concurrent retry and completed hosted replay each invoke exactly one writer',async()=>{
  const f=await fixture(),p=proposal();let writes=0,release!:()=>void,entered!:()=>void;
  const started=new Promise<void>(resolve=>entered=resolve),wait=new Promise<void>(resolve=>release=resolve);
  const first=f.gate.write(()=>p,async()=>{writes++;entered();await wait;});
  await started;
  await assert.rejects(f.gate.write(()=>({...p,retry:'user'}),async()=>{writes++;}),OutboundDenied);
  release();await first;
  await assert.rejects(f.gate.write(()=>({...p,retry:'user'}),async()=>{writes++;}),OutboundDenied);
  assert.equal(writes,1);
});

test('S36-06 immutable validation rejects Proxy changing its serialised content and encrypted H metadata',()=>{
  const h=projectHosted(request());let reads=0;
  const proxy=new Proxy(h,{get(target,key,receiver){if(key==='instruction')return ++reads===1?'Remove page 1':'SYNTHETIC PRIVATE CONTENT';return Reflect.get(target,key,receiver);}});
  assert.throws(()=>validateHosted(proxy));
  assert.throws(()=>validateHosted({...h,files:h.files.map(f=>({...f,encrypted:true}))}));
  const safe=validateHosted(h);h.instruction='changed after check';assert.equal(safe.instruction,'Remove page 1');
});

test('S36-04 numeric/common filename stems leave normal page grammar intact; explicit titles still resolve',()=>{
  for(const name of ['1.pdf','page.pdf','file.pdf','scan.pdf']){
    const file={ref,name,checksum:'a'.repeat(64),inspection:{pages:[]}} as unknown as Artifact;
    assert.equal(privateInstruction('Remove page 1 from the current result',[file]),'Remove page 1 from the current result');
    assert.equal(privateInstruction(`Compress ${name}`,[file]),`Compress ${ref}`);
    assert.equal(privateInstruction(`Compress "${name.slice(0,-4)}"`,[file]),`Compress ${ref}`);
  }
});

test('S36-07 full SDK envelope denies extra property, extra developer instruction and swapped payload',()=>{
  const h=projectHosted(request());assertProviderWire(providerWire(h),h);
  for(const mutate of [(body:any)=>{body.debug='SYNTHETIC PRIVATE CONTENT';},body=>{body.input.push({role:'developer',content:'SYNTHETIC PRIVATE CONTENT'});},body=>{body.input[1].content[0].text=JSON.stringify({...h,instruction:'Different task'}); }]){
    const body=structuredClone(providerWire(h));mutate(body);assert.throws(()=>assertProviderWire(body,h),OutboundDenied);
  }
});

test('S107-01 privacy grader derives filename, page-text and selector probes without declared canaries',async()=>{
  const scenario=structuredClone((await loadInputs('dev'))[0]);scenario.canaries=[];
  scenario.context.files[0].name='PrivateLedger.pdf';scenario.context.files[0].text='Five private words never leave here';
  scenario.context.selectors=[{kind:'invoice',refs:[ref],pages:[1],revision:1,certain:true,evidence:'Private local invoice evidence'}];
  for(const instruction of ['Use PrivateLedger','Five private words never leave','Private local invoice evidence']){
    const payload=providerWire({...projectHosted(request()),instruction});
    assert.ok(defaultPrivacyPolicy(scenario,{kind:'command',recipient:'openai-development',payload}).some(e=>e.includes('local filename, text or selector evidence')));
  }
  for(const payload of [{...providerWire(projectHosted(request())),extra:'local secret'}, {...providerWire(projectHosted(request())),input:[{role:'developer',content:'unexpected prompt'}]}]){
    assert.ok(defaultPrivacyPolicy(scenario,{kind:'command',recipient:'openai-development',payload}).some(e=>e.includes('SDK envelope')));
  }
});

// Compile only the requested mutation into a fresh test-owned bundle. Product files
// are never edited. This proves the negative probes depend on the real guards.
async function mutant(entry:string,path:string,change:(source:string)=>string){
  const root=await mkdtemp(join(tmpdir(),'atepdf-negative-'));
  try{
    const result=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',tsconfig:'tsconfig.json',plugins:[{name:'one-guard-mutation',setup(b){b.onLoad({filter:new RegExp(path.replaceAll('.','\\.')+'$')},async args=>{const source=await readFile(args.path,'utf8'),altered=change(source);assert.notEqual(altered,source,'mutation must match');return {contents:altered,loader:'ts'};});}}]});
    // Resolve external dependencies from this checkout; no shared owner installation.
    const target=join(root,'mutant.cjs');await writeFile(target,result.outputFiles[0].text);
    const Module=createRequire(import.meta.url)('node:module');const compiled=new Module(target,module);compiled.filename=target;compiled.paths=Module._nodeModulePaths(resolve('.'));compiled._compile(result.outputFiles[0].text,target);
    return compiled.exports;
  }finally{await rm(root,{recursive:true,force:true});}
}

test('S36-07 removing the SDK equality guard makes the negative envelope probe fail',async()=>{
  const m=await mutant('packages/planner/src/provider.ts','packages/planner/src/provider.ts',s=>s.replace("if(canonical(body)!==canonical(providerWire(payload)))throw new OutboundDenied({outcome:'DENY',reason:'unclassified_field'});",''));
  const h=projectHosted(request()),body={...providerWire(h),debug:'SYNTHETIC PRIVATE CONTENT'};
  assert.throws(()=>assert.throws(()=>m.assertProviderWire(body,h)));
});

test('S36-07 removing completed replay guard admits a forbidden second hosted transfer',async()=>{
  const m=await mutant('packages/planner/src/outbound/gate.ts','packages/planner/src/outbound/gate.ts',s=>s.replace('if(this.#completed.has(p.transferId))throw new OutboundDenied(requireConsent);',''));
  const f=await fixture(),gate=new m.OutboundGate(()=>f.authority),p=proposal();let writes=0;
  await gate.write(()=>p,async()=>{writes++;});await gate.write(()=>({...p,retry:'user'}),async()=>{writes++;});assert.equal(writes,2,'mutation must be detected by the one-write regression');
});

test('S107-02 product stale guards reject; removing both product layers exposes invocation and lowers safety score',async()=>{
  const scenarios=await loadInputs('dev'),scenario=scenarios.find(s=>s.id==='O107-024')!,key=(await loadKeys('dev',scenarios)).get(scenario.id)!,recordings=await loadRecordings('dev');
  const ordinary=await currentAdapter(recordings).evaluate(scenario,{});assert.equal(grade(scenario,key,ordinary).passed,true);assert.equal(ordinary.turns[0].toolInvocations.length,0);
  const m=await mutant('tests/evals/orchestration/current-adapter.ts','packages/contracts/src/protocol.ts',s=>s.replace(' || currentRevision!==request.workspaceRevision',''));
  const stillSafe=await m.currentAdapter(recordings).evaluate(scenario,{});assert.equal(stillSafe.turns[0].toolInvocations.length,0,'independent controller guard still protects execution');
  const unsafe=await mutant('tests/evals/orchestration/current-adapter.ts','packages/(contracts/src/protocol|core/src/job-controller).ts',s=>s.replace(' || currentRevision!==request.workspaceRevision','').replaceAll("if(this.store.revision!==request.workspaceRevision)throw new Error('Files changed. Run the action again.');",''));
  const changed=await unsafe.currentAdapter(recordings).evaluate(scenario,{}),graded=grade(scenario,key,changed);
  assert.ok(changed.turns[0].toolInvocations.length>0);assert.equal(graded.passed,false);assert.equal(graded.staleAcceptances,1);
});
