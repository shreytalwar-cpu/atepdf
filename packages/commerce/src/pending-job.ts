import {validateEnvelope,validateLocalContext,type Request,type Envelope} from '../../contracts/src/protocol';

/** Local-only state: contains the user's draft and must never enter analytics or a billing/provider DTO. */
export type PendingJobSnapshot = Readonly<{kind:'local-pending-job';snapshotId:string;draft:string;request:Request;recipe:Envelope}>;
export type ResumeReview =
  | {status:'replan_required';reason:'workspace_changed'}
  | {status:'confirmation_required';reviewId:string;snapshotId:string;request:Request;recipe:Envelope};

const newId=(prefix:string)=>`${prefix}_${crypto.randomUUID().replaceAll('-','')}`;
function binding(request:Request):string {
  validateLocalContext(request);
  // Intentionally local. No checksums, names, paths, PDF content or full chat history.
  return JSON.stringify({revision:request.workspaceRevision,instruction:request.instruction,
    files:request.files.map(file=>({ref:file.ref,kind:file.kind,pageCount:file.pageCount,sizeBytes:file.sizeBytes,encrypted:file.encrypted})),
    selectionRefs:request.selectionRefs,focusedResultRef:request.focusedResultRef,originalRefs:request.originalRefs,
    capabilities:request.capabilities,ocrLanguages:request.ocrLanguages});
}
export function capturePendingJob(request:Request,recipe:Envelope,draft:string):PendingJobSnapshot {
  if(typeof draft!=='string'||draft.length>4000)throw new Error('Invalid local draft.');
  validateEnvelope(recipe,request,request.workspaceRevision);
  return structuredClone({kind:'local-pending-job',snapshotId:newId('pending'),draft,request,recipe});
}
export function reviewPendingJob(snapshot:PendingJobSnapshot,current:Request):ResumeReview {
  if(snapshot.kind!=='local-pending-job'||!/^pending_[a-f0-9]{32}$/.test(snapshot.snapshotId))throw new Error('Invalid local pending job.');
  validateEnvelope(snapshot.recipe,snapshot.request,snapshot.request.workspaceRevision);
  if(binding(snapshot.request)!==binding(current))return {status:'replan_required',reason:'workspace_changed'};
  // Never execute, even after purchase or restore. Produce a newly bound proposal for explicit review.
  const recipe=validateEnvelope({...structuredClone(snapshot.recipe),requestId:current.requestId,workspaceRevision:current.workspaceRevision},current,current.workspaceRevision);
  return {status:'confirmation_required',reviewId:newId('review'),snapshotId:snapshot.snapshotId,request:structuredClone(current),recipe};
}
export function confirmPendingJob(review:ResumeReview,current:Request,confirmedReviewId:string):Envelope {
  if(review.status!=='confirmation_required'||confirmedReviewId!==review.reviewId)throw new Error('Review this recipe before continuing.');
  if(current.requestId!==review.request.requestId||binding(current)!==binding(review.request))throw new Error('Files or intent changed. Review a new recipe.');
  return validateEnvelope(structuredClone(review.recipe),current,current.workspaceRevision);
}
