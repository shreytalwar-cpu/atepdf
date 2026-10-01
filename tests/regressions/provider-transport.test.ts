import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {buildRequest} from '../../packages/contracts/src/protocol';
import {planWithOpenAI,MODEL} from '../../packages/planner/src/provider';
import {requestPlan,plannerStatus,createNativePairing} from '../../packages/planner/src/client';
import {createGateway} from '../../packages/planner/src/gateway';
import {OutboundDenied,productionOutbound} from '../../packages/planner/src/outbound/gate';
import {outboundDiagnostic} from '../../packages/planner/src/outbound/diagnostics';
import {TRANSPORT_POLICY as P,TransportDenied,createSyntheticTransport,SYNTHETIC_PROVIDER_KEY,SYNTHETIC_LOCAL_TOKEN,admitProviderDestination,assertProviderBaseUrl,readBoundedText,readBoundedJson} from '../../packages/planner/src/transport';
import {fixture} from '../helpers/outbound-fixture';
const encoder=new TextEncoder(),signal=()=>new AbortController().signal;
const request=()=>buildRequest({revision:1,files:[{ref:'file_'+'a'.repeat(32),kind:'pdf',pageCount:3,sizeBytes:100,encrypted:false}],selected:['file_'+'a'.repeat(32)],focus:null,originals:['file_'+'a'.repeat(32)]},'Remove page 1');
const answer=()=>({id:'resp_synthetic',created_at:1,model:MODEL,status:'completed',error:null,incomplete_details:null,output:[{id:'fc_synthetic',type:'function_call',status:'completed',call_id:'call_synthetic',name:'undo_last_change',arguments:'{}'}],usage:{input_tokens:1,output_tokens:1,total_tokens:2,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:0}}});
const code=(expected:string)=>(e:unknown)=>{assert.ok(e instanceof TransportDenied);assert.equal(e.code,expected);assert.doesNotMatch(JSON.stringify(e)+e.message,/PROTECTED_CANARY|NONREAL|Bearer|instruction|\/Users\//);return true;};
async function run(fetcher:typeof fetch,endpoint=P.providerEndpoint,key=SYNTHETIC_PROVIDER_KEY){
  const f=await fixture();
  return planWithOpenAI(request(),key,signal(),fetcher,{...f.boundary,transport:createSyntheticTransport({mode:'test',endpoint,fetcher})});
}
const targets=[
 ['wrong scheme','http://api.openai.com/v1/responses'],['wrong host','https://example.invalid/v1/responses'],
 ['attacker suffix','https://api.openai.com.attacker.invalid/v1/responses'],['loose suffix','https://evilopenai.com/v1/responses'],
 ['sibling','https://uploads.openai.com/v1/responses'],['subdomain','https://child.api.openai.com/v1/responses'],
 ['port','https://api.openai.com:444/v1/responses'],['userinfo','https://user:NONREAL@api.openai.com/v1/responses'],
 ['empty userinfo','https://@api.openai.com/v1/responses'],['IP literal','https://127.0.0.1/v1/responses'],
 ['punycode lookalike','https://xn--openai-9jg.com/v1/responses'],['unicode lookalike','https://api.openаi.com/v1/responses'],
 ['trailing dot','https://api.openai.com./v1/responses'],['query','https://api.openai.com/v1/responses?x=1'],
 ['fragment','https://api.openai.com/v1/responses#x'],['path','https://api.openai.com/v1/files'],
 ['encoded host','https://%61pi.openai.com/v1/responses'],['backslash','https://api.openai.com\\@attacker.invalid/v1/responses'],
 ['repaired authority','https:///api.openai.com/v1/responses'],['excess slashes','https:////api.openai.com/v1/responses'],
 ['missing authority','https:api.openai.com/v1/responses'],['malformed','http://[broken'],
 ['whitespace',' https://api.openai.com/v1/responses'],['encoded path','https://api.openai.com/v1/%72esponses'],
];
for(const [name,target]of targets)test(`destination ${name}: no credentials or hosted payload at rejected target`,async()=>{
  let authorization=0,payload=0,metadata=0;
  const receiver:typeof fetch=async(_u,init)=>{authorization+=encoder.encode(new Headers(init?.headers).get('authorization')??'').length;payload+=encoder.encode(String(init?.body??'')).length;metadata+=encoder.encode(new Headers(init?.headers).get('idempotency-key')??'').length;return Response.json(answer());};
  await assert.rejects(run(receiver,target),code('destination_not_allowed'));
  assert.deepEqual({authorization,payload,metadata},{authorization:0,payload:0,metadata:0});
});
test('exact normalized pin allowed by transport, production disclosure still denies',async()=>{
  assert.equal(admitProviderDestination('HTTPS://API.OPENAI.COM:443/v1/responses'),P.providerEndpoint);
  let writes=0;const fetcher:typeof fetch=async()=>{writes++;return Response.json(answer());};
  await assert.rejects(planWithOpenAI(request(),SYNTHETIC_PROVIDER_KEY,signal(),fetcher,{gate:productionOutbound,route:['openai-development'],transport:createSyntheticTransport({mode:'test',endpoint:P.providerEndpoint,fetcher})}),OutboundDenied);assert.equal(writes,0);
});
test('loopback without authority, forged authority, mismatched writer and non-sentinel credential deny before writes',async()=>{
  let authorization=0,payload=0;const writer:typeof fetch=async(_u,i)=>{authorization+=new Headers(i?.headers).get('authorization')?.length??0;payload+=String(i?.body??'').length;return Response.json(answer());};
  const f=await fixture();const endpoint='http://127.0.0.1:3999/v1/responses';
  assert.throws(()=>admitProviderDestination(endpoint),code('destination_not_allowed'));
  await assert.rejects(planWithOpenAI(request(),SYNTHETIC_PROVIDER_KEY,signal(),writer,f.boundary),code('destination_not_allowed'));
  await assert.rejects(planWithOpenAI(request(),SYNTHETIC_PROVIDER_KEY,signal(),writer,{...f.boundary,transport:{mode:'test'}}),code('destination_not_allowed'));
  await assert.rejects(run(writer,endpoint,'sk-SHR70-NONREAL-CREDENTIAL'),code('destination_not_allowed'));
  const transport=createSyntheticTransport({mode:'test',endpoint,fetcher:writer});
  await assert.rejects(planWithOpenAI(request(),SYNTHETIC_PROVIDER_KEY,signal(),async()=>Response.json(answer()),{...f.boundary,transport}),code('destination_not_allowed'));
  assert.deepEqual({authorization,payload},{authorization:0,payload:0});
});
test('production runtime refuses creation AND consumption of test authority; ambiguous mode denied',()=>{
  const script=`import {createSyntheticTransport,providerDestination,SYNTHETIC_PROVIDER_KEY,TRANSPORT_POLICY} from './packages/planner/src/transport.ts'; const f=async()=>new Response('{}');let rejected=0;const a=createSyntheticTransport({mode:'test',endpoint:TRANSPORT_POLICY.providerEndpoint,fetcher:f});process.env.NODE_ENV='production';for(const work of [()=>createSyntheticTransport({mode:'test',endpoint:TRANSPORT_POLICY.providerEndpoint,fetcher:f}),()=>providerDestination(SYNTHETIC_PROVIDER_KEY,f,a)]){try{work()}catch(e){if(e.code==='destination_not_allowed')rejected++}}if(rejected!==2)process.exit(1);`;
  const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','--eval',script],{env:{PATH:process.env.PATH,NODE_ENV:'test'},encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  assert.throws(()=>createSyntheticTransport({mode:undefined as never,endpoint:P.providerEndpoint,fetcher:fetch}),code('destination_not_allowed'));
});
for(const [name,target]of targets)test(`inherited base URL ${name}: zero write`,()=>{
  assert.throws(()=>assertProviderBaseUrl(target.replace(/\/responses$/, '')),code('destination_not_allowed'));
});
test('actual environment override refuses before an unbound credential-bearing writer',()=>{
  const script=`import {planWithOpenAI} from './packages/planner/src/provider.ts';let auth=0,payload=0;try{await planWithOpenAI({},'sk-NONREAL-ONLY',new AbortController().signal,async(_u,i)=>{auth+=new Headers(i.headers).get('authorization').length;payload+=i.body.length;return new Response('{}')})}catch(e){if(e.code!=='destination_not_allowed')process.exit(1)}if(auth||payload)process.exit(2);`;
  const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','--eval',script],{env:{PATH:process.env.PATH,OPENAI_BASE_URL:'http://127.0.0.1:3999/v1'},encoding:'utf8'});assert.equal(result.status,0,result.stderr);
});
async function server(handler:Parameters<typeof createServer>[0]){
  const s=createServer(handler);s.listen(0,'127.0.0.1');await once(s,'listening');const address=s.address() as {port:number};return {s,origin:`http://127.0.0.1:${address.port}`,close:()=>new Promise<void>((resolve,reject)=>s.close(e=>e?reject(e):resolve()))};
}
test('loopback with explicit synthetic authority works; all redirect types/chains stop before second target',async()=>{
  let forbiddenAuth=0,forbiddenPayload=0,forbiddenMetadata=0,forbiddenRequests=0,acceptedAuth=0,acceptedPayload=0;
  const forbidden=await server(async(req,res)=>{forbiddenRequests++;forbiddenAuth+=String(req.headers.authorization??'').length;forbiddenMetadata+=String(req.headers['idempotency-key']??'').length;for await(const chunk of req)forbiddenPayload+=chunk.length;res.end('{}');});
  let location='',status=200;
  const approved=await server(async(req,res)=>{acceptedAuth+=String(req.headers.authorization??'').length;for await(const chunk of req)acceptedPayload+=chunk.length;res.writeHead(status,{'Content-Type':'application/json',...(location?{Location:location}:{})});res.end(status===200?JSON.stringify(answer()):'');});
  try{
    assert.equal((await run(fetch,approved.origin+'/v1/responses')).status,'undo');assert.ok(acceptedAuth&&acceptedPayload);
    for(const target of [forbidden.origin+'/redirect-chain',approved.origin+'/same-origin',forbidden.origin.replace('http:','https:')+'/downgrade', 'http://localhost:3999/v1/responses']){
      status=307;location=target;await assert.rejects(run(fetch,approved.origin+'/v1/responses'),code('redirect_not_allowed'));
    }
    assert.deepEqual({forbiddenAuth,forbiddenPayload,forbiddenMetadata,forbiddenRequests},{forbiddenAuth:0,forbiddenPayload:0,forbiddenMetadata:0,forbiddenRequests:0});
  }finally{await approved.close();await forbidden.close();}
});
function streamBody(text:string,{status=200,length,chunk=65536,fail=false}:{status?:number;length?:string;chunk?:number;fail?:boolean}={}){
  const bytes=encoder.encode(text);let received=0,reads=0,cancelled=false;
  const body=new ReadableStream<Uint8Array>({pull(c){reads++;if(received===bytes.length){if(fail)c.error(new Error('PROTECTED_CANARY'));else c.close();return;}const next=bytes.subarray(received,Math.min(received+chunk,bytes.length));received+=next.length;c.enqueue(next);},cancel(){cancelled=true;}},{highWaterMark:0});
  return {response:new Response(body,{status,headers:{'Content-Type':'application/json',...(length===undefined?{}:{'Content-Length':length})}}),stats:()=>({received,reads,cancelled})};
}
for(const limit of [P.providerResponseBytes,P.plannerResponseBytes,P.controlResponseBytes])for(const extra of [-1,0,1])test(`actual-byte boundary ${limit} ${extra>=0?'+':''}${extra}`,async()=>{
  const f=streamBody(' '.repeat(limit+extra));
  if(extra<=0)assert.equal((await readBoundedText(f.response,limit)).length,limit+extra);
  else{await assert.rejects(readBoundedText(f.response,limit),code('response_too_large'));assert.equal(f.stats().received,limit+1);assert.equal(f.stats().cancelled,true);}
});
test('Content-Length under/exact/over and misleading/missing length never bypass actual cap',async()=>{
  for(const length of ['4','5']){const f=streamBody('null'+(length==='5'?' ':''),{length});assert.equal(await readBoundedJson(f.response,8),null);}
  const early=streamBody('PROTECTED_CANARY',{length:'100'});await assert.rejects(readBoundedText(early.response,8),code('response_too_large'));assert.deepEqual(early.stats(),{received:0,reads:0,cancelled:true});
  for(const length of [undefined,'1']){const f=streamBody(' '.repeat(1000),{length,chunk:9});await assert.rejects(readBoundedText(f.response,8),code('response_too_large'));assert.deepEqual(f.stats(),{received:9,reads:1,cancelled:true});}
});
for(const body of ['{"x":','{"x": PROTECTED_CANARY}','null garbage PROTECTED_CANARY'])test(`malformed/truncated JSON safely refused (${body.length} bytes)`,async()=>{await assert.rejects(readBoundedJson(streamBody(body).response,100),code('provider_response_invalid'));});
test('truncated transfer, interrupted stream, malformed length and UTF-8 safely refused',async()=>{
  await assert.rejects(readBoundedText(streamBody('{}',{length:'3'}).response,100),code('response_truncated'));
  await assert.rejects(readBoundedText(streamBody('{}',{fail:true}).response,100),code('response_truncated'));
  await assert.rejects(readBoundedText(streamBody('{}',{length:'invalid'}).response,100),code('provider_response_invalid'));
  await assert.rejects(readBoundedText(new Response(new Uint8Array([0xff])),100),code('provider_response_invalid'));
});
test('provider rejects oversized success/error/trailing responses without draining or leaking bodies',async()=>{
  for(const status of [200,400,500]){
    const f=streamBody(JSON.stringify(answer())+' '.repeat(P.providerResponseBytes*2)+'PROTECTED_CANARY',{status});
    await assert.rejects(run(async()=>f.response),code('response_too_large'));
    assert.equal(f.stats().cancelled,true);assert.ok(f.stats().received<=P.providerResponseBytes+65536);assert.ok(f.stats().received<P.providerResponseBytes*2);
  }
});
test('provider accepts valid exact-cap JSON and maps invalid/truncated JSON safely',async()=>{
  const text=JSON.stringify(answer());assert.equal((await run(async()=>streamBody(text+' '.repeat(P.providerResponseBytes-text.length)).response)).status,'undo');
  for(const body of [text.slice(0,-1),'PROTECTED_CANARY'])await assert.rejects(run(async()=>streamBody(body).response),e=>{assert.doesNotMatch(String(e)+JSON.stringify(e),/PROTECTED_CANARY/);assert.equal((e as {code:string}).code,'provider_response_invalid');return true;});
});
test('already redirected or mismatched response URL refused, without reading body',async()=>{
  for(const kind of ['redirected','url']){const f=streamBody('PROTECTED_CANARY');Object.defineProperty(f.response,kind,{value:kind==='redirected'?true:'https://evil.invalid/v1/responses'});await assert.rejects(run(async()=>f.response),code('redirect_not_allowed'));assert.equal(f.stats().received,0);assert.equal(f.stats().cancelled,true);}
});
test('browser caps success/error/status/pairing responses before parsing and never leaks raw errors',async t=>{
  const req=request(),f=await fixture();const fetcher=t.mock.method(globalThis,'fetch',async()=>streamBody('PROTECTED_CANARY'+' '.repeat(P.plannerResponseBytes*2),{status:500}).response);
  await assert.rejects(requestPlan(req,'synthetic-token',signal(),()=>req,{gate:f.gate}),code('response_too_large'));
  fetcher.mock.mockImplementation(async()=>streamBody(' '.repeat(P.controlResponseBytes+1)).response);
  await assert.rejects(plannerStatus(),code('response_too_large'));await assert.rejects(createNativePairing('synthetic-token'),code('response_too_large'));
  fetcher.mock.restore();
});
test('gateway forwards content-safe security reason, releases reservation, and diagnostics cannot serialize body',async()=>{
  let released=0;const f=await fixture();const gateway=createGateway({status:async()=>({connected:true,enabled:true,remaining:1}),reserve:async()=>({key:SYNTHETIC_PROVIDER_KEY,release:async()=>{released++;}})},async()=>{throw new TransportDenied('response_too_large',500);},{minIntervalMs:0,...f.gatewayOptions});
  const status=await(await gateway(new Request('http://localhost:3211/api/planner/status'))).json();
  const response=await gateway(new Request('http://localhost:3211/api/planner',{method:'POST',headers:{origin:'http://localhost:3211','content-type':'application/json','x-atepdf-token':status.token},body:JSON.stringify((await import('../../packages/planner/src/outbound/schema')).projectHosted(request()))}));
  assert.equal(response.status,502);const reply=await response.json();assert.equal(reply.reasonCode,'response_too_large');assert.doesNotMatch(JSON.stringify(reply),/PROTECTED_CANARY|synthetic-transport|Bearer/);assert.equal(released,1);
  assert.deepEqual(outboundDiagnostic({body:'PROTECTED_CANARY',key:'PROTECTED_CANARY'}),{event:'outbound_blocked',reasonCode:'outbound_failed'});
});
test('limits exceed worst current four-step schema shape, provider framing and native generated constants agree',async()=>{
  const inputs=Array.from({length:100},(_,i)=>'file_'+String(i).padStart(64,'a'));
  const plan={schemaVersion:'1.0',status:'plan',reasonCode:null,steps:Array.from({length:4},(_,i)=>({id:'s_'+String(i).padStart(32,'a'),operation:'select_pages',inputs,outputRef:'out_'+String(i).padStart(64,'a'),params:{action:'remove',pages:{mode:'explicit',indices:Array.from({length:10000},(_,i)=>90001+i)}}})),resultRefs:Array.from({length:100},(_,i)=>'out_'+String(i).padStart(64,'a')),clarification:null};
  const envelope={schemaVersion:'1.0',requestId:'req_'+'a'.repeat(80),workspaceRevision:Number.MAX_SAFE_INTEGER,planner:plan};
  assert.ok(encoder.encode(JSON.stringify(envelope)).length<P.plannerResponseBytes);
  assert.ok(encoder.encode(JSON.stringify({...answer(),output:[{...answer().output[0],arguments:JSON.stringify(plan)}]})).length<P.providerResponseBytes);
  const source=await readFile('apps/universal/modules/atepdf-planner/ios/AtepdfPlannerTransport.swift','utf8');assert.match(source,new RegExp(`plannerResponseBytes = ${P.plannerResponseBytes}`));assert.match(source,new RegExp(`controlResponseBytes = ${P.controlResponseBytes}`));
});

test('unbound browser injected writer cannot reconstruct tokens or instruction at another origin',async()=>{
  let auth=0,payload=0;const fetcher:typeof fetch=async(_u,init)=>{auth+=new Headers(init?.headers).get('x-atepdf-token')?.length??0;payload+=String(init?.body??'').length;return Response.json({});};
  const f=await fixture(),req=request();
  await assert.rejects(requestPlan(req,'synthetic-token',signal(),()=>req,{gate:f.gate,fetch:fetcher}),code('destination_not_allowed'));
  const transport=createSyntheticTransport({mode:'test',role:'local',endpoint:'http://localhost:3211/api/planner',fetcher});
  await assert.rejects(requestPlan(req,'sk-SHR70-NONREAL-CREDENTIAL',signal(),()=>req,{gate:f.gate,fetch:fetcher,transport}),code('destination_not_allowed'));
  assert.deepEqual({auth,payload},{auth:0,payload:0});
  const response=quickLocalResponse(req);
  const allowed:typeof fetch=async()=>Response.json(response);
  const authority=createSyntheticTransport({mode:'development',role:'local',endpoint:'http://localhost:3211/api/planner',fetcher:allowed});
  assert.deepEqual(await requestPlan(req,SYNTHETIC_LOCAL_TOKEN,signal(),()=>req,{gate:f.gate,fetch:allowed,transport:authority}),response);
});
function quickLocalResponse(req:ReturnType<typeof request>){return {schemaVersion:'1.0',requestId:req.requestId,workspaceRevision:req.workspaceRevision,planner:{schemaVersion:'1.0',status:'undo',reasonCode:'undo_last_change',steps:[],resultRefs:[],clarification:null}};}
test('UTF-8 bytes, compression and browser opaque redirects retain bounds',async()=>{
  assert.equal(await readBoundedText(streamBody('€'.repeat(4),{chunk:1}).response,12),'€'.repeat(4));
  await assert.rejects(readBoundedText(streamBody('€'.repeat(5),{chunk:1}).response,12),code('response_too_large'));
  const compressed=streamBody('null',{length:'2'}).response;compressed.headers.set('content-encoding','gzip');assert.equal(await readBoundedJson(compressed,8),null);
  const opaque=streamBody('PROTECTED_CANARY');Object.defineProperty(opaque.response,'type',{value:'opaqueredirect'});await assert.rejects(readBoundedText(opaque.response,100),code('redirect_not_allowed'));assert.equal(opaque.stats().received,0);
});
