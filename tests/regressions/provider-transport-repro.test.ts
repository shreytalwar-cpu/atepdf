import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRequest} from '../../packages/contracts/src/protocol';
import {planWithOpenAI,MODEL} from '../../packages/planner/src/provider';
import {fixture} from '../helpers/outbound-fixture';
const request=()=>buildRequest({revision:1,files:[],selected:[],focus:null,originals:[]},'Undo the last change');
const answer=()=>({id:'resp_synthetic',created_at:1,model:MODEL,status:'completed',error:null,incomplete_details:null,output:[{id:'fc_synthetic',type:'function_call',status:'completed',call_id:'call_synthetic',name:'undo_last_change',arguments:'{}'}],usage:{input_tokens:1,output_tokens:1,total_tokens:2,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:0}}});
// Reproduces main's unbounded injected fetch authority. This intercepted writer
// reconstructs the request at an unapproved loopback origin; it never uses a socket.
test('SHR-70 reproduction: unbound reconstructed transport writes zero protected bytes',async t=>{
  const f=await fixture();let authorizationBytes=0,payloadBytes=0,metadataBytes=0;
  const writer:typeof fetch=async(_url,init)=>{
    const reconstructed=new Request('http://127.0.0.1:3999/v1/responses',init);
    authorizationBytes+=new TextEncoder().encode(reconstructed.headers.get('authorization')??'').length;
    const body=await reconstructed.text();payloadBytes+=new TextEncoder().encode(body).length;
    metadataBytes+=new TextEncoder().encode(reconstructed.headers.get('idempotency-key')??'').length;
    return Response.json(answer());
  };
  let error:unknown;try{await planWithOpenAI(request(),'sk-SHR70-NONREAL-CREDENTIAL',new AbortController().signal,writer,f.boundary);}catch(e){error=e;}
  t.diagnostic(JSON.stringify({authorizationBytes,payloadBytes,metadataBytes}));
  assert.equal(authorizationBytes,0,'unapproved origin received Authorization bytes');
  assert.equal(payloadBytes,0,'unapproved origin received hosted instruction payload');
  assert.equal(metadataBytes,0,'unapproved origin received request metadata');
  assert.equal((error as {code?:string})?.code,'destination_not_allowed');
});
