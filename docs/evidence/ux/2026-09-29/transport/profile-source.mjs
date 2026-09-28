import {chromium} from '@playwright/test';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {gunzipSync} from 'node:zlib';
import {performance as clock} from 'node:perf_hooks';
import {startWeb, stopWeb} from '../../../scripts/beta/web.mjs';

const out = 'docs/evidence/ux/2026-09-29/transport';
const scratch = '/private/tmp/atepdf-ux-tDVWpF';
const origin = 'http://localhost:3213';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const expectedHTML = 'e9c07d03c77cab35ab9e9c3732a94aa7e07999cb5c8e4d5ff288deb9faf82c47';
const expectedEntry = '1689e2e2cdd9a47626f15c477509e41f9b3d4d58aa5b8d83d04bd08893b166d1';
const entryPath = '/_expo/static/js/web/index-630012e833bbef46f5441d9899bb7fda.js';
await mkdir(out, {recursive:true});
await stopWeb(scratch);
await startWeb(scratch,{port:3213,localOnly:true});
const report = {scope:'Same immutable candidate10 on local-only beta host. Four isolated cold Chrome contexts; one identity/gzip pair per profile, not a statistical sample or physical-device/CDN result.', browserPath:'Browser plugin not available; project Playwright with installed headless Chrome.', measurements:[], serverSource:{}, providerCalls:0};
for (const file of ['scripts/beta/server.mjs','scripts/beta/static-response.mjs']) report.serverSource[file]=sha(await readFile(file));
const browser = await chromium.launch({channel:'chrome',headless:true});
report.browser=browser.version();
try {
  for (const constrained of [true, false]) for (const encoding of ['identity','gzip']) {
    const label = `${constrained?'constrained':'loopback'}-${encoding}`;
    const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',extraHTTPHeaders:{'Accept-Encoding':encoding}});
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const run = {label,encoding,viewport:{width:1440,height:1000},cpuSlowdown:constrained?4:1,network:constrained?{downloadMbps:1.6,uploadMbps:0.75,latencyMs:150}:'unthrottled loopback',requests:[],errors:[],console:[]};
    const observations=[];
    try {
      await context.route('**/*', route => {
        const u=new URL(route.request().url());
        if(u.origin!==origin || (u.pathname==='/api/planner'&&route.request().method()==='POST')) {run.errors.push('Unexpected request blocked: '+u.origin+u.pathname); return route.abort();}
        return route.continue();
      });
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
      if(constrained) await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1000000/8,uploadThroughput:0.75*1000000/8,connectionType:'cellular4g'});
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:run.cpuSlowdown});
      await cdp.send('Performance.enable');
      await page.coverage.startJSCoverage({resetOnNavigation:false});
      await page.addInitScript(()=>{
        window.__perf={longTasks:[],lcp:[]};
        new PerformanceObserver(list=>window.__perf.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
        new PerformanceObserver(list=>window.__perf.lcp.push(...list.getEntries().map(e=>({start:e.startTime,size:e.size,tag:e.element?.tagName})))).observe({type:'largest-contentful-paint',buffered:true});
      });
      page.on('pageerror',error=>run.errors.push(error.message));
      page.on('console',message=>{if(['error','warning'].includes(message.type()))run.console.push({type:message.type(),text:message.text()})});
      page.on('response',response=>observations.push((async()=>{
        const path = new URL(response.url()).pathname;
        const item = {path,status:response.status(),encoding:response.headers()['content-encoding']??null,contentLength:response.headers()['content-length']??null};
        run.requests.push(item);
        if(path==='/' || path===entryPath) item.decodedSHA256=sha(await response.body());
      })()));
      const start=clock.now();
      await page.goto(origin,{timeout:90_000,waitUntil:'load'});
      await page.getByRole('button',{name:'Choose files',exact:true}).waitFor();
      run.visibleChooseFilesMs=Math.round(clock.now()-start);
      run.url=page.url();run.title=await page.title();
      assert.match(run.title,/atepdf/i);
      assert.equal(await page.getByRole('heading',{name:'Drop files here',exact:true}).isVisible(),true);
      await page.getByRole('button',{name:'Processed on your device',exact:true}).click();
      await page.getByRole('button',{name:'Got it',exact:true}).waitFor();
      run.privacyResponseFromNavigationMs=Math.round(clock.now()-start);
      await page.getByRole('button',{name:'Got it',exact:true}).click();
      run.metrics=await page.evaluate(()=>({navigation:performance.getEntriesByType('navigation').map(e=>({domContentLoaded:e.domContentLoadedEventEnd,load:e.loadEventEnd,responseEnd:e.responseEnd})),resources:performance.getEntriesByType('resource').map(e=>({path:new URL(e.name).pathname,encoded:e.encodedBodySize,decoded:e.decodedBodySize,transfer:e.transferSize,duration:e.duration})),paint:performance.getEntriesByType('paint').map(e=>({name:e.name,time:e.startTime})),...window.__perf}));
      run.cpu=await cdp.send('Performance.getMetrics');
      await page.coverage.stopJSCoverage();
      await page.screenshot({path:out+'/'+label+'.png'});
      await Promise.all(observations);
      assert.equal(run.requests.find(r=>r.path==='/').decodedSHA256,expectedHTML);
      const entry=run.requests.find(r=>r.path===entryPath);
      assert.equal(entry.decodedSHA256,expectedEntry);assert.equal(entry.encoding,encoding==='gzip'?'gzip':null);
      assert.deepEqual(run.errors,[]);assert.deepEqual(run.console,[]);
      run.pass=true;
      console.log(JSON.stringify({label,visibleMs:run.visibleChooseFilesMs,clickMs:run.privacyResponseFromNavigationMs,entry,errors:run.errors}));
    } catch(error) {run.errors.push(error.stack);run.pass=false;throw error;}
    finally {report.measurements.push(run);await context.close();}
  }
  const raw = encoding => new Promise((resolve,reject)=>{
    const start=clock.now();
    const req=request(origin+entryPath,{headers:{'Accept-Encoding':encoding},agent:false},response=>{
      const chunks=[];response.on('data',chunk=>chunks.push(chunk));
      response.on('end',()=>{const body=Buffer.concat(chunks),decoded=encoding==='gzip'?gunzipSync(body):body;resolve({encoding,status:response.statusCode,wireBytes:body.length,decodedSHA256:sha(decoded),milliseconds:clock.now()-start});});
    });req.setTimeout(10000,()=>req.destroy(new Error('Static timing request timed out')));req.on('error',reject);req.end();
  });
  report.concurrent=await Promise.all(Array.from({length:8},(_,index)=>raw(index%2?'gzip':'identity')));
  for(const result of report.concurrent){assert.equal(result.status,200);assert.equal(result.decodedSHA256,expectedEntry);}
} finally {
  await browser.close();report.browserClosed=true;
  await writeFile(out+'/profile.json',JSON.stringify(report,null,2)+'\n');
}
