import {jsonSchema} from 'ai';
import canonical from '../../contracts/schemas/planner-response.schema.json';
import responseValid from '../../contracts/src/generated/response';
import {capabilities, validateEnvelope, type Request as PlannerRequest, type Envelope} from '../../contracts/src/protocol';
import {validateNonPlanResponse} from './reply';

export type PlannerResponse = {schemaVersion:'1.0';status:'plan'|'clarify'|'unsupported'|'answer'|'undo';reasonCode:string|null;steps:Envelope['planner']['steps'];resultRefs:string[];clarification:{question:string;choices:string[]}|null};
// Provider-compatible subset. The canonical schema is still the independent acceptance gate.
const schema=structuredClone(canonical);
schema.properties.steps.items.anyOf=schema.properties.steps.items.anyOf.filter(s=>capabilities.includes(s.properties.operation.const as typeof capabilities[number]));
schema.properties.steps.maxItems=4;
const providerSchema=(value:unknown):unknown=>{
  if(Array.isArray(value))return value.map(providerSchema);
  if(value&&typeof value==='object'){
    const output=Object.fromEntries(Object.entries(value).filter(([key])=>!['$schema','title','uniqueItems'].includes(key)).map(([key,item])=>key==='const'?['enum',[item]]:[key,providerSchema(item)]));
    if(Array.isArray(output.enum)&&!output.type){const types=[...new Set(output.enum.map(item=>item===null?'null':typeof item))];output.type=types.length===1?types[0]:types;}
    return output;
  }
  return value;
};
const planTool=structuredClone(schema);
planTool.properties.status.enum=['plan'];planTool.properties.reasonCode.enum=[null];
planTool.properties.steps.minItems=1;planTool.properties.resultRefs.minItems=1;
planTool.properties.clarification.anyOf=[{type:'null'}];
export const planToolInput=jsonSchema<PlannerResponse>(providerSchema(planTool) as Parameters<typeof jsonSchema>[0]);
export const undoToolInput=jsonSchema<Record<string,never>>({type:'object',properties:{},required:[],additionalProperties:false});
// Retained for the independent contract bridge; provider execution now uses
// one explicit tool call rather than directly emitting this JSON object.
export const outputSchema=jsonSchema<PlannerResponse>(providerSchema(schema) as Parameters<typeof jsonSchema>[0],{validate:async value=>responseValid(value)?{success:true,value:value as PlannerResponse}:{success:false,error:new Error('Invalid planner response')}});
export type ChatReply={status:'answer'|'clarify'|'unsupported';reasonCode:string;message:string;choices:string[]};
export const chatReplyInput=jsonSchema<ChatReply>({type:'object',properties:{
  status:{type:'string',enum:['answer','clarify','unsupported']},
  reasonCode:{type:'string',enum:['product_information','missing_files','ambiguous_reference','missing_parameter','excluded_operation','content_required','unavailable_capability','invalid_request']},
  message:{type:'string',minLength:1,maxLength:600},
  choices:{type:'array',items:{type:'string',minLength:1,maxLength:100},maxItems:6},
},required:['status','reasonCode','message','choices'],additionalProperties:false});
export function bindResponse(value:unknown,request:PlannerRequest):Envelope|{schemaVersion:'1.0';requestId:string;workspaceRevision:number;planner:PlannerResponse}{
  if(!responseValid(value))throw new Error('Invalid planner response.');
  const planner=value as PlannerResponse;
  const envelope={schemaVersion:'1.0' as const,requestId:request.requestId,workspaceRevision:request.workspaceRevision,planner};
  if(planner.status==='plan'){
    const valid=validateEnvelope(envelope,request,request.workspaceRevision);
    // Model labels become fresh opaque local references before entering the store.
    const refs=new Map(valid.planner.steps.map(step=>[step.outputRef,`out_${crypto.randomUUID().replaceAll('-','')}`]));
    const rebound={...valid,planner:{...valid.planner,steps:valid.planner.steps.map(step=>({...step,inputs:step.inputs.map(ref=>refs.get(ref)??ref),outputRef:refs.get(step.outputRef)!})),resultRefs:valid.planner.resultRefs.map(ref=>refs.get(ref)!)}};
    return validateEnvelope(rebound,request,request.workspaceRevision);
  }
  validateNonPlanResponse(planner);
  return envelope;
}
