import policy from '../../contracts/transport-policy.json';
export const TRANSPORT_POLICY=Object.freeze(policy);
export const SYNTHETIC_LOCAL_TOKEN='atepdf-synthetic-local-only';
export const SYNTHETIC_PROVIDER_KEY='atepdf-synthetic-transport-only';
export const TRANSPORT_REASONS=['destination_not_allowed','redirect_not_allowed','response_too_large','response_truncated','provider_response_invalid'] as const;
export type TransportReason=typeof TRANSPORT_REASONS[number];
const messages:Record<TransportReason,string>={destination_not_allowed:'AI destination is not approved. No files changed.',redirect_not_allowed:'AI connection redirected. No files changed.',response_too_large:'AI response exceeded the supported size. No files changed.',response_truncated:'AI response was interrupted. No files changed.',provider_response_invalid:'AI response could not be accepted. No files changed.'};
export class TransportDenied extends Error {
  constructor(readonly code:TransportReason,readonly statusCode?:number){super(messages[code]);this.name='TransportDenied';}
}
/** No wildcard routes, environment-derived recipient approval, or URL parser repair. */
export function normalizedDestination(raw:string){
  if(typeof raw!=='string'||!/^https?:\/\/[^/?#]+(?:\/|$)/i.test(raw)||/[\\\s%]/.test(raw))throw new TransportDenied('destination_not_allowed');
  let url:URL;try{url=new URL(raw);}catch{throw new TransportDenied('destination_not_allowed');}
  const authority=raw.split('/')[2];
  if(authority.includes('@')||url.username||url.password||url.search||url.hash)throw new TransportDenied('destination_not_allowed');
  return url;
}
export type SyntheticTransport=Readonly<{mode:'test'|'development'}>;
const synthetic=new WeakMap<SyntheticTransport,{endpoint:string;fetcher:typeof fetch;role:'provider'|'local'}>();
/** Explicit code-owned injection; release builds cannot create or consume it.
 * The only provider credential it admits is the fixed non-secret sentinel.
 * A synthetic writer is trusted fixture code and may never be fed a real key.
 */
export function createSyntheticTransport({mode,endpoint,fetcher,role='provider'}:{role?:'provider'|'local';mode:'test'|'development';endpoint:string;fetcher:typeof fetch}):SyntheticTransport{
  assertSyntheticMode(mode);
  const url=normalizedDestination(endpoint);
  const intercepted=url.href===policy.providerEndpoint;
  const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&url.protocol==='http:'&&Number(url.port)>=1024&&Number(url.port)<=65535&&(role==='provider'?url.pathname==='/v1/responses':url.pathname==='/api/planner');
  if((role!=='provider'&&role!=='local')||!(role==='provider'&&intercepted)&&!loopback||typeof fetcher!=='function')throw new TransportDenied('destination_not_allowed');
  const authority=Object.freeze({mode});synthetic.set(authority,{endpoint:url.href,fetcher,role});return authority;
}
function assertSyntheticMode(mode:unknown){
  if((mode!=='test'&&mode!=='development')||typeof process==='undefined'||process.env.NODE_ENV==='production')throw new TransportDenied('destination_not_allowed');
}
export function providerDestination(key:string,fetcher?:typeof fetch,authority?:SyntheticTransport){
  if(authority){
    assertSyntheticMode(authority.mode);const configured=synthetic.get(authority);
    if(!configured||configured.role!=='provider'||key!==SYNTHETIC_PROVIDER_KEY||fetcher!==configured.fetcher)throw new TransportDenied('destination_not_allowed');
    return configured.endpoint;
  }
  if(fetcher)throw new TransportDenied('destination_not_allowed');
  return admitProviderDestination(policy.providerEndpoint);
}
export function assertSyntheticLocalWriter(fetcher:typeof fetch,token:string,authority?:SyntheticTransport){
  if(!authority)throw new TransportDenied('destination_not_allowed');
  assertSyntheticMode(authority.mode);const admitted=synthetic.get(authority);
  if(!admitted||admitted.role!=='local'||admitted.fetcher!==fetcher||token!==SYNTHETIC_LOCAL_TOKEN)throw new TransportDenied('destination_not_allowed');
}
export function admitProviderDestination(raw:string,authority?:SyntheticTransport){
  const url=normalizedDestination(raw);
  if(authority){assertSyntheticMode(authority.mode);if(synthetic.get(authority)?.role==='provider'&&synthetic.get(authority)?.endpoint===url.href)return url.href;}
  else if(url.href===policy.providerEndpoint)return url.href;
  throw new TransportDenied('destination_not_allowed');
}
export function assertProviderBaseUrl(raw:string|undefined){
  if(raw!==undefined&&normalizedDestination(raw).href!==policy.providerBaseUrl)throw new TransportDenied('destination_not_allowed');
}
/** Check headers and count decoded bytes. Never consume an oversized tail.
 * Content-Length is an early refusal, never the only bound. Compression may
 * change the visible byte count, so exact length checks apply only unencoded.
 */
export async function readBoundedText(response:Response,limit:number,signal?:AbortSignal):Promise<string>{
  const cancel=async()=>{await response.body?.cancel().catch(()=>{});};
  if(response.type==='opaqueredirect'||response.redirected||response.status>=300&&response.status<400){await cancel();throw new TransportDenied('redirect_not_allowed',response.status);}
  const length=response.headers.get('content-length');
  if(length!==null&&!/^\d+$/.test(length)){await cancel();throw new TransportDenied('provider_response_invalid',response.status);}
  if(length!==null&&Number(length)>limit){await cancel();throw new TransportDenied('response_too_large',response.status);}
  const reader=response.body?.getReader();
  if(!reader)throw new TransportDenied('response_truncated',response.status);
  let total=0;const parts:string[]=[];const decoder=new TextDecoder('utf-8',{fatal:true});
  const abort=()=>{void reader.cancel().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
  try{
    while(true){
      signal?.throwIfAborted();let next:ReadableStreamReadResult<Uint8Array>;
      try{next=await reader.read();}catch{signal?.throwIfAborted();throw new TransportDenied('response_truncated',response.status);}
      if(next.done)break;
      total+=next.value.byteLength;if(total>limit)throw new TransportDenied('response_too_large',response.status);
      try{parts.push(decoder.decode(next.value,{stream:true}));}catch{throw new TransportDenied('provider_response_invalid',response.status);}
    }
    signal?.throwIfAborted();
    if(length!==null&&!response.headers.get('content-encoding')&&Number(length)!==total)throw new TransportDenied(total<Number(length)?'response_truncated':'provider_response_invalid',response.status);
    try{parts.push(decoder.decode());}catch{throw new TransportDenied('provider_response_invalid',response.status);}
    return parts.join('');
  }finally{signal?.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function readBoundedJson(response:Response,limit:number,signal?:AbortSignal):Promise<any>{
  const text=await readBoundedText(response,limit,signal);
  try{return JSON.parse(text);}catch{throw new TransportDenied('provider_response_invalid',response.status);}
}
/** SDK parses once, after streaming admission. No body/header/error is logged. */
export async function boundedProviderResponse(response:Response,endpoint:string,signal:AbortSignal){
  if(response.url&&normalizedDestination(response.url).href!==endpoint){await response.body?.cancel().catch(()=>{});throw new TransportDenied('redirect_not_allowed',response.status);}
  const text=await readBoundedText(response,policy.providerResponseBytes,signal);
  return new Response(text,{status:response.status,headers:{'Content-Type':response.headers.get('content-type')??'application/json'}});
}
