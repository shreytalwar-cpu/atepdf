import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('./',import.meta.url).pathname;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Users/shrey/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const ledger=[];
try{
 for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['compact',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,acceptDownloads:true});
  const page=await context.newPage();
  const consoleErrors=[];
  page.on('pageerror',e=>consoleErrors.push(e.message));
  await context.route('**/*',async route=>{const u=new URL(route.request().url());if(['localhost','127.0.0.1'].includes(u.hostname)||['blob:','data:'].includes(u.protocol))await route.continue();else await route.abort();});
  await page.goto('http://localhost:3213',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Choose files',exact:true}).waitFor();
  const capture=async(state)=>{
    await page.waitForTimeout(350);
    await page.screenshot({path:`${out}${name}-${state}.png`,fullPage:false});
    ledger.push({size:name,state,text:await page.locator('body').innerText(),buttons:await page.getByRole('button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{label:e.getAttribute('aria-label')||e.textContent,disabled:e.disabled||e.getAttribute('aria-disabled'),x:r.x,y:r.y,w:r.width,h:r.height};})),overflow:await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth})),consoleErrors:[...consoleErrors]});
  };
  await capture('01-empty');
  await page.getByRole('button',{name:'Try the two sample PDFs',exact:true}).click();
  await page.getByText(/Your 2 PDFs are ready/).waitFor();
  await capture('02-imported');
  await page.getByRole('button',{name:'Merge',exact:true}).click();
  await page.getByTestId('current-result').waitFor();
  await capture('03-merged');
  await page.getByTestId('current-result').getByRole('button',{name:'Preview',exact:true}).click();
  await page.locator('canvas').waitFor({state:'visible'});
  await capture('04-preview');
  await page.getByRole('button',{name:'Next page',exact:true}).click();
  await page.getByText('Page 2 of 3',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Close preview',exact:true}).click();
  const input=page.getByRole('textbox',{name:'Tell atepdf what to do',exact:true});
  await input.fill('Remove page 2');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.getByTestId('current-result').getByText(/2 pages/).waitFor();
  await capture('05-removed');
  await page.getByTestId('current-result').getByRole('button',{name:'Undo',exact:true}).click();
  await page.getByText('I restored your previous result. Your original files are unchanged.',{exact:true}).waitFor();
  await capture('06-undo');
  await input.fill('Remove page 99');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.getByText('That physical page does not exist.',{exact:true}).waitFor();
  await capture('07-error');
  await input.fill('What can you do?');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.getByText('OpenAI is not connected yet.',{exact:true}).waitFor();
  await capture('08-unavailable');
  await page.getByRole('button',{name:'Processed on your device',exact:true}).click();
  await page.getByRole('button',{name:'Got it',exact:true}).waitFor();
  await capture('09-privacy');
  await context.close();
 }
}finally{await browser.close();await writeFile(`${out}observations.json`,JSON.stringify(ledger,null,2));}
console.log(`Captured ${ledger.length} states in ${out}`);
