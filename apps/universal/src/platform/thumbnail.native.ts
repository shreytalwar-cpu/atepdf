import {File} from 'expo-file-system';
import NativePDF from '../../modules/atepdf-pdf';
import {temporaryPDF,removeTemporary} from './runtime.native';

// First-page thumbnails (COMPONENT_INVENTORY C6), rendered locally by PDFKit. The rendered
// file is read into memory and removed at once, so thumbnails leave nothing on disk.
export async function renderThumbnail(bytes:Uint8Array,maxDimension:number,signal:AbortSignal):Promise<string>{
  if(!NativePDF?.readerAvailable)throw new Error('Thumbnails are unavailable.');
  signal.throwIfAborted();
  const source=temporaryPDF(bytes);let rendered:File|undefined;
  try{
    const result=await NativePDF.renderPageAsync(source.uri,1,maxDimension);rendered=new File(result.uri);
    signal.throwIfAborted();
    return `data:image/png;base64,${await rendered.base64()}`;
  }finally{removeTemporary(source);if(rendered)removeTemporary(rendered);}
}
