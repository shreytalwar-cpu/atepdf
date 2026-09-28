const {chromium}=require('@playwright/test');
const fs=require('fs'); const path=require('path'); const crypto=require('crypto'); const cp=require('child_process');
const out=__dirname, base='http://localhost:3213';
const cli='/Users/shrey/.codex/plugins/cache/openai-curated-remote/impeccable/4.3.1/skills/impeccable/scripts/impeccable';
const result={started:new Date().toISOString(),browser:'isolated headless Chromium',viewports:[],network:[],console:[],errors:[],overlay:{},cleanup:{}};
const write=()=>fs.writeFileSync(path.join(out,'browser-evidence.json'),JSON.stringify(result,null,2));
const assert=(v,msg)=>{if(!v)throw Error(msg)};
async function inspect(page){return page.evaluate(()=>{
 const rect=e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
 const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
 const name=e=>e.getAttribute('aria-label')||e.textContent.trim()||e.getAttribute('placeholder')||'';
 const controls=[...document.querySelectorAll('button,[role=button],textarea,input,a[href]')].filter(visible).map(e=>({name:name(e),tag:e.tagName,role:e.getAttribute('role'),disabled:e.disabled||e.getAttribute('aria-disabled')==='true',tabIndex:e.tabIndex,rect:rect(e),font:getComputedStyle(e).fontSize,outline:getComputedStyle(e).outline,ariaLabel:e.getAttribute('aria-label')}));
 const parse=c=>{let m=c.match(/[\d.]+/g);return m?[+m[0],+m[1],+m[2],m[3]===undefined?1:+m[3]]:[0,0,0,0]};
 const over=(a,b)=>{let alpha=a[3]+b[3]*(1-a[3]);return alpha?[(a[0]*a[3]+b[0]*b[3]*(1-a[3]))/alpha,(a[1]*a[3]+b[1]*b[3]*(1-a[3]))/alpha,(a[2]*a[3]+b[2]*b[3]*(1-a[3]))/alpha,alpha]:[0,0,0,0]};
 const lum=a=>a.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
 const texts=[...document.querySelectorAll('body *')].filter(e=>visible(e)&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&!['SCRIPT','STYLE','NOSCRIPT'].includes(e.tagName)).map(e=>{let chain=[],p=e;while(p){chain.unshift(p);p=p.parentElement}let bg=[255,255,255,1],opacity=1;for(let a of chain){const s=getComputedStyle(a);bg=over(parse(s.backgroundColor),bg);opacity*=+s.opacity;}const s=getComputedStyle(e),fg=parse(s.color);fg[3]*=opacity;let final=over(fg,bg),a=lum(final),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),font=parseFloat(s.fontSize),bold=parseInt(s.fontWeight)>=700,threshold=font>=24||(font>=18.66&&bold)?3:4.5;return {text:[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim().slice(0,200),foreground:s.color,background:bg.slice(0,3),opacity,ratio,threshold,font:s.fontSize,disabled:!!e.closest('[aria-disabled=true],:disabled'),rect:rect(e)};});
 const sels=['.aui-thread-viewport','.aui-thread-viewport-footer','.aui-composer-shell','.aui-composer-input','.inline-preview','.inline-page'];
 return {title:document.title,viewport:{width:innerWidth,height:innerHeight},rootFont:getComputedStyle(document.documentElement).fontSize,document:{scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,scrollHeight:document.documentElement.scrollHeight},controls,texts,regions:sels.map(sel=>{let e=document.querySelector(sel);return e?{sel,rect:rect(e),clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,scrollTop:e.scrollTop}:null}),headings:[...document.querySelectorAll('h1,h2,h3,[role=heading]')].map(e=>({text:e.textContent,level:e.getAttribute('aria-level')||e.tagName}))};
 });}
async function active(page){return page.evaluate(()=>{const e=document.activeElement;let p=e;const indicators=[];for(let i=0;p&&i<3;i++,p=p.parentElement){const s=getComputedStyle(p);indicators.push({tag:p.tagName,cls:p.className,outline:s.outline,outlineOffset:s.outlineOffset,shadow:s.boxShadow})}return {name:e.getAttribute('aria-label')||e.textContent.trim()||e.tagName,tag:e.tagName,rect:e.getBoundingClientRect().toJSON(),indicators,inDialog:!!e.closest('[role=dialog]')}})}
(async()=>{let browser,helper=false;try{
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 await context.addInitScript(()=>{if('showSaveFilePicker' in window)delete window.showSaveFilePicker});
 await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());const local=u.origin===base;const blocked=!local||r.method()==='POST';result.network.push({url:r.url(),method:r.method(),blocked});if(blocked)return route.abort('blockedbyclient');return route.continue()});
 const page=await context.newPage();
 page.on('console',m=>result.console.push({type:m.type(),text:m.text()}));page.on('pageerror',e=>result.errors.push(String(e)));
 const response=await page.goto(base,{waitUntil:'networkidle'});result.html_sha256=crypto.createHash('sha256').update(await response.body()).digest('hex');assert(result.html_sha256==='c7b1daae9a9523f885b1b9a06c1e44eaeb8ffa25fd27591674cbc05d36507af1','Fingerprint changed');
 await page.getByRole('button',{name:'Choose files',exact:true}).waitFor();
 result.keyboard=[];
 for(let i=0;i<9;i++){await page.keyboard.press('Tab');result.keyboard.push(await active(page));}
 await page.getByRole('textbox',{name:'Tell atepdf what to do'}).focus();await page.screenshot({path:path.join(out,'keyboard-composer.png')});result.composerFocus=await active(page);
 const privacy=page.getByRole('button',{name:'Processed on your device',exact:true});await privacy.focus();await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'Processed on your device',exact:true}).waitFor();
 result.privacy={dialogs:await page.getByRole('dialog').count(),namedDialogs:await page.getByRole('dialog',{name:'Processed on your device',exact:true}).count(),initial:await active(page),tabs:[],snapshot:await inspect(page)};
 for(let i=0;i<4;i++){await page.keyboard.press('Tab');result.privacy.tabs.push(await active(page))}await page.keyboard.press('Shift+Tab');result.privacy.reverse=await active(page);
 await page.screenshot({path:path.join(out,'privacy.png')});await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});result.privacy.afterEscape=await active(page);
 for(const viewport of [{width:1440,height:1000},{width:768,height:1024},{width:390,height:844},{width:320,height:740},{width:720,height:500,root200:true}]){
  await page.setViewportSize(viewport);await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Choose files',exact:true}).waitFor();
  if(viewport.root200)await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  const id=`${viewport.width}x${viewport.height}${viewport.root200?'-root200':''}`,e={id,viewport};
  e.empty=await inspect(page);await page.screenshot({path:path.join(out,`${id}-empty.png`)});
  await page.getByRole('button',{name:'Try the two sample PDFs',exact:true}).click();await page.getByText('Your 2 PDFs are ready.',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Merge',exact:true}).click();await page.getByTestId('result-facts').waitFor();
  e.result=await inspect(page);e.resultFacts=await page.getByTestId('result-facts').textContent();
  const preview=page.getByRole('button',{name:'Preview',exact:true});await preview.focus();await page.keyboard.press('Enter');await page.locator('.inline-page[aria-busy="false"]').waitFor();
  e.preview=await inspect(page);e.pageStart=await page.locator('.inline-page-count').textContent();
  await page.getByRole('button',{name:'Next page',exact:true}).click();await page.locator('.inline-page[aria-busy="false"]').waitFor();e.pageNext=await page.locator('.inline-page-count').textContent();
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.locator('.inline-page[aria-busy="false"]').waitFor();e.zoomCanvas=await page.locator('canvas').evaluate(e=>({w:e.width,h:e.height}));
  await page.getByRole('button',{name:'Fit page',exact:true}).click();await page.locator('.inline-page[aria-busy="false"]').waitFor();e.fitCanvas=await page.locator('canvas').evaluate(e=>({w:e.width,h:e.height}));
  await page.screenshot({path:path.join(out,`${id}-preview.png`)});
  await page.getByRole('button',{name:'Close preview',exact:true}).click();await page.getByRole('region',{name:'Read-only preview'}).waitFor({state:'hidden'});e.previewClosedFocus=await active(page);
  if(viewport.width===1440){
   result.saveAdapter='Browser Blob-download fallback; showSaveFilePicker removed only in isolated browser context';
   const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Save PDF',exact:true}).click();const download=await downloadPromise;await download.saveAs(path.join(out,'merged-output.pdf'));e.saveReceipt=await page.getByText('Download started · check your downloads',{exact:true}).textContent();
   const input=page.getByRole('textbox',{name:'Tell atepdf what to do'});await input.fill('Remove page 2');await input.press('Enter');await page.getByTestId('result-facts').filter({hasText:'2 pages'}).waitFor();e.followup=await inspect(page);await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByTestId('result-facts').filter({hasText:'3 pages'}).waitFor();e.undoFacts=await page.getByTestId('result-facts').textContent();
  }
  result.viewports.push(e);write();
 }
 result.overlay.preflight=await page.evaluate(()=>{const title=document.title;document.title='[Human] atepdf audit';const s=document.createElement('script');s.dataset.impeccablePreflight='true';document.head.append(s);const ok=s.isConnected;s.remove();return {titleChanged:document.title!==title,scriptElementAppend:ok,originalTitle:title}});
 if(result.overlay.preflight.scriptElementAppend){
  const start=cp.spawnSync(cli,['live-server','--background'],{cwd:out,encoding:'utf8'});result.overlay.start={status:start.status,stdout:start.stdout,stderr:start.stderr};fs.writeFileSync(path.join(out,'overlay-start.json'),JSON.stringify(result.overlay.start,null,2));
  if(start.status===0){helper=true;let data;try{data=JSON.parse(start.stdout)}catch{}const port=data?.port||data?.connection?.port||Number(start.stdout.match(/"port"\s*:\s*(\d+)/)?.[1]);result.overlay.port=port;
   if(port){await page.evaluate(()=>window.scrollTo(0,0));try{await page.addScriptTag({url:`http://localhost:${port}/detect.js`});result.overlay.injected=true}catch(e){result.overlay.injected=false;result.overlay.error=String(e)}await page.waitForTimeout(2200);result.overlay.messages=result.console.filter(x=>/impeccable/i.test(x.text));}
  }
 }
 await page.evaluate(title=>document.title=title,result.overlay.preflight.originalTitle);result.finished=new Date().toISOString();
 }catch(e){result.failure=String(e);process.exitCode=1}finally{if(helper){const stop=cp.spawnSync(cli,['live-server','stop','--keep-inject'],{cwd:out,encoding:'utf8'});result.cleanup.overlay={status:stop.status,stdout:stop.stdout,stderr:stop.stderr}}if(browser){await browser.close();result.cleanup.browserClosed=true}write();console.log(JSON.stringify({finished:!!result.finished,failure:result.failure||null,ownedBrowserClosed:result.cleanup.browserClosed}));}})();
