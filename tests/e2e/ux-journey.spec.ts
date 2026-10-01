import {test, expect, type Locator, type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {quickPlan, type Request as PlannerRequest} from '../../packages/contracts/src/protocol';
import {composer} from './ui';

const disconnected = {connected:false, enabled:false, remaining:0, token:'test-only-csrf', model:'gpt-6-luna'};
const connected = {...disconnected, connected:true, enabled:true, remaining:2};

test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', {value:undefined, configurable:true}));
  await page.route('**/api/planner/status', route => route.fulfill({json:disconnected}));
  // Every test is local. A missing synthetic planner handler must fail closed,
  // including if the developer's preview server has a real provider configured.
  await page.route('**/api/planner', route => route.fulfill({status:503, json:{error:'No synthetic planner response configured'}}));
});

async function ready(page:Page) {
  await page.goto('/');
  await page.getByLabel('Choose PDF files').setInputFiles(['tests/fixtures/brief.pdf', 'tests/fixtures/appendix.pdf']);
  await expect(page.getByText('Your 2 PDFs are ready.', {exact:false})).toBeVisible();
}

async function send(page:Page, instruction:string) {
  await composer(page).fill(instruction);
  await page.getByRole('button', {name:'Send message', exact:true}).click();
}

// A typed merge takes the same request path as the Merge suggestion chip (D-04), which is
// offered only before a result exists.
async function merged(page:Page) {
  await send(page, 'merge');
  await expect(page.getByTestId('result-facts')).toContainText('3 pages');
}

async function savedBytes(page:Page) {
  const pending = page.waitForEvent('download');
  await page.getByTestId('current-result').getByRole('button', {name:'Save PDF', exact:true}).click();
  const stream = await (await pending).createReadStream();
  if (!stream) throw new Error('The actual PDF download did not provide a readable stream.');
  const chunks:Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function insideConversation(page:Page, control:Locator) {
  const [viewport, input, box] = await Promise.all([
    page.getByTestId('conversation').boundingBox(),
    composer(page).boundingBox(),
    control.boundingBox(),
  ]);
  if (!viewport || !input || !box) return false;
  const bottom = Math.min(viewport.y + viewport.height, input.y);
  return box.y >= viewport.y - 1 && box.y + box.height <= bottom + 1 &&
    box.x >= viewport.x - 1 && box.x + box.width <= viewport.x + viewport.width + 1;
}

async function currentResultIsReachable(page:Page) {
  // toBeVisible alone accepts an element outside a scrolling viewport. Check
  // the title and primary action's actual geometry without scrolling them in.
  const current = page.getByTestId('current-result');
  await expect.poll(() => insideConversation(page, current.getByRole('heading').first())).toBe(true);
  await expect.poll(() => insideConversation(page, current.getByRole('button', {name:'Save PDF', exact:true}))).toBe(true);
}

async function scrollToEarlierMessages(page:Page) {
  const conversation = page.getByTestId('conversation');
  await conversation.hover();
  await page.mouse.wheel(0, -5000);
  await expect(page.getByRole('button', {name:'Latest message', exact:true})).toBeVisible();
  await expect.poll(() => insideConversation(page, page.getByTestId('user-message').first())).toBe(true);
}

test('compact explicit submissions reveal the new result, including after closing preview', async ({page}) => {
  await page.setViewportSize({width:320, height:568});
  await ready(page);
  await merged(page);
  await currentResultIsReachable(page);

  await page.getByTestId('current-result').getByRole('button', {name:'Preview', exact:true}).click();
  await expect(page.getByRole('region', {name:'Read-only preview'})).toBeVisible();
  await expect(page.getByText('Rendering page…')).not.toBeVisible();
  await page.getByRole('button', {name:'Close preview', exact:true}).click();
  await expect(page.getByRole('region', {name:'Read-only preview'})).toHaveCount(0);
  await scrollToEarlierMessages(page);

  await send(page, 'Remove physical page 2 from the merged result.');
  await expect(page.getByTestId('result-facts')).toContainText('2 pages');
  await currentResultIsReachable(page);
});

test('result titles, current status and Undo reflect the actual output history', async ({page}) => {
  await ready(page);
  await merged(page);
  const current = page.getByTestId('current-result');
  await expect(current.getByRole('heading', {name:'Merged PDF', exact:true})).toBeVisible();
  await expect(current.getByText('Current', {exact:true})).toBeVisible();
  await expect(current.getByRole('button', {name:'Undo', exact:true})).toHaveCount(0);

  await send(page, 'Remove physical page 2 from the merged result.');
  await expect(page.getByTestId('result-facts')).toContainText('2 pages');
  await expect(current.getByRole('heading', {name:'PDF with page 2 removed', exact:true})).toBeVisible();
  await expect(current.getByText('Current', {exact:true})).toBeVisible();
  const previous = page.getByTestId('previous-result');
  await expect(previous).toHaveCount(1);
  await expect(previous.getByRole('heading')).toHaveText('Merged PDF');
  await expect(previous.getByText('Earlier', {exact:true})).toHaveCount(1);
  await expect(previous).toContainText('3 pages');
  await expect(previous.getByRole('button', {name:'Undo', exact:true})).toHaveCount(0);

  await current.getByRole('button', {name:'Undo', exact:true}).click();
  await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  await expect(current.getByRole('heading')).toHaveText('Merged PDF');
  await expect(current.getByText('Current', {exact:true})).toHaveCount(1);
  await expect(previous).toHaveCount(2);
  await expect(previous.getByRole('heading')).toHaveText(['Merged PDF', 'PDF with page 2 removed']);
  await expect(previous.getByText('Earlier', {exact:true})).toHaveCount(2);
  await expect(current.getByRole('button', {name:'Undo', exact:true})).toHaveCount(0);
});

test('invalid physical page reply gives the valid range and preserves the saved current PDF', async ({page}) => {
  await ready(page);
  await merged(page);
  const before = await savedBytes(page);
  await send(page, 'Remove physical page 99 from the merged result.');
  const reply = page.getByTestId('assistant-message').last();
  await expect(reply).toContainText(/1\s*(?:–|-|to)\s*3/);
  await expect(reply).toContainText(/unchanged/i);
  await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  await expect(page.getByTestId('current-result').getByRole('heading')).toHaveText('Merged PDF');
  await expect(page.getByTestId('previous-result')).toHaveCount(0);
  expect(await savedBytes(page)).toEqual(before);
});

test('disconnected product help explains local actions and offers inline AI connection without a model call', async ({page}) => {
  const plannerRequests:string[] = [];
  page.on('request', request => {if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/planner') plannerRequests.push(request.url());});
  await ready(page);
  await merged(page);
  await send(page, 'What can atepdf do?');
  const reply = page.getByTestId('assistant-message').last();
  await expect(reply).toContainText(/merge/i);
  await expect(reply).toContainText(/remove.{0,30}pages?/i);
  await expect(reply).toContainText(/compress/i);
  await expect(reply).toContainText(/searchable/i);
  await expect(reply.getByRole('button', {name:'AI connection', exact:true})).toBeVisible();
  await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  await expect(page.getByTestId('previous-result')).toHaveCount(0);
  expect(plannerRequests).toEqual([]);
  // The connection controls live in Settings ▸ AI (development builds), not in the chat.
  await reply.getByRole('button', {name:'AI connection', exact:true}).click();
  await expect(page.getByRole('dialog', {name:'Settings'}).getByRole('textbox', {name:'OpenAI project key'})).toBeVisible();
  expect(plannerRequests).toEqual([]);
});

test('scrolling upward during delayed synthetic planning preserves the reading position when the real result arrives', async ({page}) => {
  await page.setViewportSize({width:390, height:844});
  let enabled = false, calls = 0, release!:() => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/api/planner/status', route => route.fulfill({json:enabled ? connected : disconnected}));
  await page.route('**/api/planner', async route => {
    calls++;
    const request = route.request().postDataJSON() as PlannerRequest;
    await gate;
    await route.fulfill({json:quickPlan(request, 'merge')}).catch(() => {});
  });
  await ready(page);
  for (let index = 0; index < 4; index++) {
    await merged(page);
    await expect(page.getByTestId('previous-result')).toHaveCount(index);
  }
  enabled = true;
  try {
    await send(page, 'Please combine both PDFs in the order I added them.');
    await expect.poll(() => calls).toBe(1);
    await expect(page.getByTestId('progress-message')).toContainText('Planning');
    await scrollToEarlierMessages(page);
    const anchor = page.getByTestId('user-message').first();
    const before = await anchor.boundingBox();
    expect(before).not.toBeNull();
    release();
    await expect(page.getByTestId('previous-result')).toHaveCount(4);
    await expect(page.getByTestId('progress-message')).toHaveCount(0);
    // Include delayed list-layout callbacks, not just the React commit frame.
    await page.waitForTimeout(350);
    const after = await anchor.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(4);
    await expect(page.getByRole('button', {name:'Latest message', exact:true})).toBeVisible();
    await page.getByRole('button', {name:'Latest message', exact:true}).click();
    await currentResultIsReachable(page);
    expect(calls).toBe(1);
  } finally {release();}
});

for (const width of [320, 390]) {
  test(`long synthetic filenames stay inside the ${width}px workspace before and after merge`, async ({page}) => {
    await page.setViewportSize({width, height:width === 320 ? 568 : 844});
    const name = `Synthetic_${'VeryLongUnbrokenFilename'.repeat(8)}.pdf`;
    await page.goto('/');
    await page.getByLabel('Choose PDF files').setInputFiles([
      {name, mimeType:'application/pdf', buffer:await readFile('tests/fixtures/brief.pdf')},
      {name:'appendix.pdf', mimeType:'application/pdf', buffer:await readFile('tests/fixtures/appendix.pdf')},
    ]);
    await expect(page.getByText('Your 2 PDFs are ready.', {exact:false})).toBeVisible();
    await expect(page.getByText(name, {exact:true})).toHaveCount(1);
    const noOverflow = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.getByTestId('conversation').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    };
    await noOverflow();
    await merged(page);
    await noOverflow();
    await currentResultIsReachable(page);
  });
}
