import {test, expect} from '@playwright/test';
import {quickPlan as localQuickPlan} from '../../packages/contracts/src/protocol';
import {hostedLocalContext,validateHosted,type HostedPayload as PlannerRequest} from '../../packages/planner/src/outbound/schema';
import {composer,send,samples} from './ui';
const quickPlan=(wire:PlannerRequest,action:Parameters<typeof localQuickPlan>[1])=>localQuickPlan(hostedLocalContext(validateHosted(wire)),action);

// SHR-106 / D-04, CONV-01: suggestion chips are conversational requests. A chip sends the
// same sentence through the same submit path as typing it, so it is planned by AI when AI
// is enabled, and follows the existing local fallback (unchanged here) when it is not.
// This replaces the superseded check that explicit buttons bypass planning.
const healthy = {connected:true, enabled:true, remaining:2, token:'test-only-csrf', model:'gpt-6-luna'};

for (const mode of ['healthy', 'disabled', 'unavailable', 'provider failure'] as const) {
  test(`suggestion chips follow the typed-request path: ${mode}`, async ({page}, testInfo) => {
    let modelCalls = 0, statusCalls = 0;
    const instructions:string[] = [];
    await page.route('**/api/planner/status', async route => {
      statusCalls++;
      if (mode === 'unavailable') { await route.abort(); return; }
      await route.fulfill({json:{...healthy, enabled:mode !== 'disabled'}});
    });
    await page.route('**/api/planner', async route => {
      modelCalls++;
      const req = route.request().postDataJSON() as PlannerRequest;instructions.push(req.instruction);
      if (mode === 'healthy') await route.fulfill({json:quickPlan(req, /searchable/i.test(req.instruction) ? 'ocr' : 'merge')});
      else await route.fulfill({status:503, json:{error:'Synthetic provider failure'}});
    });
    await page.goto('/');
    await samples(page);
    await page.getByRole('button', {name:'Merge', exact:true}).click();
    // The chip's request is in the transcript exactly as if it had been typed.
    await expect(page.getByTestId('user-message').last()).toContainText('Merge these PDFs');
    if (mode === 'provider failure') {
      await expect(page.getByTestId('assistant-message').last()).toContainText(/Planning|finish|failed|unavailable/i);
      await expect(page.getByTestId('current-result')).toHaveCount(0);
      expect(modelCalls).toBe(1);
      return;
    }
    await expect(page.getByTestId('result-facts')).toContainText('3 pages');
    expect(statusCalls).toBeGreaterThan(0);
    expect(modelCalls).toBe(mode === 'healthy' ? 1 : 0);
    if (mode === 'healthy') expect(instructions[0]).toMatch(/^Merge these PDFs/);
    await page.getByRole('button', {name:'Make searchable', exact:true}).click();
    await expect(page.getByTestId('previous-result')).toHaveCount(1);
    expect(modelCalls).toBe(mode === 'healthy' ? 2 : 0);
    await page.getByRole('button', {name:'Undo', exact:true}).click();
    await expect(page.getByTestId('previous-result')).toHaveCount(2);
    await testInfo.attach('routing-counts', {body:JSON.stringify({mode,modelCalls,statusCalls,instructions}),contentType:'application/json'});
  });
}

test('a compression chip without AI keeps the image-quality choice before any copy is made', async ({page}) => {
  let modelCalls = 0;
  await page.route('**/api/planner/status', route => route.fulfill({json:{...healthy, enabled:false}}));
  await page.route('**/api/planner', async route => {modelCalls++; await route.abort();});
  await page.goto('/');
  await samples(page);
  await page.getByRole('button', {name:'Merge', exact:true}).click();
  await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  await page.getByRole('button', {name:'Compress', exact:true}).click();
  await expect(page.getByRole('button', {name:'Create Copy', exact:true})).toBeVisible();
  await expect(page.getByText('Image quality may change;', {exact:false})).toBeVisible();
  await expect(page.getByTestId('previous-result')).toHaveCount(0);
  await page.getByRole('button', {name:'Create Copy', exact:true}).click();
  await expect(page.getByTestId('previous-result')).toHaveCount(1);
  await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  expect(modelCalls).toBe(0);
});

for (const code of [401, 429, 503]) {
  test(`local recovery after a free-form planner error ${code}`, async ({page}, testInfo) => {
    let calls = 0, enabled = true;
    await page.route('**/api/planner/status', route => route.fulfill({json:{...healthy, enabled}}));
    await page.route('**/api/planner', async route => {
      calls++;
      await route.fulfill({status:code, json:{error:`Synthetic provider error ${code}`}});
    });
    await page.goto('/');
    await samples(page);
    await send(page, 'Please combine both documents');
    await expect(page.getByTestId('assistant-message').last()).toContainText(`Synthetic provider error ${code}`);
    expect(calls).toBe(1);
    // With AI paused, the same chip still has its existing local route; the error left nothing behind.
    enabled = false;
    await page.getByRole('button', {name:'Merge', exact:true}).click();
    await expect(page.getByTestId('result-facts')).toContainText('3 pages');
    expect(calls).toBe(1);
    await testInfo.attach('routing-counts', {body:JSON.stringify({providerError:code,freeFormCalls:1,localActionCalls:calls-1}),contentType:'application/json'});
  });
}

test('missing local inputs are rejected and ambiguous typed requests remain planner requests', async ({page}) => {
  let calls = 0, enabled = false;
  await page.route('**/api/planner/status', route => route.fulfill({json:{...healthy, enabled}}));
  await page.route('**/api/planner', async route => {
    calls++;
    const req = route.request().postDataJSON() as PlannerRequest;
    await route.fulfill({json:{schemaVersion:'1.0',requestId:req.requestId,workspaceRevision:req.workspaceRevision,planner:{schemaVersion:'1.0',status:'clarify',reasonCode:'ambiguous_reference',steps:[],resultRefs:[],clarification:{question:'Which pages should I remove?',choices:[]}}}});
  });
  await page.goto('/');
  // No files: suggestion chips are not offered; a typed merge is refused locally.
  await expect(page.getByRole('button', {name:'Merge', exact:true})).toHaveCount(0);
  await send(page, 'merge');
  await expect(page.getByTestId('assistant-message').last()).toContainText(/Choose|invalid/i);
  expect(calls).toBe(0);
  await page.getByLabel('Choose PDF files').setInputFiles(['tests/fixtures/brief.pdf','tests/fixtures/appendix.pdf']);
  await expect(page.getByText('Your 2 PDFs are ready.', {exact:false})).toBeVisible();
  await send(page, 'compress');
  await page.getByRole('button', {name:'Create Copy', exact:true}).click();
  await expect(page.getByText('Choose one PDF or create a merged result first.', {exact:true})).toBeVisible();
  enabled = true;
  await send(page, 'Remove some pages');
  await expect(page.getByText('Which pages should I remove?', {exact:true})).toBeVisible();
  expect(calls).toBe(1);
  await expect(page.getByTestId('current-result')).toHaveCount(0);
  await expect(composer(page)).toBeEnabled();
});
