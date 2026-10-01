import {test,expect,type Page} from '@playwright/test';
import {openSettings,closeSettings,startOver} from './ui';
const status={connected:true,enabled:true,remaining:2,token:'synthetic',model:'gpt-6-luna'};
async function ready(page:Page){await page.goto('/');await page.getByLabel('Choose PDF files').setInputFiles(['tests/fixtures/brief.pdf','tests/fixtures/appendix.pdf']);await expect(page.getByText('Your 2 PDFs are ready.',{exact:false})).toBeVisible();}
for(const action of ['Cancel','Start Over'] as const)test(`delayed sample + ${action} leaves the active workspace authoritative`,async({page})=>{
  let release!:()=>void,calls=0,modelCalls=0;
  const pending=new Promise<void>(done=>release=done);
  await page.route('**/fixtures/*.pdf',async route=>{calls++;await pending;await route.continue().catch(()=>{});});
  await page.route('**/api/planner',async route=>{modelCalls++;await route.abort();});
  await page.goto('/');
  await page.getByRole('button',{name:'Try with sample PDFs'}).click();
  await expect.poll(()=>calls).toBe(2);
  if(action==='Cancel')await page.getByRole('button',{name:'Cancel',exact:true}).click();
  else await startOver(page);
  await expect(page.getByLabel('Choose PDF files')).toBeEnabled();
  release();await expect(page.getByTestId('current-result')).toHaveCount(0);
  await expect(page.getByText('Your 2 PDFs are ready.',{exact:false})).toHaveCount(0);
  await page.getByLabel('Choose PDF files').setInputFiles(['tests/fixtures/brief.pdf','tests/fixtures/appendix.pdf']);
  await expect(page.getByText('Your 2 PDFs are ready.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');expect(modelCalls).toBe(0);
});

test('late setup status after Start over cannot reopen a closed setup choice',async({page})=>{
  let release!:()=>void,calls=0;const pending=new Promise<void>(done=>release=done);
  await page.route('**/api/planner/status',async route=>{calls++;await pending;await route.fulfill({json:status}).catch(()=>{});});
  // Settings ▸ AI checks the connection; Start over makes that check stale.
  await ready(page);await openSettings(page,'AI');await expect.poll(()=>calls).toBe(1);await closeSettings(page);
  await startOver(page);
  release();await expect(page.getByRole('button',{name:'Try with sample PDFs'})).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByText(/Connected · up to|AI planning is ready/)).toHaveCount(0);await expect(page.getByRole('button',{name:'Create pairing code'})).toHaveCount(0);await expect(page.getByTestId('assistant-message')).toHaveCount(0);
});

test('late export receipt after Start over stays off the new result; external bytes survive',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;w.__exported=[];w.showSaveFilePicker=async()=>({createWritable:async()=>({write:async(bytes:Uint8Array)=>{w.__exported=Array.from(bytes);},close:()=>new Promise<void>(done=>{w.__finishSave=done;}),abort:async()=>{}})});
  });
  await ready(page);await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('current-result')).toBeVisible();
  await page.getByTestId('current-result').getByRole('button',{name:'Save PDF',exact:true}).click();await expect.poll(()=>page.evaluate(()=>Boolean((window as any).__finishSave))).toBe(true);
  const before=await page.evaluate(()=>JSON.stringify((window as any).__exported));
  await startOver(page);
  await page.evaluate(()=>(window as any).__finishSave());await expect(page.getByRole('button',{name:'Try with sample PDFs'})).toBeVisible();
  await expect(page.getByText('Saved to your device',{exact:true})).toHaveCount(0);expect(await page.evaluate(()=>JSON.stringify((window as any).__exported))).toBe(before);
});
