# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ux-journey.spec.ts >> compact explicit submissions reveal the new result, including after closing preview
- Location: tests/e2e/ux-journey.spec.ts:71:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 20000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main "PDF conversation" [ref=e5]:
  - generic [ref=e6]:
    - generic "atepdf" [ref=e10]:
      - img "atepdf" [ref=e12]
    - generic [ref=e13]:
      - button "Processed on your device" [ref=e14] [cursor=pointer]
      - button "OpenAI connection" [ref=e19] [cursor=pointer]
      - button "Start over" [ref=e21] [cursor=pointer]
  - generic [ref=e27]:
    - generic [ref=e29]:
      - generic [ref=e31]:
        - generic [ref=e36]:
          - generic [ref=e37]: brief.pdf
          - generic [ref=e38]: 3.1 kB · Original · 1
        - generic [ref=e43]:
          - generic [ref=e44]: appendix.pdf
          - generic [ref=e45]: 2.1 kB · Original · 2
        - generic [ref=e46]: I’ve added 2 PDFs.
      - generic [ref=e49]:
        - generic [ref=e50]: Your 2 PDFs are ready. 3 pages in total. What would you like to do? Merge uses the order you added them.
        - button "Copy" [ref=e54] [cursor=pointer]
      - generic [ref=e58]: Merge my PDFs.
      - generic [ref=e64]:
        - generic [ref=e65]: I merged your PDFs in the order added. Here’s your PDF.
        - generic [ref=e66]:
          - generic [ref=e67]:
            - generic [ref=e72]:
              - heading "Merged PDF" [level=1] [ref=e73]
              - generic [ref=e74]: 3 pages · 3.1 kB
              - generic [ref=e75]: Earlier result
            - img "Validated" [ref=e76]
          - generic [ref=e78]:
            - button "Save PDF" [ref=e79] [cursor=pointer]
            - button "Preview" [ref=e83] [cursor=pointer]
      - generic [ref=e88]: Remove physical page 2 from the merged result.
      - generic [ref=e94]:
        - generic [ref=e95]: I removed page 2. Here’s the new copy.
        - generic [ref=e96]:
          - generic [ref=e97]:
            - generic [ref=e102]:
              - heading "PDF with page 2 removed" [level=1] [ref=e103]
              - generic [ref=e104]: 2 pages · 2.3 kB
              - generic [ref=e105]: Current result
            - img "Validated" [ref=e106]
          - generic [ref=e108]:
            - button "Save PDF" [ref=e109] [cursor=pointer]
            - button "Preview" [ref=e113] [cursor=pointer]
            - button "Undo" [ref=e118] [cursor=pointer]
          - generic [ref=e123]: Tell me what you’d like to do next.
    - generic [ref=e124]:
      - generic [ref=e126]:
        - textbox "Tell atepdf what to do" [ref=e127]:
          - /placeholder: Tell atepdf what to do…
        - generic [ref=e128]:
          - button "Add files" [ref=e129] [cursor=pointer]
          - generic [ref=e131]:
            - button "Send message" [disabled]
      - generic [ref=e134]:
        - generic [ref=e135]:
          - button "Merge" [ref=e136] [cursor=pointer]
          - button "Compress" [ref=e142] [cursor=pointer]
          - button "Make searchable" [ref=e147] [cursor=pointer]
        - generic [ref=e155]:
          - generic [ref=e156]: "Current: PDF with page 2 removed · 2 pages"
          - button "Help" [ref=e161] [cursor=pointer]
  - button "Choose PDF files" [ref=e163]
```

# Test source

```ts
  1   | import {test, expect, type Locator, type Page} from '@playwright/test';
  2   | import {readFile} from 'node:fs/promises';
  3   | import {quickPlan, type Request as PlannerRequest} from '../../packages/contracts/src/protocol';
  4   | 
  5   | const disconnected = {connected:false, enabled:false, remaining:0, token:'test-only-csrf', model:'gpt-6-luna'};
  6   | const connected = {...disconnected, connected:true, enabled:true, remaining:2};
  7   | 
  8   | test.beforeEach(async ({page}) => {
  9   |   await page.emulateMedia({reducedMotion:'reduce'});
  10  |   await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', {value:undefined, configurable:true}));
  11  |   await page.route('**/api/planner/status', route => route.fulfill({json:disconnected}));
  12  |   // Every test is local. A missing synthetic planner handler must fail closed,
  13  |   // including if the developer's preview server has a real provider configured.
  14  |   await page.route('**/api/planner', route => route.fulfill({status:503, json:{error:'No synthetic planner response configured'}}));
  15  | });
  16  | 
  17  | async function ready(page:Page) {
  18  |   await page.goto('/');
  19  |   await page.getByLabel('Choose PDF files').setInputFiles(['tests/fixtures/brief.pdf', 'tests/fixtures/appendix.pdf']);
  20  |   await expect(page.getByText('Your 2 PDFs are ready.', {exact:false})).toBeVisible();
  21  | }
  22  | 
  23  | async function send(page:Page, instruction:string) {
  24  |   await page.getByRole('textbox', {name:'Tell atepdf what to do'}).fill(instruction);
  25  |   await page.getByRole('button', {name:'Send message', exact:true}).click();
  26  | }
  27  | 
  28  | async function merged(page:Page) {
  29  |   await page.getByRole('button', {name:'Merge', exact:true}).click();
  30  |   await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  31  | }
  32  | 
  33  | async function savedBytes(page:Page) {
  34  |   const pending = page.waitForEvent('download');
  35  |   await page.getByTestId('current-result').getByRole('button', {name:'Save PDF', exact:true}).click();
  36  |   const stream = await (await pending).createReadStream();
  37  |   if (!stream) throw new Error('The actual PDF download did not provide a readable stream.');
  38  |   const chunks:Buffer[] = [];
  39  |   for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  40  |   return Buffer.concat(chunks);
  41  | }
  42  | 
  43  | async function insideConversation(page:Page, control:Locator) {
  44  |   const [viewport, input, box] = await Promise.all([
  45  |     page.getByTestId('conversation').boundingBox(),
  46  |     page.getByRole('textbox', {name:'Tell atepdf what to do'}).boundingBox(),
  47  |     control.boundingBox(),
  48  |   ]);
  49  |   if (!viewport || !input || !box) return false;
  50  |   const bottom = Math.min(viewport.y + viewport.height, input.y);
  51  |   return box.y >= viewport.y - 1 && box.y + box.height <= bottom + 1 &&
  52  |     box.x >= viewport.x - 1 && box.x + box.width <= viewport.x + viewport.width + 1;
  53  | }
  54  | 
  55  | async function currentResultIsReachable(page:Page) {
  56  |   // toBeVisible alone accepts an element outside a scrolling viewport. Check
  57  |   // the title and primary action's actual geometry without scrolling them in.
  58  |   const current = page.getByTestId('current-result');
> 59  |   await expect.poll(() => insideConversation(page, current.getByRole('heading').first())).toBe(true);
      |                                                                                           ^ Error: expect(received).toBe(expected) // Object.is equality
  60  |   await expect.poll(() => insideConversation(page, current.getByRole('button', {name:'Save PDF', exact:true}))).toBe(true);
  61  | }
  62  | 
  63  | async function scrollToEarlierMessages(page:Page) {
  64  |   const conversation = page.getByTestId('conversation');
  65  |   await conversation.hover();
  66  |   await page.mouse.wheel(0, -5000);
  67  |   await expect(page.getByRole('button', {name:'Latest message', exact:true})).toBeVisible();
  68  |   await expect.poll(() => insideConversation(page, page.getByTestId('user-message').first())).toBe(true);
  69  | }
  70  | 
  71  | test('compact explicit submissions reveal the new result, including after closing preview', async ({page}) => {
  72  |   await page.setViewportSize({width:320, height:568});
  73  |   await ready(page);
  74  |   await merged(page);
  75  |   await currentResultIsReachable(page);
  76  | 
  77  |   await page.getByTestId('current-result').getByRole('button', {name:'Preview', exact:true}).click();
  78  |   await expect(page.getByRole('region', {name:'Read-only preview'})).toBeVisible();
  79  |   await expect(page.getByText('Rendering page…')).not.toBeVisible();
  80  |   await page.getByRole('button', {name:'Close preview', exact:true}).click();
  81  |   await expect(page.getByRole('region', {name:'Read-only preview'})).toHaveCount(0);
  82  |   await scrollToEarlierMessages(page);
  83  | 
  84  |   await send(page, 'Remove physical page 2 from the merged result.');
  85  |   await expect(page.getByTestId('result-facts')).toContainText('2 pages');
  86  |   await currentResultIsReachable(page);
  87  | });
  88  | 
  89  | test('result titles, current status and Undo reflect the actual output history', async ({page}) => {
  90  |   await ready(page);
  91  |   await merged(page);
  92  |   const current = page.getByTestId('current-result');
  93  |   await expect(current.getByRole('heading', {name:'Merged PDF', exact:true})).toBeVisible();
  94  |   await expect(current.getByText('Current result', {exact:true})).toBeVisible();
  95  |   await expect(current.getByRole('button', {name:'Undo', exact:true})).toHaveCount(0);
  96  | 
  97  |   await send(page, 'Remove physical page 2 from the merged result.');
  98  |   await expect(page.getByTestId('result-facts')).toContainText('2 pages');
  99  |   await expect(current.getByRole('heading', {name:'PDF with page 2 removed', exact:true})).toBeVisible();
  100 |   await expect(current.getByText('Current result', {exact:true})).toBeVisible();
  101 |   const previous = page.getByTestId('previous-result');
  102 |   await expect(previous).toHaveCount(1);
  103 |   await expect(previous.getByRole('heading')).toHaveText('Merged PDF');
  104 |   await expect(previous.getByText('Earlier result', {exact:true})).toHaveCount(1);
  105 |   await expect(previous).toContainText('3 pages');
  106 |   await expect(previous.getByRole('button', {name:'Undo', exact:true})).toHaveCount(0);
  107 | 
  108 |   await current.getByRole('button', {name:'Undo', exact:true}).click();
  109 |   await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  110 |   await expect(current.getByRole('heading')).toHaveText('Merged PDF');
  111 |   await expect(current.getByText('Current result', {exact:true})).toHaveCount(1);
  112 |   await expect(previous).toHaveCount(2);
  113 |   await expect(previous.getByRole('heading')).toHaveText(['Merged PDF', 'PDF with page 2 removed']);
  114 |   await expect(previous.getByText('Earlier result', {exact:true})).toHaveCount(2);
  115 |   await expect(current.getByRole('button', {name:'Undo', exact:true})).toHaveCount(0);
  116 | });
  117 | 
  118 | test('invalid physical page reply gives the valid range and preserves the saved current PDF', async ({page}) => {
  119 |   await ready(page);
  120 |   await merged(page);
  121 |   const before = await savedBytes(page);
  122 |   await send(page, 'Remove physical page 99 from the merged result.');
  123 |   const reply = page.getByTestId('assistant-message').last();
  124 |   await expect(reply).toContainText(/1\s*(?:–|-|to)\s*3/);
  125 |   await expect(reply).toContainText(/unchanged/i);
  126 |   await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  127 |   await expect(page.getByTestId('current-result').getByRole('heading')).toHaveText('Merged PDF');
  128 |   await expect(page.getByTestId('previous-result')).toHaveCount(0);
  129 |   expect(await savedBytes(page)).toEqual(before);
  130 | });
  131 | 
  132 | test('disconnected product help explains local actions and offers inline AI connection without a model call', async ({page}) => {
  133 |   const plannerRequests:string[] = [];
  134 |   page.on('request', request => {if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/planner') plannerRequests.push(request.url());});
  135 |   await ready(page);
  136 |   await merged(page);
  137 |   await send(page, 'What can atepdf do?');
  138 |   const reply = page.getByTestId('assistant-message').last();
  139 |   await expect(reply).toContainText(/merge/i);
  140 |   await expect(reply).toContainText(/remove.{0,30}pages?/i);
  141 |   await expect(reply).toContainText(/compress/i);
  142 |   await expect(reply).toContainText(/searchable/i);
  143 |   await expect(reply.getByRole('button', {name:'AI connection', exact:true})).toBeVisible();
  144 |   await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  145 |   await expect(page.getByTestId('previous-result')).toHaveCount(0);
  146 |   expect(plannerRequests).toEqual([]);
  147 |   await reply.getByRole('button', {name:'AI connection', exact:true}).click();
  148 |   await expect(page.getByRole('textbox', {name:'OpenAI project key'})).toBeVisible();
  149 |   expect(plannerRequests).toEqual([]);
  150 | });
  151 | 
  152 | test('scrolling upward during delayed synthetic planning preserves the reading position when the real result arrives', async ({page}) => {
  153 |   await page.setViewportSize({width:390, height:844});
  154 |   let enabled = false, calls = 0, release!:() => void;
  155 |   const gate = new Promise<void>(resolve => {release = resolve;});
  156 |   await page.route('**/api/planner/status', route => route.fulfill({json:enabled ? connected : disconnected}));
  157 |   await page.route('**/api/planner', async route => {
  158 |     calls++;
  159 |     const request = route.request().postDataJSON() as PlannerRequest;
```