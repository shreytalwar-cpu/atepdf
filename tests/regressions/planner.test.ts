import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,chmod,symlink,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {privateInstruction,assertInstructionSafe} from '../../packages/planner/src/privacy';
import {createGateway,validateRequest} from '../../packages/planner/src/gateway';
import {LocalConfig} from '../../packages/planner/src/local-config';
import {planWithOpenAI,MODEL} from '../../packages/planner/src/provider';
import {requestPlan} from '../../packages/planner/src/client';
import {buildRequest,quickPlan} from '../../packages/contracts/src/protocol';
import type {Artifact} from '../../packages/core/src/local-file-store';
const files=[{ref:'file_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',kind:'pdf' as const,pageCount:2,sizeBytes:3000,encrypted:false as const},{ref:'file_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',kind:'pdf' as const,pageCount:1,sizeBytes:2000,encrypted:false as const}];
const request=()=>buildRequest({revision:2,files,selected:files.map(f=>f.ref),focus:null,originals:files.map(f=>f.ref)},'Combine the two PDFs in the order added.');
function memoryConfig(remaining=2){let locked=false;return {status:async()=>({connected:true,enabled:remaining>0,remaining}),reserve:async()=>{if(locked||remaining<=0)throw new Error('blocked');locked=true;remaining--;return {key:'sk-test-never-network',release:async()=>{locked=false;}};}};}
async function setup(provider:Parameters<typeof createGateway>[1],remaining=2,timeoutMs=1000){const config=memoryConfig(remaining),gateway=createGateway(config,provider,{minIntervalMs:0,timeoutMs});const status=await (await gateway(new Request('http://localhost:3211/api/planner/status'))).json();const post=(body:unknown,headers:Record<string,string>={},signal?:AbortSignal)=>gateway(new Request('http://localhost:3211/api/planner',{method:'POST',headers:{origin:'http://localhost:3211','content-type':'application/json','x-atepdf-token':status.token,...headers},body:typeof body==='string'?body:JSON.stringify(body),signal}));return {config,gateway,post};}
test('planner privacy: exact filename aliasing, local snippet/path/password/bytes rejection and positive manifest projection',()=>{
  const artifact={...files[0],name:'Customer [A]+.pdf',checksum:'c'.repeat(64),inspection:{pages:[{text:'CONFIDENTIAL CANARY every page must stay local',width:612,height:792,rotation:0}]}} as unknown as Artifact;
  assert.equal(privateInstruction('Please merge Customer [A]+.pdf with the second file',[artifact]),`Please merge ${artifact.ref} with the second file`);
  for(const text of ['password=canary123','sk-canary-secret-key12345','/Users/alice/secret.pdf','/etc/passwd','../private/file','ftp://example.com/canary','customer.csv','file:///tmp/canary','https://example.com/x','C:\\docs\\payroll.pdf','other.pdf','c'.repeat(64),'A'.repeat(100),'CONFIDENTIAL CANARY every page must stay local'])assert.throws(()=>privateInstruction(text,[artifact]),text);
  assert.throws(()=>privateInstruction('merge Customer [A]+.pdf',[artifact,{...artifact,ref:files[1].ref}]));
  const projected=validateRequest(request());assert.equal(Object.hasOwn(projected.files[0],'name'),false);assert.throws(()=>validateRequest({...projected,files:[{...files[0],name:'secret.pdf'}]}));
  assert.throws(()=>assertInstructionSafe('x'.repeat(1001)));
});
test('gateway: host/origin/token/content-type and disabled state cannot call provider',async()=>{
  let calls=0;const {post,gateway}=await setup(async r=>{calls++;return quickPlan(r,'merge').planner;},0);
  assert.equal((await post(request())).status,503);assert.equal((await post(request(),{origin:'https://evil.example'})).status,403);assert.equal((await post(request(),{'x-atepdf-token':'wrong'})).status,403);
  assert.equal((await gateway(new Request('http://rebinding.example/api/planner/status'))).status,403);
  assert.equal((await post(request(),{'content-type':'text/plain'})).status,415);assert.equal(calls,0);
});
test('gateway: malformed, oversized, unknown fields, unsupported context and document canaries fail before provider',async()=>{
  let calls=0;const {post}=await setup(async r=>{calls++;return quickPlan(r,'merge').planner;});
  for(const body of ['{partial', ' '.repeat(24_001), {...request(),bytes:'CANARY'},{...request(),instruction:'password=CANARY'},{...request(),capabilities:['run_shell']},{...request(),focusedResultRef:'file_missing'}])assert.equal((await post(body)).status,400);
  assert.equal(calls,0);
});
test('gateway: complete bound plan, duplicate rejection, hard request cap and no automatic follow-up calls',async()=>{
  let calls=0;const {post,config}=await setup(async r=>{calls++;return quickPlan(r,'merge').planner;});const first=request();
  const result=await post(first);assert.equal(result.status,200);const value=await result.json();assert.equal(value.requestId,first.requestId);assert.equal(value.workspaceRevision,first.workspaceRevision);assert.equal(value.planner.steps.length,1);
  assert.equal((await post(first)).status,409);assert.equal((await post(request())).status,200);assert.equal((await post(request())).status,503);assert.equal(calls,2);assert.equal((await config.status()).remaining,0);
});
test('gateway: partial, unavailable operation and future refs never form an executable response',async()=>{
  for(const bad of [{schemaVersion:'1.0',status:'plan',steps:[]},{...quickPlan(request(),'merge').planner,steps:[{id:'s_1',operation:'run_shell',inputs:[],outputRef:'out_1',params:{}}]}, {...quickPlan(request(),'merge').planner,steps:[{...quickPlan(request(),'merge').planner.steps[0],inputs:['out_future',files[0].ref]}]}]){
    const {post}=await setup(async()=>bad as never);assert.equal((await post(request())).status,502);
  }
});
test('gateway: concurrent requests, timeout and cancellation stop planning without retry or provider-error disclosure',async()=>{
  let calls=0;const {post,config}=await setup(async(_r,_key,signal)=>{calls++;return await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('sk-LEAK-CANARY')),{once:true}));},2,30);
  const first=post(request());await new Promise(resolve=>setTimeout(resolve,5));assert.equal((await post(request())).status,429);
  const result=await first;assert.equal(result.status,502);assert.doesNotMatch(await result.text(),/LEAK/);assert.equal(calls,1);assert.equal((await config.status()).remaining,1);
  const abort=new AbortController();const cancelled=post(request(),{},abort.signal);setTimeout(()=>abort.abort(),5);assert.equal((await cancelled).status,499);assert.equal(calls,2);
});
test('local credential: private permissions, no symlink following, budget persists across gateway restarts',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'atepdf-key-test-'));await chmod(dir,0o700);const config=new LocalConfig(dir);
  try{
    assert.equal((await config.status()).connected,false);
    await writeFile(join(dir,'openai-key'),'sk-test-only-not-real-credential',{mode:0o600});await writeFile(join(dir,'planner-settings.json'),JSON.stringify({enabled:true,model:MODEL,approvedRequests:1}),{mode:0o600});
    assert.equal((await config.status()).enabled,true);const reserved=await config.reserve();await assert.rejects(config.reserve());await reserved.release();assert.equal((await new LocalConfig(dir).status()).enabled,false);assert.equal(JSON.parse(await readFile(join(dir,'planner-settings.json'),'utf8')).approvedRequests,0);
    await chmod(join(dir,'openai-key'),0o644);assert.equal((await config.status()).connected,false);
    await rm(join(dir,'openai-key'));await symlink(join(dir,'planner-settings.json'),join(dir,'openai-key'));assert.equal((await config.status()).connected,false);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('actual AI SDK adapter mocked HTTP: allowlisted request, store=false, structured output, no tools/uploads/telemetry and no retries',async()=>{
  const req=request();let calls=0;
  const fetcher:typeof fetch=async(url,init)=>{
    calls++;assert.equal(String(url),'https://api.openai.com/v1/responses');
    const body=JSON.parse(String(init!.body));assert.equal(body.model,MODEL);assert.equal(body.store,false);assert.equal(body.max_output_tokens,2000);assert.equal(body.text.format.type,'json_schema');assert.equal(body.text.format.strict,true);assert.equal(body.tools,undefined);
    assert.doesNotMatch(String(init!.body),/brief\.pdf|appendix\.pdf|checksum|file_data|image_url|sk-test-never-network/);
    return Response.json({id:'resp_test',created_at:1,model:MODEL,status:'completed',error:null,incomplete_details:null,output:[{id:'msg_test',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(quickPlan(req,'merge').planner),annotations:[]}]}],usage:{input_tokens:50,output_tokens:100,total_tokens:150,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:0}}});
  };
  const result=await planWithOpenAI(req,'sk-test-never-network',new AbortController().signal,fetcher);assert.equal(result.status,'plan');assert.equal(calls,1);
  let failedCalls=0;await assert.rejects(planWithOpenAI(req,'sk-test-never-network',new AbortController().signal,async()=>{failedCalls++;return Response.json({error:{message:'private upstream detail',type:'server_error'}},{status:500});}));assert.equal(failedCalls,1);
});

test('masked key endpoint saves only locally, refuses cross-origin/oversized/overwrite and never invokes the provider',async()=>{
  const root=await mkdtemp(join(tmpdir(),'atepdf-key-endpoint-'));const dir=join(root,'private'),config=new LocalConfig(dir);let calls=0;
  const gateway=createGateway(config,async r=>{calls++;return quickPlan(r,'merge').planner;});
  try{
    const {token}=await (await gateway(new Request('http://localhost:3211/api/planner/status'))).json();
    const save=(key:string,origin='http://localhost:3211')=>gateway(new Request('http://localhost:3211/api/planner/key',{method:'POST',headers:{origin,'content-type':'application/json','x-atepdf-token':token},body:JSON.stringify({key})}));
    assert.equal((await save('sk-synthetic-local-key-1234567','http://evil.example')).status,403);assert.equal((await save('x'.repeat(2000))).status,400);assert.equal((await config.status()).connected,false);
    assert.equal((await save('sk-synthetic-local-key-1234567')).status,200);assert.equal((await config.status()).connected,true);assert.equal((await config.status()).enabled,false);assert.equal((await config.status()).remaining,0);
    assert.equal((await save('sk-other-local-key-1234567')).status,400);assert.equal(await readFile(join(dir,'openai-key'),'utf8'),'sk-synthetic-local-key-1234567');assert.equal(calls,0);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('planner accepts metadata for large local PDFs without receiving bytes or filenames',()=>{
  const r=request();r.files[0].sizeBytes=350_000_000;r.files[1].sizeBytes=1_200_000_000;
  assert.deepEqual(validateRequest(r).files.map(f=>f.sizeBytes),[350_000_000,1_200_000_000]);
  r.capabilities=['merge_pdf','select_pages'];r.ocrLanguages=[];assert.deepEqual(validateRequest(r).ocrLanguages,[]);
  r.ocrLanguages=['eng'];assert.throws(()=>validateRequest(r));
});

test('privacy canaries: quoted paths, native URIs, encoded separators, hidden characters and JSON-shaped secrets reject',()=>{
  for(const instruction of [
    'Look in "/etc/private-canary"', "Use ('../private-canary')", 'Open content:private-canary', 'Read blob:private-canary',
    'Use %2Fprivate%2Fcanary', 'Use \\u002fprivate', 'pass\u200bword=PRIVATE-CANARY', '{"password":"PRIVATE-CANARY"}',
    'access_token=PRIVATE-CANARY', 'Authorization: Bearer synthetic-secret-token123',
  ])assert.throws(()=>assertInstructionSafe(instruction),undefined,instruction);
  assert.doesNotThrow(()=>assertInstructionSafe('Merge the first two.\nThen remove page 2.'));
  const artifact={...files[0],name:'Cafe\u0301.pdf',checksum:'c'.repeat(64),inspection:{pages:[{text:'synthetic text',width:612,height:792,rotation:0}]}} as unknown as Artifact;
  assert.equal(privateInstruction('Compress Café.pdf',[artifact]),`Compress ${artifact.ref}`);
});

test('gateway: hostile fetch context and stale tokens fail before any reservation',async()=>{
  let calls=0;const {post,gateway,config}=await setup(async r=>{calls++;return quickPlan(r,'merge').planner;});
  for(const headers of [{'sec-fetch-site':'cross-site'},{host:'other.example'},{origin:'http://localhost:9999'},{'x-atepdf-token':''}])assert.equal((await post(request(),headers)).status,403);
  assert.equal((await gateway(new Request('http://localhost:3211/api/planner/status',{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
  assert.equal((await gateway(new Request('http://localhost:3211/api/planner/status',{headers:{host:'127.0.0.1:3211'}}))).status,403);
  assert.equal(calls,0);assert.equal((await config.status()).remaining,2);
});

test('gateway: provider failures consume only their reserved call and never disclose provider bodies',async()=>{
  for(const statusCode of [401,403,404,429,500]){
    let calls=0;const {post,config}=await setup(async()=>{calls++;throw Object.assign(new Error('PRIVATE-PROVIDER-KEY-CANARY'),{statusCode,responseBody:'PRIVATE-DOCUMENT-CANARY'});},1);
    const response=await post(request());assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/CANARY/);assert.equal(calls,1);assert.equal((await config.status()).remaining,0);assert.equal((await post(request())).status,503);
  }
});

test('client: incomplete streaming JSON never resolves; cancelled or malformed complete envelopes reject',async t=>{
  const req=request(),plan=quickPlan(req,'merge'),encoder=new TextEncoder();
  let controller!:ReadableStreamDefaultController<Uint8Array>;
  const stream=new ReadableStream<Uint8Array>({start(value){controller=value;}});
  const fetchMock=t.mock.method(globalThis,'fetch',async()=>new Response(stream,{headers:{'content-type':'application/json'}}));
  let finished=false;const pending=requestPlan(req,'synthetic-token',new AbortController().signal).finally(()=>{finished=true;});
  controller.enqueue(encoder.encode(JSON.stringify(plan).slice(0,-1)));await new Promise(resolve=>setTimeout(resolve,10));assert.equal(finished,false);
  controller.close();await assert.rejects(pending);
  const clarify={schemaVersion:'1.0',requestId:req.requestId,workspaceRevision:req.workspaceRevision,planner:{schemaVersion:'1.0',status:'clarify',reasonCode:'ambiguous_reference',steps:[],resultRefs:[],clarification:{question:'Which file?',choices:[]}}};
  fetchMock.mock.mockImplementation(async()=>Response.json(clarify));assert.deepEqual(await requestPlan(req,'synthetic-token',new AbortController().signal),clarify);
  for(const response of [{...plan,requestId:'req_other'},{...plan,workspaceRevision:99},{...clarify,extra:'PRIVATE-CANARY'},{...clarify,planner:{...clarify.planner,steps:plan.planner.steps}}]){
    fetchMock.mock.mockImplementation(async()=>Response.json(response));await assert.rejects(requestPlan(req,'synthetic-token',new AbortController().signal));
  }
  const abort=new AbortController();fetchMock.mock.mockImplementation(async()=>{abort.abort();return Response.json(plan);});await assert.rejects(requestPlan(req,'synthetic-token',abort.signal));
});

test('local configuration: invalid allowances and malformed keys cannot enable paid calls',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'atepdf-budget-invalid-'));await chmod(dir,0o700);const config=new LocalConfig(dir);
  try{
    await writeFile(join(dir,'openai-key'),'sk-test-only-not-real-credential',{mode:0o600});
    for(const approvedRequests of [-1,21,1.5,'2',null]){await writeFile(join(dir,'planner-settings.json'),JSON.stringify({enabled:true,model:MODEL,approvedRequests}),{mode:0o600});assert.equal((await config.status()).enabled,false);await assert.rejects(config.reserve());}
    await writeFile(join(dir,'planner-settings.json'),JSON.stringify({enabled:true,model:MODEL,approvedRequests:1}),{mode:0o600});await writeFile(join(dir,'openai-key'),'sk-bad-local-key!with-punctuation');assert.equal((await config.status()).connected,false);
  }finally{await rm(dir,{recursive:true,force:true});}
});
