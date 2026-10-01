import {TransportDenied} from '@planner/transport-errors';
import NativePlanner from '../../modules/atepdf-planner';
import NativePDF from '../../modules/atepdf-pdf';
import {validatePlanResult,type PlannerStatus} from '@planner/client';
import {projectHosted} from '@planner/outbound/schema';
import {productionOutbound} from '@planner/outbound/gate';
import type {Request as PlannerRequest} from '@contracts/protocol';
export type {PlannerStatus};
export const plannerAvailable=NativePlanner?.available===true&&NativePDF?.storageIsolated===true;
function native(){if(!plannerAvailable||!NativePlanner)throw new Error('AI connection is not available on this device yet. Local quick actions still work.');return NativePlanner;}
async function call<T>(work:(id:string)=>Promise<T>,signal?:AbortSignal):Promise<T>{
  signal?.throwIfAborted();const bridge=native(),id=crypto.randomUUID();
  return new Promise<T>((resolve,reject)=>{
    const abort=()=>{void bridge.cancelAsync(id).catch(()=>{});reject(new DOMException('Cancelled','AbortError'));};
    signal?.addEventListener('abort',abort,{once:true});
    work(id).then(value=>{signal?.removeEventListener('abort',abort);if(signal?.aborted)reject(new DOMException('Cancelled','AbortError'));else resolve(value);},error=>{signal?.removeEventListener('abort',abort);reject(error);});
  });
}
export async function plannerStatus(signal?:AbortSignal):Promise<PlannerStatus>{
  const status=safeJSON(await call(id=>native().statusAsync(id),signal));
  if(typeof status.connected!=='boolean'||typeof status.enabled!=='boolean'||!Number.isSafeInteger(status.remaining)||status.remaining<0||typeof status.model!=='string')throw new Error('Invalid connection status.');
  return {...status,token:''};
}
export async function requestPlan(request:PlannerRequest,_token:string,signal:AbortSignal,readCurrent:()=>PlannerRequest=()=>request){
  const value=safeJSON(await productionOutbound.writeLocalHosted(()=>projectHosted(readCurrent()),body=>call(id=>native().planAsync(id,body),signal),signal));
  signal.throwIfAborted();return validatePlanResult(value,request,signal);
}
export async function pairNativePlanner(code:string){await call(id=>native().pairAsync(id,code.trim()));}
export async function disconnectNativePlanner(){await call(id=>native().disconnectAsync(id));}
export async function savePlannerKey(_key:string,_token:string):Promise<void>{throw new Error('Provider keys belong in the local browser setup.');}
export async function createNativePairing(_token:string):Promise<{code:string;expiresAt:number}>{throw new Error('Create a pairing code in the browser.');}

function safeJSON(text:string){try{return JSON.parse(text);}catch{throw new TransportDenied('provider_response_invalid');}}
