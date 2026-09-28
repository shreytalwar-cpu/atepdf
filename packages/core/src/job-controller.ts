import {buildRequest,quickPlan,validateEnvelope,type Request,type Envelope} from '@contracts/protocol';
import {LocalFileStore} from './local-file-store';
import type {EngineRequest,EngineResult,Inspection,OCRPage} from '@pdf/types';
import {LIMITS} from '@pdf/types';
type Services={worker:(request:EngineRequest,signal:AbortSignal,progress?:(text:string)=>void)=>Promise<EngineResult|{pages:number}>;inspect:(bytes:Uint8Array,signal:AbortSignal)=>Promise<Inspection>;recognize:(bytes:Uint8Array,inspection:Inspection,signal:AbortSignal,progress:(text:string)=>void)=>Promise<OCRPage[]>};
export type JobState={busy:boolean;message:string;error:string|null;stage:'idle'|'importing'|'executing'|'validating'|'complete'|'cancelled'|'failed'};
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
  private async locked(stage:JobState['stage'],work:(signal:AbortSignal)=>Promise<void>){
    if(this.state.busy)throw new Error('Wait for this action or cancel it first.');
    const abort=new AbortController();this.#abort=abort;
    const deadline=setTimeout(()=>abort.abort(),240_000);
    this.update({busy:true,stage,error:null,message:stage==='importing'?'Checking your PDFs…':'Starting local processing…'});
    try{await work(abort.signal);abort.signal.throwIfAborted();this.update({stage:'complete',message:'Ready. Your originals are unchanged.'});}
    catch(e){const cancelled=abort.signal.aborted;this.update({stage:cancelled?'cancelled':'failed',error:cancelled?null:e instanceof Error?e.message:'This action could not finish.',message:cancelled?'Cancelled. No new result was committed.':''});}
    finally{clearTimeout(deadline);this.#abort=null;this.update({busy:false});}
  }
  cancel(){this.#abort?.abort();}
  async import(files:File[]){
    await this.locked('importing',async signal=>{
      const revision=this.store.revision;
      if(!files.length||files.length+this.store.originals.length>20||files.reduce((n,f)=>n+f.size,0)+this.store.originals.reduce((n,r)=>n+this.store.get(r).meta.sizeBytes,0)>LIMITS.total)throw new Error('Choose up to 20 PDFs, with a total size under 40 MB.');
      const staged=[];
      for(const file of files){
        if(file.size>LIMITS.file)throw new Error('Choose PDFs smaller than 20 MB each.');
        const bytes=new Uint8Array(await file.arrayBuffer());signal.throwIfAborted();
        await this.services.worker({kind:'inspect',bytes},signal);
        const inspection=await this.services.inspect(bytes,signal);
        staged.push(await this.store.prepare(bytes,file.name,inspection,true));
        this.update({message:`Checked ${staged.length} of ${files.length} PDFs`});
      }
      signal.throwIfAborted();this.store.commit(staged,revision);
    });
  }
  request(instruction='Local quick action'):Request{return buildRequest({revision:this.store.revision,files:this.store.list.map(f=>({ref:f.ref,kind:'pdf',pageCount:f.pageCount,sizeBytes:f.sizeBytes,encrypted:false})),selected:this.store.originals,focus:this.store.focus,originals:this.store.originals},instruction);}
  async quick(action:Parameters<typeof quickPlan>[1],page=2,target:number|null=null){
    const request=this.request();
    try{await this.execute(quickPlan(request,action,page,target),request);}catch(e){this.update({error:e instanceof Error?e.message:'Action unavailable.'});}
  }
  async execute(raw:unknown,request:Request){
    const envelope:Envelope=validateEnvelope(raw,request,this.store.revision);
    if(this.#used.has(request.requestId))throw new Error('This request was already handled.');
    if(this.state.busy)throw new Error('A local job is already running.');
    this.#used.add(request.requestId);
    await this.locked('executing',async signal=>{
      const stage=new Map<string,{bytes:Uint8Array;inspection:Inspection}>();let note='';
      for(const step of envelope.planner.steps){
        signal.throwIfAborted();
        const inputs=step.inputs.map(ref=>{const temp=stage.get(ref);if(temp)return temp;const f=this.store.get(ref);return {bytes:f.bytes,inspection:f.meta.inspection};});
        const progress=(message:string)=>this.update({message,stage:'executing'});
        const ocrPages=step.operation==='ocr_pdf'?await this.services.recognize(inputs[0].bytes,inputs[0].inspection,signal,progress):undefined;
        const result=await this.services.worker({kind:'transform',step,inputs,ocrPages},signal,progress) as EngineResult;
        signal.throwIfAborted();this.update({stage:'validating',message:'Checking the PDF with an independent reader…'});
        const inspection=await this.services.inspect(result.bytes,signal);
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
      }
      const ref=envelope.planner.resultRefs[0],result=stage.get(ref)!;
      const artifact=await this.store.prepare(result.bytes,'atepdf-result.pdf',result.inspection,false,ref,note);
      signal.throwIfAborted();this.store.commit([artifact],request.workspaceRevision);
    });
  }
  undo(){if(this.state.busy)return;this.store.undo();this.update({message:'Previous result restored.',error:null,stage:'complete'});}
  clear(){if(this.state.busy)return;this.store.clear();this.update({message:'',error:null,stage:'idle'});}
}
