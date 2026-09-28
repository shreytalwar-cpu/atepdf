import {JobController} from '@core/job-controller';
import {LocalFileStore} from '@core/local-file-store';
import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
// Native engine capabilities fail closed until independent native verification exists.
// No browser engine/WebView or cloud processing is substituted in the native app.
export const nativeEngineReady=false;
const unavailable=async():Promise<never>=>{throw new Error('Native PDF engine verification is not connected in this development build.');};
export const createController=()=>new JobController(new LocalFileStore(),{worker:unavailable,inspect:unavailable,recognize:unavailable});
export async function chooseFiles(){
  const result=await DocumentPicker.getDocumentAsync({type:'application/pdf',multiple:true,copyToCacheDirectory:true});
  if(result.canceled)return [];
  // File handles stay local. Do not pass picker metadata to a cloud transport.
  return result.assets.map(asset=>({name:asset.name,size:asset.size??0,arrayBuffer:()=>new File(asset.uri).arrayBuffer()} as unknown as globalThis.File));
}
export const sampleFiles=unavailable;
export const save=unavailable;
