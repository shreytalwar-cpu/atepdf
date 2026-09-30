import {JobController} from '@core/job-controller';
import {LocalFileStore} from '@core/local-file-store';
import {savePDF,type SavePicker} from '../../../web/src/services/export';
export const nativeEngineReady=true;
export const ocrAvailable=true;
// Load browser PDF services on first use. Each service still checks its signal
// before processing, and promotion still waits for independent inspection.
export const createController=()=>new JobController(new LocalFileStore(),{
  worker:async(...args)=>(await import('@pdf/client')).runWorker(...args),
  inspect:async(...args)=>(await import('@pdf/client')).inspect(...args),
  recognize:async(...args)=>(await import('@pdf/client')).recognize(...args),
});
export async function chooseFiles(signal?:AbortSignal){return new Promise<File[]>(resolve=>{const input=document.createElement('input');input.type='file';input.accept='.pdf,application/pdf';input.multiple=true;const finish=(files:File[])=>{signal?.removeEventListener('abort',cancel);input.onchange=null;input.oncancel=null;resolve(files);};const cancel=()=>finish([]);input.onchange=()=>finish(Array.from(input.files??[]));input.oncancel=cancel;if(signal?.aborted){cancel();return;}signal?.addEventListener('abort',cancel,{once:true});input.click();});}
export async function sampleFiles(signal?:AbortSignal){return Promise.all(['brief.pdf','appendix.pdf'].map(async name=>{const response=await fetch(`/fixtures/${name}`,{signal});if(!response.ok)throw new Error('Sample files unavailable.');return new File([await response.arrayBuffer()],name,{type:'application/pdf'});}));}
export const save=async(bytes:Uint8Array):Promise<'saved'|'cancelled'|'download-started'|'shared'>=>savePDF(bytes,(window as unknown as {showSaveFilePicker?:SavePicker}).showSaveFilePicker?.bind(window));
