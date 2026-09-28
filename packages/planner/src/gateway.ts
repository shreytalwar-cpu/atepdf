import {randomBytes} from 'node:crypto';
import requestValid from '../../contracts/src/generated/request';
import {capabilities,validateLocalContext,type Request as PlannerRequest} from '../../contracts/src/protocol';
import {assertInstructionSafe} from './privacy';
import {bindResponse} from './schema';
import {planWithOpenAI} from './provider';
import {LocalConfig} from './local-config';
const LIMIT=24_000;
export function validateRequest(value:unknown):PlannerRequest{
  if(!requestValid(value))throw new Error('Invalid request.');
  const r=value as PlannerRequest;
  validateLocalContext(r);
  assertInstructionSafe(r.instruction);
  if(!/^req_[a-f0-9]{32}$/.test(r.requestId)||r.files.some(f=>!/^(file|out)_[a-f0-9]{32}$/.test(f.ref))||r.files.length>40||r.previousPlan!==null||r.previousActionIds.length||r.locale!=='en-IN'||r.ocrLanguages.some(language=>language!=='eng')||(!r.capabilities.includes('ocr_pdf')&&r.ocrLanguages.length>0)||r.capabilities.some(c=>!capabilities.includes(c)))throw new Error('Unsupported context.');
  const refs=new Set(r.files.map(f=>f.ref));
  if(refs.size!==r.files.length||r.files.some(f=>f.kind!=='pdf'||f.encrypted||f.pageCount<1||f.pageCount>100)||[...r.selectionRefs,...r.originalRefs,...(r.focusedResultRef?[r.focusedResultRef]:[])].some(ref=>!refs.has(ref)))throw new Error('Invalid file references.');
  // Second positive projection at the server boundary; never forward raw JSON.
  return {schemaVersion:'1.0',requestId:r.requestId,workspaceRevision:r.workspaceRevision,locale:'en-IN',instruction:r.instruction,files:r.files.map(f=>({ref:f.ref,kind:'pdf',pageCount:f.pageCount,sizeBytes:f.sizeBytes,encrypted:false})),selectionRefs:[...r.selectionRefs],focusedResultRef:r.focusedResultRef,originalRefs:[...r.originalRefs],previousActionIds:[],capabilities:[...r.capabilities],previousPlan:null,ocrLanguages:[...r.ocrLanguages]};
}
export function createGateway(config:Pick<LocalConfig,'status'|'reserve'> & Partial<Pick<LocalConfig,'saveKey'>>,provider=planWithOpenAI,{timeoutMs=30_000,minIntervalMs=1500}={}){
  const token=randomBytes(32).toString('hex');let running=false,lastStarted=0;const used=new Set<string>();
  const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  return async(request:Request)=>{
    const url=new URL(request.url),host=request.headers.get('host')??url.host;
    if(!/^https?:$/.test(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||host!==url.host)return json({error:'Local access only.'},403);
    const origin=request.headers.get('origin');
    if((origin&&origin!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Use atepdf on this computer.'},403);
    if(request.method==='GET'&&url.pathname==='/api/planner/status')return json({...await config.status(),token,model:'gpt-5.6-luna'});
    if(request.method!=='POST')return json({error:'Method not allowed.'},405);
    if(origin!==url.origin||request.headers.get('x-atepdf-token')!==token)return json({error:'Refresh atepdf before planning.'},403);
    if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'Expected a plan request.'},415);
    if(url.pathname==='/api/planner/key'){
      if(!config.saveKey)return json({error:'Key setup unavailable.'},503);
      try{
        const reader=request.body?.getReader();if(!reader)throw new Error();let size=0,text='';const decoder=new TextDecoder();
        try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024)throw new Error();text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}
        const data=JSON.parse(text);if(!data||Object.keys(data).length!==1||typeof data.key!=='string')throw new Error();
        await config.saveKey(data.key);return json({saved:true,enabled:false});
      }catch{return json({error:'The key could not be saved. Check its format or the existing local setup; nothing was overwritten.'},400);}
    }
    if(url.pathname!=='/api/planner')return json({error:'Not found.'},404);
    if(!((await config.status()).enabled))return json({error:'AI planning is not enabled. Connect a key and approve a request limit locally.'},503);
    if(running||Date.now()-lastStarted<minIntervalMs)return json({error:'Wait for the current request.'},429);
    let parsed:PlannerRequest;
    try{
      if(Number(request.headers.get('content-length'))>LIMIT)throw new Error();
      const reader=request.body?.getReader();if(!reader)throw new Error();let total=0,body='';const decoder=new TextDecoder();
      try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>LIMIT)throw new Error();body+=decoder.decode(value,{stream:true});}body+=decoder.decode();}finally{await reader.cancel();}
      parsed=validateRequest(JSON.parse(body));
    }catch{return json({error:'This instruction cannot be sent safely. Use file positions and a short PDF operation.'},400);}
    if(used.has(parsed.requestId))return json({error:'This request was already submitted.'},409);
    if(running)return json({error:'Wait for the current request.'},429);
    if(used.size>=200)return json({error:'Restart the local gateway to start a new test session.'},429);
    running=true;used.add(parsed.requestId);lastStarted=Date.now();let release:(()=>Promise<void>)|undefined;
    try{
      request.signal.throwIfAborted();const reservation=await config.reserve();release=reservation.release;
      const signal=AbortSignal.any([request.signal,AbortSignal.timeout(timeoutMs)]);
      signal.throwIfAborted();
      const planner=await provider(parsed,reservation.key,signal);signal.throwIfAborted();
      const result=bindResponse(planner,parsed);return json(result);
    }catch(error){
      const code=error&&typeof error==='object'&&'statusCode' in error?error.statusCode:null;
      const message=code===401?'OpenAI did not accept this key. Check the local connection.':code===403?'This OpenAI project does not have permission for the planner.':code===429?'OpenAI could not accept this request. Check the project quota or try later.':code===404?'The planner model is unavailable for this project.':'Planning did not finish. No local files changed. Try a quick action.';
      return json({error:request.signal.aborted?'Planning cancelled. No local files changed.':message},request.signal.aborted?499:502);
    }
    finally{running=false;if(release)await release().catch(()=>{});}
  };
}
