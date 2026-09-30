// SHR-49 direct-library investigation. Never calls or modifies production admission.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const [root,out,deps]=process.argv.slice(2);
const require=createRequire(resolve(deps,'package.json'));
const {PDFDocument,PDFName,PDFArray}=require('pdf-lib');
const {getDocument,version}=await import(pathToFileURL(resolve(deps,'node_modules/pdfjs-dist/legacy/build/pdf.mjs')));
const n=PDFName.of;
const hash=b=>createHash('sha256').update(b).digest('hex');
const interactive=await readFile(resolve(root,'tests/fixtures/corpus/interactive.pdf'));
const tagged=await readFile(resolve(root,'tests/fixtures/corpus/tagged.pdf'));
const manifest=JSON.parse(await readFile(resolve(root,'tests/fixtures/corpus/manifest.json'),'utf8'));
const ordinary=await readFile(resolve(root,manifest.fixtures.find(f=>f.id==='ordinary-appendix').path));
await mkdir(out,{recursive:true});
async function observe(bytes){
 const task=getDocument({data:new Uint8Array(bytes),verbosity:0,stopAtErrors:true});
 try{
 const d=await task.promise,pages=[];
 for(let i=1;i<=d.numPages;i++){
  const p=await d.getPage(i),annotations=[];
  for(const a of await p.getAnnotations()){
   let targetPage=null,destinationError=null;
   if(Array.isArray(a.dest)&&a.dest[0])try{targetPage=(await d.getPageIndex(a.dest[0]))+1;}catch(e){destinationError=e.message;}
   annotations.push({subtype:a.subtype,rect:a.rect,url:a.url??null,unsafeUrl:a.unsafeUrl??null,dest:a.dest??null,targetPage,destinationError,fieldName:a.fieldName??null,fieldValue:a.fieldValue??null,contents:a.contentsObj?.str??null});
  }
  pages.push({ref:p.ref,text:(await p.getTextContent()).items.map(x=>x.str??'').join(' '),view:p.view,rotation:p.rotate,annotations,structure:await p.getStructTree()});
 }
 return {pages,outline:await d.getOutline(),fields:await d.getFieldObjects(),markInfo:await d.getMarkInfo()};
 }finally{await task.destroy();}
}
async function uriProjection(withP=false){
 const d=await PDFDocument.load(interactive,{updateMetadata:false});
 for(const k of ['AcroForm','Outlines','Names','StructTreeRoot'])d.catalog.delete(n(k));
 for(const p of d.getPages()){
  const a=p.node.lookupMaybe(n('Annots'),PDFArray);if(!a)continue;
  const keep=[];
  for(let i=0;i<a.size();i++){
   const ref=a.get(i),obj=d.context.lookup(ref),action=obj.lookup(n('A'));
   if(obj.get(n('Subtype'))?.toString()==='/Link'&&action?.get(n('S'))?.toString()==='/URI'){
    if(withP)obj.set(n('P'),p.ref);keep.push(ref);
   }
  }
  p.node.set(n('Annots'),d.context.obj(keep));
 }
 return d.save({useObjectStreams:true,updateFieldAppearances:false});
}
async function copy(inputs,remove){
 const d=await PDFDocument.create();
 for(const bytes of inputs){const src=await PDFDocument.load(bytes,{updateMetadata:false});
  const indices=src.getPageIndices().filter(i=>i!==remove);
  for(const page of await d.copyPages(src,indices))d.addPage(page);
 }
 return d.save({useObjectStreams:true,updateFieldAppearances:false});
}
const uri=await uriProjection(),uriP=await uriProjection(true),records=[];
const cases=[['interactive-input',interactive],['tagged-input',tagged],['uri-only-input',uri],['uri-with-P-input',uriP],
 ['interactive-merge',await copy([ordinary,interactive])],['interactive-remove-target',await copy([interactive],1)],
 ['tagged-merge',await copy([ordinary,tagged])],['uri-only-merge-offset',await copy([ordinary,uri])],
 ['uri-only-merge-first',await copy([uri,ordinary])],['uri-only-remove-target',await copy([uri],1)],
 ['uri-only-remove-link-page',await copy([uri],0)],['uri-with-P-merge-offset',await copy([ordinary,uriP])]];
for(const [id,bytes]of cases){await writeFile(resolve(out,id+'.pdf'),bytes);records.push({id,sha256:hash(bytes),byteLength:bytes.length,observation:await observe(bytes)});}
const report={scope:'Direct pdf-lib copyPages probe, not product support or Mac-app acceptance. URI inputs are test-only projections of SHR-45 interactive; removed catalog families are never stripped in production.',source:process.env.SHR49_SOURCE,pdfLib:require('pdf-lib/package.json').version,pdfjs:version,inputs:{interactive:hash(interactive),tagged:hash(tagged),ordinary:hash(ordinary)},originalHashesUnchanged:{interactive:hash(await readFile(resolve(root,'tests/fixtures/corpus/interactive.pdf')))===hash(interactive),tagged:hash(await readFile(resolve(root,'tests/fixtures/corpus/tagged.pdf')))===hash(tagged)},records};
await writeFile(resolve(out,'probe.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(records.map(r=>({id:r.id,pages:r.observation.pages.length,annots:r.observation.pages.map(p=>p.annotations.map(a=>({subtype:a.subtype,uri:a.unsafeUrl,targetPage:a.targetPage,destinationError:a.destinationError}))),outline:!!r.observation.outline,fields:!!r.observation.fields,structure:r.observation.pages.map(p=>!!p.structure)})),null,2));
