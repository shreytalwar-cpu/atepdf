import {File,Directory,Paths} from 'expo-file-system';
import NativePDF from '../../modules/atepdf-pdf';
import type {TemporaryFiles} from './temporary.web';
export type {TemporaryFiles};

// atePDF's private, disposable copies in the app's own Caches folder: processing
// scratch and export handoff files, previews, and document-picker import copies.
// Never a file the user chose to keep or save; external folders are never listed.
const roots=()=>['atepdf-work','atepdf-preview','atepdf-previews','DocumentPicker'].map(name=>new Directory(Paths.cache,name));
function each(directory:Directory,visit:(file:File)=>void){
  if(!directory.exists)return;
  for(const entry of directory.list()){if(entry instanceof File)visit(entry);else if(entry instanceof Directory)each(entry,visit);}
}
const usage=()=>{
  try{let bytes=0;for(const root of roots())each(root,file=>{bytes+=file.size;});return bytes;}
  catch{return null;}
};
export const temporaryFiles:TemporaryFiles|null=NativePDF?.storageIsolated===true?{
  usage,
  clear(){
    let complete=true;
    for(const root of roots()){try{each(root,file=>{try{file.delete();}catch{complete=false;}});}catch{complete=false;}}
    // Removal is only reported when nothing is left to measure.
    return complete&&usage()===0;
  },
}:null;
