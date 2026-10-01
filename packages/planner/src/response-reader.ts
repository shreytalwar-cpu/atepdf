import {TransportDenied} from './transport-errors';
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
