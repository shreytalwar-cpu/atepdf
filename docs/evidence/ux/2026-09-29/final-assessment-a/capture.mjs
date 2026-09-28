import {chromium, expect} from '@playwright/test';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const root=process.cwd(), out=path.join(root,'.build/ux-20260929/final-assessment-a');
await mkdir(path.join(out,'screenshots'),{recursive:true});
const sha=value=>createHash('sha256').update(value).digest('hex');
const html=await (await fetch('http://localhost:3213')).text();
const run={time:new Date().toISOString(),target:'apps/universal/App.tsx',sourceSha:sha(await readFile('apps/universal/App.tsx')),htmlSha:sha(html),states:[],requests:[],errors:[],failures:[]};
if(run.htmlSha!=='c7b1daae9a9523f885b1b9a06c1e44eaeb8ffa25fd27591674cbc05d36507af1') throw Error('HTML fingerprint mismatch');
const browser=await chromium.launch({channel:'chrome',headless:true});
run.browserVersion=browser.version();
try {
for(const [name,width,height] of [['desktop',1440,1000],['phone',390,844],['compact',320,568]]) {
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'});
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    const allowed=url.origin==='http://localhost:3213'&&req.method()==='GET';
    run.requests.push({viewport:name,method:req.method(),origin:url.origin,path:url.pathname,allowed});
    if(allowed) await route.continue(); else await route.abort('blockedbyclient');
  });
  const page=await context.newPage();
  page.on('pageerror',e=>run.errors.push({viewport:name,message:e.message}));
  page.setDefaultTimeout(12000);
  const capture=async state=>{
    await page.screenshot({path:path.join(out,'screenshots',`${name}-${state}.png`)});
    const data=await page.evaluate(()=>({
      viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,
      bodyText:document.body.innerText,
      currentContext:document.querySelector('[data-testid="current-context"]')?.textContent,
      currentResult:document.querySelector('[data-testid="current-result"]')?.textContent,
      controls:[...document.querySelectorAll('button,[role="button"],textarea,input')].map(e=>{
        const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {label:e.getAttribute('aria-label')||e.textContent||e.getAttribute('placeholder'),disabled:e.getAttribute('aria-disabled')||e.disabled||false,x:r.x,y:r.y,width:r.width,height:r.height,fontSize:s.fontSize,visible:r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight,color:s.color,background:s.backgroundColor,outline:s.outline};
      }),
      preview:[...document.querySelectorAll('canvas')].map(e=>({width:e.width,height:e.height,label:e.getAttribute('aria-label'),visible:getComputedStyle(e).visibility})),
      activeElement:document.activeElement?.getAttribute('aria-label')||document.activeElement?.tagName
    }));
    run.states.push({viewport:name,state,...data});
    await writeFile(path.join(out,'measurements.json'),JSON.stringify(run,null,2));
    console.log(`${name}: ${state}`);
  };
  const submit=async text=>{await page.getByRole('textbox').fill(text);await page.getByRole('textbox').press('Enter');};
  try {
    await page.goto('http://localhost:3213',{waitUntil:'networkidle'});
    await expect(page.getByRole('button',{name:'Choose files',exact:true})).toBeVisible();
    await capture('01-empty');
    const chooser=page.waitForEvent('filechooser');
    await page.getByRole('button',{name:'Choose files',exact:true}).click();
    await (await chooser).setFiles(['apps/universal/assets/fixtures/brief.pdf','apps/universal/assets/fixtures/appendix.pdf']);
    await expect(page.getByText(/Your 2 PDFs are ready/)).toBeVisible();
    await capture('02-imported');
    await page.getByRole('button',{name:'Merge',exact:true}).click();
    await expect(page.getByTestId('result-facts')).toContainText('3 pages');
    await capture('03-merged');
    await page.getByTestId('current-result').getByRole('button',{name:'Preview',exact:true}).click();
    await expect(page.locator('.inline-page')).toHaveAttribute('aria-busy','false');
    await expect(page.getByLabel('PDF page 1',{exact:true})).toBeVisible();
    await capture('04-preview-page1');
    await page.getByRole('button',{name:'Next page',exact:true}).click();
    await expect(page.locator('.inline-page')).toHaveAttribute('aria-busy','false');
    await expect(page.getByLabel('PDF page 2',{exact:true})).toBeVisible();
    await capture('05-preview-page2');
    await page.getByRole('button',{name:'Close preview',exact:true}).click();
    run.states.push({viewport:name,state:'preview-close-focus',activeElement:await page.evaluate(()=>document.activeElement?.textContent)});
    await submit('remove page 2');
    await expect(page.getByTestId('result-facts')).toContainText('2 pages');
    await capture('06-removed');
    await page.getByTestId('current-result').getByRole('button',{name:'Undo',exact:true}).click();
    await expect(page.getByTestId('result-facts')).toContainText('3 pages');
    await capture('07-undone');
    await submit('remove page 99');
    await expect(page.getByRole('button',{name:'Merge',exact:true})).toBeEnabled();
    await expect(page.getByRole('textbox')).toHaveValue('');
    await page.waitForTimeout(350);
    await capture('08-error');
    await submit('help');
    await expect(page.getByText(/I can merge PDFs, remove pages/)).toBeVisible();
    await capture('09-help');
    await page.getByRole('button',{name:'Processed on your device',exact:true}).click();
    await expect(page.getByRole('button',{name:'Got it',exact:true})).toBeVisible();
    await capture('10-privacy');
    await page.getByRole('button',{name:'Got it',exact:true}).click();
  } catch(error) {run.failures.push({viewport:name,message:error.message});await capture('failure');}
  await context.close();
}
}finally {await browser.close();run.browserClosed=true;run.sourceShaAfter=sha(await readFile('apps/universal/App.tsx'));await writeFile(path.join(out,'measurements.json'),JSON.stringify(run,null,2));}
console.log(JSON.stringify({states:run.states.length,failures:run.failures,errors:run.errors,blockedRequests:run.requests.filter(r=>!r.allowed).length,htmlSha:run.htmlSha,sourceSha:run.sourceSha,sourceShaAfter:run.sourceShaAfter,browserClosed:run.browserClosed}));
