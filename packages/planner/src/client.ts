import type {Request as PlannerRequest,Envelope} from '../../contracts/src/protocol';
import {validateEnvelope,validateEnvelopeBinding} from '../../contracts/src/protocol';
import responseValid from '../../contracts/src/generated/response';
import type {PlannerResponse} from './schema';
import {validateNonPlanResponse} from './reply';
import {projectHosted} from './outbound/schema';
import {productionOutbound,OutboundDenied} from './outbound/gate';
export type PlannerStatus={connected:boolean;enabled:boolean;remaining:number;token:string;model:string;pairingRequired?:boolean};
export async function plannerStatus(signal?:AbortSignal):Promise<PlannerStatus>{assertLocalPlannerOrigin();const response=await fetch('/api/planner/status',{cache:'no-store',redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(10_000),...(signal?[signal]:[])])});if(!response.ok)throw new Error('The local planner gateway is unavailable. Quick actions still work.');return response.json();}
export function assertLocalPlannerOrigin(){
  if(typeof location!=='undefined'&&!['localhost','127.0.0.1','[::1]'].includes(location.hostname))throw new OutboundDenied({outcome:'DENY',reason:'recipient_undisclosed'});
}
export async function requestPlan(request:PlannerRequest,token:string,signal:AbortSignal,readCurrent:()=>PlannerRequest=()=>request){
  assertLocalPlannerOrigin();
  const response=await productionOutbound.writeLocalHosted(()=>projectHosted(readCurrent()),body=>fetch('/api/planner',{method:'POST',headers:{'Content-Type':'application/json','X-Atepdf-Token':token},body,signal,cache:'no-store',redirect:'error'}),signal);
  // No stream consumer or partial-plan execution path exists.
  if(!response.ok)throw new Error('Planning did not finish. No local files changed.');
  const envelope=await response.json();
  signal.throwIfAborted();
  return validatePlanResult(envelope,request);
}
export function validatePlanResult(value:unknown,request:PlannerRequest){
  const envelope=value as {schemaVersion:'1.0';requestId:string;workspaceRevision:number;planner:PlannerResponse};
  validateEnvelopeBinding(envelope,request,request.workspaceRevision);
  if(envelope.schemaVersion!=='1.0'||envelope.requestId!==request.requestId||envelope.workspaceRevision!==request.workspaceRevision||!responseValid(envelope.planner))throw new Error('Invalid or stale plan. No local files changed.');
  if(envelope.planner.status==='plan')validateEnvelope(envelope,request,request.workspaceRevision);
  else validateNonPlanResponse(envelope.planner);
  return envelope;
}
export async function createNativePairing(token:string){
  assertLocalPlannerOrigin();
  const response=await fetch('/api/planner/pairing',{method:'POST',headers:{'Content-Type':'application/json','X-Atepdf-Token':token},body:'{}',cache:'no-store',redirect:'error'});
  if(!response.ok)throw new Error('A pairing code could not be created.');
  return await response.json() as {code:string;expiresAt:number};
}

export async function savePlannerKey(key:string,token:string){
  assertLocalPlannerOrigin();
  const response=await fetch('/api/planner/key',{method:'POST',headers:{'Content-Type':'application/json','X-Atepdf-Token':token},body:JSON.stringify({key}),cache:'no-store',redirect:'error'});
  if(!response.ok)throw new Error('The key could not be saved. Check its format or your existing local setup.');
}
