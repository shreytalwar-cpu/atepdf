import {buildRequest,quickPlan,validateEnvelope,type Request,type Envelope,type Operation} from '@contracts/protocol';
import {LocalFileStore} from './local-file-store';
import type {EngineRequest,EngineResult,Inspection,OCRPage} from '@pdf/types';
type Services={capabilities?:Operation[];worker:(request:EngineRequest,signal:AbortSignal,progress?:(text:string)=>void)=>Promise<EngineResult|{pages:number}>;inspect:(bytes:Uint8Array,signal:AbortSignal)=>Promise<Inspection>;recognize:(bytes:Uint8Array,inspection:Inspection,signal:AbortSignal,progress:(text:string)=>void)=>Promise<OCRPage[]>};
// Browser File objects need no cleanup; native picker handles own disposable cache copies.
export type LocalInputFile=Pick<File,'name'|'size'|'arrayBuffer'>&{release?:()=>void|Promise<void>};
export type JobStepStatus='pending'|'active'|'validating'|'complete'|'cancelled'|'failed';
export type JobProgress={kind:'import'|'transform';currentStep:number|null;steps:{label:string;operation?:Operation;status:JobStepStatus}[]};
export type JobState={busy:boolean;message:string;error:string|null;stage:'idle'|'importing'|'executing'|'validating'|'complete'|'cancelled'|'failed';progress?:JobProgress};
const operationLabels:Record<Operation,string>={merge_pdf:'Merge PDFs',select_pages:'Remove pages',ocr_pdf:'Make searchable',compress_pdf:'Compress PDF'};
const normalize=(s:string)=>s.replace(/\s+/g,'').toLowerCase();
export class JobController {
  state:JobState={busy:false,message:'',error:null,stage:'idle'};
  #abort:AbortController|null=null;
  #listeners=new Set<()=>void>();
  #used=new Set<string>();
  constructor(readonly store:LocalFileStore,private services:Services){}
  subscribe=(listener:()=>void)=>{this.#listeners.add(listener);return ()=>{this.#listeners.delete(listener);};};
  snapshot=()=>this.state;
  private update(value:Partial<JobState>){this.state={...this.state,...value};this.#listeners.forEach(l=>l());}
  private updateStep(index:number,status:JobStepStatus,value:Partial<JobState>={}){
    const progress=this.state.progress;
    if(!progress)return;
    this.update({...value,progress:{...progress,currentStep:index,steps:progress.steps.map((step,i)=>i===index?{...step,status}:step)}});
  }
  private async locked(stage:JobState['stage'],work:(signal:AbortSignal)=>Promise<void>,progress?:JobProgress){
    if(this.state.busy)throw new Error('Wait for this action or cancel it first.');
    const abort=new AbortController();this.#abort=abort;
    const deadline=setTimeout(()=>abort.abort(),240_000);
    this.update({busy:true,stage,error:null,progress,message:stage==='importing'?'Checking your PDFs…':'Starting local processing…'});
    try{await work(abort.signal);abort.signal.throwIfAborted();this.update({stage:'complete',message:'Ready. Your originals are unchanged.',progress:this.state.progress?{...this.state.progress,currentStep:null}:undefined});}
    catch(e){const cancelled=abort.signal.aborted;const progress=this.state.progress;this.update({stage:cancelled?'cancelled':'failed',error:cancelled?null:e instanceof Error?e.message:'This action could not finish.',message:cancelled?'Cancelled. No new result was committed.':'',progress:progress?{...progress,steps:progress.steps.map(step=>step.status==='active'||step.status==='validating'?{...step,status:cancelled?'cancelled':'failed'}:step)}:undefined});}
    finally{clearTimeout(deadline);this.#abort=null;this.update({busy:false});}
  }
  cancel(){this.#abort?.abort();}
  async import(files:LocalInputFile[]){
    try{await this.locked('importing',async signal=>{
      const revision=this.store.revision;
      if(!files.length||files.length+this.store.originals.length>20)throw new Error('Choose between 1 and 20 PDFs per session.');
      const staged=[];
      for(const [index,file] of files.entries()){
        this.updateStep(index,'active',{message:`Checking PDF ${index+1} of ${files.length}…`});
        const bytes=new Uint8Array(await file.arrayBuffer());signal.throwIfAborted();
        await this.services.worker({kind:'inspect',bytes},signal);
        signal.throwIfAborted();this.updateStep(index,'validating');
        const inspection=await this.services.inspect(bytes,signal);
        signal.throwIfAborted();
        staged.push(await this.store.prepare(bytes,file.name,inspection,true));
        signal.throwIfAborted();this.updateStep(index,'complete',{message:`Checked ${staged.length} of ${files.length} PDFs`});
      }
      signal.throwIfAborted();this.store.commit(staged,revision);
    },{kind:'import',currentStep:null,steps:files.map((_,index)=>({label:`Check PDF ${index+1}`,status:'pending'}))});}finally{
      // Also release unread selections after cancellation, preflight failure or a busy rejection.
      await Promise.allSettled(files.map(file=>Promise.resolve().then(()=>file.release?.())));
    }
  }
  request(instruction='Local quick action'):Request{const request=buildRequest({revision:this.store.revision,files:this.store.list.map(f=>({ref:f.ref,kind:'pdf',pageCount:f.pageCount,sizeBytes:f.sizeBytes,encrypted:false})),selected:this.store.originals,focus:this.store.focus,originals:this.store.originals},instruction);if(this.services.capabilities){request.capabilities=[...this.services.capabilities];if(!request.capabilities.includes('ocr_pdf'))request.ocrLanguages=[];}return request;}
  async quick(action:Parameters<typeof quickPlan>[1],page=2,target:number|null=null){
    const request=this.request();
    try{await this.execute(quickPlan(request,action,page,target),request);}catch(e){this.update({error:e instanceof Error?e.message:'Action unavailable.'});}
  }
  async execute(raw:unknown,request:Request){
    // Keep the accepted recipe and context fixed throughout asynchronous engine work.
    request=structuredClone(request);
    const envelope:Envelope=validateEnvelope(structuredClone(raw),request,this.store.revision);
    if(this.services.capabilities&&envelope.planner.steps.some(step=>!this.services.capabilities!.includes(step.operation)))throw new Error('This operation is unavailable on this device.');
    const local=new Map(this.store.list.map(file=>[file.ref,file]));
    if(request.files.some(file=>{const actual=local.get(file.ref);return !actual||actual.pageCount!==file.pageCount||actual.sizeBytes!==file.sizeBytes;}))throw new Error('Files changed. Run the action again.');
    if(this.#used.has(request.requestId))throw new Error('This request was already handled.');
    if(this.state.busy)throw new Error('A local job is already running.');
    this.#used.add(request.requestId);
    await this.locked('executing',async signal=>{
      const stage=new Map<string,{bytes:Uint8Array;inspection:Inspection}>();let note='';
      for(const [index,step] of envelope.planner.steps.entries()){
        signal.throwIfAborted();
        this.updateStep(index,'active',{stage:'executing',message:'Starting local processing…'});
        const inputs=step.inputs.map(ref=>{const temp=stage.get(ref);if(temp)return temp;const f=this.store.get(ref);return {bytes:f.bytes,inspection:f.meta.inspection};});
        // A late engine callback cannot regress validation or overwrite a later job.
        const progress=(message:string)=>{if(!signal.aborted&&this.#abort?.signal===signal&&this.state.progress?.currentStep===index&&this.state.progress.steps[index].status==='active')this.update({message,stage:'executing'});};
        const ocrPages=step.operation==='ocr_pdf'?await this.services.recognize(inputs[0].bytes,inputs[0].inspection,signal,progress):undefined;
        const result=await this.services.worker({kind:'transform',step,inputs,ocrPages},signal,progress) as EngineResult;
        signal.throwIfAborted();this.updateStep(index,'validating',{stage:'validating',message:'Checking the PDF with an independent reader…'});
        const inspection=await this.services.inspect(result.bytes,signal);
        signal.throwIfAborted();
        let expected=inputs.flatMap(i=>i.inspection.pages);
        if(step.operation==='select_pages')expected=expected.filter((_,i)=>!(step.params.pages as {indices:number[]}).indices.includes(i+1));
        if(expected.length!==inspection.pages.length)throw new Error('Page-count validation failed.');
        expected.forEach((p,i)=>{
          const got=inspection.pages[i];
          if(p.width!==got.width||p.height!==got.height||p.rotation!==got.rotation|| (p.text&&normalize(got.text)!==normalize(p.text)))throw new Error('Page preservation validation failed.');
        });
        for(const page of ocrPages??[]){
          const text=normalize(inspection.pages[page.page-1].text);
          if(page.words.some(w=>!text.includes(normalize(w.text))))throw new Error('Searchable text validation failed.');
        }
        stage.set(step.outputRef,{bytes:result.bytes,inspection});note=result.note||note;
        if(step.operation==='compress_pdf'){
          const before=inputs[0].bytes.length,after=result.bytes.length;
          note+=` ${before.toLocaleString()} → ${after.toLocaleString()} bytes.`;
          if(typeof step.params.targetBytes==='number'&&after>=step.params.targetBytes)note+=' Target not met; this is the best valid candidate.';
        }
        this.updateStep(index,'complete');
      }
      const ref=envelope.planner.resultRefs[0],result=stage.get(ref)!;
      const artifact=await this.store.prepare(result.bytes,'atepdf-result.pdf',result.inspection,false,ref,note);
      signal.throwIfAborted();this.store.commit([artifact],request.workspaceRevision);
    },{kind:'transform',currentStep:null,steps:envelope.planner.steps.map(step=>({label:operationLabels[step.operation],operation:step.operation,status:'pending'}))});
  }
  undo(){if(this.state.busy)return;this.store.undo();this.update({message:'Previous result restored.',error:null,stage:'complete',progress:undefined});}
  clear(){if(this.state.busy)return;this.store.clear();this.update({message:'',error:null,stage:'idle',progress:undefined});}
}
