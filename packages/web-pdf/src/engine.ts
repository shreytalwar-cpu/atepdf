import {PDFDocument,PDFName,PDFArray,PDFNumber,PDFRawStream,StandardFonts,TextRenderingMode,pushGraphicsState,popGraphicsState,setTextRenderingMode,decodePDFRawStream} from 'pdf-lib';
import type {EngineRequest,EngineResult} from './types';
import {LIMITS} from './types';
import {admitDrawingContent} from './content-admission';
const name=(n:string)=>PDFName.of(n);
export async function preflight(bytes:Uint8Array) {
  if(String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw new Error('Choose a valid PDF.');
  const doc=await PDFDocument.load(bytes,{updateMetadata:false,throwOnInvalidObject:true});
  if(doc.getPageCount()<1||doc.getPageCount()>LIMITS.pages)throw new Error('Use a PDF with 1–100 pages.');
  for(const key of ['AcroForm','StructTreeRoot','Collection','Outlines','Names','OpenAction','AA','Perms'])if(doc.catalog.has(name(key)))throw new Error('This PDF has document features this build cannot safely preserve. Your original is unchanged.');
  for(const page of doc.getPages()) {
    const annots=page.node.lookupMaybe(name('Annots'),PDFArray);
    if(annots?.size()||page.node.has(name('AA')))throw new Error('Annotated or linked PDFs are not supported by this build.');
    const {width,height}=page.getSize();
    if(!Number.isFinite(width*height)||width<10||height<10||width>4000||height>4000)throw new Error('This page is too large to process safely.');
  }
  // Bound decoded image dimensions before either preview or OCR can allocate them.
  for(const [,obj] of doc.context.enumerateIndirectObjects())if(obj instanceof PDFRawStream&&obj.dict.get(name('Subtype'))?.toString()==='/Image') {
    const w=obj.dict.lookupMaybe(name('Width'),PDFNumber)?.asNumber()??0,h=obj.dict.lookupMaybe(name('Height'),PDFNumber)?.asNumber()??0;
    if(w<1||h<1||w*h>LIMITS.pixels)throw new Error('An embedded image is too large. Use a smaller scan.');
  }
  admitDrawingContent(doc);
  return doc;
}
export type EnginePlatform={reencodeJPEG?:(bytes:Uint8Array,width:number,height:number)=>Promise<Uint8Array>;checkpoint?:()=>Promise<void>};
async function browserJPEG(jpeg:Uint8Array):Promise<Uint8Array>{
  const bitmap=await createImageBitmap(new Blob([new Uint8Array(jpeg)],{type:'image/jpeg'}));
  try{const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);canvas.getContext('2d')!.drawImage(bitmap,0,0);return new Uint8Array(await(await canvas.convertToBlob({type:'image/jpeg',quality:.82})).arrayBuffer());}
  finally{bitmap.close();}
}
export async function transform(request:Extract<EngineRequest,{kind:'transform'}>,progress:(text:string)=>void,platform:EnginePlatform={}):Promise<EngineResult> {
  const {step,inputs,ocrPages=[]}=request;
  const docs=await Promise.all(inputs.map(i=>preflight(i.bytes)));
  let output=docs[0],note='';
  if(step.operation==='merge_pdf') {
    output=await PDFDocument.create();
    for(let i=0;i<docs.length;i++){
      for(const page of await output.copyPages(docs[i],docs[i].getPageIndices()))output.addPage(page);
      progress(`Merged ${i+1} of ${docs.length} files`);await platform.checkpoint?.();
    }
  } else if(step.operation==='select_pages') {
    const indices=(step.params.pages as {indices:number[]}).indices;
    output=await PDFDocument.create();
    const kept=docs[0].getPageIndices().filter(i=>!indices.includes(i+1));
    if(!kept.length)throw new Error('Keep at least one page.');
    for(const page of await output.copyPages(docs[0],kept))output.addPage(page);
    progress('Page selection complete');
  } else if(step.operation==='ocr_pdf') {
    const font=await output.embedFont(StandardFonts.Helvetica);
    for(const entry of ocrPages){
      const page=output.getPage(entry.page-1);
      for(const word of entry.words){
        if(!word.text.trim())continue;
        if(/[^\x20-\x7e]/.test(word.text))throw new Error('This OCR result needs an unsupported text encoding. No output was committed.');
        const size=Math.max(1,word.height*0.82);
        const fontWidth=font.widthOfTextAtSize(word.text,size);
        page.pushOperators(pushGraphicsState(),setTextRenderingMode(TextRenderingMode.Invisible));
        // Horizontal scaling fits each recognised word to its measured source box.
        const {setCharacterSpacing,setWordSpacing,setCharacterSqueeze}=await import('pdf-lib');
        page.pushOperators(setCharacterSpacing(0),setWordSpacing(0),setCharacterSqueeze(fontWidth>0?word.width/fontWidth*100:100));
        // Explicit separators keep independent readers from concatenating nearby
        // word runs. Squeeze remains based on the measured word, not its space.
        page.drawText(`${word.text} `,{x:word.x,y:word.y+word.height*0.14,size,font});
        page.pushOperators(popGraphicsState());
      }
      progress(`Added searchable text to page ${entry.page}`);await platform.checkpoint?.();
    }
    note=ocrPages.length?`English text added to ${ocrPages.length} scanned page${ocrPages.length===1?'':'s'}. Review recognition in Preview.`:'Existing text preserved; no scanned pages needed OCR.';
  } else if(step.operation==='compress_pdf') {
    let changed=0;
    if(step.params.preset!=='lossless')for(const [ref,obj] of output.context.enumerateIndirectObjects()) {
      if(!(obj instanceof PDFRawStream)||obj.dict.get(name('Subtype'))?.toString()!=='/Image'||obj.dict.get(name('ColorSpace'))?.toString()!=='/DeviceRGB'||obj.dict.get(name('BitsPerComponent'))?.toString()!=='8')continue;
      if(['SMask','Mask','Decode','DecodeParms','ImageMask','Alternates','OPI','SMaskInData'].some(k=>obj.dict.has(name(k))))continue;
      const filter=obj.dict.get(name('Filter'));
      let jpeg=obj.contents;
      if(filter?.toString()!=='/DCTDecode'){
        if(!(filter instanceof PDFArray)||filter.size()!==2||filter.get(0).toString()!=='/ASCII85Decode'||filter.get(1).toString()!=='/DCTDecode')continue;
        const wrapper=obj.dict.clone(output.context);wrapper.set(name('Filter'),name('ASCII85Decode'));
        jpeg=decodePDFRawStream(PDFRawStream.of(wrapper,obj.contents)).decode();
      }
      const width=obj.dict.lookup(name('Width'),PDFNumber).asNumber(),height=obj.dict.lookup(name('Height'),PDFNumber).asNumber();
      const bytes=await(platform.reencodeJPEG??browserJPEG)(jpeg,width,height);
        if(bytes.length<obj.contents.length*0.95){
          const dictionary=obj.dict.clone(output.context);dictionary.set(name('Length'),PDFNumber.of(bytes.length));dictionary.set(name('Filter'),name('DCTDecode'));
          output.context.assign(ref,PDFRawStream.of(dictionary,bytes));changed++;
        }
      await platform.checkpoint?.();
    }
    note=changed?`Optimised ${changed} JPEG image${changed===1?'':'s'} at original dimensions. Text and vectors retained; review image quality.`:'Lossless object optimisation checked. No supported JPEG images needed re-encoding.';
    progress('Image and object optimisation complete');
  } else throw new Error('Operation unavailable.');
  await platform.checkpoint?.();
  const bytes=await output.save({useObjectStreams:true,updateFieldAppearances:false});
  if(step.operation==='compress_pdf'&&bytes.length>=inputs[0].bytes.length)return {bytes:inputs[0].bytes.slice(),note:'No useful reduction found. The previous PDF is retained unchanged.'};
  return {bytes,note,ocrPages};
}
