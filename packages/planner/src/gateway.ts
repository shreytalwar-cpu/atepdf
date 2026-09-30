import {randomBytes} from 'node:crypto';
import type {Request as PlannerRequest} from '../../contracts/src/protocol';
import {validateRequest} from './request';
export {validateRequest} from './request';
import {bindResponse} from './schema';
import {MODEL,planWithOpenAI} from './provider';
import {LocalConfig} from './local-config';
import {NativePairing} from './native-pairing';
import {packBetaPairing,validateNativeEndpoint,type NativeEndpoint} from './native-beta';
import {validateHosted,hostedLocalContext,type HostedPayload} from './outbound/schema';
import {productionOutbound,OutboundDenied,type OutboundGate} from './outbound/gate';
const LIMIT=24_000;

export function createGateway(config:Pick<LocalConfig,'status'|'reserve'> & Partial<Pick<LocalConfig,'saveKey'>>,provider=planWithOpenAI,{timeoutMs=30_000,minIntervalMs=1500,nativeEndpoint,outbound=productionOutbound,recipientRoute=['openai-development']}:{timeoutMs?:number;minIntervalMs?:number;nativeEndpoint?:NativeEndpoint;outbound?:OutboundGate;recipientRoute?:string[]}={}){
  if(nativeEndpoint)validateNativeEndpoint(nativeEndpoint);
  const token=randomBytes(32).toString('hex');let running=false,lastStarted=0;const used=new Set<string>();
  const pairing=new NativePairing();
  const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  return async(request:Request)=>{
    const url=new URL(request.url),host=request.headers.get('host')??url.host;
    if(!/^https?:$/.test(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||host!==url.host)return json({error:'Local access only.'},403);
    const origin=request.headers.get('origin');
    if((origin&&origin!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Use atepdf on this computer.'},403);
    const native=url.pathname.startsWith('/api/native/');
    if(native){
      // Native requests have no browser fetch context; never grant native auth
      // to a browser just because it is same-origin.
      if(origin||request.headers.has('sec-fetch-site'))return json({error:'Native connection required.'},403);
      if(url.pathname==='/api/native/pair'&&request.method==='POST'){
        if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'Invalid pairing request.'},415);
        try{const text=await smallBody(request,256),data=JSON.parse(text);if(Object.keys(data).length!==1||typeof data.code!=='string')throw new Error();return json(pairing.exchange(data.code,url.origin));}
        catch{return json({error:'Pairing expired or invalid. Create a new code in the browser.'},401);}
      }
      if(!pairing.accepts(request.headers.get('authorization'),url.origin))return json({error:'Pair this app with the browser again.'},401);
      if(request.method==='GET'&&url.pathname==='/api/native/planner/status')return json({...await config.status(),model:MODEL});
      if(request.method==='POST'&&url.pathname==='/api/native/disconnect'){pairing.revoke(request.headers.get('authorization'));return json({disconnected:true});}
      if(request.method!=='POST'||url.pathname!=='/api/native/planner')return json({error:'Not found.'},404);
    }
    if(request.method==='GET'&&url.pathname==='/api/planner/status')return json({...await config.status(),token,model:MODEL});
    if(request.method!=='POST')return json({error:'Method not allowed.'},405);
    if(!native&&(origin!==url.origin||request.headers.get('x-atepdf-token')!==token))return json({error:'Refresh atepdf before planning.'},403);
    if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'Expected a plan request.'},415);
    if(url.pathname==='/api/planner/pairing'){
      try{if(await smallBody(request,8)!=='{}')throw new Error();if(!['3210','3211','3212'].includes(url.port))throw new Error();const issued=pairing.issue(url.origin);return json(nativeEndpoint?packBetaPairing(issued,nativeEndpoint):issued);}
      catch{return json({error:'Local pairing unavailable.'},400);}
    }
    if(url.pathname==='/api/planner/key'){
      if(!config.saveKey)return json({error:'Key setup unavailable.'},503);
      try{
        const reader=request.body?.getReader();if(!reader)throw new Error();let size=0,text='';const decoder=new TextDecoder();
        try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024)throw new Error();text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}
        const data=JSON.parse(text);if(!data||Object.keys(data).length!==1||typeof data.key!=='string')throw new Error();
        await config.saveKey(data.key);return json({saved:true,enabled:false});
      }catch{return json({error:'The key could not be saved. Check its format or the existing local setup; nothing was overwritten.'},400);}
    }
    if(url.pathname!=='/api/planner'&&url.pathname!=='/api/native/planner')return json({error:'Not found.'},404);
    if(!((await config.status()).enabled))return json({error:'AI planning is not enabled. Connect a key and approve a request limit locally.'},503);
    if(running||Date.now()-lastStarted<minIntervalMs)return json({error:'Wait for the current request.'},429);
    let parsed:PlannerRequest,hostedPayload:HostedPayload;
    try{
      if(Number(request.headers.get('content-length'))>LIMIT)throw new Error();
      const reader=request.body?.getReader();if(!reader)throw new Error();let total=0,body='';const decoder=new TextDecoder();
      try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>LIMIT)throw new Error();body+=decoder.decode(value,{stream:true});}body+=decoder.decode();}finally{await reader.cancel();}
      hostedPayload=validateHosted(JSON.parse(body));parsed=hostedLocalContext(hostedPayload);
    }catch{return json({error:'This instruction cannot be sent safely. Use file positions and a short PDF operation.'},400);}
    if(used.has(parsed.requestId))return json({error:'This request was already submitted.'},409);
    if(running)return json({error:'Wait for the current request.'},429);
    if(used.size>=200)return json({error:'Restart the local gateway to start a new test session.'},429);
    running=true;used.add(parsed.requestId);lastStarted=Date.now();let release:(()=>Promise<void>)|undefined;
    try{
      request.signal.throwIfAborted();
      const proposal=()=>({kind:'hosted' as const,payload:validateHosted(hostedPayload),route:[...recipientRoute],endpoint:'https://api.openai.com/v1/responses',purposeCode:'interpret_instruction',idempotencyKey:parsed.requestId,transferId:`dispatch_${parsed.requestId}`});
      const permission=await outbound.check(proposal());if(permission.outcome!=='ALLOW')throw new OutboundDenied(permission);
      const reservation=await config.reserve();release=reservation.release;
      const signal=AbortSignal.any([request.signal,AbortSignal.timeout(timeoutMs)]);
      signal.throwIfAborted();
      const planner=await outbound.write(proposal,()=>provider(parsed,reservation.key,signal,undefined,{gate:outbound,route:recipientRoute,hostedPayload}),signal);signal.throwIfAborted();
      const result=bindResponse(planner,parsed);return json(result);
    }catch(error){
      if(error instanceof OutboundDenied)return json({error:'Outbound request blocked. No local files changed.',reasonCode:error.verdict.reason,outcome:error.verdict.outcome},403);
      const code=error&&typeof error==='object'&&'statusCode' in error?error.statusCode:null;
      const message=code===401?'OpenAI did not accept this key. Check the local connection.':code===403?'This OpenAI project does not have permission for the planner.':code===429?'OpenAI could not accept this request. Check the project quota or try later.':code===404?'The planner model is unavailable for this project.':'Planning did not finish. No local files changed. Try a quick action.';
      return json({error:request.signal.aborted?'Planning cancelled. No local files changed.':message},request.signal.aborted?499:502);
    }
    finally{running=false;if(release)await release().catch(()=>{});}
  };
}
async function smallBody(request:Request,limit:number){
  const reader=request.body?.getReader();if(!reader)throw new Error();let size=0,text='';const decoder=new TextDecoder();
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw new Error();text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}
  finally{await reader.cancel();}
}
