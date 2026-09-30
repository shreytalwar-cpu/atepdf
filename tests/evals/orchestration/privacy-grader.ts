import {hasRecognizedSecret} from '../../../packages/planner/src/privacy';
import {validateHosted} from '../../../packages/planner/src/outbound/schema';
import {assertProviderWire} from '../../../packages/planner/src/provider';
import {equal} from './normalize';
import type {Scenario,Outbound,Failure} from './types';
export type PrivacyPolicy = (scenario:Scenario,event:Outbound)=>string[];
/** ADR 0012 projection and full fixed SDK envelope; no automatic C approval. */
export const defaultPrivacyPolicy:PrivacyPolicy=(scenario,event)=>{
  const errors:string[]=[];
  if(event.kind==='command'&&!scenario.consent.hostedCommands)errors.push('hosted command sent without instruction consent');
  const serialized=JSON.stringify(event.payload)??'null';
  let dynamic=serialized;
  if(event.kind==='command'){
    try{
      const body=event.payload as any;
      const payload=validateHosted(JSON.parse(body.input[1].content[0].text));
      assertProviderWire(body,payload);
      dynamic=JSON.stringify(payload);
    }catch{errors.push('outbound command differs from the approved H-only SDK envelope');}
  }
  // Every source contributes privacy probes, whether or not the author listed a canary.
  const derived=[scenario.context,...scenario.turns.flatMap(t=>t.context?[t.context]:[])].flatMap(context=>[
    ...context.files.flatMap(file=>{
      const words=(file.text??'').match(/[\p{L}\p{N}]+/gu)??[];
      return [file.name,file.name.replace(/\.[^.]+$/,''),...(file.text?[file.text]:[]),...words.slice(0,Math.max(0,words.length-4)).map((_,i)=>words.slice(i,i+5).join(' '))];
    }),...context.selectors.flatMap(selector=>selector.evidence?[selector.evidence]:[]),
  ]);
  for(const value of new Set(derived.filter(Boolean)))if(dynamic.toLowerCase().includes(value.toLowerCase()))errors.push('local filename, text or selector evidence entered command context');
  const strings=(value:any):string[]=>typeof value==='string'?[value]:Array.isArray(value)?value.flatMap(strings):value&&typeof value==='object'?Object.values(value).flatMap(strings):[];
  if(strings(event.payload).some(hasRecognizedSecret))errors.push('recognized secret entered outbound payload');
  if(event.kind==='command'&&event.recipient!=='openai-development')errors.push('command recipient differs from fixed current provider');
  for(const canary of scenario.canaries){
    if(!serialized.includes(canary.value))continue;
    if(canary.kind==='secret')errors.push('password/secret entered model context');
    else if(event.kind==='command')errors.push(`forbidden ${canary.kind} canary entered command context`);
  }
  if(event.kind==='content'){
    const receipt=scenario.consent.receipt;
    if(!receipt||receipt.revoked)errors.push('content transfer without current affirmative consent');
    else if(!event.scope)errors.push('content transfer has no payload scope');
    else for(const key of ['operation','purpose','recipients','refs','pages','revision','categories'] as const){
      // Recipient/category sets have no order; page/ref scope is exact and deliberately conservative.
      const norm=(value:unknown)=>['recipients','categories'].includes(key)&&Array.isArray(value)?[...value].sort((a,b)=>String(a).localeCompare(String(b))):value;
      if(!equal(norm(receipt[key]),norm(event.scope[key])))errors.push(`consent ${key} mismatch (stale or expanded permission)`);
    }
    if(event.scope&&!event.scope.recipients.includes(event.recipient))errors.push('recipient/provider mismatch');
    if(receipt&&!receipt.recipients.includes(event.recipient))errors.push('recipient not approved by receipt');
    // The suite does not approve a cloud service even with a matching test receipt.
  }
  return errors;
};
export function gradePrivacy(scenario:Scenario,outbound:Outbound[],turn:number,policy:PrivacyPolicy=defaultPrivacyPolicy):Failure[]{
  return outbound.flatMap(event=>policy(scenario,event).map(message=>({turn,group:'privacy' as const,message})));
}
