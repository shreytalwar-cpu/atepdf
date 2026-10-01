// Run from the source snapshot under test; imports bind to that cwd.
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const fromSource=(path:string)=>import(pathToFileURL(resolve(path)).href);
test('SHR-70 historical reproduction: provider must stop before an oversized JSON tail',async t=>{
  const {buildRequest}=await fromSource('packages/contracts/src/protocol.ts');
  const {planWithOpenAI,MODEL}=await fromSource('packages/planner/src/provider.ts');
  const {fixture}=await fromSource('tests/helpers/outbound-fixture.ts');
  const transport=await fromSource('packages/planner/src/transport.ts').catch(()=>null);
  const cap=transport?.TRANSPORT_POLICY.providerResponseBytes??1048576;
  const reply={id:'resp_synthetic',created_at:1,model:MODEL,status:'completed',error:null,incomplete_details:null,output:[{id:'fc_synthetic',type:'function_call',status:'completed',call_id:'call_synthetic',name:'undo_last_change',arguments:'{}'}]};
  const head=JSON.stringify(reply),data=new TextEncoder().encode(head+' '.repeat(cap*2-head.length));
  let readBytes=0,cancelled=false;
  const fetcher:typeof fetch=async()=>new Response(new ReadableStream<Uint8Array>({pull(c){if(readBytes===data.length){c.close();return;}const chunk=data.subarray(readBytes,Math.min(data.length,readBytes+65536));readBytes+=chunk.length;c.enqueue(chunk);},cancel(){cancelled=true;}},{highWaterMark:0}),{headers:{'Content-Type':'application/json'}});
  const f=await fixture();let result:unknown,error:unknown;
  const authority=transport?.createSyntheticTransport({mode:'test',endpoint:transport.TRANSPORT_POLICY.providerEndpoint,fetcher});
  try{result=await planWithOpenAI(buildRequest({revision:1,files:[],selected:[],focus:null,originals:[]},'Undo the last change'),'atepdf-synthetic-transport-only',new AbortController().signal,fetcher,{...f.boundary,...(authority?{transport:authority}:{})});}catch(e){error=e;}
  t.diagnostic(JSON.stringify({readBytes,cancelled,accepted:!!result,reasonCode:(error as {code?:string})?.code??null}));
  assert.equal((error as {code?:string})?.code,'response_too_large');
  assert.ok(readBytes<=cap+65536);assert.ok(cancelled);
});
