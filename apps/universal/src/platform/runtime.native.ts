import {Platform} from 'react-native';
import {JobController,releaseInputFiles,type LocalInputFile} from '@core/job-controller';
import {LocalFileStore} from '@core/local-file-store';
import {preflight,transform} from '@pdf/engine';
import type {EngineRequest,Inspection,OCRPage} from '@pdf/types';
import type {Operation} from '@contracts/protocol';
import * as DocumentPicker from 'expo-document-picker';
import {File,Directory,Paths} from 'expo-file-system';
import {Asset} from 'expo-asset';
import * as Sharing from 'expo-sharing';
import {encodeToBase64,decodeFromBase64} from 'pdf-lib';
import NativePDF from '../../modules/atepdf-pdf';
import {withNativeCancellation} from './native-cancellation';

const storageIsolated=NativePDF?.storageIsolated===true;
export const nativeEngineReady=storageIsolated&&NativePDF?.readerAvailable===true;
export const ocrAvailable=nativeEngineReady&&NativePDF?.ocrAvailable===true;
const requireReader=()=>{if(!nativeEngineReady||!NativePDF)throw new Error('Local PDF processing is unavailable in this build. Your files stay on this device.');return NativePDF;};
const scratch=new Directory(Paths.cache,'atepdf-work');
const pickerCache=new Directory(Paths.cache,'DocumentPicker');
const inside=(file:File,directory:Directory)=>file.uri.startsWith(`${directory.uri.replace(/\/+$/,'')}/`);
export function removeTemporary(file:File){if(!storageIsolated)return;try{if(file.exists)file.delete();}catch{/* OS cache eviction/startup cleanup remains available; never expose local paths. */}}
function cleanFiles(directory:Directory){try{if(directory.exists)for(const entry of directory.list())if(entry instanceof File)removeTemporary(entry);}catch{/* Cache cleanup must not prevent the application from opening. */}}
// These app-private locations hold disposable copies only, never user-chosen saved originals.
// Picker copies left by an interrupted import are removed too (ADR 0010 startup cleanup).
if(storageIsolated)for(const directory of [scratch,new Directory(Paths.cache,'atepdf-preview'),new Directory(Paths.cache,'atepdf-previews'),pickerCache])cleanFiles(directory);
export function temporaryPDF(bytes:Uint8Array){
  requireReader();
  const file=new File(scratch,`${crypto.randomUUID()}.pdf`);
  try{scratch.create({intermediates:true,idempotent:true});file.create();file.write(bytes);return file;}
  catch{removeTemporary(file);throw new Error('This PDF could not be prepared in local storage. Your original is unchanged.');}
}
async function withPDF<T>(bytes:Uint8Array,signal:AbortSignal,work:(uri:string)=>Promise<T>):Promise<T>{
  signal.throwIfAborted();const reader=requireReader(),file=temporaryPDF(bytes);
  try{return await withNativeCancellation(signal,()=>reader.cancelAsync(),()=>work(file.uri));}
  finally{removeTemporary(file);}
}
const check=async(bytes:Uint8Array)=>{
  const doc=await preflight(bytes);
  if(Platform.OS==='android'){
    const {assertAndroidGeometry}=await import('./android-preflight');
    assertAndroidGeometry(doc);
  }
  return doc;
};
export const createController=()=>new JobController(new LocalFileStore(),{
  capabilities:(!nativeEngineReady?[]:ocrAvailable?['merge_pdf','select_pages','ocr_pdf','compress_pdf']:['merge_pdf','select_pages','compress_pdf']) as Operation[],
  worker:async(request:EngineRequest,signal:AbortSignal,progress=()=>{})=>{
    signal.throwIfAborted();requireReader();
    if(request.kind==='inspect')return {pages:(await check(request.bytes)).getPageCount()};
    for(const input of request.inputs)await check(input.bytes);
    const checkpoint=async()=>{await new Promise(resolve=>setTimeout(resolve,0));signal.throwIfAborted();};
    const result=await transform(request,progress,{checkpoint,reencodeJPEG:async(bytes,width,height)=>{
      await checkpoint();const output=await requireReader().reencodeJpegAsync(encodeToBase64(bytes),width,height,.82);await checkpoint();return decodeFromBase64(output);
    }});signal.throwIfAborted();return result;
  },
  inspect:async(bytes:Uint8Array,signal:AbortSignal):Promise<Inspection>=>{
    const admitted=await check(bytes),inspection=await withPDF(bytes,signal,uri=>requireReader().inspectAsync(uri));
    // Android reports integer point dimensions. Retain exact admitted box values
    // as supplementary geometry evidence; native pixels remain independent.
    if(Platform.OS==='android'&&inspection.structure)inspection.structure.pages=inspection.structure.pages.map((p,i)=>({
      ...p,mediaBox:admitted.getPage(i).getMediaBox(),cropBox:admitted.getPage(i).getCropBox(),
    }));
    signal.throwIfAborted();return inspection;
  },
  recognize:(bytes:Uint8Array,_inspection:Inspection,signal:AbortSignal,progress:(text:string)=>void):Promise<OCRPage[]>=>{
    if(!ocrAvailable)throw new Error('On-device text recognition is not available in this build. Your files stay here.');
    progress('Recognising English on your device');return withPDF(bytes,signal,uri=>requireReader().recognizeAsync(uri));
  },
});
export async function chooseFiles(signal?:AbortSignal){
  signal?.throwIfAborted();
  requireReader();let result:Awaited<ReturnType<typeof DocumentPicker.getDocumentAsync>>;
  try{result=await DocumentPicker.getDocumentAsync({type:'application/pdf',multiple:true,copyToCacheDirectory:true});}
  catch{throw new Error('The selected PDFs could not be copied into local storage. Try again.');}
  if(result.canceled)return [];
  const files:(Omit<LocalInputFile,'size'>&{size:number})[]=[];
  try{
    // Register every returned handle before any fallible metadata read. A size
    // failure on one copy still releases later, unread picker copies.
    for(const asset of result.assets){
      files.push({name:asset.name,size:0,arrayBuffer:()=>new File(asset.uri).arrayBuffer(),release:()=>{const file=new File(asset.uri);if(inside(file,pickerCache))removeTemporary(file);}});
    }
    for(const [index,input] of files.entries())input.size=new File(result.assets[index].uri).size;
    if(signal?.aborted){await releaseInputFiles(files);return [];}
    return files as unknown as globalThis.File[];
  }catch{await releaseInputFiles(files);throw new Error('The selected PDFs could not be opened. Try again.');}
}
export async function sampleFiles(signal?:AbortSignal){
  signal?.throwIfAborted();
  requireReader();const modules=[require('../../assets/fixtures/brief.pdf'),require('../../assets/fixtures/appendix.pdf')];
  return Promise.all(modules.map(async(module,index)=>{
    const asset=Asset.fromModule(module);await asset.downloadAsync();if(!asset.localUri)throw new Error('Bundled sample unavailable.');
    const file=new File(asset.localUri),size=file.size;
    return {name:['brief.pdf','appendix.pdf'][index],size,arrayBuffer:()=>file.arrayBuffer()} as unknown as globalThis.File;
  }));
}
export async function save(bytes:Uint8Array):Promise<'saved'|'cancelled'|'shared'>{
  const reader=requireReader();
  if(reader.exportAvailable===true){
    const file=temporaryPDF(bytes);
    try{
      if(!reader.exportPDFAsync)throw new Error('Native export is unavailable.');
      const outcome=await reader.exportPDFAsync(file.uri);
      if(outcome!=='saved'&&outcome!=='cancelled')throw new Error('Native export did not confirm completion.');
      return outcome;
    }catch{throw new Error('The PDF could not be saved. Your result remains available here.');}
    finally{removeTemporary(file);}
  }
  if(!await Sharing.isAvailableAsync())throw new Error('System sharing is not available.');
  const file=temporaryPDF(bytes);
  // Some share targets read after the sheet closes. Keep this disposable copy until next startup.
  try{await Sharing.shareAsync(file.uri,{mimeType:'application/pdf',UTI:'com.adobe.pdf',dialogTitle:'Save or share your PDF'});return 'shared';}
  catch{removeTemporary(file);throw new Error('The share sheet could not open. Your PDF remains available here.');}
}
