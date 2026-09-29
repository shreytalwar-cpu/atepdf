import {test, expect, type Page} from '@playwright/test';
import {quickPlan, type Request as PlannerRequest} from '../../packages/contracts/src/protocol';

const healthy = {connected:true, enabled:true, remaining:2, token:'test-only-csrf', model:'gpt-6-luna'};
async function send(page:Page, text:string) {
  await page.getByRole('textbox', {name:'Tell atepdf what to do'}).fill(text);
  await page.getByRole('button', {name:'Send message'}).click();
}

for (const mode of ['healthy', 'disabled', 'unavailable', 'authentication', 'allowance', 'provider failure', 'pending status'] as const) {
  test(`explicit local actions bypass planning: ${mode}`, async ({page}, testInfo) => {
    let modelCalls = 0, statusCalls = 0;
    let release!:()=>void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/planner/status', async route => {
      statusCalls++;
      if (mode === 'pending status') await pending;
      if (mode === 'unavailable') { await route.abort(); return; }
      await route.fulfill({json:{...healthy, enabled:mode !== 'disabled'}}).catch(()=>{});
    });
    await page.route('**/api/planner', async route => {
      modelCalls++;
      if (mode === 'healthy') {
        await route.fulfill({json:quickPlan(route.request().postDataJSON() as PlannerRequest, 'merge')});
      } else {
        await route.fulfill({status:mode === 'authentication' ? 401 : mode === 'allowance' ? 429 : 503, json:{error:`Synthetic ${mode}`}});
      }
    });
    try {
      await page.goto('/');
      await page.getByRole('button', {name:'Try the two sample PDFs'}).click();
      await expect(page.getByText('Your 2 PDFs are ready.', {exact:false})).toBeVisible();
      if (mode === 'pending status') {
        await page.getByRole('button', {name:'OpenAI connection'}).click();
        await expect.poll(() => statusCalls).toBe(1);
      }
      await page.getByRole('button', {name:'Merge', exact:true}).click();
      // Observe transport directly, including a successful mocked response:
      // a rendered success alone would hide the original routing defect.
      await expect.poll(async () => modelCalls || await page.getByTestId('current-result').count(), {timeout:3_000}).toBeGreaterThan(0);
      expect(modelCalls).toBe(0);
      expect(statusCalls).toBe(mode === 'pending status' ? 1 : 0);
      await expect(page.getByTestId('result-facts')).toContainText('3 pages');
      await page.getByRole('button', {name:'Make searchable', exact:true}).click();
      await expect(page.getByTestId('previous-result')).toHaveCount(1);
      await page.getByRole('button', {name:'Compress', exact:true}).click();
      await expect(page.getByRole('button', {name:'Create optimised copy', exact:true})).toBeVisible();
      await expect(page.getByText('Image quality may change;', {exact:false})).toBeVisible();
      await expect(page.getByTestId('previous-result')).toHaveCount(1);
      await page.getByRole('button', {name:'Create optimised copy', exact:true}).click();
      await expect(page.getByTestId('previous-result')).toHaveCount(2);
      await expect(page.getByTestId('result-facts')).toContainText('3 pages');
      await page.getByRole('button', {name:'Undo', exact:true}).click();
      await expect(page.getByTestId('previous-result')).toHaveCount(3);
      expect(modelCalls).toBe(0);
      expect(statusCalls).toBe(mode === 'pending status' ? 1 : 0);
      await testInfo.attach('routing-counts', {body:JSON.stringify({mode,modelCalls,statusCalls,actions:['merge','ocr','compress','undo']}),contentType:'application/json'});
    } finally { release(); }
  });
}

for (const code of [401, 429, 503]) {
  test(`local recovery after a free-form planner error ${code}`, async ({page}, testInfo) => {
    let calls = 0;
    await page.route('**/api/planner/status', route => route.fulfill({json:healthy}));
    await page.route('**/api/planner', async route => {
      calls++;
      await route.fulfill({status:code, json:{error:`Synthetic provider error ${code}`}});
    });
    await page.goto('/');
    await page.getByRole('button', {name:'Try the two sample PDFs'}).click();
    await expect(page.getByText('Your 2 PDFs are ready.', {exact:false})).toBeVisible();
    await send(page, 'Please combine both documents');
    await expect(page.getByTestId('assistant-message').last()).toContainText(`Synthetic provider error ${code}`);
    expect(calls).toBe(1);
    await page.getByRole('button', {name:'Merge', exact:true}).click();
    await expect.poll(async () => calls > 1 || await page.getByTestId('current-result').count() > 0).toBe(true);
    expect(calls).toBe(1);
    await expect(page.getByTestId('result-facts')).toContainText('3 pages');
    await testInfo.attach('routing-counts', {body:JSON.stringify({providerError:code,freeFormCalls:1,localActionCalls:calls-1}),contentType:'application/json'});
  });
}

test('missing local inputs are rejected and ambiguous typed requests remain planner requests', async ({page}) => {
  let calls = 0;
  await page.route('**/api/planner/status', route => route.fulfill({json:healthy}));
  await page.route('**/api/planner', async route => {
    calls++;
    const req = route.request().postDataJSON() as PlannerRequest;
    await route.fulfill({json:{schemaVersion:'1.0',requestId:req.requestId,workspaceRevision:req.workspaceRevision,planner:{schemaVersion:'1.0',status:'clarify',reasonCode:'ambiguous_reference',steps:[],resultRefs:[],clarification:{question:'Which pages should I remove?',choices:[]}}}});
  });
  await page.goto('/');
  await page.getByRole('button', {name:'Merge', exact:true}).click();
  await expect(page.getByTestId('assistant-message').last()).toContainText(/Choose|invalid/i);
  expect(calls).toBe(0);
  await page.getByLabel('Choose PDF files').setInputFiles(['tests/fixtures/brief.pdf','tests/fixtures/appendix.pdf']);
  await expect(page.getByText('Your 2 PDFs are ready.', {exact:false})).toBeVisible();
  await page.getByRole('button', {name:'Compress', exact:true}).click();
  await page.getByRole('button', {name:'Create optimised copy', exact:true}).click();
  await expect(page.getByText('Choose one PDF or create a merged result first.', {exact:true})).toBeVisible();
  await send(page, 'Remove some pages');
  await expect(page.getByText('Which pages should I remove?', {exact:true})).toBeVisible();
  expect(calls).toBe(1);
  await expect(page.getByTestId('current-result')).toHaveCount(0);
});
