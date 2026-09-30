import requestValid from '../../contracts/src/generated/request';
import {PLANNER_REFERENCE_LIMIT,capabilities,validateLocalContext,type Request as PlannerRequest} from '../../contracts/src/protocol';
import {assertInstructionSafe} from './privacy';
import {validatePendingClarification} from './clarification';
export function validateRequest(value:unknown):PlannerRequest{
  if(!requestValid(value))throw new Error('Invalid request.');
  const r=value as PlannerRequest;
  validateLocalContext(r);
  assertInstructionSafe(r.instruction);
  validatePendingClarification(r);
  if(r.files.length>PLANNER_REFERENCE_LIMIT)throw new Error('This request exceeds the active file reference limit. Choose fewer files; existing work is still available.');
  if(!/^req_[a-f0-9]{32}$/.test(r.requestId)||r.files.some(f=>!/^(file|out)_[a-f0-9]{32}$/.test(f.ref))||r.previousPlan!==null||r.previousActionIds.length||r.locale!=='en-IN'||r.ocrLanguages.some(language=>language!=='eng')||(!r.capabilities.includes('ocr_pdf')&&r.ocrLanguages.length>0)||r.capabilities.some(c=>!capabilities.includes(c)))throw new Error('Unsupported context.');
  const refs=new Set(r.files.map(f=>f.ref));
  if(refs.size!==r.files.length||r.files.some(f=>f.kind!=='pdf'||f.encrypted||f.pageCount<1||f.pageCount>100)||[...r.selectionRefs,...r.originalRefs,...(r.focusedResultRef?[r.focusedResultRef]:[])].some(ref=>!refs.has(ref)))throw new Error('Invalid file references.');
  // Second positive projection at the server boundary; never forward raw JSON.
  return {schemaVersion:'1.0',requestId:r.requestId,workspaceRevision:r.workspaceRevision,locale:'en-IN',instruction:r.instruction,files:r.files.map(f=>({ref:f.ref,kind:'pdf',pageCount:f.pageCount,sizeBytes:f.sizeBytes,encrypted:false})),selectionRefs:[...r.selectionRefs],focusedResultRef:r.focusedResultRef,originalRefs:[...r.originalRefs],pendingClarification:r.pendingClarification?{originalRequestId:r.pendingClarification.originalRequestId,workspaceRevision:r.pendingClarification.workspaceRevision,originalInstruction:r.pendingClarification.originalInstruction,question:r.pendingClarification.question,choices:[...r.pendingClarification.choices],answers:r.pendingClarification.answers.map(answer=>({question:answer.question,answer:answer.answer})),selectionRefs:[...r.pendingClarification.selectionRefs],focusedResultRef:r.pendingClarification.focusedResultRef,originalRefs:[...r.pendingClarification.originalRefs]}:null,previousActionIds:[],capabilities:[...r.capabilities],previousPlan:null,ocrLanguages:[...r.ocrLanguages]};
}
