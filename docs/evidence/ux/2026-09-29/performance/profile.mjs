import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const out='.build/ux-20260929/performance',suffix=process.argv[2]??'';
const report={scope:'One cold desktop Chrome navigation; 1440x1000; CPU 4x slowdown; 1.6 Mbps download, 0.75 Mbps upload, 150 ms latency; local preview server; not physical mobile or production CDN.',requests:[],errors:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),cdp=await context.newCDPSession(page);
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://localhost:3213'||(u.pathname==='/api/planner'&&route.request().method()==='POST')){report.errors.push('Unexpected request blocked: '+u.origin+u.pathname);return route.abort();}return route.continue()});
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1000000/8,uploadThroughput:.75*1000000/8,connectionType:'cellular4g'});
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await cdp.send('Performance.enable');
 await page.coverage.startJSCoverage({resetOnNavigation:false});
 await page.addInitScript(()=>{window.__perf={longTasks:[],lcp:[]};new PerformanceObserver(l=>window.__perf.longTasks.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});new PerformanceObserver(l=>window.__perf.lcp.push(...l.getEntries().map(e=>({start:e.startTime,size:e.size,tag:e.element?.tagName})))).observe({type:'largest-contentful-paint',buffered:true});});
 page.on('response',async r=>{const u=new URL(r.url());if(u.pathname==='/'){const body=await r.body();report.htmlSHA256=crypto.createHash('sha256').update(body).digest('hex')}report.requests.push({path:u.pathname,status:r.status(),encoding:r.headers()['content-encoding']??null})});
 const start=Date.now();await page.goto('http://localhost:3213',{timeout:90000,waitUntil:'load'});await page.getByRole('button',{name:'Choose files',exact:true}).waitFor();report.interactiveControlMs=Date.now()-start;
 await page.getByRole('button',{name:'Processed on your device',exact:true}).click();await page.getByRole('button',{name:'Got it',exact:true}).waitFor();report.respondedToClickMs=Date.now()-start;await page.getByRole('button',{name:'Got it',exact:true}).click();
 report.metrics=await page.evaluate(()=>({navigation:performance.getEntriesByType('navigation').map(e=>({domContentLoaded:e.domContentLoadedEventEnd,load:e.loadEventEnd,responseEnd:e.responseEnd,encodedBodySize:e.encodedBodySize,transferSize:e.transferSize})),resources:performance.getEntriesByType('resource').map(e=>({path:new URL(e.name).pathname,encoded:e.encodedBodySize,decoded:e.decodedBodySize,transfer:e.transferSize,duration:e.duration})),paint:performance.getEntriesByType('paint').map(e=>({name:e.name,time:e.startTime})),...window.__perf}));
 report.cpu=await cdp.send('Performance.getMetrics');
 const coverage=await page.coverage.stopJSCoverage();report.coverage=[];
 for(const entry of coverage){if(!entry.url.startsWith('http://localhost:3213'))continue;report.coverage.push({path:new URL(entry.url).pathname,totalChars:entry.source?.length??entry.text?.length,functions:entry.functions?.length});if(/\/index-[^/]+\.js$/.test(entry.url)){const source=entry.source??entry.text;if(source){await fs.writeFile(out+'/entry'+suffix+'.js',source);report.entrySHA256=crypto.createHash('sha256').update(source).digest('hex');}await fs.writeFile(out+'/entry-coverage'+suffix+'.json',JSON.stringify({url:entry.url,functions:entry.functions,ranges:entry.ranges},null,2));}}
 await page.screenshot({path:out+'/throttled-ready'+suffix+'.png'});
 await context.close();
}catch(e){report.errors.push(e.message);process.exitCode=1}finally{await browser.close();report.closed=true;await fs.writeFile(out+'/throttled-startup'+suffix+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify({scope:report.scope,browser:report.browser,html:report.htmlSHA256,ready:report.interactiveControlMs,clickResponse:report.respondedToClickMs,metrics:report.metrics,coverage:report.coverage,errors:report.errors},null,2));}
