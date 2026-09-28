import fs from 'node:fs/promises';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const results=[];
for(const label of ['320','390','768','1440']){
 const bytes=await fs.readFile(`.build/ux-20260929/candidate-assessment-b/${label}-merged.pdf`),task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:true}),pdf=await task.promise;
 const pages=[];for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i);pages.push((await p.getTextContent()).items.map(x=>x.str??'').join(' '));}
 results.push({label,bytes:bytes.length,pages:pdf.numPages,text:pages});await task.destroy();
}
await fs.writeFile('.build/ux-20260929/candidate-assessment-b/independent-saved-validation.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
