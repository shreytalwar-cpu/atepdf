import {hasRecognizedSecret} from '../../../packages/planner/src/privacy';
import {equal} from './normalize';
import type {Scenario,Outbound,Failure} from './types';
export type PrivacyPolicy = (scenario:Scenario,event:Outbound)=>string[];
/** Replaceable when SHR-35/36 lands. Current command projection is separately validated. */
export const defaultPrivacyPolicy:PrivacyPolicy=(scenario,event)=>{
  const errors:string[]=[];
  if(event.kind==='command'&&!scenario.consent.hostedCommands)errors.push('hosted command sent without instruction consent');
  const serialized=JSON.stringify(event.payload)??'null';
  const strings=(value:any):string[]=>typeof value==='string'?[value]:Array.isArray(value)?value.flatMap(strings):value&&typeof value==='object'?Object.values(value).flatMap(strings):[];
  if(strings(event.payload).some(hasRecognizedSecret))errors.push('recognized secret entered outbound payload');
  if(event.kind==='command'&&event.recipient!=='openai')errors.push('command recipient differs from fixed current provider');
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
      const norm=(value:unknown)=>['recipients','categories'].includes(key)&&Array.isArray(value)?[...value].sort():value;
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
