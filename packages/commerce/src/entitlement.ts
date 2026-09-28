/** Pure M6-01 domain contracts. No provider verification or application entitlement is implemented. */
export const COMMERCE_ENABLED = false as const;
export const commercialActionsAvailable = (): false => COMMERCE_ENABLED;

export type PurchaseActivity = 'idle' | 'checkout_pending' | 'verification_pending' | 'restore_pending' | 'cancelled' | 'failed';
export type EntitlementGrant =
  | {status:'active'|'grace';accessUntil:number;renews:boolean}
  | {status:'none'|'expired'|'revoked';accessUntil:null;renews:false};
/** A future verifier must establish authenticity/account ownership and assign a monotonic aggregate revision. */
export type VerifiedObservation = {
  subjectRef:string;
  eventRef:string;
  verificationRevision:number;
  verifiedAt:number;
  grant:EntitlementGrant;
};
export type EntitlementState = Readonly<{
  subjectRef:string;
  activity:PurchaseActivity;
  observation:Readonly<VerifiedObservation>|null;
}>;
export type AccessDecision = {allowed:boolean;reason:'unknown'|'active'|'grace'|'none'|'expired'|'revoked'|'verification_required'};

const opaque = /^(subject|event)_[a-f0-9]{32}$/;
const integer = (value:unknown):value is number => Number.isSafeInteger(value) && Number(value)>=0;
const exact=(value:object,keys:string[])=>Object.keys(value).sort().join('|')===[...keys].sort().join('|');
function validateObservation(value:VerifiedObservation):void {
  if(!value||typeof value!=='object'||!exact(value,['subjectRef','eventRef','verificationRevision','verifiedAt','grant'])||
    !/^subject_/.test(value.subjectRef)||!opaque.test(value.subjectRef)||!/^event_/.test(value.eventRef)||!opaque.test(value.eventRef)||
    !integer(value.verificationRevision)||value.verificationRevision<1||!integer(value.verifiedAt))throw new Error('Invalid entitlement observation.');
  const grant=value.grant;
  if(!grant||typeof grant!=='object'||!exact(grant,['status','accessUntil','renews'])||typeof grant.renews!=='boolean')throw new Error('Invalid entitlement grant.');
  if(grant.status==='active'||grant.status==='grace'){
    if(!integer(grant.accessUntil)||grant.accessUntil<=value.verifiedAt)throw new Error('Invalid entitlement period.');
  }else if(!['none','expired','revoked'].includes(grant.status)||grant.accessUntil!==null||grant.renews!==false)throw new Error('Invalid entitlement grant.');
}
function frozen(state:EntitlementState):EntitlementState {
  if(!state.observation)return Object.freeze({...state});
  return Object.freeze({...state,observation:Object.freeze({...state.observation,grant:Object.freeze({...state.observation.grant})})});
}
export function initialEntitlement(subjectRef:string):EntitlementState {
  if(!/^subject_[a-f0-9]{32}$/.test(subjectRef))throw new Error('Use an opaque local account reference.');
  return frozen({subjectRef,activity:'idle',observation:null});
}
export function recordPurchaseActivity(state:EntitlementState,activity:PurchaseActivity):EntitlementState {
  if(!['idle','checkout_pending','verification_pending','restore_pending','cancelled','failed'].includes(activity))throw new Error('Invalid purchase activity.');
  // Pending/cancel/failure never create or erase independently verified access.
  return frozen({...state,activity});
}
export function reduceVerifiedObservation(state:EntitlementState,event:VerifiedObservation):EntitlementState {
  validateObservation(event);
  if(event.subjectRef!==state.subjectRef)throw new Error('Account verification does not match.');
  const previous=state.observation;
  if(previous){
    if(event.verificationRevision<previous.verificationRevision)return state;
    if(event.verificationRevision===previous.verificationRevision){
      if(event.eventRef!==previous.eventRef||event.verifiedAt!==previous.verifiedAt||event.grant.status!==previous.grant.status||event.grant.accessUntil!==previous.grant.accessUntil||event.grant.renews!==previous.grant.renews)throw new Error('Conflicting verification revision.');
      return state;
    }
    if(event.eventRef===previous.eventRef||event.verifiedAt<previous.verifiedAt)throw new Error('Invalid verification ordering.');
  }
  // An account observation does not prove completion of a particular checkout or restore flow.
  return frozen({subjectRef:state.subjectRef,activity:state.activity,observation:event});
}
/** Domain decision only. The caller must use a trustworthy clock; this is not a signed offline cache. */
export function evaluateVerifiedAccess(state:EntitlementState,now:number):AccessDecision {
  if(!integer(now))throw new Error('Invalid entitlement clock.');
  const observation=state.observation;
  if(!observation)return {allowed:false,reason:'unknown'};
  if(now<observation.verifiedAt)return {allowed:false,reason:'verification_required'};
  const grant=observation.grant;
  if(grant.status==='active'||grant.status==='grace')return now<grant.accessUntil?{allowed:true,reason:grant.status}:{allowed:false,reason:'expired'};
  return {allowed:false,reason:grant.status};
}
