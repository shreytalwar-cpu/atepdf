import fs from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import crypto from 'node:crypto';
const path=new URL('./merged-output.pdf',import.meta.url),data=new Uint8Array(fs.readFileSync(path));
const task=getDocument({data,isEvalSupported:false,useSystemFonts:true}); const pdf=await task.promise;
const pages=[];for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i),t=await p.getTextContent();pages.push({page:i,text:t.items.map(x=>x.str).join(' '),view:p.view,rotate:p.rotate});}
const result={independentReader:'pdfjs-dist legacy 6.3.289',writer:'application local pdf-lib engine',fileBytes:fs.statSync(path).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'),pageCount:pdf.numPages,pages};
fs.writeFileSync(new URL('./independent-reopen.json',import.meta.url),JSON.stringify(result,null,2));await task.destroy();console.log(JSON.stringify(result));
