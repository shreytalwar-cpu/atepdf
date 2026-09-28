import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const out=path.resolve('.build/ux-20260929/candidate-assessment-b');
const browser=await chromium.launch({channel:'chrome',headless:true});
const report=process.argv.includes('--resume')?JSON.parse(await fs.readFile(path.join(out,'browser-report.json'),'utf8')):{browser:browser.version(),started:new Date().toISOString(),cases:[],overlay:{},errors:[]};
if(process.argv.includes('--resume'))report.cases=report.cases.filter(c=>!['1440','text200-720'].includes(c.label));
const measure=()=>{
 const visible=e=>{let r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
 const box=e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
 const parse=s=>{let m=s.match(/[\d.]+/g);return m?m.map(Number):[255,255,255,1]};
 const blend=(fg,bg)=>{let a=fg[3]??1;return fg.slice(0,3).map((c,i)=>c*a+bg[i]*(1-a))};
 const bg=e=>{if(!e)return [255,255,255];return blend(parse(getComputedStyle(e).backgroundColor),bg(e.parentElement))};
 const lum=c=>c.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 const contrast=[];
 for(const e of document.querySelectorAll('body *')){if(!visible(e)||['SCRIPT','STYLE','SVG','PATH','CANVAS'].includes(e.tagName)||e.closest('svg'))continue;
  const t=[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();if(!t)continue;
  let disabled=!!e.closest('[aria-disabled="true"],:disabled'),opacity=1;for(let a=e;a;a=a.parentElement)opacity*=Number(getComputedStyle(a).opacity);
  const s=getComputedStyle(e),back=bg(e),fg=blend([...parse(s.color).slice(0,3),opacity],back),a=lum(fg),b=lum(back),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700);
  contrast.push({text:t.slice(0,160),ratio:+ratio.toFixed(2),fontSize:s.fontSize,color:s.color,background:back,opacity,disabled,passes:disabled||ratio>=(large?3:4.5)});
 }
 const controls=[...document.querySelectorAll('button,[role="button"],input,textarea')].filter(visible).map(e=>({tag:e.tagName,role:e.getAttribute('role'),name:e.getAttribute('aria-label')||e.innerText||e.getAttribute('placeholder')||'',disabled:e.disabled||e.getAttribute('aria-disabled')==='true',tabIndex:e.tabIndex,...box(e)}));
 return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,rootFont:getComputedStyle(document.documentElement).fontSize},overflow:{root:document.documentElement.scrollWidth-innerWidth,body:document.body.scrollWidth-innerWidth,conversation:[...document.querySelectorAll('[data-testid="conversation"]')].map(e=>({client:e.clientWidth,scroll:e.scrollWidth}))},controls,contrast,headings:[...document.querySelectorAll('[role="heading"],h1,h2,h3')].map(e=>({text:e.textContent,level:e.getAttribute('aria-level'),tag:e.tagName})),landmarks:[...document.querySelectorAll('main,[role="main"],nav,[role="navigation"],header,[role="banner"]')].map(e=>({tag:e.tagName,role:e.getAttribute('role')})),liveRegions:[...document.querySelectorAll('[aria-live]')].map(e=>({mode:e.getAttribute('aria-live'),text:e.textContent.slice(0,240)}))};
};
async function state(page,name,r){await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});const m=await page.evaluate(measure);await fs.writeFile(path.join(out,name+'.json'),JSON.stringify(m,null,2));await fs.writeFile(path.join(out,name+'-aria.txt'),await page.locator('body').ariaSnapshot());r.states.push({name,overflow:m.overflow,lowContrast:m.contrast.filter(x=>!x.passes),smallControls:m.controls.filter(x=>!x.disabled&&(x.width<43.9||x.height<43.9))});}
async function focus(page){return page.evaluate(()=>{let e=document.activeElement,s=getComputedStyle(e);return {tag:e.tagName,name:e.getAttribute('aria-label')||e.innerText||e.getAttribute('placeholder'),focusVisible:e.matches(':focus-visible'),outline:s.outline,boxShadow:s.boxShadow,rect:{x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}}});}
try{
 for(const [label,width,height,text200] of [['320',320,568,false],['390',390,844,false],['768',768,1024,false],['1440',1440,1000,false],['text200-720',720,500,true]]){
  if(process.argv.includes('--resume')&&!['1440','text200-720'].includes(label))continue;
  const context=await browser.newContext({viewport:{width,height},acceptDownloads:true,reducedMotion:'reduce'}), page=await context.newPage();
  const r={label,states:[],requests:[],console:[],keyboard:[],timings:{}};report.cases.push(r);
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://localhost:3213'){r.requests.push({externalBlocked:u.origin});return route.abort();}if(u.pathname==='/api/planner'&&route.request().method()==='POST'){r.requests.push({plannerBlocked:true});return route.abort();}return route.continue();});
  await page.addInitScript(()=>{Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true});window.__longTasks=[];new PerformanceObserver(list=>window.__longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});});
  page.on('request',q=>{let u=new URL(q.url());r.requests.push({origin:u.origin,path:u.pathname,method:q.method()})});
  page.on('console',m=>{if(m.type()==='error'||/impeccable|Content Security/.test(m.text()))r.console.push({type:m.type(),text:m.text().slice(0,1200)})});
  page.on('pageerror',e=>r.console.push({type:'pageerror',text:e.message}));
  const started=Date.now();await page.goto('http://localhost:3213');await page.getByRole('button',{name:'Choose files',exact:true}).waitFor();r.timings.readyMs=Date.now()-started;
  if(text200)await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  await state(page,label+'-empty',r);
  if(label==='1440'){
   report.overlay.preflight=await page.evaluate(()=>{document.title='[Audit B] atepdf';const s=document.createElement('script');s.textContent='window.__auditMutable=true';document.head.append(s);return {title:document.title,scriptRan:window.__auditMutable===true}});
   const shellStyle=()=>{const e=document.querySelector('.aui-composer-shell'),s=getComputedStyle(e);return {border:s.borderColor,shadow:s.boxShadow,background:s.backgroundColor,outline:s.outline,cssWebMedia:matchMedia('web').matches}};
   r.composerUnfocused=await page.evaluate(shellStyle);
   for(let i=0;i<9;i++){await page.keyboard.press('Tab');r.keyboard.push(await focus(page));if(i===4){r.composerFocused=await page.evaluate(shellStyle);await page.screenshot({path:path.join(out,'1440-composer-keyboard-focus.png')});}}
   await page.getByRole('button',{name:'Processed on your device',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('dialog').last().waitFor();r.dialogInitial=await focus(page);await page.keyboard.press('Tab');r.dialogTab=await focus(page);await page.keyboard.press('Escape');r.dialogAfterEscape=await focus(page);r.dialogCountAfterEscape=await page.getByRole('dialog').count();
   await page.waitForFunction(()=>document.querySelectorAll('[role="dialog"]').length===0);r.dialogCountAfterEscape=await page.getByRole('dialog').count();r.dialogAfterEscape=await focus(page);
  }
  await page.getByLabel('Choose PDF files').setInputFiles(['tests/fixtures/brief.pdf','tests/fixtures/appendix.pdf']);await page.getByText('Your 2 PDFs are ready.',{exact:false}).waitFor();await state(page,label+'-imported',r);
  const mergeStart=Date.now();await page.getByRole('button',{name:'Merge',exact:true}).click();await page.getByTestId('result-facts').filter({hasText:'3 pages'}).waitFor();r.timings.mergeMs=Date.now()-mergeStart;await state(page,label+'-merged',r);
  const preview=page.getByTestId('current-result').getByRole('button',{name:'Preview',exact:true});await preview.focus();await page.keyboard.press('Enter');await page.getByRole('region',{name:'Read-only preview'}).waitFor();await page.waitForFunction(()=>document.querySelector('.inline-page')?.getAttribute('aria-busy')==='false');await state(page,label+'-preview',r);
  await page.getByRole('button',{name:'Next page',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.inline-page-count')?.textContent==='Page 2 of 3'&&document.querySelector('.inline-page')?.getAttribute('aria-busy')==='false');
  r.previewPage2=await page.locator('.inline-page-count').innerText();await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.inline-page')?.getAttribute('aria-busy')==='false');r.zoomCanvas=await page.locator('canvas').evaluate(e=>({width:e.width,height:e.height}));
  await page.getByRole('button',{name:'Close preview',exact:true}).click();r.previewFocusRestored=await focus(page);
  const downloaded=page.waitForEvent('download');await page.getByTestId('current-result').getByRole('button',{name:'Save PDF',exact:true}).click();const d=await downloaded;await d.saveAs(path.join(out,label+'-merged.pdf'));const bytes=await fs.readFile(path.join(out,label+'-merged.pdf'));r.saved={bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  await page.getByRole('textbox',{name:'Tell atepdf what to do'}).fill('Remove physical page 99 from the merged result.');await page.getByRole('button',{name:'Send message',exact:true}).click();await page.getByTestId('assistant-message').last().filter({hasText:/unchanged/i}).waitFor();r.errorText=await page.getByTestId('assistant-message').last().innerText();r.currentAfterError=await page.getByTestId('current-result').innerText();await state(page,label+'-error',r);
  r.timings.browser=await page.evaluate(()=>({navigation:performance.getEntriesByType('navigation').map(e=>({domContentLoaded:e.domContentLoadedEventEnd,load:e.loadEventEnd,bytes:e.transferSize})),resources:performance.getEntriesByType('resource').map(e=>({path:new URL(e.name).pathname,transfer:e.transferSize,duration:e.duration})),longTasks:window.__longTasks}));
  if(label==='1440'){await page.emulateMedia({colorScheme:'dark'});r.darkComputed=await page.evaluate(()=>({background:getComputedStyle(document.querySelector('.aui-root')).backgroundColor,color:getComputedStyle(document.querySelector('.aui-root')).color}));await state(page,label+'-dark-preference',r);}
  await context.close();await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(label+' complete');
 }
}catch(e){report.errors.push({message:e.message,stack:e.stack});console.error(e);process.exitCode=1}finally{await browser.close();report.finished=new Date().toISOString();await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));}
