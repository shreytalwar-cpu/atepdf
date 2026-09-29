# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: local-actions.spec.ts >> local recovery after a free-form planner error 401
- Location: tests/e2e/local-actions.spec.ts:55:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 1
Received: 2
```

# Page snapshot

```yaml
- main "PDF conversation" [ref=e5]:
  - generic [ref=e6]:
    - generic "atepdf" [ref=e10]:
      - img "atepdf" [ref=e12]
    - generic [ref=e13]:
      - button "Processed on your device" [ref=e14] [cursor=pointer]
      - button "OpenAI connection" [ref=e20] [cursor=pointer]
      - button "Start over" [ref=e22] [cursor=pointer]
  - generic [ref=e28]:
    - generic [ref=e30]:
      - generic [ref=e32]:
        - generic [ref=e37]:
          - generic [ref=e38]: brief.pdf
          - generic [ref=e39]: 3.1 kB · Original · 1
        - generic [ref=e44]:
          - generic [ref=e45]: appendix.pdf
          - generic [ref=e46]: 2.1 kB · Original · 2
        - generic [ref=e47]: I’ve added 2 PDFs.
      - generic [ref=e50]:
        - generic [ref=e51]: Your 2 PDFs are ready. 3 pages in total. What would you like to do? Merge uses the order you added them.
        - button "Copy" [ref=e55] [cursor=pointer]
      - generic [ref=e59]: Please combine both documents
      - generic [ref=e64]:
        - generic [ref=e65]: Synthetic provider error 401
        - button "Copy" [ref=e69] [cursor=pointer]
      - generic [ref=e73]: Merge my PDFs.
      - generic [ref=e78]:
        - generic [ref=e79]: Synthetic provider error 401
        - button "Copy" [ref=e83] [cursor=pointer]
    - generic [ref=e87]:
      - generic [ref=e89]:
        - textbox "Tell atepdf what to do" [ref=e90]:
          - /placeholder: Tell atepdf what to do…
        - generic [ref=e91]:
          - button "Add files" [ref=e92] [cursor=pointer]
          - generic [ref=e94]:
            - button "Send message" [disabled]
      - generic [ref=e97]:
        - generic [ref=e98]:
          - button "Merge" [ref=e99] [cursor=pointer]
          - button "Compress" [ref=e105] [cursor=pointer]
          - button "Make searchable" [ref=e110] [cursor=pointer]
        - generic [ref=e118]:
          - generic [ref=e119]: 2 originals in this chat
          - button "Help" [ref=e121] [cursor=pointer]
  - button "Choose PDF files" [ref=e123]
```

# Test source

```ts
  1  | import {test, expect, type Page} from '@playwright/test';
  2  | import {quickPlan, type Request as PlannerRequest} from '../../packages/contracts/src/protocol';
  3  | 
  4  | const healthy = {connected:true, enabled:true, remaining:2, token:'test-only-csrf', model:'gpt-6-luna'};
  5  | async function send(page:Page, text:string) {
  6  |   await page.getByRole('textbox', {name:'Tell atepdf what to do'}).fill(text);
  7  |   await page.getByRole('button', {name:'Send message'}).click();
  8  | }
  9  | 
  10 | for (const mode of ['healthy', 'disabled', 'unavailable', 'authentication', 'allowance', 'provider failure', 'pending status'] as const) {
  11 |   test(`explicit local actions bypass planning: ${mode}`, async ({page}) => {
  12 |     let modelCalls = 0;
  13 |     let release!:()=>void;
  14 |     const pending = new Promise<void>(resolve => { release = resolve; });
  15 |     await page.route('**/api/planner/status', async route => {
  16 |       if (mode === 'pending status') await pending;
  17 |       if (mode === 'unavailable') { await route.abort(); return; }
  18 |       await route.fulfill({json:{...healthy, enabled:mode !== 'disabled'}}).catch(()=>{});
  19 |     });
  20 |     await page.route('**/api/planner', async route => {
  21 |       modelCalls++;
  22 |       if (mode === 'healthy') {
  23 |         await route.fulfill({json:quickPlan(route.request().postDataJSON() as PlannerRequest, 'merge')});
  24 |       } else {
  25 |         await route.fulfill({status:mode === 'authentication' ? 401 : mode === 'allowance' ? 429 : 503, json:{error:`Synthetic ${mode}`}});
  26 |       }
  27 |     });
  28 |     try {
  29 |       await page.goto('/');
  30 |       await page.getByRole('button', {name:'Try the two sample PDFs'}).click();
  31 |       await expect(page.getByText('Your 2 PDFs are ready.', {exact:false})).toBeVisible();
  32 |       await page.getByRole('button', {name:'Merge', exact:true}).click();
  33 |       // Observe transport directly, including a successful mocked response:
  34 |       // a rendered success alone would hide the original routing defect.
  35 |       await expect.poll(async () => modelCalls || await page.getByTestId('current-result').count()).toBeGreaterThan(0);
  36 |       expect(modelCalls).toBe(0);
  37 |       await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  38 |       await page.getByRole('button', {name:'Make searchable', exact:true}).click();
  39 |       await expect(page.getByTestId('previous-result')).toHaveCount(1);
  40 |       await page.getByRole('button', {name:'Compress', exact:true}).click();
  41 |       await expect(page.getByRole('button', {name:'Create optimised copy', exact:true})).toBeVisible();
  42 |       await expect(page.getByText('Image quality may change;', {exact:false})).toBeVisible();
  43 |       await expect(page.getByTestId('previous-result')).toHaveCount(1);
  44 |       await page.getByRole('button', {name:'Create optimised copy', exact:true}).click();
  45 |       await expect(page.getByTestId('previous-result')).toHaveCount(2);
  46 |       await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  47 |       await page.getByRole('button', {name:'Undo', exact:true}).click();
  48 |       await expect(page.getByTestId('previous-result')).toHaveCount(3);
  49 |       expect(modelCalls).toBe(0);
  50 |     } finally { release(); }
  51 |   });
  52 | }
  53 | 
  54 | for (const code of [401, 429, 503]) {
  55 |   test(`local recovery after a free-form planner error ${code}`, async ({page}) => {
  56 |     let calls = 0;
  57 |     await page.route('**/api/planner/status', route => route.fulfill({json:healthy}));
  58 |     await page.route('**/api/planner', async route => {
  59 |       calls++;
  60 |       await route.fulfill({status:code, json:{error:`Synthetic provider error ${code}`}});
  61 |     });
  62 |     await page.goto('/');
  63 |     await page.getByRole('button', {name:'Try the two sample PDFs'}).click();
  64 |     await expect(page.getByText('Your 2 PDFs are ready.', {exact:false})).toBeVisible();
  65 |     await send(page, 'Please combine both documents');
  66 |     await expect(page.getByTestId('assistant-message').last()).toContainText(`Synthetic provider error ${code}`);
  67 |     expect(calls).toBe(1);
  68 |     await page.getByRole('button', {name:'Merge', exact:true}).click();
  69 |     await expect.poll(async () => calls > 1 || await page.getByTestId('current-result').count() > 0).toBe(true);
> 70 |     expect(calls).toBe(1);
     |                   ^ Error: expect(received).toBe(expected) // Object.is equality
  71 |     await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  72 |   });
  73 | }
  74 | 
  75 | test('missing local inputs are rejected and ambiguous typed requests remain planner requests', async ({page}) => {
  76 |   let calls = 0;
  77 |   await page.route('**/api/planner/status', route => route.fulfill({json:healthy}));
  78 |   await page.route('**/api/planner', async route => {
  79 |     calls++;
  80 |     const req = route.request().postDataJSON() as PlannerRequest;
  81 |     await route.fulfill({json:{schemaVersion:'1.0',requestId:req.requestId,workspaceRevision:req.workspaceRevision,planner:{schemaVersion:'1.0',status:'clarify',reasonCode:'ambiguous_reference',steps:[],resultRefs:[],clarification:{question:'Which pages should I remove?',choices:[]}}}});
  82 |   });
  83 |   await page.goto('/');
  84 |   await page.getByRole('button', {name:'Merge', exact:true}).click();
  85 |   await expect(page.getByTestId('assistant-message').last()).toContainText(/Choose|invalid/i);
  86 |   expect(calls).toBe(0);
  87 |   await page.getByRole('button', {name:'Try the two sample PDFs'}).click();
  88 |   await expect(page.getByText('Your 2 PDFs are ready.', {exact:false})).toBeVisible();
  89 |   await page.getByRole('button', {name:'Compress', exact:true}).click();
  90 |   await page.getByRole('button', {name:'Create optimised copy', exact:true}).click();
  91 |   await expect(page.getByText('Choose one PDF or create a merged result first.', {exact:true})).toBeVisible();
  92 |   await send(page, 'Remove some pages');
  93 |   await expect(page.getByText('Which pages should I remove?', {exact:true})).toBeVisible();
  94 |   expect(calls).toBe(1);
  95 |   await expect(page.getByTestId('current-result')).toHaveCount(0);
  96 | });
  97 | 
```