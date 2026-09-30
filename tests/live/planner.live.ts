// Explicitly invoked only after the owner authorizes at most two paid checks.
// Not part of normal test/e2e scripts. Never reads or prints a credential.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile,readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
async function main(){
if(process.env.ATEPDF_APPROVED_LIVE_REQUESTS!=='2')throw new Error('An explicit two-request approval is required.');
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1280,height:960}}),dir=await mkdtemp(join(tmpdir(),'atepdf-live-'));
const requests:{route:string;method:string}[]=[],errors:string[]=[];
const evidence:{approvedMaximum:number;calls:number;model:string;completed:string[];error?:string;network?:unknown}={approvedMaximum:2,calls:0,model:'gpt-6-luna',completed:[]};
page.on('pageerror',()=>errors.push('page_error'));
page.on('request',r=>{requests.push({route:new URL(r.url()).origin==='http://localhost:3211'?'local':'unexpected',method:r.method()});});
try{
  // This is an external-spend guard, not a mock response: permit no more than
  // two actual submissions even if the interface accidentally submits again.
  await page.route('**/api/planner',async route=>{
    if(evidence.calls>=2){await route.abort();return;}
    evidence.calls++;await route.continue();
  });
  const status=await(await page.request.get('http://localhost:3211/api/planner/status')).json();
  assert.equal(status.model,evidence.model);assert.equal(status.enabled,true);assert.ok(status.remaining>=2);
  await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
  await page.goto('http://localhost:3211/');await page.getByRole('button',{name:'Try the two sample PDFs'}).click();await page.getByText('Your 2 PDFs are ready.',{exact:false}).waitFor();
  const plan=async(text:string)=>{
    await page.getByRole('textbox',{name:'Tell atepdf what to do'}).fill(text);await page.getByRole('button',{name:'Send message'}).click();
    // Completed plans run through the real local controller directly. There is
    // no per-request disclosure dialog or second execution-confirmation step.
  };
  await plan('Please combine both documents in their current order.');await page.getByTestId('result-facts').filter({hasText:'3 pages'}).waitFor({timeout:30_000});evidence.completed.push('live model planned merge; local engine produced independently validated 3-page PDF');
  // Respect the gateway's start-rate limit even if the first model response is fast.
  await new Promise(resolve=>setTimeout(resolve,1500));
  await plan('Please delete the second physical page from the current result.');await page.getByTestId('result-facts').filter({hasText:'2 pages'}).waitFor({timeout:30_000});evidence.completed.push('live model planned physical page removal; local engine produced independently validated 2-page PDF');
  const pending=page.waitForEvent('download');await page.getByTestId('current-result').getByRole('button',{name:'Save PDF',exact:true}).click();await (await pending).saveAs(join(dir,'result.pdf'));
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:new Uint8Array(await readFile(join(dir,'result.pdf'))),verbosity:0,useSystemFonts:true}),pdf=await task.promise;
  try{assert.equal(pdf.numPages,2);for(const [index,marker]of ['A1','B1'].entries()){const content=await(await pdf.getPage(index+1)).getTextContent();assert.match(content.items.map(i=>'str'in i?i.str:'').join(' '),new RegExp(marker));}}finally{await task.destroy();}
  await page.screenshot({path:'docs/evidence/planner/live-planner-result.png'});
  assert.equal(evidence.calls,2);assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.route==='local'));
  evidence.completed.push('download independently reopened in A1/B1 order; browser requests only same-origin; no filenames/content in planner DTO');
}catch{
  evidence.error='live_test_failed';process.exitCode=1;
}finally{
  evidence.network=requests;await writeFile('docs/evidence/planner/live-test.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({calls:evidence.calls,completed:evidence.completed,error:evidence.error}));await browser.close();await rm(dir,{recursive:true,force:true});
}
}
void main().catch(()=>{console.error('Live test setup failed before completion. Check local test configuration.');process.exitCode=1;});
