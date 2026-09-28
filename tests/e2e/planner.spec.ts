import {test,expect,type Page} from '@playwright/test';
import {quickPlan,type Request as PlannerRequest} from '../../packages/contracts/src/protocol';
const status={connected:true,enabled:true,remaining:2,token:'test-only-csrf',model:'gpt-5.6-luna'};
async function ready(page:import('@playwright/test').Page,getStatus=()=>status){await page.route('**/api/planner/status',route=>route.fulfill({json:getStatus()}));await page.goto('/');await page.getByRole('button',{name:'Try the two sample PDFs'}).click();await expect(page.getByText('Your 2 PDFs are ready.',{exact:false})).toBeVisible();}
async function send(page:Page,text:string){await page.getByRole('textbox',{name:'Tell atepdf what to do'}).fill(text);await page.getByRole('button',{name:'Send message'}).click();}
async function noPlanningConsent(page:Page){
  await expect(page.getByRole('button',{name:'Plan this request',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Create local copy',exact:true})).toHaveCount(0);
  await expect(page.getByText('To plan this,',{exact:false})).toHaveCount(0);
}
test('mocked planner transport: Send → redacted complete plan → real local result → follow-up',async({page})=>{
  const sent:PlannerRequest[]=[];const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/planner',async route=>{const req=route.request().postDataJSON() as PlannerRequest;sent.push(req);await route.fulfill({json:quickPlan(req,'merge')});});
  await ready(page,()=>({...status,remaining:sent.length?0:1,enabled:!sent.length}));await send(page,'Please combine brief.pdf with appendix.pdf in the order added.');
  await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  await noPlanningConsent(page);await expect(page.getByRole('button',{name:'Keep working',exact:true})).toHaveCount(0);
  expect(sent).toHaveLength(1);expect(JSON.stringify(sent)).not.toMatch(/brief\.pdf|appendix\.pdf|checksum|inspection|bytes|password/);expect(sent[0].instruction).toContain(sent[0].files[0].ref);
  await page.getByRole('button',{name:'OpenAI connection'}).click();
  await expect(page.getByText('Your key is saved locally. Paid planning is paused',{exact:false})).toBeVisible();
  await page.getByRole('textbox',{name:'Tell atepdf what to do'}).fill('remove page 2');await page.getByRole('textbox',{name:'Tell atepdf what to do'}).press('Enter');await expect(page.getByTestId('result-facts')).toContainText('2 pages');expect(sent).toHaveLength(1);expect(errors).toEqual([]);
});
test('direct planner cancellation ignores a late complete plan and keeps local quick actions usable',async({page})=>{
  let requests=0,finished=0,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/planner',async route=>{requests++;const req=route.request().postDataJSON() as PlannerRequest;await gate;await route.fulfill({json:quickPlan(req,'merge')}).catch(()=>{});finished++;});
  await ready(page);await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  try{
    await send(page,'Please combine both documents');await expect(page.getByTestId('progress-message')).toContainText('Planning your request');
    await expect.poll(()=>requests).toBe(1);await noPlanningConsent(page);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByText('Planning cancelled. No local files changed.')).toBeVisible();
    await expect(page.getByTestId('previous-result')).toHaveCount(0);await expect(page.getByTestId('result-facts')).toContainText('3 pages');
    await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('previous-result')).toHaveCount(1);
    release();await expect.poll(()=>finished).toBe(1);await expect(page.getByTestId('progress-message')).toHaveCount(0);
    await expect(page.getByTestId('previous-result')).toHaveCount(1);await expect(page.getByTestId('result-facts')).toContainText('3 pages');expect(requests).toBe(1);
  }finally{release();}
});

test('cancelling direct planner setup prevents any later model request',async({page})=>{
  await ready(page);
  let arrived!:()=>void,release!:()=>void,finished=0,requests=0;
  const started=new Promise<void>(resolve=>{arrived=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/planner/status',async route=>{arrived();await gate;await route.fulfill({json:status}).catch(()=>{});finished++;});
  await page.route('**/api/planner',async route=>{requests++;await route.fulfill({status:500,json:{error:'Unexpected synthetic transport call'}});});
  try{
    await send(page,'Please combine both documents');await started;await page.getByRole('button',{name:'Cancel',exact:true}).click();
    // The local setup request is deliberately still held: Stop must unlock
    // immediately, rather than wait for its network response to arrive.
    await expect(page.getByText('Planning cancelled. No local files changed.')).toBeVisible({timeout:3_000});
    await expect(page.getByTestId('current-result')).toHaveCount(0);await expect(page.getByTestId('progress-message')).toHaveCount(0,{timeout:3_000});expect(requests).toBe(0);
    await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');expect(requests).toBe(0);
    release();await expect.poll(()=>finished).toBeGreaterThan(0);expect(requests).toBe(0);
  }finally{release();}
});

for(const invalid of ['incomplete','stale','truncated JSON'] as const){
  test(`direct planner ${invalid} response never changes a committed result`,async({page})=>{
    let requests=0;
    await page.route('**/api/planner',async route=>{
      requests++;const req=route.request().postDataJSON() as PlannerRequest;
      if(invalid==='truncated JSON'){await route.fulfill({contentType:'application/json',body:'{"schemaVersion":"1.0","planner":{"status":"plan","steps":['});return;}
      const envelope=quickPlan(req,'merge');
      if(invalid==='stale')envelope.workspaceRevision++;
      else delete (envelope.planner as unknown as Record<string,unknown>).resultRefs;
      await route.fulfill({json:envelope});
    });
    await ready(page);await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');
    await send(page,'Please combine both documents');await expect.poll(()=>requests).toBe(1);
    const failure=page.getByTestId('assistant-message').last();
    await expect(failure).toContainText(invalid==='stale'?'Files changed.':invalid==='incomplete'?'Incomplete or invalid plan.':/JSON|Planning.*failed|Planning.*finish/i);
    await noPlanningConsent(page);await expect(page.getByTestId('progress-message')).toHaveCount(0);
    await expect(page.getByTestId('previous-result')).toHaveCount(0);await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  });
}

test('direct balanced-compression plan retains its image-quality choice before local execution',async({page})=>{
  let requests=0;
  await page.route('**/api/planner',async route=>{requests++;await route.fulfill({json:quickPlan(route.request().postDataJSON() as PlannerRequest,'compress')});});
  await ready(page);await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  await send(page,'Please optimize this document');await expect(page.getByRole('button',{name:'Create optimised copy',exact:true})).toBeVisible();
  await noPlanningConsent(page);await expect(page.getByTestId('previous-result')).toHaveCount(0);await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  await page.getByRole('button',{name:'Create optimised copy',exact:true}).click();await expect(page.getByTestId('previous-result')).toHaveCount(1);await expect(page.getByTestId('result-facts')).toContainText('3 pages');expect(requests).toBe(1);
});
test('privacy rejection happens before transport, unknown instruction with no key stays honest',async({page})=>{
  await page.route('**/api/planner/status',route=>route.fulfill({json:{...status,connected:false,enabled:false,remaining:0}}));
  const posted:string[]=[];page.on('request',r=>{if(r.method()==='POST')posted.push(r.url());});await page.goto('/');
  await page.getByRole('textbox',{name:'Tell atepdf what to do'}).fill('Use password=synthetic-canary-secret');await page.getByRole('button',{name:'Send message'}).click();await expect(page.getByText('Keep keys and passwords out of chat.',{exact:false})).toBeVisible();expect(posted).toEqual([]);
  await page.getByRole('button',{name:'OpenAI connection'}).click();await expect(page.getByText('Connect OpenAI for optional AI planning.',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Plan this request'})).toHaveCount(0);expect(posted).toEqual([]);
});

test('masked local key setup keeps the key outside chat and model transport',async({page})=>{
  const canary='sk-synthetic-local-key-not-a-real-secret',saved:string[]=[],modelPosts:string[]=[];
  await page.route('**/api/planner/status',route=>route.fulfill({json:{...status,connected:false,enabled:false,remaining:0}}));
  await page.route('**/api/planner/key',async route=>{saved.push(route.request().postDataJSON().key);expect(route.request().headers()['x-atepdf-token']).toBe(status.token);await route.fulfill({json:{saved:true,enabled:false}});});
  page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/planner'))modelPosts.push(r.url());});
  await page.goto('/');await page.getByRole('button',{name:'OpenAI connection'}).click();const input=page.getByRole('textbox',{name:'OpenAI project key'});await expect(input).toHaveAttribute('type','password');await input.fill(canary);await page.getByRole('button',{name:'Save key on this computer'}).click();await expect(page.getByText('Your key is saved on this computer.',{exact:false})).toBeVisible();await expect(input).toHaveCount(0);expect(saved).toEqual([canary]);expect(modelPosts).toEqual([]);await expect(page.getByTestId('conversation')).not.toContainText(canary);
});
