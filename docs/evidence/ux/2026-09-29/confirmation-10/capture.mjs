import {chromium,expect} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out='.build/ux-20260929/confirmation-10';await mkdir(`${out}/images`,{recursive:true});
const sha=value=>createHash('sha256').update(value).digest('hex');
const run={time:new Date().toISOString(),url:'http://localhost:3213',htmlSha:sha(await(await fetch('http://localhost:3213')).text()),cssSha:sha(await readFile('apps/universal/src/platform/workspace.css')),states:[],requests:[],errors:[],failures:[]};
if(run.htmlSha!=='e9c07d03c77cab35ab9e9c3732a94aa7e07999cb5c8e4d5ff288deb9faf82c47')throw Error('Unexpected export');
const browser=await chromium.launch({channel:'chrome',headless:true});run.browserVersion=browser.version();
try {
for(const [name,width,height] of [['compact',320,568],['large-text',720,500]]) {
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'});
  await context.route('**/*',async route=>{const request=route.request(),url=new URL(request.url()),allowed=url.origin==='http://localhost:3213'&&request.method()==='GET';run.requests.push({method:request.method(),origin:url.origin,path:url.pathname,allowed});if(allowed)await route.continue();else await route.abort('blockedbyclient');});
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>run.errors.push(e.message));
  const capture=async state=>{
    if(await page.locator('.inline-page').count())await expect(page.locator('.inline-page')).toHaveAttribute('aria-busy','false');
    await page.waitForTimeout(600);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const geometry=await page.evaluate(()=>{
      const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
      const byLabel=name=>[...document.querySelectorAll('[role=button],button')].find(e=>e.getAttribute('aria-label')===name||e.textContent===name);
      const card=document.querySelector('[data-testid=current-result]');
      return {viewport:{width:innerWidth,height:innerHeight},rootFont:getComputedStyle(document.documentElement).fontSize,documentWidth:document.documentElement.scrollWidth,conversation:rect(document.querySelector('[data-testid=conversation]')),welcome:rect(document.querySelector('[data-testid=welcome]')),heading:rect(card?.querySelector('[role=heading]')),save:rect(card?[...card.querySelectorAll('[role=button]')].find(e=>e.textContent==='Save PDF'):null),choose:rect(byLabel('Choose files')),chooseLabelFont:byLabel('Choose files')?getComputedStyle(byLabel('Choose files').lastElementChild).fontSize:null,help:rect(byLabel('Help')),preview:rect(document.querySelector('.inline-preview')),paper:rect(document.querySelector('canvas')),pageHost:rect(document.querySelector('.inline-page')),facts:document.querySelector('[data-testid=result-facts]')?.textContent,bodyText:document.body.innerText};
    });
    await page.screenshot({path:`${out}/images/${name}-${state}.png`});run.states.push({name,state,...geometry});await writeFile(`${out}/geometry.json`,JSON.stringify(run,null,2));console.log(`${name}: ${state}`);return geometry;
  };
  const inside=(box,container)=>!!box&&!!container&&box.x>=container.x-.5&&box.y>=container.y-.5&&box.right<=container.right+.5&&box.bottom<=container.bottom+.5;
  try {
    await page.goto('http://localhost:3213',{waitUntil:'networkidle'});
    if(name==='large-text') {
      await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
      const geometry=await capture('initial-choose');
      expect(inside(geometry.choose,geometry.welcome)).toBe(true);expect(geometry.choose.height).toBeGreaterThanOrEqual(44);expect(geometry.chooseLabelFont).toBe('28px');
    } else {
      await page.getByRole('button',{name:'Try the two sample PDFs',exact:true}).click();await expect(page.getByText(/Your 2 PDFs are ready/)).toBeVisible();
      await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');
      await page.getByTestId('current-result').getByRole('button',{name:'Preview',exact:true}).click();await expect(page.locator('.inline-page')).toHaveAttribute('aria-busy','false');
      await page.getByRole('button',{name:'Close preview',exact:true}).click();
      await page.getByTestId('conversation').hover();await page.mouse.wheel(0,-5000);await page.waitForTimeout(400);
      await page.getByRole('textbox',{name:'Tell atepdf what to do'}).fill('Remove physical page 2 from the merged result.');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('2 pages');
      const result=await capture('removal-result');expect(inside(result.heading,result.conversation)).toBe(true);expect(inside(result.save,result.conversation)).toBe(true);expect(result.save.height).toBeGreaterThanOrEqual(44);
      await page.getByTestId('current-result').getByRole('button',{name:'Preview',exact:true}).click();await expect(page.locator('.inline-page')).toHaveAttribute('aria-busy','false');
      const preview=await capture('fitted-preview');expect(inside(preview.preview,preview.conversation)).toBe(true);expect(inside(preview.paper,preview.pageHost)).toBe(true);expect(inside(preview.paper,preview.conversation)).toBe(true);
    }
  } catch(error){run.failures.push({name,message:error.message});}
  await context.close();
}
}finally{await browser.close();run.browserClosed=true;await writeFile(`${out}/geometry.json`,JSON.stringify(run,null,2));}
console.log(JSON.stringify({htmlSha:run.htmlSha,cssSha:run.cssSha,states:run.states.length,failures:run.failures,errors:run.errors,requests:run.requests.length,blockedRequests:run.requests.filter(r=>!r.allowed).length,browserClosed:run.browserClosed}));
