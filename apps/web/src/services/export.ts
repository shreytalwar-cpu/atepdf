export type SaveOutcome='saved'|'cancelled'|'download-started';
export type SavePicker=(options:unknown)=>Promise<{createWritable:()=>Promise<{write:(bytes:Uint8Array)=>Promise<void>;close:()=>Promise<void>;abort:()=>Promise<void>}>}>;
export async function savePDF(bytes:Uint8Array,picker?:SavePicker):Promise<SaveOutcome>{
  if(picker){
    let stream:Awaited<ReturnType<Awaited<ReturnType<SavePicker>>['createWritable']>>|undefined;
    try{const handle=await picker({suggestedName:'atepdf-result.pdf',types:[{description:'PDF document',accept:{'application/pdf':['.pdf']}}]});stream=await handle.createWritable();await stream.write(bytes.slice());await stream.close();return 'saved';}
    catch(e){await stream?.abort().catch(()=>{});if(e instanceof DOMException&&e.name==='AbortError')return 'cancelled';throw new Error('Saving failed. Your result is still ready.');}
  }
  const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'}));
  const link=document.createElement('a');link.href=url;link.download='atepdf-result.pdf';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),60_000);return 'download-started';
}
