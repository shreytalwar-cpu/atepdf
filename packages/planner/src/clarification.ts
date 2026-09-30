import {validateLocalContext,type PendingClarification,type Request} from '../../contracts/src/protocol';
import type {PlannerResponse} from './schema';
import {assertInstructionSafe} from './privacy';
import {validateNonPlanResponse} from './reply';

const normalise=(value:string)=>value.trim().toLocaleLowerCase('en').replace(/[.!?]+$/,'').replace(/^(?:the )/,'').replace(/ one$/,'');
const newTask=/^(?:merge|combine|remove|delete|compress|optimise|optimize|make|ocr|undo|help|start over|clear|what|how|can you|please (?:merge|combine|remove|delete|compress|optimise|optimize|make|ocr|undo))/i;

/** Only a bounded answer is linked to the old task; explicit new requests replace it. */
export function isClarificationAnswer(text:string,pending:PendingClarification):boolean{
  const answer=text.trim();
  if(!answer||answer.length>100||answer.includes('\n')||newTask.test(answer))return false;
  const value=normalise(answer);
  if(pending.choices.some(choice=>normalise(choice)===value||normalise(choice)===value.replace(/^the /,'')))return true;
  if(/^(?:(?:page|pages|file|document|original|result|item) )?\d+(?: and \d+)?$/.test(value))return true;
  if(/^(?:(?:page|file|document|original|result|item) )?(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|last)(?: (?:one|file|document|original|result|item))?$/.test(value))return true;
  if(pending.choices.length)return false;
  return /^[\p{L}\p{N}][\p{L}\p{N} '-]*$/u.test(answer)&&answer.split(/\s+/).length<=5;
}

export function withPendingClarification(request:Request,pending:PendingClarification):Request{
  const bound:Request={...request,pendingClarification:{...pending,choices:[...pending.choices],answers:pending.answers.map(answer=>({...answer})),selectionRefs:[...pending.selectionRefs],originalRefs:[...pending.originalRefs]}};
  validateLocalContext(bound);
  return bound;
}

export function pendingFromResponse(request:Request,planner:PlannerResponse):PendingClarification{
  if(planner.status!=='clarify'||!planner.clarification)throw new Error('No clarification to retain.');
  validateNonPlanResponse(planner);
  const previous=request.pendingClarification;
  if(previous&&previous.answers.length>=3)throw new Error('Please restate the full request to continue.');
  return {
    originalRequestId:previous?.originalRequestId??request.requestId,
    workspaceRevision:request.workspaceRevision,
    originalInstruction:previous?.originalInstruction??request.instruction,
    question:planner.clarification.question,
    choices:[...planner.clarification.choices],
    answers:previous?[...previous.answers,{question:previous.question,answer:request.instruction}]:[],
    selectionRefs:[...request.selectionRefs],
    focusedResultRef:request.focusedResultRef,
    originalRefs:[...request.originalRefs],
  };
}

export function validatePendingClarification(request:Request):void{
  const pending=request.pendingClarification;
  if(!pending)return;
  validateLocalContext(request);
  assertInstructionSafe(pending.originalInstruction);
  validateNonPlanResponse({schemaVersion:'1.0',status:'clarify',reasonCode:'ambiguous_reference',steps:[],resultRefs:[],clarification:{question:pending.question,choices:pending.choices}});
  for(const answer of pending.answers){
    validateNonPlanResponse({schemaVersion:'1.0',status:'clarify',reasonCode:'ambiguous_reference',steps:[],resultRefs:[],clarification:{question:answer.question,choices:[]}});
    assertInstructionSafe(answer.answer);
  }
}
