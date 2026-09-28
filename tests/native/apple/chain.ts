import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {preflight,transform} from '../../../packages/web-pdf/src/engine';
import type {EngineRequest,Inspection,OCRPage} from '../../../packages/web-pdf/src/types';
import {LocalFileStore} from '../../../packages/core/src/local-file-store';
import {JobController} from '../../../packages/core/src/job-controller';

async function main() {
const root=process.cwd(),scratch=process.argv[2],binary=process.argv[3];
assert(scratch&&binary,'Pass isolated scratch directory and compiled Apple harness');
const evidence=resolve(root,'docs/evidence/native'),fixtures=resolve(root,'tests/fixtures');
await mkdir(scratch,{recursive:true});
await copyFile(resolve(fixtures,'mixed-text-and-scan.pdf'),resolve(scratch,'mixed-text-and-scan.pdf'));
await copyFile(resolve(fixtures,'image-heavy.pdf'),resolve(scratch,'image-heavy.pdf'));
function apple(mode:string,...args:string[]) {
  const output=spawnSync(binary,[fixtures,scratch,evidence,mode,...args],{encoding:'utf8',timeout:125_000});
  assert.equal(output.status,0,`Apple ${mode} failed: ${output.stderr.slice(0,500)}`);
  return output.stdout.trim()?JSON.parse(output.stdout):undefined;
}
const inputPath=resolve(scratch,'mixed-text-and-scan.pdf');
const input=new Uint8Array(await readFile(inputPath));
const before=apple('inspect',inputPath) as Inspection;
const words=JSON.parse(await readFile(resolve(evidence,'apple-ocr-words.json'),'utf8')) as OCRPage[];
const ocr=await transform({kind:'transform',step:{id:'s_1',operation:'ocr_pdf',inputs:['local_input'],outputRef:'local_ocr',params:{languages:['eng'],existingText:'preserve',batchMode:'single'}},inputs:[{bytes:input,inspection:before}],ocrPages:words},()=>{});
const ocrPath=resolve(scratch,'ocr-output.pdf');await writeFile(ocrPath,ocr.bytes);
const after=apple('inspect',ocrPath) as Inspection;
assert.equal(after.pages.length,3);
assert.equal(after.pages[0].text,before.pages[0].text);
assert.equal(after.pages[2].text,before.pages[2].text);
assert.match(after.pages[1].text,/Paperwork made simple/);
assert.match(after.pages[1].text,/DEMO-0042/);
const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
const jsTask=getDocument({data:ocr.bytes.slice(),useSystemFonts:true,verbosity:0});
try {
  const jsDocument=await jsTask.promise,jsPage=await jsDocument.getPage(2),content=await jsPage.getTextContent();
  const jsText=content.items.map(item=>'str' in item?item.str:'').join(' ').replace(/\s+/g,' ').trim();
  assert.match(jsText,/Paperwork made simple/);assert.match(jsText,/DEMO-0042/);
} finally {await jsTask.destroy();}
for(let index=0;index<3;index++)for(const field of ['width','height','rotation'] as const)assert.equal(after.pages[index][field],before.pages[index][field]);
const beforeImage=apple('render',inputPath),afterImage=apple('render',ocrPath);
assert.deepEqual(await readFile(new URL(afterImage.uri)),await readFile(new URL(beforeImage.uri)),'Invisible OCR must preserve rendered pixels');
await copyFile(new URL(afterImage.uri),resolve(evidence,'apple-ocr-output.png'));
let codecCalls=0;
async function reencodeJPEG(bytes:Uint8Array,width:number,height:number) {
  const source=resolve(scratch,`jpeg-in-${codecCalls}.json`),target=resolve(scratch,`jpeg-out-${codecCalls++}.json`);
  await writeFile(source,JSON.stringify({base64:Buffer.from(bytes).toString('base64'),width,height}));
  apple('codec',source,target);
  return new Uint8Array(Buffer.from(JSON.parse(await readFile(target,'utf8')).base64,'base64'));
}
const heavyPath=resolve(scratch,'image-heavy.pdf'),heavy=new Uint8Array(await readFile(heavyPath));
const heavyInspection=apple('inspect',heavyPath) as Inspection;
const compressed=await transform({kind:'transform',step:{id:'s_1',operation:'compress_pdf',inputs:['local_heavy'],outputRef:'local_compressed',params:{preset:'balanced',batchMode:'single',targetBytes:null}},inputs:[{bytes:heavy,inspection:heavyInspection}]},()=>{},{reencodeJPEG,checkpoint:async()=>{}});
const compressedPath=resolve(scratch,'compressed-output.pdf');await writeFile(compressedPath,compressed.bytes);
const compressedInspection=apple('inspect',compressedPath) as Inspection;
assert(codecCalls>0,'Use real native codec');
assert(compressed.bytes.length<heavy.length,'Measured PDF reduction');
assert.deepEqual(compressedInspection,heavyInspection,'Text, pages and geometry remain');
const heavyRender=apple('render',heavyPath,'1'),compressedRender=apple('render',compressedPath,'1');
await copyFile(new URL(heavyRender.uri),resolve(evidence,'apple-compression-before.png'));
await copyFile(new URL(compressedRender.uri),resolve(evidence,'apple-compression-after.png'));
let nativeInvocation=0;
async function localFile(bytes:Uint8Array) {const path=resolve(scratch,`controller-${nativeInvocation++}.pdf`);await writeFile(path,bytes);return path;}
const store=new LocalFileStore();
const controller=new JobController(store,{
  worker:async(request:EngineRequest)=>request.kind==='inspect'?{pages:(await preflight(request.bytes)).getPageCount()}:transform(request,()=>{},{reencodeJPEG,checkpoint:async()=>{}}),
  inspect:async bytes=>apple('inspect',await localFile(bytes)),
  recognize:async bytes=>apple('recognize',await localFile(bytes)),
});
await controller.import(await Promise.all(['brief.pdf','scanned-note.pdf','appendix.pdf'].map(async name=>new File([await readFile(resolve(fixtures,name))],name))));
assert.equal(controller.state.error,null);
const hashes=store.originals.map(ref=>store.get(ref).meta.checksum);
await controller.quick('chain');assert.equal(controller.state.error,null);
const completed=store.focus!;assert.equal(store.get(completed).meta.pageCount,4);
const completedPages=store.get(completed).meta.inspection.pages;
for(const [index,marker] of ['A1','A2','S1','B1'].entries())assert.match(completedPages[index].text,new RegExp(marker));
assert.match(completedPages[2].text,/Paperwork made simple/);
await controller.quick('remove',2);assert.equal(controller.state.error,null);assert.equal(store.get(store.focus!).meta.pageCount,3);
assert.match(store.get(store.focus!).meta.inspection.pages[2].text,/B1/);
controller.undo();assert.equal(store.focus,completed);
assert.deepEqual(store.originals.map(ref=>store.get(ref).meta.checksum),hashes);
const report={syntheticOnly:true,passed:true,writer:'pdf-lib',independentReaders:['Apple PDFKit','PDF.js'],ocr:'Apple Vision',codec:'Apple ImageIO',ocrTextSearchPassed:true,digitalTextUnchanged:true,ocrRenderIdentical:true,geometryUnchanged:true,codecCalls,compressionBytesBefore:heavy.length,compressionBytesAfter:compressed.bytes.length,note:compressed.note,controllerChain:['import','merge','ocr','compress','independent validate','remove physical page2','undo'],controllerChainPages:completedPages.length,originalHashesUnchanged:true,scope:'Native helper plus shared writer/controller, not iOS UI/device test'};
await writeFile(resolve(evidence,'apple-shared-writer-tests.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
