import type {Request as LocalRequest} from '../../../contracts/src/protocol';
import {validateRequest} from '../request';
import {hasPaymentCard} from './sensitive';
import {assertInstructionSafe,hasRejectedSecretDraft} from '../privacy';
import {CONTENT_CATEGORIES,PRIVACY_POLICY,sizeBucket,type ContentCategory} from './constants';

export type HostedPayload = Omit<LocalRequest,'files'> & {files: Array<{ref:string;kind:'pdf';pageCount:number;sizeBucket:typeof PRIVACY_POLICY.sizeBuckets[number];encrypted:false}>;selectorCapabilities?:Array<'invoice'|'scanned_pages'|'blank_page_candidates'>;results?:Array<{ref:string;status:'created'|'failed'|'cancelled';pageCount:number;outcome:'complete'|'target_not_met'|'no_change'}>};
export type ContentPayload = {items:Array<{category:ContentCategory;data:string}>};
export type DataClass = 'H'|'C'|'N';
// This table is the outbound field authority. Local manifests/consent bindings are NOT wire payloads.
export const OUTBOUND_FIELDS = Object.freeze({
  hosted: {schemaVersion:'H',requestId:'H',workspaceRevision:'H',locale:'H',instruction:'H',files:'H',selectionRefs:'H',focusedResultRef:'H',originalRefs:'H',pendingClarification:'H',previousActionIds:'H',capabilities:'H',previousPlan:'H',ocrLanguages:'H'},
  optionalHosted:{selectorCapabilities:'H',results:'H'},result:{ref:'H',status:'H',pageCount:'H',outcome:'H'},
  file: {ref:'H',kind:'H',pageCount:'H',sizeBucket:'H',encrypted:'H'},
  pending: {originalRequestId:'H',workspaceRevision:'H',originalInstruction:'H',question:'H',choices:'H',answers:'H',selectionRefs:'H',focusedResultRef:'H',originalRefs:'H'},
  answer: {question:'H',answer:'H'},
  content: {items:'C'}, item: {category:'C',data:'C'},
  never: {password:'N',secureHandle:'N',secretHandle:'N',encryptionKey:'N',apiKey:'N',providerKey:'N',bearerToken:'N',pairingToken:'N',refreshToken:'N',csrfToken:'N',path:'N',bookmark:'N',deviceFingerprint:'N',deviceId:'N',paymentCredential:'N',clipboard:'N',appData:'N'},
} as const);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
/** No accessors, prototype data, binary values, cycles or unclassified nested fields. */
export function exactKeys(value:unknown,allowed:readonly string[],required=allowed):asserts value is Record<string,unknown> {
  if(!object(value))throw new Error('unclassified_field');
  for(const key of Reflect.ownKeys(value)){
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    if(typeof key!=='string'||!descriptor||!('value' in descriptor)||(!allowed.includes(key)&&!(key in OUTBOUND_FIELDS.never)))throw new Error('unclassified_field');
  }
  if(required.some(key=>!Object.hasOwn(value,key)))throw new Error('unclassified_field');
}
function keys(v:unknown,table:object):asserts v is Record<string,unknown>{exactKeys(v,Object.keys(table));}
export const isClassifiedArray=(v:unknown):v is unknown[]=>{
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype)return false;
  const own=Reflect.ownKeys(v);
  if(own.length!==v.length+1)return false;
  return own.every(key=>{
    if(key==='length')return true;
    if(typeof key!=='string'||! /^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=v.length)return false;
    const descriptor=Object.getOwnPropertyDescriptor(v,key);return !!descriptor&&'value'in descriptor;
  });
};
const array=isClassifiedArray;
export function assertClassified(payload:unknown,kind:'hosted'|'content'):void {
  if(kind==='hosted')exactKeys(payload,[...Object.keys(OUTBOUND_FIELDS.hosted),...Object.keys(OUTBOUND_FIELDS.optionalHosted)],Object.keys(OUTBOUND_FIELDS.hosted));else keys(payload,OUTBOUND_FIELDS.content);
  const p=payload as Record<string,unknown>;
  if(kind==='content'){
    if(!array(p.items)||!p.items.length||p.items.length>40)throw new Error('unclassified_field');
    p.items.forEach(item=>{keys(item,OUTBOUND_FIELDS.item);if(!CONTENT_CATEGORIES.includes(item.category as ContentCategory)||typeof item.data!=='string')throw new Error('unclassified_field');});
    return;
  }
  const strings=(v:unknown)=>array(v)&&v.every(s=>typeof s==='string');
  if(!['schemaVersion','requestId','locale','instruction'].every(k=>typeof p[k]==='string')||typeof p.workspaceRevision!=='number'||!['selectionRefs','originalRefs','previousActionIds','capabilities','ocrLanguages'].every(k=>strings(p[k]))||(p.focusedResultRef!==null&&typeof p.focusedResultRef!=='string')||p.previousPlan!==null||!array(p.files))throw new Error('unclassified_field');
  p.files.forEach(f=>{keys(f,OUTBOUND_FIELDS.file);if(typeof f.ref!=='string'||typeof f.kind!=='string'||typeof f.pageCount!=='number'||typeof f.sizeBucket!=='string'||typeof f.encrypted!=='boolean')throw new Error('unclassified_field');});
  if(p.selectorCapabilities!==undefined&&(!strings(p.selectorCapabilities)||(p.selectorCapabilities as string[]).length>3||(p.selectorCapabilities as string[]).some(s=>!['invoice','scanned_pages','blank_page_candidates'].includes(s))))throw new Error('unclassified_field');
  if(p.results!==undefined){if(!array(p.results)||p.results.length>40)throw new Error('unclassified_field');p.results.forEach(r=>{keys(r,OUTBOUND_FIELDS.result);if(typeof r.ref!=='string'||typeof r.pageCount!=='number'||!['created','failed','cancelled'].includes(r.status as string)||!['complete','target_not_met','no_change'].includes(r.outcome as string))throw new Error('unclassified_field');});}
  if(p.pendingClarification!==null){
    keys(p.pendingClarification,OUTBOUND_FIELDS.pending);
    const pending=p.pendingClarification as Record<string,unknown>;
    if(!array(pending.answers)||!['originalRequestId','originalInstruction','question'].every(k=>typeof pending[k]==='string')||!['choices','selectionRefs','originalRefs'].every(k=>strings(pending[k]))||typeof pending.workspaceRevision!=='number'||(pending.focusedResultRef!==null&&typeof pending.focusedResultRef!=='string'))throw new Error('unclassified_field');
    pending.answers.forEach(a=>{keys(a,OUTBOUND_FIELDS.answer);if(typeof a.question!=='string'||typeof a.answer!=='string')throw new Error('unclassified_field');});
  }
}
const forbiddenPath=/(?::\/\/|(?:file|content|asset|ph):|(?:[a-z]:[\\/])|(?:^|[\s"'([{=:])[~.]?\.?\/\S+|\\\\)/i;
export function hasNeverTransfer(value:unknown,depth=0):boolean {
  if(depth>32)return true;
  if(typeof value==='string')return hasPaymentCard(value)||hasRejectedSecretDraft(value)||forbiddenPath.test(value);
  if(Array.isArray(value))return value.some(v=>hasNeverTransfer(v,depth+1));
  if(value&&typeof value==='object')return Object.getOwnPropertyNames(value).some(key=>key in OUTBOUND_FIELDS.never||hasNeverTransfer((value as Record<string,unknown>)[key],depth+1));
  return false;
}
/** Positive H projection. Durable history is intentionally left in the local store. */
export function projectHosted(request:LocalRequest):HostedPayload {
  const r=validateRequest(request);
  const active=new Set([...r.selectionRefs,...(r.focusedResultRef?[r.focusedResultRef]:[])]);
  const originalRefs=r.originalRefs.filter(ref=>active.has(ref));
  const pending=r.pendingClarification;
  const projected:HostedPayload={
    schemaVersion:'1.0',requestId:r.requestId,workspaceRevision:r.workspaceRevision,locale:r.locale,instruction:r.instruction,
    files:r.files.filter(f=>active.has(f.ref)).map(f=>({ref:f.ref,kind:'pdf',pageCount:f.pageCount,sizeBucket:sizeBucket(f.sizeBytes),encrypted:false})),
    selectionRefs:[...r.selectionRefs],focusedResultRef:r.focusedResultRef,originalRefs,
    pendingClarification:pending?{originalRequestId:pending.originalRequestId,workspaceRevision:pending.workspaceRevision,originalInstruction:pending.originalInstruction,question:pending.question,choices:[...pending.choices],answers:pending.answers.map(a=>({question:a.question,answer:a.answer})),selectionRefs:[...pending.selectionRefs],focusedResultRef:pending.focusedResultRef,originalRefs:pending.originalRefs.filter(ref=>active.has(ref))}:null,
    previousActionIds:[],capabilities:[...r.capabilities],previousPlan:null,ocrLanguages:[...r.ocrLanguages],
  };
  validateHosted(projected);return projected;
}
/** Adapter for existing local semantic/plan validation; the placeholder size never goes on the wire. */
export function hostedLocalContext(payload:HostedPayload):LocalRequest {
  const representative={'<1MB':0,'1-10MB':1_000_000,'10-50MB':10_000_001,'>50MB':50_000_001};
  const {selectorCapabilities:_selectors,results:_results,...local}=payload;
  return {...local,files:payload.files.map(f=>({ref:f.ref,kind:f.kind,pageCount:f.pageCount,sizeBytes:representative[f.sizeBucket],encrypted:false}))};
}
export function validateHosted(value:unknown):HostedPayload {
  let copy:unknown;try{copy=structuredClone(value);}catch{throw new Error('unclassified_field');}
  assertClassified(value,'hosted');
  if(hasNeverTransfer(value))throw new Error('never_transfer');
  if(hasNeverTransfer(copy))throw new Error('never_transfer');
  assertClassified(copy,'hosted');
  const p=copy as HostedPayload;
  if(p.files.some(f=>f.encrypted!==false||!PRIVACY_POLICY.sizeBuckets.includes(f.sizeBucket)))throw new Error('unclassified_field');
  try{validateRequest(hostedLocalContext(p));}catch{throw new Error('unclassified_field');}
  const active=new Set([...p.selectionRefs,...(p.focusedResultRef?[p.focusedResultRef]:[])]);
  if(p.files.some(f=>!active.has(f.ref))||p.results?.some(r=>!active.has(r.ref)||!Number.isSafeInteger(r.pageCount)||r.pageCount<0||r.pageCount>100))throw new Error('unclassified_field');
  return p;
}
export function assertHostedText(payload:HostedPayload):void {
  const pending=payload.pendingClarification;
  for(const text of [payload.instruction,...(pending?[pending.originalInstruction,pending.question,...pending.choices,...pending.answers.flatMap(a=>[a.question,a.answer])]:[])]){
    try{assertInstructionSafe(text,true);}catch{throw new Error(hasRejectedSecretDraft(text)||forbiddenPath.test(text)?'never_transfer':'unclassified_field');}
  }
}
