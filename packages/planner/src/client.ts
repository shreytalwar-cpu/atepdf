import type {Request as PlannerRequest,Envelope} from '../../contracts/src/protocol';
import {validateEnvelope,validateEnvelopeBinding} from '../../contracts/src/protocol';
import responseValid from '../../contracts/src/generated/response';
import type {PlannerResponse} from './schema';
import {validateNonPlanResponse} from './reply';
import {validateRequest} from './request';
export type PlannerStatus={connected:boolean;enabled:boolean;remaining:number;token:string;model:string;pairingRequired?:boolean};
export async function plannerStatus(signal?:AbortSignal):Promise<PlannerStatus>{const response=await fetch('/api/planner/status',{cache:'no-store',signal:AbortSignal.any([AbortSignal.timeout(10_000),...(signal?[signal]:[])])});if(!response.ok)throw new Error('The local planner gateway is unavailable. Quick actions still work.');return response.json();}
export async function requestPlan(request:PlannerRequest,token:string,signal:AbortSignal){
  const response=await fetch('/api/planner',{method:'POST',headers:{'Content-Type':'application/json','X-Atepdf-Token':token},body:JSON.stringify(validateRequest(request)),signal,cache:'no-store'});
  // No stream consumer or partial-plan execution path exists.
  if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(typeof error.error==='string'?error.error:'Planning did not finish. No local files changed.');}
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
  const response=await fetch('/api/planner/pairing',{method:'POST',headers:{'Content-Type':'application/json','X-Atepdf-Token':token},body:'{}',cache:'no-store'});
  if(!response.ok)throw new Error('A pairing code could not be created.');
  return await response.json() as {code:string;expiresAt:number};
}

export async function savePlannerKey(key:string,token:string){
  const response=await fetch('/api/planner/key',{method:'POST',headers:{'Content-Type':'application/json','X-Atepdf-Token':token},body:JSON.stringify({key}),cache:'no-store'});
  if(!response.ok)throw new Error('The key could not be saved. Check its format or your existing local setup.');
}
