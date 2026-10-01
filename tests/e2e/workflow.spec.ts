import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {composer,send,startOver,emptyWorkspace} from './ui';
const baseURL=process.env.ATEPDF_BASE_URL||'http://localhost:3210';
async function readPDF(bytes:Uint8Array){const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:bytes.slice(),verbosity:0,useSystemFonts:true}),doc=await task.promise;try{const pages=[];for(let n=1;n<=doc.numPages;n++){const p=await doc.getPage(n),text=await p.getTextContent();pages.push(text.items.map(i=>'str'in i?i.str:'').join(' '));}return pages;}finally{await task.destroy();}}
async function download(page:Page,name:string){const pending=page.waitForEvent('download');await page.getByTestId('current-result').getByRole('button',{name:'Save PDF',exact:true}).click();const d=await pending;await d.saveAs(`docs/evidence/${name}.pdf`);return new Uint8Array(await readFile(`docs/evidence/${name}.pdf`));}
test.beforeEach(async({page})=>{await page.addInitScript(()=>{Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true});});await page.route('**/api/planner/status',route=>route.fulfill({json:{connected:false,enabled:false,remaining:0,token:'test-only-csrf',model:'gpt-6-luna'}}));});
test('real merge → preview/save → remove physical page 2 → undo; local-only network',async({page})=>{
  const requests:{url:string;method:string;body:string|null;type:string}[]=[],errors:string[]=[];
  page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData(),type:r.resourceType()}));page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(emptyWorkspace(page)).toBeVisible();await page.screenshot({path:'docs/evidence/desktop-empty.png',fullPage:true});
  await page.getByRole('button',{name:'Try with sample PDFs'}).click();await expect(page.getByTestId('conversation').getByText('brief.pdf',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  const merged=await download(page,'merged');const pages=await readPDF(merged);expect(pages.length).toBe(3);['A1','A2','B1'].forEach((m,i)=>expect(pages[i]).toContain(m));
  await page.getByTestId('current-result').getByRole('button',{name:'Preview',exact:true}).click();await expect(page.getByRole('region',{name:'Read-only preview'})).toBeVisible();await expect(page.getByRole('dialog').getByRole('region',{name:'Read-only preview'})).toBeVisible();await expect(page.getByText('Rendering page…')).not.toBeVisible();await page.screenshot({path:'docs/evidence/preview.png'});await page.getByRole('button',{name:'Next page'}).click();await expect(page.getByText('Page 2 of 3')).toBeVisible();await page.getByRole('button',{name:'Zoom in'}).click();await page.getByRole('button',{name:'Close preview'}).click();
  await composer(page).fill('Remove physical page 2 from the merged result.');await page.getByRole('button',{name:'Send message'}).click();await expect(page.getByTestId('result-facts')).toContainText('2 pages');
  const removed=await download(page,'removed');const two=await readPDF(removed);expect(two).toHaveLength(2);expect(two[0]).toContain('A1');expect(two[1]).toContain('B1');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');const undo=await download(page,'undo');expect(createHash('sha256').update(undo).digest('hex')).toBe(createHash('sha256').update(merged).digest('hex'));
  await expect(page.getByTestId('assistant-message').filter({has:page.getByTestId('current-result')})).toHaveCount(1);await expect(page.getByTestId('user-message')).toContainText(['Added 2 PDFs', 'Combine these PDFs', 'Remove physical page 2 from the merged result.', 'Undo the last change.']);await expect(page.getByTestId('previous-result')).toHaveCount(2);await page.getByTestId('current-result').scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Remove page 2',exact:true})).toHaveCount(0);await page.screenshot({path:'docs/evidence/desktop-result.png',fullPage:true});
  expect(errors).toEqual([]);expect(requests.filter(r=>r.method!=='GET')).toEqual([]);expect(requests.filter(r=>!r.url.startsWith(baseURL+'/'))).toEqual([]);expect(requests.filter(r=>r.url.includes('/api/planner')&&!r.url.includes('/api/planner/status'))).toEqual([]);
  await writeFile('docs/evidence/network-merge.json',JSON.stringify(requests,null,2));
});
test('responsive workspace, keyboard height, privacy and save cancellation',async({page})=>{
  for(const [name,width,height]of [['phone',390,844],['compact',320,568],['tablet-portrait',820,1180],['tablet-landscape',1180,820],['keyboard',390,530]] as const){await page.setViewportSize({width,height});await page.goto('/');await composer(page).focus();await page.screenshot({path:`docs/evidence/${name}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);const input=await composer(page).boundingBox();const more=await page.getByRole('button',{name:'More',exact:true}).boundingBox();expect(input!.y).toBeGreaterThan(more!.y+more!.height);expect(more!.x+more!.width).toBeLessThanOrEqual(width);await page.getByRole('button',{name:'Try with sample PDFs'}).scrollIntoViewIfNeeded();const sample=await page.getByRole('button',{name:'Try with sample PDFs'}).boundingBox();expect(sample!.y+sample!.height).toBeLessThan(input!.y);}
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Processed on your device'}).click();await expect(page.getByRole('dialog')).toContainText('processed on this Mac');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Try with sample PDFs'}).click();await expect(page.getByTestId('conversation').getByText('brief.pdf',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  await page.evaluate(()=>Object.defineProperty(window,'showSaveFilePicker',{value:async()=>{throw new DOMException('Cancelled','AbortError');},configurable:true}));await page.getByTestId('current-result').getByRole('button',{name:'Save PDF',exact:true}).click();await expect(page.getByText('Ready · save cancelled')).toBeVisible();await page.screenshot({path:'docs/evidence/phone-result.png',fullPage:true});
  const response=await page.request.post('/api/planner',{data:{test:'disabled'}});expect(response.status()).toBe(403);
});
test('real merge → OCR → compression preserves text and produces a measured smaller PDF without egress',async({page})=>{
  const requests:{url:string;method:string;body:string|null}[]=[],errors:string[]=[];page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByLabel('Choose PDF files').setInputFiles(['tests/fixtures/mixed-text-and-scan.pdf','tests/fixtures/image-heavy.pdf']);await expect(page.getByTestId('conversation').getByText('image-heavy.pdf',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('4 pages');const merged=await download(page,'chain-before');
  await page.getByRole('button',{name:'Make searchable',exact:true}).click();await expect(page.getByText(/English text added/)).toBeVisible({timeout:120_000});const searchable=await download(page,'chain-searchable');
  const ocrText=await readPDF(searchable);expect(ocrText[0]).toContain('A1');expect(ocrText[1]).toMatch(/Paperwork\s+made\s+simple/i);expect(ocrText[1]).toContain('DEMO-0042');expect(ocrText[2]).toContain('B1');
  await page.getByRole('button',{name:'Compress',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByTestId('assistant-message').filter({has:page.getByRole('button',{name:'Create Copy'})})).toHaveCount(1);await page.getByRole('button',{name:'Create Copy'}).click();await expect(page.getByText(/Optimised .*JPEG/)).toBeVisible({timeout:120_000});const compressed=await download(page,'chain-final');
  expect(compressed.length).toBeLessThan(searchable.length);const final=await readPDF(compressed);expect(final).toEqual(ocrText);await page.screenshot({path:'docs/evidence/chain-result.png',fullPage:true});
  expect(errors).toEqual([]);expect(requests.filter(r=>r.method!=='GET'||!r.url.startsWith(baseURL+'/'))).toEqual([]);expect(requests.filter(r=>r.url.includes('/api/')&&!r.url.includes('/api/planner/status'))).toEqual([]);
  await writeFile('docs/evidence/chain-measurements.json',JSON.stringify({mergedBytes:merged.length,searchableBytes:searchable.length,compressedBytes:compressed.length,pages:4,searchPhraseVerified:true,originalTextPreserved:true},null,2));await writeFile('docs/evidence/network-chain.json',JSON.stringify(requests,null,2));
});
test('chat clarification, cancellation and discard guard keep committed results intact',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  // This no-key branch must not depend on the developer's saved local credential.
  await page.route('**/api/planner/status',route=>route.fulfill({json:{connected:false,enabled:false,remaining:0,token:'test-only-csrf'}}));
  await page.goto('/');
  await page.getByLabel('Choose PDF files').setInputFiles(['tests/fixtures/mixed-text-and-scan.pdf','tests/fixtures/appendix.pdf']);
  await expect(page.getByText('Your 2 PDFs are ready.',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>!window.dispatchEvent(new Event('beforeunload',{cancelable:true})))).toBe(true);
  await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('4 pages');
  const before=await download(page,'cancel-before');
  await composer(page).fill('Send this to someone');await page.getByRole('button',{name:'Send message'}).click();await expect(page.getByText('OpenAI is not connected yet.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Compress',exact:true}).click();await page.getByRole('button',{name:'Keep Current Result',exact:true}).click();await expect(page.getByTestId('previous-result')).toHaveCount(0);
  let release!:()=>void, arrived!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;}),requested=new Promise<void>(resolve=>{arrived=resolve;});
  await page.route('**/eng.traineddata.gz',async route=>{arrived();await gate;await route.continue();});
  await page.getByRole('button',{name:'Make searchable',exact:true}).click();await requested;
  try{
    const activity=page.getByTestId('progress-message');
    await expect(activity).toContainText('Loading text recognition');
    await expect(page.getByTestId('assistant-message').filter({has:activity})).toHaveCount(1);
    await expect(page.getByRole('button',{name:'Cancel',exact:true})).toBeEnabled();
    await expect(page.getByRole('button',{name:'Send message',exact:true})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Compress',exact:true})).toBeDisabled();
    await expect(page.getByRole('button',{name:'Make searchable',exact:true})).toBeDisabled();
    await expect(page.getByTestId('result-facts')).toContainText('4 pages');
    await expect(page.getByTestId('previous-result')).toHaveCount(0);
    await expect(page.getByText('Your searchable copy is ready.',{exact:true})).toHaveCount(0);
    // Observe the actual reduced-motion rendering across the upstream pulse's
    // first 700ms cycle while the real worker waits for its local language file.
    const pulse=activity.getByTestId('activity-pulse');
    await expect(pulse).toHaveCSS('opacity','1');
    await page.waitForTimeout(850);
    await expect(pulse).toHaveCSS('opacity','1');
    expect(await activity.evaluate(element=>element.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').length)).toBe(0);
    await page.screenshot({path:'docs/evidence/local-processing-reduced-motion.png'});
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(page.getByText('Cancelled. No new result was committed.')).toBeVisible();
  }finally{release();}
  await expect(page.getByTestId('progress-message')).toHaveCount(0);const after=await download(page,'cancel-after');expect(after).toEqual(before);
  await send(page,'merge');await expect(page.getByTestId('previous-result')).toHaveCount(1);
  await startOver(page);await expect(emptyWorkspace(page)).toBeVisible();await expect(page.getByTestId('conversation')).toHaveCount(0);
});

test('PDF drag feedback clears on leave and actual drop imports locally',async({page})=>{
  await page.goto('/');
  const bytes=[...await readFile('tests/fixtures/brief.pdf')];
  const transfer=await page.evaluateHandle(data=>{
    const transfer=new DataTransfer();
    transfer.items.add(new File([Uint8Array.from(data)],'brief.pdf',{type:'application/pdf'}));
    return transfer;
  },bytes);
  try{
    const surface=page.getByLabel('Choose PDF files').locator('..');
    await surface.dispatchEvent('dragenter',{dataTransfer:transfer});
    await expect(page.getByTestId('drop-feedback')).toBeVisible();
    await expect(page.getByTestId('drop-feedback')).toContainText('checked on this Mac');
    await page.screenshot({path:'docs/evidence/drag-feedback.png'});
    await surface.dispatchEvent('dragleave',{dataTransfer:transfer});
    await expect(page.getByTestId('drop-feedback')).toHaveCount(0);
    await expect(page.getByTestId('conversation')).toHaveCount(0);
    await surface.dispatchEvent('dragenter',{dataTransfer:transfer});
    await surface.dispatchEvent('drop',{dataTransfer:transfer});
    await expect(page.getByTestId('drop-feedback')).toHaveCount(0);
    await expect(page.getByTestId('conversation').getByText('brief.pdf',{exact:true})).toBeVisible();
    await expect(page.getByText('Your 1 PDF is ready.',{exact:false})).toBeVisible();
    await expect(page.getByTestId('current-result')).toHaveCount(0);
  }finally{await transfer.dispose();}
});

test('keyboard composer and Latest message keep current results reachable',async({page})=>{
  await page.setViewportSize({width:1280,height:720});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.getByRole('button',{name:'Try with sample PDFs'}).click();
  await expect(page.getByText('Your 2 PDFs are ready.',{exact:false})).toBeVisible();
  const input=composer(page);
  await input.focus();
  await input.pressSequentially('merge');
  await input.press('Shift+Enter');
  await expect(input).toHaveValue('merge\n');
  await expect(input).toBeFocused();
  await expect(page.getByTestId('current-result')).toHaveCount(0);
  await input.press('Enter');
  await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  // Enough history that the newest result can scroll out of view in the compact SHR-106 layout.
  for(const pages of ['2 pages','3 pages','2 pages']){await send(page,pages==='3 pages'?'undo':'remove page 2');await expect(page.getByTestId('result-facts')).toContainText(pages);}
  const conversation=page.getByTestId('conversation');
  await conversation.hover();
  await page.mouse.wheel(0,-2000);
  const latest=page.getByRole('button',{name:'Latest message',exact:true});
  await expect(latest).toBeVisible();
  await latest.click();
  const save=page.getByTestId('current-result').getByRole('button',{name:'Save PDF',exact:true});
  await expect.poll(async()=>{
    const [viewport,button,field]=await Promise.all([conversation.boundingBox(),save.boundingBox(),input.boundingBox()]);
    return !!viewport&&!!button&&!!field&&button.y>=viewport.y&&button.y+button.height<=Math.min(viewport.y+viewport.height,field.y);
  }).toBe(true);
  await expect(latest).not.toBeVisible();
  await page.screenshot({path:'docs/evidence/latest-message-result.png'});
});
test('one chat recipe commits only the final merge → OCR → compression result',async({page})=>{
  await page.goto('/');await page.getByLabel('Choose PDF files').setInputFiles(['tests/fixtures/mixed-text-and-scan.pdf','tests/fixtures/image-heavy.pdf']);await expect(page.getByText('Your 2 PDFs are ready.',{exact:false})).toBeVisible();
  await composer(page).fill('merge, OCR, compress');await page.getByRole('button',{name:'Send message'}).click();await expect(page.getByTestId('current-result')).toHaveCount(0);await page.getByRole('button',{name:'Create Copy'}).click();
  await expect(page.getByText('Your merged, searchable and optimised copy is ready.')).toBeVisible({timeout:120_000});await expect(page.getByTestId('result-facts')).toContainText('4 pages');await expect(page.getByTestId('previous-result')).toHaveCount(0);
  const bytes=await download(page,'recipe-final'),text=await readPDF(bytes);expect(text).toHaveLength(4);expect(text[0]).toContain('A1');expect(text[1]).toMatch(/Paperwork\s+made\s+simple/i);expect(text[2]).toContain('B1');expect(bytes.length).toBeLessThan(1_000_000);
});
