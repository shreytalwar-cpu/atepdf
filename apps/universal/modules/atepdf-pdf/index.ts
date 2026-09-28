import {requireOptionalNativeModule} from 'expo';
import type {Inspection,OCRPage} from '@pdf/types';
export type NativePDFModule={
  storageIsolated:boolean;
  readerAvailable:boolean;
  ocrAvailable:boolean;
  exportAvailable?:boolean;
  exportPDFAsync?(uri:string):Promise<'saved'|'cancelled'>;
  inspectAsync(uri:string):Promise<Inspection>;
  renderPageAsync(uri:string,page:number,maxDimension:number):Promise<{uri:string;width:number;height:number}>;
  recognizeAsync(uri:string):Promise<OCRPage[]>;
  reencodeJpegAsync(base64:string,width:number,height:number,quality:number):Promise<string>;
  cancelAsync():Promise<void>;
};
export default requireOptionalNativeModule<NativePDFModule>('AtepdfPdf');
