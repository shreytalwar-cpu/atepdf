import {createHash} from 'node:crypto';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {PDFDict,PDFDocument,PDFName,PDFRawStream} from 'pdf-lib';

export const CLASSIFICATIONS=[
  'SUPPORTED','SAFELY_REJECTED','FAILED','FIDELITY_MISMATCH','UNVERIFIED','NOT_IMPLEMENTED','NOT_RUN',
] as const;
export type Classification=typeof CLASSIFICATIONS[number];
export function summarizeCases(rows:{classification:string}[]){
  if(rows.some(row=>!CLASSIFICATIONS.includes(row.classification as Classification)))throw new Error('Unknown matrix classification.');
  const counts=Object.fromEntries(CLASSIFICATIONS.map(kind=>[kind,rows.filter(row=>row.classification===kind).length]));
  return {total:rows.length,executed:rows.filter(row=>!['NOT_RUN','NOT_IMPLEMENTED'].includes(row.classification)).length,counts};
}
export type Check='passed'|'failed'|'not_run';
export type PageObservation={
  text:string;view:number[];rotation:number;imagePaints:number;
  mediaBox:{x:number;y:number;width:number;height:number};
  cropBox:{x:number;y:number;width:number;height:number};
  imageHashes:string[];fontResources:number;embeddedFontHashes:string[];
};
export type Observation={pages:PageObservation[];annotations:number[]};
export type Verification={reader:Check;structural:Check;visual:Check;issues:string[];actual?:Observation};
export const sha256=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const norm=(text:string)=>text.replace(/\s+/g,'').toLowerCase();
const near=(a:number,b:number)=>Math.abs(a-b)<0.02;
const boxEqual=(a:PageObservation['mediaBox'],b:PageObservation['mediaBox'])=>
  near(a.x,b.x)&&near(a.y,b.y)&&near(a.width,b.width)&&near(a.height,b.height);

/** PDF.js independently reopens bytes produced by the pdf-lib writer. */
export async function observe(bytes:Uint8Array):Promise<Observation>{
  const task=getDocument({data:bytes.slice(),stopAtErrors:true,verbosity:0,useSystemFonts:true});
  try{
    const reader=await task.promise;
    const structural=await PDFDocument.load(bytes,{updateMetadata:false,throwOnInvalidObject:true});
    const pages:PageObservation[]=[],annotations:number[]=[];
    for(let index=0;index<reader.numPages;index++){
      const page=await reader.getPage(index+1);
      const content=await page.getTextContent();
      const operators=await page.getOperatorList();
      const pdfPage=structural.getPage(index);
      const resources=pdfPage.node.Resources();
      const images=resources?.lookupMaybe(PDFName.of('XObject'),PDFDict);
      const fonts=resources?.lookupMaybe(PDFName.of('Font'),PDFDict);
      const embeddedFontHashes=(fonts?.entries()??[]).flatMap(([,ref])=>{
        const font=structural.context.lookup(ref,PDFDict);
        const descriptor=font.lookupMaybe(PDFName.of('FontDescriptor'),PDFDict);
        return ['FontFile','FontFile2','FontFile3'].flatMap(key=>{
          const stream=structural.context.lookup(descriptor?.get(PDFName.of(key)));
          return stream instanceof PDFRawStream?[sha256(stream.contents)]:[];
        });
      }).sort();
      const imageHashes=(images?.entries()??[]).flatMap(([,ref])=>{
        const object=structural.context.lookup(ref);
        return object instanceof PDFRawStream&&object.dict.get(PDFName.of('Subtype'))?.toString()==='/Image'
          ?[sha256(object.contents)]:[];
      }).sort();
      pages.push({
        text:content.items.map(item=>'str'in item?item.str:'').join(' ').replace(/\s+/g,' ').trim(),
        view:[...page.view],rotation:page.rotate,
        imagePaints:operators.fnArray.filter(op=>op===OPS.paintImageXObject||op===OPS.paintInlineImageXObject).length,
        mediaBox:pdfPage.getMediaBox(),cropBox:pdfPage.getCropBox(),
        imageHashes,fontResources:fonts?.entries().length??0,embeddedFontHashes,
      });
      annotations.push((await page.getAnnotations()).length);
      page.cleanup();
    }
    return {pages,annotations};
  }finally{await task.destroy();}
}

export async function verifyOutput(bytes:Uint8Array,expected:Observation,options:{
  addedWords?:Map<number,string>;allowImageReencode?:boolean;
}={}):Promise<Verification>{
  let actual:Observation;
  try{actual=await observe(bytes);}
  catch(error){return {reader:'failed',structural:'not_run',visual:'not_run',
    issues:[`Saved-output reader/structural inspection failed: ${error instanceof Error?error.message:String(error)}`]};}
  const issues:string[]=[];
  if(actual.pages.length!==expected.pages.length)issues.push(`page count ${actual.pages.length}; expected ${expected.pages.length}`);
  for(let i=0;i<Math.min(actual.pages.length,expected.pages.length);i++){
    const got=actual.pages[i],want=expected.pages[i],added=options.addedWords?.get(i+1);
    if(added?!norm(got.text).includes(norm(want.text)):norm(got.text)!==norm(want.text))issues.push(`page ${i+1} text/order changed`);
    if(added&&!norm(got.text).includes(norm(added)))issues.push(`page ${i+1} OCR marker missing`);
    if(got.view.length!==want.view.length||got.view.some((value,n)=>!near(value,want.view[n])))issues.push(`page ${i+1} visible box changed`);
    if(got.rotation!==want.rotation)issues.push(`page ${i+1} rotation changed`);
    if(!boxEqual(got.mediaBox,want.mediaBox)||!boxEqual(got.cropBox,want.cropBox))issues.push(`page ${i+1} media/crop geometry changed`);
    if(got.imagePaints!==want.imagePaints||got.imageHashes.length!==want.imageHashes.length)issues.push(`page ${i+1} image count changed`);
    if(!options.allowImageReencode&&got.imageHashes.join(',')!==want.imageHashes.join(','))issues.push(`page ${i+1} encoded image identity changed`);
    if(got.fontResources<want.fontResources)issues.push(`page ${i+1} font resources lost`);
    if(got.embeddedFontHashes.join(',')!==want.embeddedFontHashes.join(','))issues.push(`page ${i+1} embedded font bytes changed`);
    if(actual.annotations[i]!==expected.annotations[i])issues.push(`page ${i+1} annotations changed`);
  }
  return {reader:'passed',structural:issues.length?'failed':'passed',visual:'not_run',issues,actual};
}

// Only deliberate, specific application refusals qualify. Parser exceptions
// (including the current upstream encrypted-PDF error) remain failures.
export function specificRefusal(message:string):boolean{
  return [
    /^This PDF has document features this build cannot safely preserve\./,
    /^Annotated or linked PDFs are not supported by this build\./,
    /^Use a PDF with 1[–-]100 pages\./,
    /^This page is too large to process safely\./,
    /^An embedded image is too large\./,
    /^Inline-image PDFs are not supported by this build\./,
    /^This PDF uses drawing content this build cannot safely inspect\./,
    /^Use no more than 15 scanned pages per OCR job\./,
    /^OCR currently needs unrotated pages with an origin-aligned crop box\./,
    /^Keep at least one page\./,
    /^Keep between 1 and 100 pages\./,
    /^Recognition was not reliable enough\. No output was committed\./,
    /^The combined PDF would be too large to process safely\./,
  ].some(pattern=>pattern.test(message));
}

export function classify(input:{
  implemented:boolean;ran:boolean;error?:string;noPromotion?:boolean;originalUnchanged?:boolean;
  verification?:Verification;partialCoverage?:boolean;
}):Classification{
  if(!input.implemented)return 'NOT_IMPLEMENTED';
  if(!input.ran)return 'NOT_RUN';
  if(input.error)return specificRefusal(input.error)&&input.noPromotion===true&&input.originalUnchanged===true
    ?'SAFELY_REJECTED':'FAILED';
  if(!input.verification||input.verification.reader==='failed')return 'FAILED';
  if(input.originalUnchanged===false)return 'FAILED';
  if(input.verification.structural==='failed')return 'FIDELITY_MISMATCH';
  if(input.verification.reader!=='passed'||input.verification.structural!=='passed')return 'UNVERIFIED';
  if(input.partialCoverage)return 'UNVERIFIED';
  return 'SUPPORTED';
}
