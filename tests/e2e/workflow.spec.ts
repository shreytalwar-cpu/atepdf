import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const baseURL=process.env.ATEPDF_BASE_URL||'http://localhost:3210';
async function readPDF(bytes:Uint8Array){const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:bytes.slice(),verbosity:0,useSystemFonts:true}),doc=await task.promise;try{const pages=[];for(let n=1;n<=doc.numPages;n++){const p=await doc.getPage(n),text=await p.getTextContent();pages.push(text.items.map(i=>'str'in i?i.str:'').join(' '));}return pages;}finally{await task.destroy();}}
async function download(page:Page,name:string){const pending=page.waitForEvent('download');await page.getByTestId('current-result').getByRole('button',{name:'Save PDF',exact:true}).click();const d=await pending;await d.saveAs(`docs/evidence/${name}.pdf`);return new Uint8Array(await readFile(`docs/evidence/${name}.pdf`));}
test.beforeEach(async({page})=>{await page.addInitScript(()=>{Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true});});});
test('real merge → preview/save → remove physical page 2 → undo; local-only network',async({page})=>{
  const requests:{url:string;method:string;body:string|null;type:string}[]=[],errors:string[]=[];
  page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData(),type:r.resourceType()}));page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByRole('heading',{name:'Drop files here'})).toBeVisible();await page.screenshot({path:'docs/evidence/desktop-empty.png',fullPage:true});
  await page.getByRole('button',{name:'Try the two sample PDFs'}).click();await expect(page.getByText('brief.pdf',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  const merged=await download(page,'merged');const pages=await readPDF(merged);expect(pages.length).toBe(3);['A1','A2','B1'].forEach((m,i)=>expect(pages[i]).toContain(m));
  await page.getByTestId('current-result').getByRole('button',{name:'Preview',exact:true}).click();await expect(page.getByRole('region',{name:'Read-only preview'})).toBeVisible();await expect(page.getByTestId('current-result').getByRole('region',{name:'Read-only preview'})).toBeVisible();await expect(page.getByText('Rendering page…')).not.toBeVisible();await page.screenshot({path:'docs/evidence/preview.png'});await page.getByRole('button',{name:'Next page'}).click();await expect(page.getByText('Page 2 of 3')).toBeVisible();await page.getByRole('button',{name:'Zoom in'}).click();await page.getByRole('button',{name:'Close preview'}).click();
  await page.getByRole('textbox',{name:'Tell atepdf what to do'}).fill('Remove physical page 2 from the merged result.');await page.getByRole('button',{name:'Run local command'}).click();await expect(page.getByTestId('result-facts')).toContainText('2 pages');
  const removed=await download(page,'removed');const two=await readPDF(removed);expect(two).toHaveLength(2);expect(two[0]).toContain('A1');expect(two[1]).toContain('B1');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');const undo=await download(page,'undo');expect(createHash('sha256').update(undo).digest('hex')).toBe(createHash('sha256').update(merged).digest('hex'));
  await expect(page.getByTestId('assistant-message').filter({has:page.getByTestId('current-result')})).toHaveCount(1);await expect(page.getByTestId('user-message')).toContainText(['I’ve added 2 PDFs.', 'Merge my PDFs.', 'Remove physical page 2 from the merged result.', 'Undo the last change.']);await expect(page.getByTestId('previous-result')).toHaveCount(2);await page.getByText('Keep going with this result',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'docs/evidence/desktop-result.png',fullPage:true});
  expect(errors).toEqual([]);expect(requests.filter(r=>r.method!=='GET')).toEqual([]);expect(requests.filter(r=>!r.url.startsWith(baseURL+'/'))).toEqual([]);expect(requests.some(r=>r.url.includes('/api/planner'))).toBe(false);
  await writeFile('docs/evidence/network-merge.json',JSON.stringify(requests,null,2));
});
test('responsive workspace, keyboard height, privacy and save cancellation',async({page})=>{
  for(const [name,width,height]of [['phone',390,844],['compact',320,568],['tablet-portrait',820,1180],['tablet-landscape',1180,820],['keyboard',390,530]] as const){await page.setViewportSize({width,height});await page.goto('/');await page.getByRole('textbox',{name:'Tell atepdf what to do'}).focus();await page.screenshot({path:`docs/evidence/${name}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Processed on your device'}).click();await expect(page.getByRole('dialog')).toContainText('do not contact an AI provider');await page.getByRole('button',{name:'Got it'}).click();
  await page.getByRole('button',{name:'Try the two sample PDFs'}).click();await expect(page.getByText('brief.pdf',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  await page.evaluate(()=>Object.defineProperty(window,'showSaveFilePicker',{value:async()=>{throw new DOMException('Cancelled','AbortError');},configurable:true}));await page.getByTestId('current-result').getByRole('button',{name:'Save PDF',exact:true}).click();await expect(page.getByText('Ready · save cancelled')).toBeVisible();await page.screenshot({path:'docs/evidence/phone-result.png',fullPage:true});
  const response=await page.request.post('/api/planner',{data:{test:'disabled'}});expect(response.status()).toBe(503);
});
test('real merge → OCR → compression preserves text and produces a measured smaller PDF without egress',async({page})=>{
  const requests:{url:string;method:string;body:string|null}[]=[],errors:string[]=[];page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByLabel('Choose PDF files').setInputFiles(['tests/fixtures/mixed-text-and-scan.pdf','tests/fixtures/image-heavy.pdf']);await expect(page.getByText('image-heavy.pdf',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('4 pages');const merged=await download(page,'chain-before');
  await page.getByRole('button',{name:'Make searchable',exact:true}).click();await expect(page.getByText(/English text added/)).toBeVisible({timeout:120_000});const searchable=await download(page,'chain-searchable');
  const ocrText=await readPDF(searchable);expect(ocrText[0]).toContain('A1');expect(ocrText[1]).toMatch(/Paperwork\s+made\s+simple/i);expect(ocrText[1]).toContain('DEMO-0042');expect(ocrText[2]).toContain('B1');
  await page.getByRole('button',{name:'Compress',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByTestId('assistant-message').filter({has:page.getByRole('button',{name:'Create optimised copy'})})).toHaveCount(1);await page.getByRole('button',{name:'Create optimised copy'}).click();await expect(page.getByText(/Optimised .*JPEG/)).toBeVisible({timeout:120_000});const compressed=await download(page,'chain-final');
  expect(compressed.length).toBeLessThan(searchable.length);const final=await readPDF(compressed);expect(final).toEqual(ocrText);await page.screenshot({path:'docs/evidence/chain-result.png',fullPage:true});
  expect(errors).toEqual([]);expect(requests.filter(r=>r.method!=='GET'||!r.url.startsWith(baseURL+'/'))).toEqual([]);expect(requests.some(r=>r.url.includes('/api/'))).toBe(false);
  await writeFile('docs/evidence/chain-measurements.json',JSON.stringify({mergedBytes:merged.length,searchableBytes:searchable.length,compressedBytes:compressed.length,pages:4,searchPhraseVerified:true,originalTextPreserved:true},null,2));await writeFile('docs/evidence/network-chain.json',JSON.stringify(requests,null,2));
});
test('chat clarification, cancellation and discard guard keep committed results intact',async({page})=>{
  await page.goto('/');
  await page.getByLabel('Choose PDF files').setInputFiles(['tests/fixtures/mixed-text-and-scan.pdf','tests/fixtures/appendix.pdf']);
  await expect(page.getByText('Your 2 PDFs are ready.',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>!window.dispatchEvent(new Event('beforeunload',{cancelable:true})))).toBe(true);
  await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('4 pages');
  const before=await download(page,'cancel-before');
  await page.getByRole('textbox',{name:'Tell atepdf what to do'}).fill('Send this to someone');await page.getByRole('button',{name:'Run local command'}).click();await expect(page.getByText('Hosted AI is not connected yet,',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Compress',exact:true}).click();await page.getByRole('button',{name:'Keep working',exact:true}).click();await expect(page.getByTestId('previous-result')).toHaveCount(0);
  let release!:()=>void, arrived!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;}),requested=new Promise<void>(resolve=>{arrived=resolve;});
  await page.route('**/eng.traineddata.gz',async route=>{arrived();await gate;await route.continue();});
  await page.getByRole('button',{name:'Make searchable',exact:true}).click();await requested;
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByText('Cancelled. No new result was committed.')).toBeVisible();release();
  await expect(page.getByTestId('progress-message')).toHaveCount(0);const after=await download(page,'cancel-after');expect(after).toEqual(before);
  await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('previous-result')).toHaveCount(1);
  await page.getByRole('button',{name:'Start over'}).click();await expect(page.getByRole('button',{name:'Clear session'})).toBeVisible();await expect(page.getByTestId('current-result')).toHaveCount(1);
  await page.getByRole('button',{name:'Clear session'}).click();await expect(page.getByRole('heading',{name:'Drop files here'})).toBeVisible();await expect(page.getByTestId('conversation')).toHaveCount(0);
});
test('one chat recipe commits only the final merge → OCR → compression result',async({page})=>{
  await page.goto('/');await page.getByLabel('Choose PDF files').setInputFiles(['tests/fixtures/mixed-text-and-scan.pdf','tests/fixtures/image-heavy.pdf']);await expect(page.getByText('Your 2 PDFs are ready.',{exact:false})).toBeVisible();
  await page.getByRole('textbox',{name:'Tell atepdf what to do'}).fill('merge, OCR, compress');await page.getByRole('button',{name:'Run local command'}).click();await expect(page.getByTestId('current-result')).toHaveCount(0);await page.getByRole('button',{name:'Create optimised copy'}).click();
  await expect(page.getByText('Your merged, searchable and optimised copy is ready.')).toBeVisible({timeout:120_000});await expect(page.getByTestId('result-facts')).toContainText('4 pages');await expect(page.getByTestId('previous-result')).toHaveCount(0);
  const bytes=await download(page,'recipe-final'),text=await readPDF(bytes);expect(text).toHaveLength(4);expect(text[0]).toContain('A1');expect(text[1]).toMatch(/Paperwork\s+made\s+simple/i);expect(text[2]).toContain('B1');expect(bytes.length).toBeLessThan(1_000_000);
});
