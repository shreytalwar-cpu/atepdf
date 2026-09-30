import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {Inspection} from '../../packages/web-pdf/src/types';
import {createRequire} from 'node:module';
import {identifyPage,readPageBoxes} from '../../packages/web-pdf/src/page-structure';
import {execFile} from 'node:child_process';
import {writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {promisify} from 'node:util';
const require=createRequire(import.meta.url);
const {createCanvas}=createRequire(require.resolve('pdfjs-dist/package.json'))('@napi-rs/canvas');

// Actual independent reader for synthetic controller tests, never a mocked verdict.
export async function independentPDF(bytes:Uint8Array,signal=new AbortController().signal):Promise<Inspection>{
  if(process.env.ATEPDF_PAGE_READER_BINARY){
    const scratch=process.env.ATEPDF_PAGE_READER_SCRATCH!;
    const path=join(scratch,'page-verification-'+crypto.randomUUID()+'.pdf');
    try{
      await writeFile(path,bytes);signal.throwIfAborted();
      const {stdout}=await promisify(execFile)(process.env.ATEPDF_PAGE_READER_BINARY,[
        resolve('tests/fixtures'),scratch,process.env.ATEPDF_NATIVE_EVIDENCE_DIR!,'inspect',path,
      ],{signal,timeout:125_000,maxBuffer:1024*1024});
      return JSON.parse(stdout) as Inspection;
    }finally{await rm(path,{force:true});}
  }
  const task=getDocument({data:bytes.slice(),useSystemFonts:true,verbosity:0,stopAtErrors:true});
  const abort=()=>{void task.destroy();};signal.addEventListener('abort',abort,{once:true});
  try{
    const doc=await task.promise,pages=[],physical=[],boxes=await readPageBoxes(bytes);
    for(let n=1;n<=doc.numPages;n++){
      signal.throwIfAborted();const p=await doc.getPage(n),v=p.getViewport({scale:1}),t=await p.getTextContent();
      pages.push({text:t.items.map(i=>'str'in i?i.str:'').join(' ').replace(/\s+/g,' ').trim(),width:v.width,height:v.height,rotation:p.rotate});
      physical.push(await identifyPage(p,boxes[n-1],createCanvas(1,1),signal));
      p.cleanup();
    }
    return {pages,structure:{version:1,reader:'pdfjs-raster96-v1',pages:physical}};
  }finally{signal.removeEventListener('abort',abort);await task.destroy();}
}
