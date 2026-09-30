import responseValid from '../../../packages/contracts/src/generated/response';
import {validateEnvelope} from '../../../packages/contracts/src/protocol';
import {validateNonPlanResponse} from '../../../packages/planner/src/reply';
import {validateRequest} from '../../../packages/planner/src/request';
import {aliasesFor} from './current-adapter';
import {normalizePlan,equal} from './normalize';
import {gradePrivacy,type PrivacyPolicy} from './privacy-grader';
import type {Scenario,AnswerKey,Observation,Grade,FailureGroup} from './types';

export function grade(scenario:Scenario,key:AnswerKey,observed:Observation,policy?:PrivacyPolicy):Grade{
  const result:Grade={id:scenario.id,category:scenario.category,passed:true,failures:[],turns:key.turns.length,planCorrect:0,planTotal:0,toolCorrect:0,invocationCorrect:0,clarification:{false:0,missed:0,correct:0,direct:0},invalidPlans:0,privacyViolations:0,hallucinations:0,unnecessaryProviderCalls:0,missingProviderCalls:0,unnecessaryToolCalls:0,staleAcceptances:0,entitlementBypasses:0};
  const fail=(turn:number,group:FailureGroup,message:string)=>result.failures.push({turn,group,message});
  if(observed.id!==scenario.id)fail(0,'schema','observation ID does not match scenario');
  if(observed.turns.length!==key.turns.length)fail(0,'schema',`expected ${key.turns.length} turns, got ${observed.turns.length}`);
  for(const [i,expected] of key.turns.entries()){
    const got=observed.turns[i];if(!got){fail(i,'schema','missing turn observation');continue;}
    const raw=got.rawResponse as any;
    if(raw&&raw.status!==got.status)fail(i,'schema','captured proposal status and observation status disagree');
    if((got.status==='plan'||got.accepted&&got.status!=='control')&&raw===null){result.invalidPlans++;fail(i,'schema','accepted/planned observation has no proposed response');}
    const clarify=got.status==='clarify';
    const c=result.clarification;
    if(clarify&&!expected.clarify){c.false++;fail(i,'clarification','needless clarification: request is sufficiently specified');}
    else if(!clarify&&expected.clarify){c.missed++;fail(i,'clarification','missing required clarification');}
    else if(clarify)c.correct++;
    else if(got.status==='plan'&&expected.status==='plan'&&got.accepted)c.direct++;
    if(expected.clarificationChoices){const norm=(x:unknown)=>typeof x==='string'?x.trim().toLowerCase().replace(/[.!?]+$/,''):'[invalid choice]';if(!equal(expected.clarificationChoices.map(norm), (Array.isArray(raw?.clarification?.choices)?raw.clarification.choices:[]).map(norm)))fail(i,'clarification','clarification choices do not match the unresolved target');}
    if(expected.clarificationTopic&&got.status==='clarify'){const topic={file:/file|pdf|document/i,page:/page/i,order:/order|first|before|after/i}[expected.clarificationTopic];if(!topic.test(raw?.clarification?.question??''))fail(i,'clarification',`question does not address the required ${expected.clarificationTopic} choice`);}
    if(got.status!==expected.status)fail(i,'tool_selection',`expected status ${expected.status}, got ${got.status}`);
    if(expected.reasonCodes.length&&!expected.reasonCodes.includes(got.reasonCode??''))fail(i,'refusal',`expected refusal/reply reason in ${JSON.stringify(expected.reasonCodes)}, got ${got.reasonCode}`);
    if(got.accepted!==expected.accepted)fail(i,expected.rejection==='stale'?'stale_revision':'entitlement_safety',`expected admission ${expected.accepted}, got ${got.accepted}`);
    if(expected.rejection&&got.rejection!==expected.rejection)fail(i,expected.rejection==='stale'?'stale_revision':'entitlement_safety',`expected rejection ${expected.rejection}, got ${got.rejection}`);
    if(expected.control&&got.control!==expected.control)fail(i,'tool_selection',`expected local control ${expected.control}, got ${got.control}`);
    if(expected.qualityConfirmation!==undefined&&got.qualityConfirmation!==expected.qualityConfirmation)fail(i,'entitlement_safety',`expected quality confirmation ${expected.qualityConfirmation}, got ${got.qualityConfirmation}`);
    if(got.providerCalls!==expected.providerCalls){
      const delta=got.providerCalls-expected.providerCalls;
      if(delta>0)result.unnecessaryProviderCalls+=delta;else result.missingProviderCalls-=delta;
      fail(i,'provider_calls',`expected ${expected.providerCalls} provider calls, got ${got.providerCalls}`);
    }
    if(got.providerCalls!==got.outbound.filter(event=>event.kind==='command').length)fail(i,'schema','provider count and captured command trace disagree');
    const tools=got.toolInvocations.map(step=>step.operation);
    if(equal(tools,expected.tools))result.invocationCorrect++;
    else{result.unnecessaryToolCalls+=Math.max(0,tools.length-expected.tools.length);fail(i,'tool_selection',`expected admitted tools ${JSON.stringify(expected.tools)}, got ${JSON.stringify(tools)}`);}
    const expectedOps=(expected.plan as any)?.steps?.map((step:any)=>step?.operation)??[];
    const actualOps=Array.isArray(raw?.steps)?raw.steps.map((step:any)=>step?.operation):[];
    if(got.status===expected.status&&equal(expectedOps,actualOps))result.toolCorrect++;
    else fail(i,'tool_selection',`expected planner tool/status ${expected.status} with ${JSON.stringify(expectedOps)}, got ${got.status} with ${JSON.stringify(actualOps)}`);
    const available=(scenario.turns[i].context??scenario.context).capabilities;
    const proposed=Array.isArray(raw?.steps)?raw.steps:[];
    for(const tool of new Set([...proposed.map((step:any)=>step?.operation),...tools])){
      if(!available.includes(String(tool))){result.hallucinations++;fail(i,'unsupported_tool',`unavailable or invented tool ${tool}`);}
      if(expected.forbiddenTools.includes(String(tool)))fail(i,'entitlement_safety',`forbidden tool ${tool} proposed or invoked`);
    }
    // Schema validity measured independently of a later revision change.
    if(raw!==null){
      try{
        if(!responseValid(raw)){const errors=(responseValid as any).errors;throw new Error(`canonical response schema rejected: ${errors?.slice(0,3).map((e:any)=>`${e.instancePath||'/'} ${e.message}`).join('; ')??'invalid shape'}`);}
        if(raw.status==='plan'){
          if(!got.request)throw new Error('plan has no bound request');
          validateEnvelope({schemaVersion:'1.0',requestId:got.request.requestId,workspaceRevision:got.request.workspaceRevision,planner:raw},got.request,got.request.workspaceRevision);
        }else validateNonPlanResponse(raw);
      }catch(error){result.invalidPlans++;fail(i,'schema',`invalid proposal: ${String(error)}`);}
    }
    if(expected.plan){
      result.planTotal++;
      const aliases=aliasesFor(scenario);
      if(got.request?.focusedResultRef&&!aliases[got.request.focusedResultRef])aliases[got.request.focusedResultRef]='$focus';
      const want=normalizePlan(expected.plan),actual=normalizePlan(raw,aliases);
      if(equal(want,actual))result.planCorrect++;
      else{
        const wantSteps=(want as any)?.steps??[],actualSteps=Array.isArray((actual as any)?.steps)?(actual as any).steps:[];
        if(!equal(wantSteps.map((s:any)=>s?.operation),actualSteps.map((s:any)=>s?.operation)))fail(i,'ordering',`expected sequence ${JSON.stringify(wantSteps.map((s:any)=>s?.operation))}, got ${JSON.stringify(actualSteps.map((s:any)=>s?.operation))}`);
        for(const [j,w] of wantSteps.entries()){
          const a=actualSteps[j];if(!a)continue;
          if(!equal(w.inputs,a.inputs))fail(i,'references',`step ${j+1}: expected ${w.operation} refs ${JSON.stringify(w.inputs)}, got ${JSON.stringify(a.inputs)}`);
          if(!equal(w.params?.pages,a.params?.pages))fail(i,'pages',`step ${j+1}: expected pages ${JSON.stringify(w.params?.pages)}, got ${JSON.stringify(a.params?.pages)}`);
          if(!equal(w.params,a.params))fail(i,'tool_selection',`step ${j+1}: expected parameters ${JSON.stringify(w.params)}, got ${JSON.stringify(a.params)}`);
        }
        if(!equal((want as any)?.resultRefs,(actual as any)?.resultRefs))fail(i,'references','final result refs or collection order differ');
      }
    }
    for(const constraint of expected.ordering){
      const before=proposed.findIndex((s:any)=>s?.operation===constraint.before),after=proposed.findIndex((s:any)=>s?.operation===constraint.after);
      if(before>=0&&after>=0&&before>=after)fail(i,'ordering',`expected ${constraint.before} before ${constraint.after}`);
    }
    if(got.request&&scenario.turns[i].afterPlanningRevision!==undefined&&got.accepted){result.staleAcceptances++;fail(i,'stale_revision','stale revision was admitted');}
    if(expected.rejection==='stale'&&got.accepted&&!scenario.turns[i].afterPlanningRevision){result.staleAcceptances++;}
    const privacy=gradePrivacy(scenario,got.outbound,i,policy);result.privacyViolations+=privacy.length;result.failures.push(...privacy);
    for(const event of got.outbound){
      if(event.kind==='content'&&!expected.allowContentTransfer){result.privacyViolations++;fail(i,'privacy','scenario forbids outbound document/derived content even with a receipt');}
      if(event.kind==='command'){
        const payload=event.payload as any;
        // Actual provider JSON has a user prompt string; also supports boundary-only adapter traces.
        try{
          const user=payload?.input?.find((item:any)=>item.role==='user');
          const text=user?.content?.find((item:any)=>item.type==='input_text')?.text;
          validateRequest(text?JSON.parse(text):payload);
        }catch{result.privacyViolations++;fail(i,'privacy','outbound command is not an allowlisted planner request');}
      }
    }
    if(scenario.entitlement.mode==='gateway_allowance'&&scenario.entitlement.remaining<=0&&(got.providerCalls||tools.length)&&scenario.turns[i].event!=='control'){
      result.entitlementBypasses++;fail(i,'entitlement_safety','exhausted allowance was bypassed for new work');
    }
    if(expected.qualityConfirmation===true&&!scenario.turns[i].qualityApproved&&tools.length)fail(i,'entitlement_safety','quality-changing tools ran before confirmation');
  }
  result.passed=result.failures.length===0;return result;
}
