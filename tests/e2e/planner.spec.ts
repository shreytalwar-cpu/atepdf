import {test,expect} from '@playwright/test';
import {quickPlan,type Request as PlannerRequest} from '../../packages/contracts/src/protocol';
const status={connected:true,enabled:true,remaining:2,token:'test-only-csrf',model:'gpt-5.6-luna'};
async function ready(page:import('@playwright/test').Page,getStatus=()=>status){await page.route('**/api/planner/status',route=>route.fulfill({json:getStatus()}));await page.goto('/');await page.getByRole('button',{name:'Try the two sample PDFs'}).click();await expect(page.getByText('Your 2 PDFs are ready.',{exact:false})).toBeVisible();}
test('mocked planner transport: review redacted instruction → complete plan → confirm → real local result → follow-up',async({page})=>{
  const sent:PlannerRequest[]=[];const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/planner',async route=>{const req=route.request().postDataJSON() as PlannerRequest;sent.push(req);await route.fulfill({json:quickPlan(req,'merge')});});
  await ready(page,()=>({...status,remaining:sent.length?0:1,enabled:!sent.length}));await page.getByRole('textbox',{name:'Tell atepdf what to do'}).fill('Please combine brief.pdf with appendix.pdf in the order added.');await page.getByRole('button',{name:'Send message'}).click();
  await expect(page.getByRole('button',{name:'Plan this request'})).toBeVisible();expect(sent).toHaveLength(0);await expect(page.getByText('To plan this,',{exact:false})).not.toContainText('brief.pdf');
  await page.getByRole('button',{name:'Plan this request'}).click();await expect(page.getByRole('button',{name:'Create local copy'})).toBeVisible();await expect(page.getByTestId('current-result')).toHaveCount(0);expect(sent).toHaveLength(1);expect(JSON.stringify(sent)).not.toMatch(/brief\.pdf|appendix\.pdf|checksum|inspection|bytes|password/);expect(sent[0].instruction).toContain(sent[0].files[0].ref);
  await page.getByRole('button',{name:'Create local copy'}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');expect(sent).toHaveLength(1);
  await expect(page.getByRole('button',{name:'OpenAI connection'})).toContainText('AI planning paused');
  await page.getByRole('textbox',{name:'Tell atepdf what to do'}).fill('remove page 2');await page.getByRole('textbox',{name:'Tell atepdf what to do'}).press('Enter');await expect(page.getByTestId('result-facts')).toContainText('2 pages');expect(sent).toHaveLength(1);expect(errors).toEqual([]);
});
test('planner cancellation and stale consent cannot execute or overwrite a committed result',async({page})=>{
  let requests=0,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/planner',async route=>{requests++;const req=route.request().postDataJSON() as PlannerRequest;await gate;await route.fulfill({json:quickPlan(req,'merge')}).catch(()=>{});});
  await ready(page);await page.getByRole('textbox',{name:'Tell atepdf what to do'}).fill('Please combine both documents');await page.getByRole('button',{name:'Send message'}).click();await page.getByRole('button',{name:'Plan this request'}).click();await expect(page.getByText('Planning your request…',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByText('Planning cancelled. No local files changed.')).toBeVisible();release();await expect(page.getByTestId('current-result')).toHaveCount(0);expect(requests).toBe(1);
  await page.getByRole('textbox',{name:'Tell atepdf what to do'}).fill('Please combine both documents');await page.getByRole('button',{name:'Send message'}).click();await expect(page.getByRole('button',{name:'Plan this request'})).toBeVisible();await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');await expect(page.getByRole('button',{name:'Plan this request'})).toHaveCount(0);expect(requests).toBe(1);
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
