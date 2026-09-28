import { chromium } from '@playwright/test';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const out=resolve('.build/ux-20260929/assessment-b');
const base='http://localhost:3213';
const launcher='/Users/shrey/.codex/plugins/cache/openai-curated-remote/impeccable/4.3.1/skills/impeccable/scripts/impeccable';
const evidence={base,startedAt:new Date().toISOString(),browser:'Playwright Chromium, new isolated context per viewport',states:[],requests:[],console:[],pageErrors:[],blocked:[],overlay:{},helper:{}};
const write=async(name,data)=>fs.writeFile(resolve(out,name),typeof data==='string'?data:JSON.stringify(data,null,2));
const browser=await chromium.launch({channel:'chrome',headless:true});
let helperStarted=false;
let helperPort=null;
const runHelper=(args)=>execFileSync('/usr/bin/sandbox-exec',['-p',`(version 1)(allow default)(deny file-write*)(allow file-write* (literal "/dev/null"))(allow file-write* (subpath "${out}"))`,launcher,...args],{cwd:out,encoding:'utf8',timeout:15000});
async function snapshot(page,name){
 await page.screenshot({path:resolve(out,name+'.png'),fullPage:true});
 const dom=await page.evaluate(()=>({title:document.title,viewport:{width:innerWidth,height:innerHeight},document:{scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight},text:document.body.innerText,buttons:Array.from(document.querySelectorAll('button,[role="button"]')).map(e=>{const r=e.getBoundingClientRect();const c=getComputedStyle(e);return {name:e.getAttribute('aria-label')||e.textContent.trim(),disabled:e.hasAttribute('disabled')||e.getAttribute('aria-disabled')==='true',rect:{x:r.x,y:r.y,width:r.width,height:r.height},color:c.color,background:c.backgroundColor,fontSize:c.fontSize};}),fields:Array.from(document.querySelectorAll('input,textarea')).map(e=>{const r=e.getBoundingClientRect();return {type:e.type,label:e.getAttribute('aria-label'),placeholder:e.getAttribute('placeholder'),rect:{x:r.x,y:r.y,width:r.width,height:r.height}}})}));
 await write(name+'.json',dom);evidence.states.push({name,screenshot:name+'.png',dom:name+'.json'});
}
async function overlay(page,name){
 if(!helperPort)return;
 const start=evidence.console.length;
 try{await page.evaluate(()=>{document.title='[Human] atepdf critique';window.scrollTo(0,0)});await page.addScriptTag({url:`http://localhost:${helperPort}/detect.js`});await page.waitForTimeout(2500);evidence.overlay[name]={injected:true,console:evidence.console.slice(start)};await page.screenshot({path:resolve(out,name+'-overlay.png'),fullPage:true});}
 catch(error){evidence.overlay[name]={injected:false,error:String(error),console:evidence.console.slice(start)};}
}
try{
 for(const [name,width,height] of [['desktop',1440,1000],['phone',390,844]]){
  const context=await browser.newContext({viewport:{width,height},acceptDownloads:true,serviceWorkers:'block'});
  await context.route('**/*',async route=>{const r=route.request(),url=new URL(r.url());const allowed=(url.origin===base&&r.method()==='GET')||(helperPort&&['localhost','127.0.0.1'].includes(url.hostname)&&Number(url.port)===helperPort&&r.method()==='GET');if(!allowed){evidence.blocked.push({url:r.url(),method:r.method()});return route.abort('blockedbyclient')}return route.continue()});
  await context.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
  const page=await context.newPage();
  page.on('request',r=>evidence.requests.push({viewport:name,url:r.url(),method:r.method(),type:r.resourceType()}));
  page.on('console',m=>evidence.console.push({viewport:name,type:m.type(),text:m.text()}));
  page.on('pageerror',e=>evidence.pageErrors.push({viewport:name,message:e.message}));
  const response=await page.goto(base,{waitUntil:'networkidle'});evidence[name]={status:response.status(),csp:response.headers()['content-security-policy']};
  await page.getByRole('textbox',{name:'Tell atepdf what to do'}).waitFor();
  await snapshot(page,name+'-empty');
  if(name==='desktop'){
   evidence.overlay.preflight=await page.evaluate(()=>{document.title='[Human] atepdf critique';const s=document.createElement('script');s.id='impeccable-mutation-preflight';s.textContent='window.__impeccablePreflight=true';document.head.appendChild(s);return {title:document.title,scriptTagPresent:!!document.getElementById(s.id),scriptExecuted:window.__impeccablePreflight===true}});
   if(evidence.overlay.preflight.scriptTagPresent&&evidence.overlay.preflight.scriptExecuted){
    try{const raw=runHelper(['live-server','--background']);await write('live-server-start.txt',raw.replace(/"(?:serverToken|token)"\s*:\s*"[^\"]*"/g,'"token":"[redacted]"'));const info=JSON.parse(raw);helperPort=info.port??info.serverPort;helperStarted=!!helperPort;evidence.helper={started:helperStarted,port:helperPort,keys:Object.keys(info),cwd:out,writeScope:'sandbox restricted to evidence directory'};}
    catch(error){evidence.helper={started:false,error:String(error),stderr:String(error.stderr??'')};}
   }
  }
  await overlay(page,name+'-empty');
  await page.getByLabel('Choose PDF files').setInputFiles(['tests/fixtures/brief.pdf','tests/fixtures/appendix.pdf']);
  await page.getByText('Your 2 PDFs are ready.',{exact:false}).waitFor();
  await snapshot(page,name+'-imported');
  await overlay(page,name+'-imported');
  await page.getByRole('button',{name:'Merge',exact:true}).click();
  await page.getByTestId('result-facts').filter({hasText:'3 pages'}).waitFor({timeout:20000});
  await snapshot(page,name+'-result');
  await overlay(page,name+'-result');
  const downloadEvent=page.waitForEvent('download');await page.getByTestId('current-result').getByRole('button',{name:'Save PDF',exact:true}).click();const download=await downloadEvent;await download.saveAs(resolve(out,name+'-merged.pdf'));
  await page.getByTestId('current-result').getByRole('button',{name:'Preview',exact:true}).click();
  await page.getByRole('region',{name:'Read-only preview'}).waitFor();
  await page.getByText('Rendering page…').waitFor({state:'hidden',timeout:20000});
  await snapshot(page,name+'-preview');
  await context.close();
 }
}catch(error){evidence.error=String(error);}
finally{
 if(helperStarted){try{evidence.helper.stop=runHelper(['live-server','stop','--keep-inject']);}catch(error){evidence.helper.stopError=String(error)}}
 await browser.close();evidence.finishedAt=new Date().toISOString();evidence.overlay.visibility='Headless isolated browser; no user-visible browser presentation requested or claimed';await write('browser-evidence.json',evidence);
}
if(evidence.error)process.exitCode=1;
