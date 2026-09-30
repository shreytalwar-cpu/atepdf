import type {EngineRequest,EngineResult,Inspection,OCRPage} from './types';
import {LIMITS} from './types';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import {identifyPage,readPageBoxes} from './page-structure';

export function runWorker<T=EngineResult>(request:EngineRequest,signal:AbortSignal,progress:(text:string)=>void=()=>{}):Promise<T>{
  return new Promise((resolve,reject)=>{
    signal.throwIfAborted();
    const worker=new Worker('/engines/atepdf.worker.js',{type:'module'});
    const finish=(error?:Error,result?:T)=>{clearTimeout(timer);signal.removeEventListener('abort',abort);worker.terminate();if(error)reject(error);else resolve(result!);};
    const abort=()=>finish(new DOMException('Cancelled','AbortError'));
    const timer=setTimeout(()=>finish(new Error('Processing took too long. Try fewer files.')),120_000);
    signal.addEventListener('abort',abort,{once:true});
    worker.onmessage=e=>{if(e.data.type==='progress')progress(e.data.text);else if(e.data.type==='done')finish(undefined,e.data.result);else finish(new Error(e.data.message));};
    worker.onerror=()=>finish(new Error('The local PDF worker could not start.'));
    worker.postMessage(request);
  });
}
export async function openPDF(bytes:Uint8Array,signal:AbortSignal):Promise<PDFDocumentProxy>{
  signal.throwIfAborted();
  const pdfjs=await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc='/engines/pdf.worker.min.mjs';
  const task=pdfjs.getDocument({data:bytes.slice(),useSystemFonts:false,disableFontFace:true,stopAtErrors:true,verbosity:0,standardFontDataUrl:'/engines/standard_fonts/',cMapUrl:'/engines/cmaps/',cMapPacked:true,wasmUrl:'/engines/wasm/',maxImageSize:LIMITS.pixels});
  const abort=()=>{void task.destroy();};signal.addEventListener('abort',abort,{once:true});
  task.onPassword=()=>{void task.destroy();};
  try {return await task.promise;} catch {throw new Error('Independent PDF validation failed. The original is unchanged.');}
  finally {signal.removeEventListener('abort',abort);}
}
export async function inspect(bytes:Uint8Array,signal:AbortSignal):Promise<Inspection>{
  const doc=await openPDF(bytes,signal),pages:Inspection['pages']=[];
  const abort=()=>{void doc.loadingTask.destroy();};signal.addEventListener('abort',abort,{once:true});
  try{
    if(doc.numPages<1||doc.numPages>LIMITS.pages)throw new Error('Use 1–100 pages.');
    const boxes=await readPageBoxes(bytes),physical=[];
    if(boxes.length!==doc.numPages)throw new Error('Page geometry verification failed. No new result was committed.');
    for(let n=1;n<=doc.numPages;n++){
      signal.throwIfAborted();const page=await doc.getPage(n),view=page.getViewport({scale:1});
      const content=await page.getTextContent();
      // Walk the display list too: a page count alone does not establish renderability.
      await page.getOperatorList();
      physical.push(await identifyPage(page,boxes[n-1],document.createElement('canvas'),signal));
      pages.push({text:content.items.map(i=>'str' in i?i.str:'').join(' ').replace(/\s+/g,' ').trim(),width:view.width,height:view.height,rotation:page.rotate});page.cleanup();
    }
    return {pages,structure:{version:1,reader:'pdfjs-raster96-v1',pages:physical}};
  }finally{signal.removeEventListener('abort',abort);await doc.loadingTask.destroy();}
}

// Tesseract termination does not settle its outstanding recognition promise.
// Race each task with cancellation and dispose a worker that initialises late.
function cancellable<T>(task: Promise<T>, signal: AbortSignal, late?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Cancelled', 'AbortError'));
    signal.addEventListener('abort', abort, {once: true});
    if (signal.aborted) abort();
    task.then(value => {if (signal.aborted) late?.(value); else resolve(value);}, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}

export async function recognize(bytes:Uint8Array,inspection:Inspection,signal:AbortSignal,progress:(text:string)=>void):Promise<OCRPage[]>{
  const needed=inspection.pages.flatMap((p,i)=>p.text.trim()?[]:[i+1]);
  if(!needed.length)return [];
  if(needed.length>15)throw new Error('Use no more than 15 scanned pages per OCR job.');
  const {createWorker}=await import('tesseract.js');
  const doc=await openPDF(bytes,signal);
  let worker:Awaited<ReturnType<typeof createWorker>>|undefined;
  const abort=()=>{void worker?.terminate();void doc.loadingTask.destroy();};
  signal.addEventListener('abort',abort,{once:true});
  try{
    progress('Loading on-device English recognition');
    worker=await cancellable(createWorker('eng',1,{workerPath:'/engines/tesseract-worker.min.js',corePath:'/engines',langPath:'/engines',gzip:true,cacheMethod:'none',workerBlobURL:false,logger:m=>{if(!signal.aborted&&m.status==='recognizing text')progress(`Recognising English · ${Math.round(m.progress*100)}%`);}}),signal,late=>{void late.terminate();});
    signal.throwIfAborted();
    const output:OCRPage[]=[];
    for(const n of needed){
      signal.throwIfAborted();const page=await doc.getPage(n);
      const base=page.getViewport({scale:1});
      if(page.rotate!==0||page.view[0]!==0||page.view[1]!==0)throw new Error('OCR currently needs unrotated pages with an origin-aligned crop box.');
      const scale=Math.min(2.5,Math.sqrt(LIMITS.pixels/(base.width*base.height))),viewport=page.getViewport({scale});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      try{
        await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport}).promise;
        const {data}=await cancellable(worker.recognize(canvas,{}, {blocks:true,text:true}),signal);
        signal.throwIfAborted();
        const words=(data.blocks??[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.flatMap(l=>l.words))).filter(w=>w.text.trim());
        if(!words.length||data.confidence<45)throw new Error('Recognition was not reliable enough. No output was committed.');
        output.push({page:n,words:words.map(w=>({text:w.text,x:w.bbox.x0/scale,y:base.height-w.bbox.y1/scale,width:(w.bbox.x1-w.bbox.x0)/scale,height:(w.bbox.y1-w.bbox.y0)/scale}))});
        progress(`Recognised page ${n} of ${doc.numPages}`);
      }finally{canvas.width=canvas.height=0;page.cleanup();}
    }
    return output;
  }finally{signal.removeEventListener('abort',abort);await worker?.terminate();await doc.loadingTask.destroy();}
}
