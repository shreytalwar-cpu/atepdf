import {preflight,transform} from './engine';
import type {EngineRequest} from './types';
self.onmessage=async(event:MessageEvent<EngineRequest>)=>{
  try{
    if(event.data.kind==='inspect'){
      const doc=await preflight(event.data.bytes);self.postMessage({type:'done',result:{pages:doc.getPageCount()}});
    }else{
      const result=await transform(event.data,text=>self.postMessage({type:'progress',text}));
      self.postMessage({type:'done',result}, {transfer:[result.bytes.buffer]});
    }
  }catch(error){
    const message=error instanceof Error?error.message:'';
    // Never forward raw parser diagnostics, paths, bytes or OCR content to UI/logs.
    const safe=/^(Choose|Use a PDF|This PDF|Annotated|This page|An embedded|Keep at least|This OCR|Output is|Operation unavailable)/.test(message);
    self.postMessage({type:'error',message:safe?message:'This PDF could not be safely processed. It may be encrypted or damaged. Your original is unchanged.'});
  }
};
