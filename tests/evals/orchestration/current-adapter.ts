import {createHash} from 'node:crypto';
import {LocalFileStore} from '../../../packages/core/src/local-file-store';
import {JobController} from '../../../packages/core/src/job-controller';
import {quickPlan,type Request as PlannerRequest,type Step,type Envelope} from '../../../packages/contracts/src/protocol';
import {privateInstruction} from '../../../packages/planner/src/privacy';
import {pendingFromResponse,withPendingClarification,isClarificationAnswer} from '../../../packages/planner/src/clarification';
import {createGateway} from '../../../packages/planner/src/gateway';
import {requestPlan} from '../../../packages/planner/src/client';
import {OutboundDenied} from '../../../packages/planner/src/outbound/gate';
import {fixture} from '../../helpers/outbound-fixture';
import {syntheticInspection} from '../../helpers/synthetic-inspection';
import {planWithOpenAI,MODEL} from '../../../packages/planner/src/provider';
import type {PendingClarification} from '../../../packages/contracts/src/protocol';
import type {Inspection,EngineResult} from '../../../packages/web-pdf/src/types';
import type {Scenario,Context,Observation,TurnObservation,Recording,Adapter} from './types';

export const opaqueRef=(alias:string)=>`${alias.startsWith('R')?'out':'file'}_${createHash('sha256').update(`eval-ref:${alias}`).digest('hex').slice(0,32)}`;
export const aliasesFor=(scenario:Scenario)=>Object.fromEntries([scenario.context,...scenario.turns.flatMap(turn=>turn.context?[turn.context]:[])].flatMap(context=>context.files.map(file=>[opaqueRef(file.ref),file.ref])));
const encode=(inspection:Inspection)=>new TextEncoder().encode(JSON.stringify(inspection));
const decode=(bytes:Uint8Array):Inspection=>JSON.parse(new TextDecoder().decode(bytes));
function expand(value:any,request:PlannerRequest,context:Context):any{
  if(Array.isArray(value))return value.map(item=>expand(item,request,context));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,expand(item,request,context)]));
  if(value==='$focus')return request.focusedResultRef;
  if(typeof value==='string'&&context.files.some(file=>file.ref===value))return opaqueRef(value);
  return value;
}
const refusal=(error:unknown)=>error instanceof OutboundDenied?'privacy':(error as {code?:string})?.code==='planner_unavailable'?'allowance':/stale|Files changed|files changed/i.test(String(error))?'stale':/safe|password|secret|text from|name|checksum|path|instruction|encoded/i.test(String(error))?'privacy':/unavailable/i.test(String(error))?'capability':'schema';
/** Production request/gateway/SDK/validation/controller with synthetic engines and scripted HTTP only.
 * No prompt-dependent mock model is invented here. Records are fixture responses, not model evidence.
 */
export function currentAdapter(recordings:Record<string,Recording>):Adapter {
  return {name:'current-mocked-v1',async evaluate(scenario):Promise<Observation>{
    let store:LocalFileStore,controller:JobController,context=scenario.context,pending:PendingClarification|null=null;
    let invoked:Step[]=[];
    const reset=async(next:Context)=>{
      context=next;store=new LocalFileStore();
      const entries=await Promise.all(next.files.map(async file=>{
        const inspection:Inspection={...syntheticInspection(file.pageCount),pages:Array.from({length:file.pageCount},(_,i)=>({width:612,height:792,rotation:0,text:file.text??`Synthetic ${file.ref} page ${i+1}`}))};
        return store.prepare(encode(inspection),file.name,inspection,next.originalRefs.includes(file.ref),opaqueRef(file.ref));
      }));
      store.hydrate(entries,next.originalRefs.map(opaqueRef),next.history.map(opaqueRef),next.revision-1);
      controller=new JobController(store,{capabilities:next.capabilities as any,inspect:async bytes=>decode(bytes),recognize:async()=>[],worker:async work=>{
        if(work.kind!=='transform')throw new Error('Only synthetic transforms are used in this eval.');
        invoked.push(structuredClone(work.step));
        let pages=work.inputs.flatMap(input=>input.inspection.pages),structure=work.inputs.flatMap(input=>input.inspection.structure!.pages);
        if(work.step.operation==='select_pages'){const keep=(index:number)=>!(work.step.params.pages as {indices:number[]}).indices.includes(index+1);pages=pages.filter((_page,index)=>keep(index));structure=structure.filter((_page,index)=>keep(index));}
        return {bytes:encode({pages,structure:{version:1,reader:'synthetic-test-only',pages:structure}}),note:'Synthetic eval engine; no PDF fidelity evidence.'} as EngineResult;
      }});
    };
    await reset(context);
    const turns:TurnObservation[]=[];
    let remaining=scenario.entitlement.remaining;
    let harnessError:Error|null=null;
    for(const [index,turn] of scenario.turns.entries()){
      if(turn.context)await reset(turn.context);
      invoked=[];
      const observation:TurnObservation={status:'rejected',reasonCode:null,rawResponse:null,request:null,accepted:false,rejection:null,providerCalls:0,outbound:[],toolInvocations:[],control:null,qualityConfirmation:false,focus:null,revision:store!.revision,pendingInstruction:null};
      try{
        if(turn.event==='control'){
          pending=null;observation.status='control';observation.control=turn.action!;
          if(turn.action==='undo')await controller!.undo();
          if(turn.action==='cancel')controller!.cancel();
          if(turn.action==='start_over')await controller!.clear();
          observation.accepted=true;
        }else if(turn.event==='quick'){
          pending=null;observation.request=controller!.request();
          // Preview is only for observing compiler output; controller.quick performs its own admission.
          const proposal=quickPlan(observation.request,turn.action as any,turn.page??2).planner;
          observation.rawResponse=proposal;observation.status=proposal.status;
          if(proposal.steps.some(step=>step.operation==='compress_pdf'&&step.params.preset!=='lossless'))observation.qualityConfirmation=true;
          if(!observation.qualityConfirmation||turn.qualityApproved){
            await controller!.quick(turn.action as any,turn.page??2);
            if(controller!.state.error)throw new Error(controller!.state.error);
          }
          observation.accepted=true;
        }else{
          if(pending&&/^(?:cancel|never mind|stop)[.!]?$/i.test(turn.message)){
            pending=null;observation.status='control';observation.control='cancel';observation.accepted=true;
          }else{
            const instruction=privateInstruction(turn.message,store!.list);
            let request=controller!.request(instruction,pending??undefined);
            const previous=pending;pending=null;
            if(previous&&isClarificationAnswer(turn.message,previous))request=withPendingClarification(request,previous);
            observation.request=request;
            const record=recordings[`${scenario.id}:${index}`];
            // Any missing fixture is a harness error; never substitute a desired answer.
            const boundary=await fixture(['openai-development']);boundary.authority.hostedAiOn=scenario.consent.hostedCommands;
            const provider=async(projected:PlannerRequest,_key:string,signal:AbortSignal)=>planWithOpenAI(projected,'sk-eval-placeholder-not-a-credential',signal,async(_url,init)=>{
              observation.providerCalls++;
              observation.outbound.push({kind:'command',recipient:'openai-development',payload:JSON.parse(String(init?.body))});
              if(!record){harnessError=new Error('Missing deterministic recording');throw harnessError;}
              const input=expand(record.input,projected,context);
              return Response.json({id:'resp_eval',created_at:1,model:MODEL,status:'completed',error:null,incomplete_details:null,output:[{id:'fc_eval',type:'function_call',status:'completed',call_id:'call_eval',name:record.toolName,arguments:JSON.stringify(input)}]});
            },boundary.boundary);
            const config={status:async()=>({connected:true,enabled:scenario.entitlement.mode==='not_integrated'||remaining>0,remaining}),reserve:async()=>{if(scenario.entitlement.mode==='gateway_allowance'&&remaining<=0)throw new Error('blocked');remaining--;return {key:'unused',release:async()=>{}};}};
            const gateway=createGateway(config,async(...args)=>{
              const raw=await provider(args[0],args[1],args[2]);observation.rawResponse=structuredClone(raw);observation.status=raw.status;observation.reasonCode=raw.reasonCode;return raw;
            },{minIntervalMs:0,...boundary.gatewayOptions});
            const status=await (await gateway(new Request('http://localhost:3211/api/planner/status'))).json();
            const signal=new AbortController().signal;
            const envelope=await requestPlan(request,status.token,signal,()=>({...request,...turn.requestExtras}),{
              gate:boundary.gate,
              fetch:async(_url,init)=>gateway(new Request('http://localhost:3211/api/planner',{...init,headers:{...init?.headers,origin:'http://localhost:3211'}})),
            });
            if(turn.afterPlanningRevision!==undefined)store!.revision=turn.afterPlanningRevision;
            observation.accepted=true;
              if(envelope.planner.status==='clarify')pending=pendingFromResponse(request,envelope.planner);
              if(envelope.planner.status==='undo'){await controller!.undo();observation.control='undo';}
              if(envelope.planner.status==='plan'){
                observation.qualityConfirmation=envelope.planner.steps.some(step=>step.operation==='compress_pdf'&&step.params.preset!=='lossless');
                if(!observation.qualityConfirmation||turn.qualityApproved)await controller!.execute(envelope,request);
                if(controller!.state.error)throw new Error(controller!.state.error);
              }
          }
        }
      }catch(error){
        if(String(error).includes('Missing deterministic recording'))throw error;
        observation.accepted=false;observation.rejection=refusal(error);
      }
      if(harnessError)throw harnessError;
      observation.toolInvocations=structuredClone(invoked);
      observation.focus=store!.focus;observation.revision=store!.revision;observation.pendingInstruction=pending?.originalInstruction??null;
      turns.push(observation);
    }
    return {id:scenario.id,turns};
  }};
}
