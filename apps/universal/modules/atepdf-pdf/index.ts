import {requireOptionalNativeModule} from 'expo';
import type {Inspection,OCRPage} from '@pdf/types';
export type NativePDFModule={
  storageIsolated:boolean;
  readerAvailable:boolean;
  ocrAvailable:boolean;
  exportAvailable?:boolean;
  exportPDFAsync?(uri:string):Promise<'saved'|'cancelled'>;
  // Mac Catalyst private workspace (SHR-39). Plaintext crosses as base64; the key never does.
  workspaceAvailable?:boolean;
  workspaceKeyStatusAsync?(create:boolean):Promise<'ready'|'missing'|'locked'|'unavailable'>;
  workspaceExistsAsync?(name:string):Promise<boolean>;
  workspaceWriteSealedAsync?(name:string,base64:string,associatedData:string):Promise<void>;
  workspaceReadOpenedAsync?(name:string,associatedData:string):Promise<{status:'ok'|'missing'|'auth'|'locked';base64?:string}>;
  workspaceListAsync?(directory:'blobs'|'manifests'):Promise<string[]>;
  workspaceRemoveAsync?(name:string):Promise<void>;
  workspaceSyncDirectoryAsync?(directory:'blobs'|'manifests'):Promise<void>;
  workspaceCleanStagingAsync?():Promise<void>;
  workspaceUsageAsync?():Promise<{name:string;bytes:number}[]>;
  inspectAsync(uri:string):Promise<Inspection>;
  renderPageAsync(uri:string,page:number,maxDimension:number):Promise<{uri:string;width:number;height:number}>;
  recognizeAsync(uri:string):Promise<OCRPage[]>;
  reencodeJpegAsync(base64:string,width:number,height:number,quality:number):Promise<string>;
  cancelAsync():Promise<void>;
};
export default requireOptionalNativeModule<NativePDFModule>('AtepdfPdf');
