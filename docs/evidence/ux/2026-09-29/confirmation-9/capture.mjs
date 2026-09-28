import {chromium,expect} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const root=process.cwd(),out=path.join(root,'.build/ux-20260929/confirmation-9');
await mkdir(path.join(out,'images'),{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const run={time:new Date().toISOString(),url:'http://localhost:3213',htmlSha:sha(await (await fetch('http://localhost:3213')).text()),sources:{},states:[],requests:[],errors:[],failures:[]};
if(run.htmlSha!=='66de4e2bf16d6b109360e4ff82b774b7186346261afebe9b4f2c47254303b961')throw Error('Unexpected HTML fingerprint');
for(const file of ['apps/universal/App.tsx','apps/universal/src/platform/workspace.css','apps/universal/src/platform/Preview.web.tsx','apps/universal/src/platform/preview.css'])run.sources[file]=sha(await readFile(file));
const browser=await chromium.launch({channel:'chrome',headless:true});
run.browserVersion=browser.version();
try {
  for(const [name,width,height,largeText] of [['desktop',1440,1000,false],['phone',390,844,false],['compact',320,568,false],['large-text',720,500,true]]) {
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'});
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url()),allowed=url.origin==='http://localhost:3213'&&request.method()==='GET';
      run.requests.push({viewport:name,method:request.method(),origin:url.origin,path:url.pathname,allowed});
      if(allowed)await route.continue();else await route.abort('blockedbyclient');
    });
    const page=await context.newPage();page.setDefaultTimeout(15000);
    page.on('pageerror',error=>run.errors.push({viewport:name,message:error.message}));
    const settle=async()=>{
      if(await page.locator('.inline-page').count())await expect(page.locator('.inline-page')).toHaveAttribute('aria-busy','false');
      await page.waitForTimeout(550);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    };
    const capture=async state=>{
      await settle();
      const measurements=await page.evaluate(()=>{
        const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
        const geometry=e=>{
          const r=rect(e),style=getComputedStyle(e);let visible={left:0,top:0,right:innerWidth,bottom:innerHeight};
          for(let parent=e.parentElement;parent;parent=parent.parentElement) {
            const s=getComputedStyle(parent),p=parent.getBoundingClientRect();
            if(/auto|scroll|hidden|clip/.test(s.overflowX)){visible.left=Math.max(visible.left,p.left);visible.right=Math.min(visible.right,p.right);}
            if(/auto|scroll|hidden|clip/.test(s.overflowY)){visible.top=Math.max(visible.top,p.top);visible.bottom=Math.min(visible.bottom,p.bottom);}
          }
          return {...r,fullyVisible:r.x>=visible.left-.5&&r.y>=visible.top-.5&&r.right<=visible.right+.5&&r.bottom<=visible.bottom+.5,fontSize:style.fontSize,clip:visible};
        };
        const controls=[...document.querySelectorAll('button,[role="button"],textarea')].map(e=>({label:e.getAttribute('aria-label')||e.textContent,...geometry(e),disabled:e.getAttribute('aria-disabled')==='true'||e.disabled||false}));
        return {viewport:{width:innerWidth,height:innerHeight},rootFontSize:getComputedStyle(document.documentElement).fontSize,documentWidth:document.documentElement.scrollWidth,bodyText:document.body.innerText,controls,
          welcome:document.querySelector('[data-testid=welcome]')?geometry(document.querySelector('[data-testid=welcome]')):null,
          conversation:document.querySelector('.aui-message-group')?geometry(document.querySelector('.aui-message-group')):null,
          preview:document.querySelector('.inline-preview')?geometry(document.querySelector('.inline-preview')):null,
          paper:document.querySelector('canvas')?{...geometry(document.querySelector('canvas')),pixels:{width:document.querySelector('canvas').width,height:document.querySelector('canvas').height},label:document.querySelector('canvas').getAttribute('aria-label')}:null,
          pageHost:document.querySelector('.inline-page')?{...geometry(document.querySelector('.inline-page')),scrollTop:document.querySelector('.inline-page').scrollTop,scrollLeft:document.querySelector('.inline-page').scrollLeft}:null,
          shortcuts:['Merge','Compress','Make searchable'].map(name=>{const e=[...document.querySelectorAll('[role=button]')].find(e=>e.textContent===name);return e?{name,button:geometry(e),icon:e.querySelector('svg')?geometry(e.querySelector('svg')):null,labelFontSize:getComputedStyle(e.lastElementChild).fontSize}:null;})};
      });
      await page.screenshot({path:path.join(out,'images',`${name}-${state}.png`)});
      run.states.push({name,state,...measurements});await writeFile(path.join(out,'geometry.json'),JSON.stringify(run,null,2));console.log(`${name}: ${state}`);
    };
    try {
      await page.goto('http://localhost:3213',{waitUntil:'networkidle'});
      await expect(page.getByRole('button',{name:'Choose files',exact:true})).toBeVisible();
      if(largeText)await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
      if(name!=='phone')await capture('empty');
      const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Choose files',exact:true}).click();
      await (await chooser).setFiles(['apps/universal/assets/fixtures/brief.pdf','apps/universal/assets/fixtures/appendix.pdf']);
      await expect(page.getByText(/Your 2 PDFs are ready/)).toBeVisible();
      await page.getByRole('button',{name:'Merge',exact:true}).click();
      await expect(page.getByTestId('result-facts')).toContainText('3 pages');
      if(name==='desktop'||name==='phone') {
        await capture('result');
        await page.getByRole('button',{name:'Help',exact:true}).click();
        await expect(page.getByTestId('assistant-message').last()).toContainText('These tasks work without an AI connection.');
        await capture('help');
      } else {
        await page.getByTestId('current-result').getByRole('button',{name:'Preview',exact:true}).click();
        await expect(page.locator('.inline-page')).toHaveAttribute('aria-busy','false');
        await capture('preview-page1');
        if(name==='compact') {
          await page.getByRole('button',{name:'Next page',exact:true}).click();
          await expect(page.getByLabel('PDF page 2',{exact:true})).toBeVisible();
          await capture('preview-next');
          await page.getByRole('button',{name:'Zoom in',exact:true}).click();
          await expect(page.getByRole('button',{name:'Zoom out',exact:true})).toBeEnabled();
          await capture('preview-zoom');
          await page.getByRole('button',{name:'Fit page',exact:true}).click();
          await expect(page.getByRole('button',{name:'Zoom out',exact:true})).toBeDisabled();
          await capture('preview-fit');
        }
      }
    }catch(error){run.failures.push({name,message:error.message});await capture('failure');}
    await context.close();
  }
}finally{await browser.close();run.browserClosed=true;await writeFile(path.join(out,'geometry.json'),JSON.stringify(run,null,2));}
console.log(JSON.stringify({htmlSha:run.htmlSha,states:run.states.length,failures:run.failures,errors:run.errors,blockedRequests:run.requests.filter(r=>!r.allowed).length,browserClosed:run.browserClosed}));
