import type {PlannerResponse} from './schema';

/** A chat reply is a terminal model choice, never an executable PDF plan. */
export function validateNonPlanResponse(planner:PlannerResponse):void {
  if(planner.status==='undo'){
    if(planner.reasonCode!=='undo_last_change'||planner.steps.length||planner.resultRefs.length||planner.clarification!==null)throw new Error('Invalid undo request.');
    return;
  }
  if(planner.reasonCode===null||planner.steps.length||planner.resultRefs.length||!planner.clarification)throw new Error('Invalid chat response.');
  const {question,choices}=planner.clarification;
  const unsafe=(text:string)=>/(?:file|out)_[a-z0-9_]{1,64}|sk-[a-z0-9_-]{12,}|https?:\/\/|(?:\/Users\/|file:\/\/)/i.test(text);
  if(!question.trim()||question.length>600||unsafe(question)||choices.some(choice=>!choice.trim()||choice.length>100||unsafe(choice)))throw new Error('Unsafe chat response.');
  if(planner.status==='answer'&&(planner.reasonCode!=='product_information'||choices.length))throw new Error('Invalid product answer.');
  if(planner.status!=='answer'&&planner.reasonCode==='product_information')throw new Error('Invalid clarification.');
}
