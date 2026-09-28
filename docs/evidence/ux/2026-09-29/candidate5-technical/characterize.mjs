import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const out=path.resolve('.build/ux-20260929/candidate-assessment-b');
const result={cases:[],savedPDFs:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const [label,width,height,rootFont,scale] of [['zoom200-equivalent',720,500,'100%',2],['text200-desktop',1440,1000,'200%',1]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:scale,reducedMotion:'reduce'}),page=await context.newPage(),r={label,width,height,rootFont,scale};result.cases.push(r);
  await context.route('**/*',route=>{let u=new URL(route.request().url());return u.origin==='http://localhost:3213'&&!(u.pathname==='/api/planner'&&route.request().method()==='POST')?route.continue():route.abort()});
  await page.goto('http://localhost:3213');await page.getByRole('button',{name:'Choose files',exact:true}).waitFor();await page.evaluate(v=>document.documentElement.style.fontSize=v,rootFont);
  await page.screenshot({path:path.join(out,label+'-empty.png'),fullPage:true});
  await page.getByLabel('Choose PDF files').setInputFiles(['tests/fixtures/brief.pdf','tests/fixtures/appendix.pdf']);await page.getByText('Your 2 PDFs are ready.',{exact:false}).waitFor();await page.getByRole('button',{name:'Merge',exact:true}).click();await page.getByTestId('result-facts').filter({hasText:'3 pages'}).waitFor();
  r.mergeGeometry=await page.evaluate(()=>{const b=s=>{let e=document.querySelector(s),r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height}:null};return {rootScroll:document.documentElement.scrollWidth,rootWidth:innerWidth,rootHeight:innerHeight,conversation:b('[data-testid="conversation"]'),composer:b('.aui-composer-shell'),result:b('[data-testid="current-result"]')}});await page.screenshot({path:path.join(out,label+'-merged.png'),fullPage:true});
  await page.getByTestId('current-result').getByRole('button',{name:'Preview',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.inline-page')?.getAttribute('aria-busy')==='false');await page.screenshot({path:path.join(out,label+'-preview.png'),fullPage:true});
  await page.getByRole('button',{name:'Next page',exact:true}).click({timeout:4000});await page.waitForFunction(()=>document.querySelector('.inline-page-count')?.textContent==='Page 2 of 3'&&document.querySelector('.inline-page')?.getAttribute('aria-busy')==='false');r.nextPage=true;
  await page.getByRole('button',{name:'Close preview',exact:true}).focus();await page.keyboard.press('Enter');r.keyboardCloseFocus=await page.evaluate(()=>({name:document.activeElement.getAttribute('aria-label'),visible:document.activeElement.matches(':focus-visible'),outline:getComputedStyle(document.activeElement).outline}));
  await context.close();
 }
}catch(e){result.error=e.message;process.exitCode=1}finally{await browser.close();await fs.writeFile(path.join(out,'characterization.json'),JSON.stringify(result,null,2));}
for(const label of ['320','390','768','1440']){
 const bytes=await fs.readFile(path.join(out,label+'-merged.pdf'));const pdf=await getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:true}).promise;
 const pages=[];for(let i=1;i<=pdf.numPages;i++){let p=await pdf.getPage(i);pages.push((await p.getTextContent()).items.map(x=>x.str??'').join(' '));}result.savedPDFs.push({label,pages:pdf.numPages,text:pages});await pdf.loadingTask.destroy();
}
await fs.writeFile(path.join(out,'characterization.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
