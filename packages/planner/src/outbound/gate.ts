import {PRIVACY_POLICY,sizeBucket,type ContentCategory} from './constants';
import {assertClassified,assertHostedText,hasNeverTransfer,validateHosted,type HostedPayload,type ContentPayload} from './schema';
import {sensitiveInstruction} from './sensitive';
import {privateInstruction} from '../privacy';
import type {Artifact} from '../../../core/src/local-file-store';

export type Reason = 'unclassified_field'|'never_transfer'|'recipient_undisclosed'|'disclosure_incomplete'|'hosted_off'|'disclosure_required'|'purpose_not_approved'|'consent_required'|'file_changed'|'pages_changed'|'derivation_regenerated'|'payload_changed'|'plan_changed'|'purpose_changed'|'recipient_changed'|'disclosure_changed'|'copy_changed'|'policy_changed'|'expired'|'clock_invalid'|'workspace_cleared'|'revoked'|'cancelled'|'retry_limit'|'sensitive_instruction';
export const REASON_CODES:readonly Reason[]=['unclassified_field','never_transfer','recipient_undisclosed','disclosure_incomplete','hosted_off','disclosure_required','purpose_not_approved','consent_required','file_changed','pages_changed','derivation_regenerated','payload_changed','plan_changed','purpose_changed','recipient_changed','disclosure_changed','copy_changed','policy_changed','expired','clock_invalid','workspace_cleared','revoked','cancelled','retry_limit','sensitive_instruction'];
export type Verdict = {outcome:'ALLOW'|'DENY'|'REQUIRE_DISCLOSURE'|'REQUIRE_CONSENT'|'REQUIRE_RECONSENT';reason:Reason|null};
export class OutboundDenied extends Error {
  readonly verdict:Verdict;
  constructor(verdict:Verdict){
    const reason=verdict.reason&&REASON_CODES.includes(verdict.reason)?verdict.reason:'unclassified_field';
    super(reason);this.name='OutboundDenied';
    this.verdict=Object.freeze({outcome:['ALLOW','DENY','REQUIRE_DISCLOSURE','REQUIRE_CONSENT','REQUIRE_RECONSENT'].includes(verdict.outcome)?verdict.outcome:'DENY',reason});
  }
}
const notAborted=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Planning cancelled. No local files changed.','AbortError');};
function transportError(error:unknown,signal?:AbortSignal){
  if(error instanceof OutboundDenied)return error;
  if(signal?.aborted)return new DOMException('Planning cancelled. No local files changed.','AbortError');
  const statusCode=error&&typeof error==='object'&&'statusCode'in error&&typeof error.statusCode==='number'?error.statusCode:undefined;
  return Object.assign(new Error('outbound_transport_failed'),{statusCode});
}
export type RecipientDisclosure = {
  recipientId:string;legalEntity:string;displayName:string;role:'relay'|'model_provider'|'processor'|'support';
  endpoints:string[];plaintextRecipients:string[];regions:string[];
  retention:{applicationState:string;abuseMonitoring:string;logs:string;objects:string;backups:string};
  training:string;dataSharing:string;humanReview:string;relayLogging:string;subprocessors:string;
  atepdfStorage:string;deletion:string;retryAndFailover:string;providerUserIdentifier:string;
  disclosureVersion:string;verifiedAt:string;verifiedBy:string;sources:string[];status:'complete'|'incomplete';
};
export type HostedDisclosureAck = {hostedDisclosureVersion:string;policyVersion:string;routeDigest:string};
export type Authority = {hostedAiOn:boolean;ack:HostedDisclosureAck|null;registry:readonly RecipientDisclosure[]};
export type Derivation = {engine:string;engineVersion:string;paramsDigest:string;runId:string};
export type SourceItem = {category:ContentCategory;sourceRef:string;sourceRevision:number;sourceBytes:Uint8Array;pages:number[]|'all';derivation:Derivation|null;itemBytes:Uint8Array};
export type TransferBinding = {
  workspaceId:string;deletionEpoch:number;operation:{kind:string;planId:string;planDigest:string};
  purpose:{code:string;approvedPurposeVersion:string};items:SourceItem[];disclosureDigest:string;
  consentCopyVersion:string;policyVersion:string;
};
type BoundItem = Omit<SourceItem,'sourceBytes'|'itemBytes'> & {sourceContentDigest:string;itemDigest:string;byteLength:number};
type BoundTransfer = {transferId:string;idempotencyKey:string;route:string[];endpoint:string;items:BoundItem[];payloadDigest:string};
export type ContentTransferGrant = {
  schema:'atepdf.consent-grant/1';grantId:string;workspaceId:string;deletionEpoch:number;
  operation:TransferBinding['operation'];purpose:TransferBinding['purpose'];transfers:BoundTransfer[];
  recipientDisclosures:Array<{recipientId:string;disclosureVersion:string}>;disclosureDigest:string;
  consentCopyVersion:string;policyVersion:string;presentedAt:number;decidedAt:number;expiresAt:number;
  decision:'allow'|'cancel'|'dismissed';state:'pending'|'granted'|'in_flight'|'consumed'|'cancelled'|'revoked'|'expired'|'invalidated';
  invalidationReason:Reason|null;userGesture:'pointer'|'keyboard'|'accessibility';appBuild:string;
};
export type Proposal = {
  kind:'hosted'|'content';payload:HostedPayload|ContentPayload;route:string[];endpoint:string;
  purposeCode:string;idempotencyKey:string;transferId:string;grantId?:string;binding?:TransferBinding;
  retry?:'automatic'|'user';
};
type Snapshot = {proposal:Proposal;wire:string;binding:TransferBinding|null;transfer:BoundTransfer|null;routeDigest:string;disclosures:ReturnType<typeof routeVersions>};
const deny=(reason:Reason):Verdict=>({outcome:'DENY',reason});
const again=(reason:Reason):Verdict=>({outcome:'REQUIRE_RECONSENT',reason});
const requireConsent:Verdict={outcome:'REQUIRE_CONSENT',reason:'consent_required'};
const allow:Verdict={outcome:'ALLOW',reason:null};
/** Deterministic JSON. Used only for already classified wire DTOs or LOCAL equality checks. */
export function canonical(value:unknown):string {
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  return '{'+Object.keys(value).sort((a,b)=>a<b?-1:a>b?1:0).map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
}
export async function digest(bytes:string|Uint8Array):Promise<string> {
  const input=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes.slice();
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',input)),n=>n.toString(16).padStart(2,'0')).join('');
}
const eq=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
export function disclosureComplete(r:RecipientDisclosure):boolean {
  if(!r||typeof r!=='object'||!Array.isArray(r.regions)||!Array.isArray(r.sources)||!r.retention||typeof r.retention!=='object')return false;
  const fields=[r.legalEntity,r.displayName,r.role,r.disclosureVersion,r.verifiedAt,r.verifiedBy,r.training,r.dataSharing,r.humanReview,r.relayLogging,r.subprocessors,r.atepdfStorage,r.deletion,r.retryAndFailover,r.providerUserIdentifier,...Object.values(r.retention??{}),...(r.regions??[]),...(r.sources??[])];
  return r.status==='complete'&&fields.every(v=>typeof v==='string'&&!!v.trim()&&!/\bunknown\b/i.test(v))&&
    ['applicationState','abuseMonitoring','logs','objects','backups'].every(k=>typeof r.retention?.[k as keyof RecipientDisclosure['retention']]==='string')&&
    Array.isArray(r.regions)&&r.regions.length>0&&Array.isArray(r.sources)&&r.sources.length>0&&Number.isFinite(Date.parse(r.verifiedAt))&&
    Array.isArray(r.plaintextRecipients)&&r.plaintextRecipients.every(x=>typeof x==='string')&&Array.isArray(r.endpoints)&&r.endpoints.length>0&&r.endpoints.every(e=>{try{const u=new URL(e);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{return false;}});
}
export function routeVersions(route:readonly string[],registry:readonly RecipientDisclosure[]){return route.map(id=>({recipientId:id,disclosureVersion:registry.find(r=>r.recipientId===id)?.disclosureVersion??''}));}
export async function hostedAck(route:readonly string[],registry:readonly RecipientDisclosure[]):Promise<HostedDisclosureAck>{
  return {hostedDisclosureVersion:PRIVACY_POLICY.hostedDisclosureVersion,policyVersion:PRIVACY_POLICY.version,routeDigest:await digest(canonical(routeVersions(route,registry)))};
}
export function routeVerdict(p:Pick<Proposal,'route'|'endpoint'>,a:Pick<Authority,'registry'>):Verdict|null {
  if(!p.route.length||new Set(p.route).size!==p.route.length||a.registry.some((r,i)=>a.registry.findIndex(x=>x.recipientId===r.recipientId)!==i))return deny('recipient_undisclosed');
  for(const id of p.route){
    const record=a.registry.find(r=>r.recipientId===id);
    if(!record)return deny('recipient_undisclosed');
    if(!disclosureComplete(record))return deny('disclosure_incomplete');
    if(record.plaintextRecipients.some(id=>!p.route.includes(id)))return deny('recipient_undisclosed');
  }
  const record=a.registry.find(r=>r.recipientId===p.route[0])!;
  if(!record.endpoints.includes(p.endpoint))return deny('recipient_undisclosed');
  return null;
}
function clonedProposal(p:Proposal):Proposal {
  const payload=structuredClone(p.payload);
  assertClassified(p.payload,p.kind); // retain accessor/hidden-field rejection
  if(hasNeverTransfer(p.payload))throw new OutboundDenied(deny('never_transfer'));
  assertClassified(payload,p.kind);
  if(hasNeverTransfer(payload))throw new OutboundDenied(deny('never_transfer'));
  return {...p,payload,route:[...p.route],binding:p.binding?structuredClone(p.binding):undefined};
}
function validBinding(p:Proposal):boolean {
  const b=p.binding,payload=p.payload as ContentPayload;
  if(!b||!b.workspaceId||!Number.isSafeInteger(b.deletionEpoch)||b.deletionEpoch<0||b.purpose.code!==p.purposeCode||b.policyVersion!==PRIVACY_POLICY.version||b.consentCopyVersion!==PRIVACY_POLICY.consentCopyVersion||!b.operation.kind||!b.operation.planId||!b.operation.planDigest||!b.disclosureDigest||b.items.length!==payload.items.length)return false;
  return b.items.every((i,n)=>i.sourceBytes instanceof Uint8Array&&i.itemBytes instanceof Uint8Array&&/^(file|out)_[a-f0-9]{32}$/.test(i.sourceRef)&&Number.isSafeInteger(i.sourceRevision)&&i.sourceRevision>=0&&
    (i.pages==='all'||(Array.isArray(i.pages)&&i.pages.length>0&&i.pages.every((p,j)=>Number.isSafeInteger(p)&&p>=1&&(j===0||p>(i.pages as number[])[j-1]))))&&
    (i.derivation===null||Object.values(i.derivation).every(v=>typeof v==='string'&&!!v))&&i.category===payload.items[n].category&&eq(Array.from(i.itemBytes),Array.from(new TextEncoder().encode(payload.items[n].data))));
}
async function snapshot(p:Proposal,a:Authority):Promise<Snapshot> {
  const copy=clonedProposal(p),wire=canonical(copy.payload),b=copy.binding??null;
  const transfer:BoundTransfer|null=b?{transferId:p.transferId,idempotencyKey:p.idempotencyKey,route:[...p.route],endpoint:p.endpoint,items:await Promise.all(b.items.map(async i=>({category:i.category,sourceRef:i.sourceRef,sourceRevision:i.sourceRevision,sourceContentDigest:await digest(i.sourceBytes),pages:structuredClone(i.pages),derivation:structuredClone(i.derivation),itemDigest:await digest(i.itemBytes),byteLength:i.itemBytes.length}))),payloadDigest:await digest(wire)}:null;
  const disclosures=routeVersions(p.route,a.registry);
  return {proposal:copy,wire,binding:b,transfer,disclosures,routeDigest:await digest(canonical(disclosures))};
}
function bindingReason(g:ContentTransferGrant,s:Snapshot,a:Authority):Reason|null {
  const b=s.binding!,t=s.transfer!,old=g.transfers.find(x=>x.transferId===t.transferId)!;
  if(g.workspaceId!==b.workspaceId||g.deletionEpoch!==b.deletionEpoch)return 'workspace_cleared';
  if(!eq(g.operation,b.operation))return 'plan_changed';
  if(!eq(g.purpose,b.purpose))return 'purpose_changed';
  if(old.idempotencyKey!==t.idempotencyKey)return 'payload_changed';
  if(!eq(old.route,t.route)||old.endpoint!==t.endpoint)return 'recipient_changed';
  if(!eq(g.recipientDisclosures,routeVersions(s.proposal.route,a.registry))||g.disclosureDigest!==b.disclosureDigest)return 'disclosure_changed';
  if(g.consentCopyVersion!==b.consentCopyVersion)return 'copy_changed';
  if(g.policyVersion!==b.policyVersion)return 'policy_changed';
  if(old.items.length!==t.items.length)return 'payload_changed';
  for(let i=0;i<t.items.length;i++){
    const before=old.items[i],after=t.items[i];
    if(before.sourceRef!==after.sourceRef||before.sourceRevision!==after.sourceRevision||before.sourceContentDigest!==after.sourceContentDigest)return 'file_changed';
    if(!eq(before.pages,after.pages))return 'pages_changed';
    if(!eq(before.derivation,after.derivation))return 'derivation_regenerated';
    if(before.category!==after.category||before.itemDigest!==after.itemDigest||before.byteLength!==after.byteLength)return 'payload_changed';
  }
  return old.payloadDigest!==t.payloadDigest?'payload_changed':null;
}
type Attempt={wire:string;route:string[];endpoint:string;purposeCode:string;idempotencyKey:string;automatic:number};
/**
 * Below planner/model code. No restored grants, queues, telemetry or raw-body logging.
 * readCurrent must read authoritative local state (including freshly read source bytes), not a cached UI proposal.
 */
export class OutboundGate {
  #grants=new Map<string,ContentTransferGrant>();#attempts=new Map<string,Attempt>();#lastWall=0;#lastMono=0;
  #invalidated=new Map<string,Reason>();#completed=new Set<string>();#inFlight=new Set<string>();#sensitiveAllowed=new Set<string>();#localSensitiveAllowed=new Set<string>();#decidedMono=new Map<string,number>();
  #presentations=new Map<string,{read:()=>Proposal[];snapshots:Snapshot[];presentedAt:number;allowAfterMonotonic:number}>();
  #localContext:(()=>{revision:number;artifacts:Artifact[]})|null=null;
  constructor(private readonly readAuthority:()=>Authority,private readonly options:{approvedPurposes?:readonly string[];clock?:()=>{wall:number;monotonic:number};gesture?:(event:unknown)=>boolean;appBuild?:string;resolveBinding?:(transferId:string)=>TransferBinding|null}={}){}
  toJSON(){return {};}
  async availability(route:readonly string[],endpoint='https://api.openai.com/v1/responses'){
    const a=this.readAuthority(),denial=routeVerdict({route:[...route],endpoint},a);
    if(denial)return {available:false,reasonCode:denial.reason};
    if(!a.hostedAiOn)return {available:false,reasonCode:'hosted_off' as const};
    const expected=await hostedAck(route,a.registry);
    return a.ack&&eq(a.ack,expected)?{available:true,reasonCode:null}:{available:false,reasonCode:'disclosure_required' as const};
  }
  private current(p:Proposal):Proposal{return p.kind==='content'?{...p,binding:this.options.resolveBinding?.(p.transferId)??undefined}:p;}
  /** Called by the local controller, not by model output, to keep the final text guard below the UI. */
  bindLocalWorkspace(read:()=>{revision:number;artifacts:Artifact[]}){this.#localContext=read;}
  private localContent(p:HostedPayload):boolean {
    if(!this.#localContext)return false;
    const local=this.#localContext();if(local.revision!==p.workspaceRevision)throw new OutboundDenied(again('file_changed'));
    for(const file of p.files){const source=local.artifacts.find(a=>a.ref===file.ref);if(!source||source.pageCount!==file.pageCount||sizeBucket(source.sizeBytes)!==file.sizeBucket)throw new OutboundDenied(again('file_changed'));}
    const pending=p.pendingClarification;
    for(const text of [p.instruction,...(pending?[pending.originalInstruction,pending.question,...pending.choices,...pending.answers.flatMap(a=>[a.question,a.answer])]:[])]){
      try{if(privateInstruction(text,local.artifacts)!==text)return true;}catch{return true;}
    }
    return false;
  }
  private now(){return this.options.clock?.()??{wall:Date.now(),monotonic:performance.now()};}
  private approved(){return this.options.approvedPurposes??PRIVACY_POLICY.approvedContentPurposes;}
  private sensitiveKey(s:Snapshot){return canonical({wire:s.wire,route:s.proposal.route,endpoint:s.proposal.endpoint,routeDigest:s.routeDigest});}
  private sensitiveHosted(p:HostedPayload){const q=p.pendingClarification;return [p.instruction,...(q?[q.originalInstruction,q.question,...q.choices,...q.answers.flatMap(a=>[a.question,a.answer])]:[])].some(text=>!!sensitiveInstruction(text));}
  private invalidate(grantId:string|undefined,reason:Reason){if(grantId){const g=this.#grants.get(grantId);if(g){g.state=reason==='expired'?'expired':'invalidated';g.invalidationReason=reason;this.#invalidated.set(grantId,reason);}}return again(reason);}
  private evaluate(s:Snapshot,a:Authority):Verdict {
    const p=s.proposal;
    // Order is ADR 0012 §5.2. Classification happens before snapshotting.
    if(hasNeverTransfer(p.payload))return deny('never_transfer');
    try{if(p.kind==='hosted'){validateHosted(p.payload);assertHostedText(p.payload as HostedPayload);}}catch(e){return deny((e as Error).message==='never_transfer'?'never_transfer':'unclassified_field');}
    const route=routeVerdict(p,a);if(route)return route;
    if(!a.hostedAiOn){this.revoke();return deny('hosted_off');}
    if(!eq(s.disclosures,routeVersions(p.route,a.registry))||!a.ack||a.ack.hostedDisclosureVersion!==PRIVACY_POLICY.hostedDisclosureVersion||a.ack.policyVersion!==PRIVACY_POLICY.version||a.ack.routeDigest!==s.routeDigest){
      if(p.kind==='content'&&p.grantId){const g=this.#grants.get(p.grantId);if(g&&!eq(g.recipientDisclosures,routeVersions(p.route,a.registry)))this.invalidate(p.grantId,'disclosure_changed');}
      return {outcome:'REQUIRE_DISCLOSURE',reason:'disclosure_required'};
    }
    if(p.kind==='hosted'){
      try{if(this.localContent(p.payload as HostedPayload))return deny('purpose_not_approved');}catch(error){return error instanceof OutboundDenied?error.verdict:deny('unclassified_field');}
      return this.sensitiveHosted(p.payload as HostedPayload)&&!this.#sensitiveAllowed.has(this.sensitiveKey(s))?deny('sensitive_instruction'):allow;
    }
    if(!this.approved().includes(p.purposeCode))return deny('purpose_not_approved');
    const g=p.grantId?this.#grants.get(p.grantId):undefined;
    if(g&&this.#invalidated.has(g.grantId))return again(this.#invalidated.get(g.grantId)!);
    if(!g||!['granted','in_flight'].includes(g.state)||!g.transfers.some(t=>t.transferId===p.transferId))return requireConsent;
    if(!s.binding||!s.transfer)return this.invalidate(p.grantId,'payload_changed');
    const mismatch=bindingReason(g,s,a);if(mismatch)return this.invalidate(p.grantId,mismatch);
    if(!validBinding(p))return this.invalidate(p.grantId,'payload_changed');
    const now=this.now();
    if(!Number.isFinite(now.wall)||!Number.isFinite(now.monotonic)||now.wall<g.decidedAt||now.wall<this.#lastWall||now.monotonic<this.#lastMono)return this.invalidate(p.grantId,'clock_invalid');
    this.#lastWall=now.wall;this.#lastMono=now.monotonic;
    if(now.wall>=g.expiresAt||now.monotonic-(this.#decidedMono.get(g.grantId)??now.monotonic)>=PRIVACY_POLICY.grantTtlMs)return this.invalidate(p.grantId,'expired');
    return allow;
  }
  async check(p:Proposal):Promise<Verdict>{
    try{return this.evaluate(await snapshot(this.current(p),this.readAuthority()),this.readAuthority());}
    catch(error){return error instanceof OutboundDenied?error.verdict:deny('unclassified_field');}
  }
  /** UI capability. Keep it in the trusted consent view; never hand it to a planner. */
  consentUI(){
    const trusted=(event:unknown)=>this.options.gesture?.(event)??(typeof Event!=='undefined'&&event instanceof Event&&event.isTrusted&&(event.type==='click'||(event.type==='keydown'&&'key'in event&&event.key===' ')));
    return {
      // ADR 0012 §6 PRIV-5 and approved cases D33/D34 explicitly require Send anyway for
      // an IBAN/identifier pattern in ordinary H instruction text. G3a cards hard-deny. This is not permission for N paymentCredential,
      // secrets, keys or tokens: validateHosted enforces their unconditional hard deny first.
      // Boundary hook for SHR-37's future trusted UI; no UI or production recipient is added here.
      confirmSensitiveInstruction:async(proposal:Proposal,event:unknown)=>{
        if(!trusted(event))throw new OutboundDenied(deny('sensitive_instruction'));
        const s=await snapshot(proposal,this.readAuthority()),v=this.evaluate(s,this.readAuthority());
        if(proposal.kind!=='hosted'||v.reason!=='sensitive_instruction')throw new OutboundDenied(v);
        this.#sensitiveAllowed.add(this.sensitiveKey(s));this.#localSensitiveAllowed.add(s.wire);
      },
      present:async(read:()=>Proposal[],replaces?:string)=>{
        const a=this.readAuthority(),snapshots=await Promise.all(read().map(p=>snapshot(this.current(p),a))),now=this.now(),id=crypto.randomUUID();
        if(!snapshots.length)throw new OutboundDenied(requireConsent);
        for(const s of snapshots){const v=this.evaluate(s,this.readAuthority());if(v.outcome!=='REQUIRE_CONSENT'&&v.outcome!=='ALLOW')throw new OutboundDenied(v);}
        if(!Number.isFinite(now.wall)||!Number.isFinite(now.monotonic)||now.wall<this.#lastWall||now.monotonic<this.#lastMono)throw new OutboundDenied(again('clock_invalid'));
        const allowAfterMonotonic=now.monotonic+(replaces?1000:0);
        if(replaces)this.#presentations.delete(replaces);
        this.#presentations.set(id,{read,snapshots,presentedAt:now.wall,allowAfterMonotonic});
        return {presentationId:id,allowAfterMonotonic};
      },
      allow:async(presentationId:string,event:unknown,gesture:ContentTransferGrant['userGesture']='pointer'):Promise<string>=>{
      const presentation=this.#presentations.get(presentationId);
      if(!trusted(event)||!presentation)throw new OutboundDenied(requireConsent);
      if(this.now().monotonic<presentation.allowAfterMonotonic)throw new OutboundDenied(again('payload_changed'));
      const a=this.readAuthority(),snapshots=await Promise.all(presentation.read().map(p=>snapshot(this.current(p),a)));
      if(snapshots.length!==presentation.snapshots.length||snapshots.some((s,i)=>!eq(s,presentation.snapshots[i])))throw new OutboundDenied(again('payload_changed'));
      for(const s of snapshots){
        const v=this.evaluate(s,this.readAuthority());
        if(s.proposal.kind!=='content'||!s.binding||!s.transfer||!validBinding(s.proposal)||!eq(this.current(s.proposal),s.proposal)||!this.approved().includes(s.proposal.purposeCode)||(v.outcome!=='REQUIRE_CONSENT'&&v.outcome!=='ALLOW'))throw new OutboundDenied(v.outcome==='REQUIRE_CONSENT'?again('payload_changed'):v);
      }
      const first=snapshots[0],b=first.binding!,now=this.now();
      if(!Number.isFinite(now.wall)||!Number.isFinite(now.monotonic)||now.wall<presentation.presentedAt||now.wall<this.#lastWall||now.monotonic<this.#lastMono)throw new OutboundDenied(again('clock_invalid'));
      if(snapshots.some(s=>!eq(s.binding&&{...s.binding,items:[]},{...b,items:[]})||!eq(s.proposal.route,first.proposal.route)))throw new OutboundDenied(again('plan_changed'));
      const grantId=crypto.randomUUID();
      this.#grants.set(grantId,{schema:'atepdf.consent-grant/1',grantId,workspaceId:b.workspaceId,deletionEpoch:b.deletionEpoch,operation:structuredClone(b.operation),purpose:structuredClone(b.purpose),transfers:snapshots.map(s=>s.transfer!),recipientDisclosures:routeVersions(first.proposal.route,this.readAuthority().registry),disclosureDigest:b.disclosureDigest,consentCopyVersion:b.consentCopyVersion,policyVersion:b.policyVersion,presentedAt:presentation.presentedAt,decidedAt:now.wall,expiresAt:now.wall+PRIVACY_POLICY.grantTtlMs,decision:'allow',state:'granted',invalidationReason:null,userGesture:gesture,appBuild:this.options.appBuild??'development'});
      this.#presentations.delete(presentationId);
      this.#decidedMono.set(grantId,now.monotonic);
      this.#lastWall=now.wall;this.#lastMono=now.monotonic;return grantId;
    },cancel:(grantId:string)=>this.cancel(grantId)};
  }
  /** Same-Mac loopback IPC only: schema + N guards still run; hosted disclosure is enforced at the external write. */
  async writeLocalHosted<T>(readCurrent:()=>HostedPayload,write:(bytes:string)=>Promise<T>,signal?:AbortSignal):Promise<T>{
    notAborted(signal);
    let p:HostedPayload;try{p=validateHosted(readCurrent());assertHostedText(p);}catch(e){throw new OutboundDenied(deny((e as Error).message==='never_transfer'?'never_transfer':'unclassified_field'));}
    const wire=canonical(p);
    try{if(this.localContent(p))throw new OutboundDenied(deny('purpose_not_approved'));}catch(error){throw error instanceof OutboundDenied?error:new OutboundDenied(deny('unclassified_field'));}
    if(this.sensitiveHosted(p)&&!this.#localSensitiveAllowed.has(wire))throw new OutboundDenied(deny('sensitive_instruction'));
    notAborted(signal);try{return await write(wire);}catch(error){throw transportError(error,signal);}
  }
  /** Every actual write/retry recomputes exact bytes and reads state again after hashing. No await between final check and write. */
  async write<T>(readCurrent:()=>Proposal,write:(bytes:string,endpoint:string)=>Promise<T>,signal?:AbortSignal):Promise<T> {
    notAborted(signal);
    let s:Snapshot;
    try{s=await snapshot(this.current(readCurrent()),this.readAuthority());}catch(error){throw error instanceof OutboundDenied?error:new OutboundDenied(deny('unclassified_field'));}
    notAborted(signal);
    let latest:Proposal;try{latest=clonedProposal(this.current(readCurrent()));}catch(error){throw error instanceof OutboundDenied?error:new OutboundDenied(deny('unclassified_field'));}
    // Compare both content and source bytes after the asynchronous digest. A concurrent replacement never uses an old digest.
    if(!eq(latest,s.proposal))throw new OutboundDenied(this.invalidate(s.proposal.grantId,latest.binding?.workspaceId!==s.binding?.workspaceId||latest.binding?.deletionEpoch!==s.binding?.deletionEpoch?'workspace_cleared':'payload_changed'));
    const a=this.readAuthority();
    const verdict=this.evaluate(s,a);if(verdict.outcome!=='ALLOW')throw new OutboundDenied(verdict);
    const p=s.proposal,prior=this.#attempts.get(p.transferId);
    notAborted(signal);
    if(this.#inFlight.has(p.transferId))throw new OutboundDenied(requireConsent);
    if(this.#completed.has(p.transferId))throw new OutboundDenied(requireConsent);
    if(prior){
      if(!eq(prior.route,p.route)||prior.endpoint!==p.endpoint)throw new OutboundDenied(again('recipient_changed'));
      if(prior.wire!==s.wire||prior.purposeCode!==p.purposeCode||prior.idempotencyKey!==p.idempotencyKey)throw new OutboundDenied(again('payload_changed'));
      if(!p.retry)throw new OutboundDenied(requireConsent);
      if(p.retry==='automatic'&&prior.automatic>=PRIVACY_POLICY.autoRetry[p.kind])throw new OutboundDenied(deny('retry_limit'));
    }else if(p.retry)throw new OutboundDenied(requireConsent);
    const attempt:Attempt=prior??{wire:s.wire,route:[...p.route],endpoint:p.endpoint,purposeCode:p.purposeCode,idempotencyKey:p.idempotencyKey,automatic:0};
    if(p.retry==='automatic')attempt.automatic++;
    this.#attempts.set(p.transferId,attempt);
    const now=this.now();this.#lastWall=now.wall;this.#lastMono=now.monotonic;
    const grant=p.grantId?this.#grants.get(p.grantId):undefined;if(grant)grant.state='in_flight';
    // The writer is invoked synchronously here. Bytes are the immutable string that was checked.
    this.#inFlight.add(p.transferId);
    try {
      const value=await write(s.wire,p.endpoint);
      this.#completed.add(p.transferId);
      if(grant&&grant.state==='in_flight'&&grant.transfers.every(t=>this.#completed.has(t.transferId)))grant.state='consumed';
      return value;
    } catch(error){throw transportError(error,signal);}
    finally{this.#inFlight.delete(p.transferId);}
  }
  cancel(grantId:string){this.#presentations.delete(grantId);const g=this.#grants.get(grantId);if(g){g.state='cancelled';g.decision='cancel';g.invalidationReason='cancelled';}}
  revoke(){this.#presentations.clear();this.#sensitiveAllowed.clear();this.#localSensitiveAllowed.clear();for(const g of this.#grants.values()){g.state='revoked';g.invalidationReason='revoked';}}
  clearWorkspace(){this.#presentations.clear();this.#sensitiveAllowed.clear();this.#localSensitiveAllowed.clear();for(const g of this.#grants.values())this.invalidate(g.grantId,'workspace_cleared');}
  /** Fresh process/restore: no grants or attempts, and nothing queued for replay. */
  relaunch(){this.#grants.clear();this.#attempts.clear();this.#invalidated.clear();this.#completed.clear();this.#inFlight.clear();this.#sensitiveAllowed.clear();this.#localSensitiveAllowed.clear();this.#presentations.clear();this.#decidedMono.clear();this.#lastWall=0;this.#lastMono=0;}
  grantState(id:string){return this.#grants.get(id)?.state??null;}
}

/** No production recipient/ack has been approved yet (SHR-79/37). No environment switch can turn this into approval. */
export const productionOutbound = new OutboundGate(()=>({hostedAiOn:true,ack:null,registry:[]}));
