import {JobController} from '../../packages/core/src/job-controller';
import {LocalFileStore} from '../../packages/core/src/local-file-store';
import {runWorker,inspect,recognize} from '../../packages/web-pdf/src/client';
import type {OCRPage} from '../../packages/web-pdf/src/types';

async function base64(bytes:Uint8Array):Promise<string>{
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Test artifact encoding failed.'));
    reader.onload=()=>resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(new Blob([new Uint8Array(bytes)]));
  });
}
async function checksum(bytes:Uint8Array):Promise<string>{
  const hash=await crypto.subtle.digest('SHA-256',new Uint8Array(bytes));
  return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function runCase(ids:string[],action:'merge'|'remove'|'ocr'|'compress'){
  const store=new LocalFileStore();
  let recognized:OCRPage[]=[];
  const controller=new JobController(store,{
    worker:runWorker,inspect,
    recognize:async(...args)=>{recognized=await recognize(...args);return recognized;},
  });
  const files=await Promise.all(ids.map(async id=>{
    const response=await fetch('/fixtures/'+id);
    if(!response.ok)throw new Error('Fixture unavailable.');
    return new File([await response.arrayBuffer()],id+'.pdf',{type:'application/pdf'});
  }));
  await controller.import(files);
  const admission={status:controller.state.error?'rejected':'admitted',reason:controller.state.error};
  const originalsBefore=await Promise.all(store.originals.map(ref=>checksum(store.get(ref).bytes)));
  const inputChecksums=await Promise.all(files.map(async file=>checksum(new Uint8Array(await file.arrayBuffer()))));
  const importedBytesMatch=store.originals.every((_,index)=>originalsBefore[index]===inputChecksums[index]);
  if(!controller.state.error)await controller.quick(action,2);
  const originalsAfter=await Promise.all(store.originals.map(ref=>checksum(store.get(ref).bytes)));
  const result=store.focus?store.get(store.focus):null;
  return {
    admission,error:controller.state.error,stage:controller.state.stage,
    promoted:Boolean(result),
    originalsUnchanged:importedBytesMatch&&JSON.stringify(originalsBefore)===JSON.stringify(originalsAfter),
    output:result?await base64(result.bytes):null,note:result?.meta.note??null,
    ocr:recognized.map(page=>({page:page.page,words:page.words.map(word=>word.text)})),
  };
}
(window as unknown as {runMatrixCase:typeof runCase}).runMatrixCase=runCase;
