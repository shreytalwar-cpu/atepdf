import {JobController} from '@core/job-controller';
import {LocalFileStore} from '@core/local-file-store';
import {inspect,recognize,runWorker} from '@pdf/client';
import {savePDF,type SavePicker} from '../../../web/src/services/export';
export const nativeEngineReady=true;
export const createController=()=>new JobController(new LocalFileStore(),{worker:runWorker,inspect,recognize});
export async function chooseFiles(){return new Promise<File[]>(resolve=>{const input=document.createElement('input');input.type='file';input.accept='.pdf,application/pdf';input.multiple=true;input.onchange=()=>resolve(Array.from(input.files??[]));input.oncancel=()=>resolve([]);input.click();});}
export async function sampleFiles(){return Promise.all(['brief.pdf','appendix.pdf'].map(async name=>{const response=await fetch(`/fixtures/${name}`);if(!response.ok)throw new Error('Sample files unavailable.');return new File([await response.arrayBuffer()],name,{type:'application/pdf'});}));}
export const save=async(bytes:Uint8Array)=>savePDF(bytes,(window as unknown as {showSaveFilePicker?:SavePicker}).showSaveFilePicker?.bind(window));
