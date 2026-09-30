import type {PDFPageProxy} from 'pdfjs-dist';
import type {PhysicalPage} from './types';

export const IDENTITY_DIMENSION=96;
export async function readPageBoxes(bytes:Uint8Array){
  // PDF.js exposes the visible intersection, not the original Media/Crop boxes.
  // Supplementary dictionary checks use the existing writer library; pixel/text
  // identity still comes from the separate PDF.js reader, never the writer.
  try{
    const {PDFDocument}=await import('pdf-lib');
    const doc=await PDFDocument.load(bytes,{updateMetadata:false,throwOnInvalidObject:true});
    return doc.getPages().map(page=>({mediaBox:page.getMediaBox(),cropBox:page.getCropBox()}));
  }catch{throw new Error('Page geometry verification failed. No new result was committed.');}
}
export async function identifyPage(page:PDFPageProxy,boxes:Pick<PhysicalPage,'mediaBox'|'cropBox'>,
  canvas:HTMLCanvasElement,signal:AbortSignal):Promise<PhysicalPage>{
  signal.throwIfAborted();
  const base=page.getViewport({scale:1,rotation:0});
  const viewport=page.getViewport({scale:IDENTITY_DIMENSION/Math.max(base.width,base.height),rotation:0});
  canvas.width=Math.min(IDENTITY_DIMENSION,Math.max(1,Math.ceil(viewport.width)));
  canvas.height=Math.min(IDENTITY_DIMENSION,Math.max(1,Math.ceil(viewport.height)));
  const context=canvas.getContext('2d',{willReadFrequently:true});
  if(!context)throw new Error('Page identity verification is unavailable. No result was committed.');
  const rendering=page.render({canvas,canvasContext:context,viewport,background:'rgb(255,255,255)'});
  const abort=()=>rendering.cancel();signal.addEventListener('abort',abort,{once:true});
  try{
    if(signal.aborted)abort();await rendering.promise;signal.throwIfAborted();
    const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
    const identity=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(pixels)))].map(n=>n.toString(16).padStart(2,'0')).join('');
    signal.throwIfAborted();return {...boxes,rotation:page.rotate,identity};
  }finally{signal.removeEventListener('abort',abort);canvas.width=canvas.height=0;}
}
