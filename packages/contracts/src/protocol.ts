import requestValid from './generated/request';
import envelopeValid from './generated/envelope';

export type Operation = 'merge_pdf' | 'select_pages' | 'ocr_pdf' | 'compress_pdf';
export type Step = { id: string; operation: Operation; inputs: string[]; outputRef: string; params: Record<string, unknown> };
export type Plan = { schemaVersion: '1.0'; status: 'plan'; reasonCode: null; steps: Step[]; resultRefs: string[]; clarification: null };
export type Envelope = { schemaVersion: '1.0'; requestId: string; workspaceRevision: number; planner: Plan };
export type ManifestFile = {ref:string; kind:'pdf'; pageCount:number; sizeBytes:number; encrypted:false};
export type Request = {schemaVersion:'1.0'; requestId:string; workspaceRevision:number; locale:string; instruction:string; files:ManifestFile[]; selectionRefs:string[]; focusedResultRef:string|null; originalRefs:string[]; previousActionIds:Operation[]; capabilities:Operation[]; previousPlan:null; ocrLanguages:string[]};
export const capabilities: Operation[] = ['merge_pdf','select_pages','ocr_pdf','compress_pdf'];
export function validateLocalContext(request: Request): void {
  if (!requestValid(request)) throw new Error('Invalid instruction or local manifest.');
  if (!Number.isSafeInteger(request.workspaceRevision)) throw new Error('Invalid workspace revision.');
  const refs = new Set(request.files.map(file => file.ref));
  if (refs.size !== request.files.length) throw new Error('Duplicate file reference.');
  if (request.files.some(file => file.kind !== 'pdf' || file.encrypted || !Number.isSafeInteger(file.pageCount) || file.pageCount < 1 || file.pageCount > 100)) throw new Error('Unsupported local file.');
  if ([...request.selectionRefs, ...request.originalRefs, ...(request.focusedResultRef ? [request.focusedResultRef] : [])].some(ref => !refs.has(ref))) throw new Error('Unknown file reference.');
}
export function buildRequest(context: {revision:number; files:ManifestFile[]; selected:string[]; focus:string|null; originals:string[]}, instruction:string): Request {
  // Positive projection: never spread a local file model into a network DTO.
  const request: Request = {
    schemaVersion:'1.0', requestId:`req_${crypto.randomUUID().replaceAll('-','')}`,
    workspaceRevision:context.revision, locale:'en-IN', instruction,
    files:context.files.map(f=>({ref:f.ref,kind:'pdf',pageCount:f.pageCount,sizeBytes:f.sizeBytes,encrypted:false})),
    selectionRefs:[...context.selected],focusedResultRef:context.focus,originalRefs:[...context.originals],
    previousActionIds:[],capabilities:[...capabilities],previousPlan:null,ocrLanguages:['eng'],
  };
  validateLocalContext(request);
  return request;
}
export function validateEnvelopeBinding(raw:unknown, request:Request, currentRevision:number): void {
  validateLocalContext(request);
  if (!envelopeValid(raw)) throw new Error('Incomplete or invalid plan.');
  const envelope=raw as Envelope;
  if (envelope.requestId!==request.requestId || envelope.workspaceRevision!==request.workspaceRevision || currentRevision!==request.workspaceRevision) throw new Error('Files changed. Run the action again.');
}
export function validateEnvelope(raw:unknown, request:Request, currentRevision:number): Envelope {
  validateEnvelopeBinding(raw,request,currentRevision);
  const envelope=raw as Envelope;
  const p=envelope.planner;
  if(p.status!=='plan'||p.reasonCode!==null||p.clarification!==null||!p.steps.length||p.steps.length>4) throw new Error('No executable local plan.');
  const counts = new Map(request.files.map(f=>[f.ref,f.pageCount]));
  if(counts.size!==request.files.length) throw new Error('Duplicate file reference.');
  const stepIds=new Set<string>(), produced=new Set<string>(), consumed=new Set<string>();
  for(const step of p.steps) {
    if(!capabilities.includes(step.operation)||!request.capabilities.includes(step.operation)) throw new Error('Operation unavailable.');
    if(stepIds.has(step.id)||counts.has(step.outputRef)) throw new Error('Duplicate step or output.');
    stepIds.add(step.id);
    if(new Set(step.inputs).size!==step.inputs.length || step.inputs.some(ref=>!counts.has(ref))) throw new Error('Unknown or repeated input.');
    let count=counts.get(step.inputs[0])!;
    if(step.operation==='merge_pdf') {
      if(step.inputs.length<2) throw new Error('Choose at least two PDFs.');
      count=step.inputs.reduce((sum,ref)=>sum+counts.get(ref)!,0);
    } else {
      if(step.inputs.length!==1) throw new Error('Choose one PDF or merge first.');
      if(step.operation==='select_pages') {
        const pages=step.params.pages as {mode:string;indices?:number[]};
        if(step.params.action!=='remove'||pages.mode!=='explicit'||!pages.indices?.length) throw new Error('Only explicit physical page removal is available.');
        if(pages.indices.some(n=>n>count)) throw new Error(`This PDF has ${count} ${count===1?'page':'pages'}. ${count===1?'A PDF must keep at least one page.':`Choose a page from 1 to ${count}.`} Your files are unchanged.`);
        count-=pages.indices.length;
      }
      if(step.operation==='ocr_pdf' && (JSON.stringify(step.params.languages)!=='["eng"]'||!request.ocrLanguages.includes('eng')||step.params.batchMode!=='single')) throw new Error('Only single-document English OCR is available.');
      if(step.operation==='compress_pdf' && (step.params.batchMode!=='single'||!['balanced','lossless'].includes(String(step.params.preset)))) throw new Error('Compression setting unavailable.');
    }
    if(count<1||count>100) throw new Error('Keep between 1 and 100 pages.');
    counts.set(step.outputRef,count);produced.add(step.outputRef);step.inputs.forEach(ref=>consumed.add(ref));
  }
  const terminal=[...produced].filter(ref=>!consumed.has(ref));
  if(p.resultRefs.length!==1||terminal.length!==1||p.resultRefs[0]!==terminal[0]) throw new Error('Plan must return its final output.');
  return envelope;
}
export function quickPlan(request:Request, action:'merge'|'remove'|'ocr'|'compress'|'chain', page=2, targetBytes:number|null=null):Envelope {
  const steps:Step[]=[];
  const add=(operation:Operation,inputs:string[],params:Step['params'])=>{
    const outputRef=`out_${crypto.randomUUID().replaceAll('-','')}`;
    steps.push({id:`s_${steps.length+1}`,operation,inputs:[...inputs],outputRef,params});return outputRef;
  };
  if(action!=='merge'&&action!=='chain'&&!request.focusedResultRef&&request.selectionRefs.length!==1)throw new Error('Choose one PDF or create a merged result first.');
  let ref=request.focusedResultRef ?? request.selectionRefs[0];
  if(action==='merge'||action==='chain')ref=add('merge_pdf',request.selectionRefs,{ordering:'as_provided'});
  if(!ref)throw new Error('Choose a PDF first.');
  if(action==='remove')ref=add('select_pages',[ref],{action:'remove',pages:{mode:'explicit',indices:[page]}});
  if(action==='ocr'||action==='chain')ref=add('ocr_pdf',[ref],{languages:['eng'],existingText:'preserve',batchMode:'single'});
  if(action==='compress'||action==='chain')ref=add('compress_pdf',[ref],{targetBytes,preset:'balanced',batchMode:'single'});
  return validateEnvelope({schemaVersion:'1.0',requestId:request.requestId,workspaceRevision:request.workspaceRevision,planner:{schemaVersion:'1.0',status:'plan',reasonCode:null,steps,resultRefs:[ref],clarification:null}},request,request.workspaceRevision);
}
