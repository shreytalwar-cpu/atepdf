import type {Request as PlannerRequest,Envelope} from '../../contracts/src/protocol';
import {validateEnvelope,validateEnvelopeBinding} from '../../contracts/src/protocol';
import type {PlannerResponse} from './schema';
import {validateNonPlanResponse} from './reply';
import {projectHosted} from './outbound/schema';
import {productionOutbound,OutboundDenied,REASON_CODES,type Reason} from './outbound/gate';
import {TRANSPORT_POLICY,readBoundedJson,TransportDenied,TRANSPORT_REASONS,assertSyntheticLocalWriter,type SyntheticTransport} from './transport';
export type PlannerStatus={connected:boolean;enabled:boolean;remaining:number;token:string;model:string;gateAvailable?:boolean;gateReason?:string|null;pairingRequired?:boolean};
export async function plannerStatus(signal?:AbortSignal):Promise<PlannerStatus>{assertLocalPlannerOrigin();const response=await fetch('/api/planner/status',{cache:'no-store',redirect:'manual',signal:AbortSignal.any([AbortSignal.timeout(10_000),...(signal?[signal]:[])])});const status=await readBoundedJson(response,TRANSPORT_POLICY.controlResponseBytes,signal);if(!response.ok)throw new Error('The local planner gateway is unavailable. Quick actions still work.');return status;}
export function assertLocalPlannerOrigin(){
  if(typeof location!=='undefined'&&(!['http:','https:'].includes(location.protocol)||!['localhost','127.0.0.1','[::1]'].includes(location.hostname)))throw new OutboundDenied({outcome:'DENY',reason:'recipient_undisclosed'});
}
export const LOCAL_ONLY_MESSAGE='AI is unavailable. Use local tools instead. Your existing files and results are still available.';
export async function requestPlan(request:PlannerRequest,token:string,signal:AbortSignal,readCurrent:()=>PlannerRequest=()=>request,boundary:{gate?:typeof productionOutbound;fetch?:typeof fetch;transport?:SyntheticTransport}={}){
  assertLocalPlannerOrigin();
  if(boundary.fetch)assertSyntheticLocalWriter(boundary.fetch,token,boundary.transport);
  const response=await (boundary.gate??productionOutbound).writeLocalHosted(()=>projectHosted(readCurrent()),body=>(boundary.fetch??fetch)('/api/planner',{method:'POST',headers:{'Content-Type':'application/json','X-Atepdf-Token':token},body,signal,cache:'no-store',redirect:'manual'}),signal);
  // Bounded receiving never admits a partial plan.
  const envelope=await readBoundedJson(response,TRANSPORT_POLICY.plannerResponseBytes,signal);
  if(TRANSPORT_REASONS.includes(envelope?.reasonCode))throw new TransportDenied(envelope.reasonCode);
  if(response.status===403)throw new OutboundDenied({outcome:'DENY',reason:REASON_CODES.includes(envelope?.reasonCode)?envelope.reasonCode as Reason:'recipient_undisclosed'});
  if(response.status===503)throw Object.assign(new Error('AI planning is not enabled. Use local tools instead.'),{code:'planner_unavailable'});
  if(!response.ok)throw new Error('Planning did not finish. No local files changed.');
  signal.throwIfAborted();
  return validatePlanResult(envelope,request,signal);
}
export async function validatePlanResult(value:unknown,request:PlannerRequest,signal?:AbortSignal){
  // Response-only validation loads when a reply arrives. It remains mandatory
  // before returning any plan; cancellation during the load cannot admit work.
  const {default:responseValid}=await import('../../contracts/src/generated/response');
  signal?.throwIfAborted();
  const envelope=value as {schemaVersion:'1.0';requestId:string;workspaceRevision:number;planner:PlannerResponse};
  validateEnvelopeBinding(envelope,request,request.workspaceRevision);
  if(envelope.schemaVersion!=='1.0'||envelope.requestId!==request.requestId||envelope.workspaceRevision!==request.workspaceRevision||!responseValid(envelope.planner))throw new Error('Invalid or stale plan. No local files changed.');
  if(envelope.planner.status==='plan')validateEnvelope(envelope,request,request.workspaceRevision);
  else validateNonPlanResponse(envelope.planner);
  return envelope;
}
export async function createNativePairing(token:string){
  assertLocalPlannerOrigin();
  const response=await fetch('/api/planner/pairing',{method:'POST',headers:{'Content-Type':'application/json','X-Atepdf-Token':token},body:'{}',cache:'no-store',redirect:'manual'});
  const value=await readBoundedJson(response,TRANSPORT_POLICY.controlResponseBytes);
  if(!response.ok)throw new Error('A pairing code could not be created.');
  return value as {code:string;expiresAt:number};
}

export async function savePlannerKey(key:string,token:string){
  assertLocalPlannerOrigin();
  const response=await fetch('/api/planner/key',{method:'POST',headers:{'Content-Type':'application/json','X-Atepdf-Token':token},body:JSON.stringify({key}),cache:'no-store',redirect:'manual'});
  await readBoundedJson(response,TRANSPORT_POLICY.controlResponseBytes);
  if(!response.ok)throw new Error('The key could not be saved. Check its format or your existing local setup.');
}
