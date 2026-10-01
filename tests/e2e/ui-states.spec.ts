import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {quickPlan as localQuickPlan} from '../../packages/contracts/src/protocol';
import {hostedLocalContext,validateHosted,type HostedPayload as PlannerRequest} from '../../packages/planner/src/outbound/schema';
import {composer,openSettings,openStartOver,samples,send} from './ui';

// SHR-106 state coverage (UX_SPEC 17): every major v1 state is reached through real app state
// (actual local PDF work) or a bounded harness (synthetic planner responses, the synthetic vault
// used by retention.spec, a held worker). Each state is asserted semantically; the capture is
// review evidence in docs/evidence/SHR-106-2026-10-01/web, not a pixel baseline.
const quickPlan=(wire:PlannerRequest,action:Parameters<typeof localQuickPlan>[1])=>localQuickPlan(hostedLocalContext(validateHosted(wire)),action);
const off={connected:false,enabled:false,remaining:0,token:'synthetic-states',model:'synthetic'};
const on={...off,connected:true,enabled:true,remaining:3};
const dir='docs/evidence/SHR-106-2026-10-01/web';
const T0=Date.parse('2026-09-01T09:00:00.000Z'),DAY=86_400_000;
test.beforeAll(async()=>{await mkdir(dir,{recursive:true});});

async function vault(page:Page){
  await page.addInitScript(start=>{
    const files=new Map<string,{aad:string;plain:Uint8Array}>();
    const clock=()=>Number(sessionStorage.getItem('atepdf-test-clock')||start);
    const backend={keyStatus:async()=>'ready',exists:async(name:string)=>files.has(name),
      writeSealed:async(name:string,plain:Uint8Array,aad:string)=>{files.set(name,{aad,plain:new Uint8Array(plain)});},
      readOpened:async(name:string,aad:string)=>{const f=files.get(name);if(!f)return {status:'missing'};if(f.aad!==aad)return {status:'auth'};return {status:'ok',bytes:new Uint8Array(f.plain)};},
      list:async(directory:string)=>[...files.keys()].filter(name=>name.startsWith(`${directory}/`)),remove:async(name:string)=>{files.delete(name);},
      syncDirectory:async()=>{},cleanStaging:async()=>{},usage:async()=>[...files].map(([name,f])=>({name,bytes:f.plain.length+32}))};
    (window as unknown as Record<string,unknown>).__ATEPDF_TEST_WORKSPACE__={backend,now:()=>new Date(clock()),temporary:{usage:()=>4096,clear:()=>true}};
  },T0);
}
// Captures wait for finite transitions to finish (the app publishes how many are running), never a sleep.
const still=(page:Page)=>page.waitForFunction(()=>(window as unknown as {__atepdfAnimations?:number}).__atepdfAnimations===0);
const capture=async(page:Page,name:string)=>{await still(page);await page.screenshot({path:`${dir}/${name}.png`});};

for(const scheme of ['light','dark'] as const){
  test.describe(`${scheme} appearance`,()=>{
    test.beforeEach(async({page})=>{await page.emulateMedia({colorScheme:scheme,reducedMotion:'reduce'});await page.setViewportSize({width:1024,height:720});});

    test(`A–D, J–L: empty, imported, request, result, saved and Undo (${scheme})`,async({page})=>{
      await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:async()=>({createWritable:async()=>({write:async()=>{},close:async()=>{},abort:async()=>{}})}),configurable:true}));
      await page.route('**/api/planner/status',route=>route.fulfill({json:off}));
      await page.goto('/');
      await expect(page.getByRole('heading',{name:'Drop PDFs here'})).toBeVisible();
      await expect(page.getByRole('button',{name:'Files panel'})).toBeDisabled();
      await capture(page,`A-empty-${scheme}`);
      await samples(page);
      await expect(page.getByText('Checked on this Mac',{exact:true})).toBeVisible();
      await expect(page.getByTestId('current-context')).toHaveText('2 PDFs · 3 pages');
      await capture(page,`B-C-imported-${scheme}`);
      await composer(page).fill('Merge these into one PDF');
      await expect(page.getByRole('button',{name:'Send message'})).toBeEnabled();
      await capture(page,`D-request-entered-${scheme}`);
      await page.getByRole('button',{name:'Send message'}).click();
      await expect(page.getByTestId('assistant-message').last()).toContainText(/OpenAI is not connected|merged/);
      await send(page,'merge');
      const current=page.getByTestId('current-result');
      await expect(current.getByText('Verified',{exact:true})).toBeVisible();
      await expect(current.getByText('Current',{exact:true})).toBeVisible();
      await capture(page,`J-result-${scheme}`);
      await current.getByRole('button',{name:'Save PDF',exact:true}).click();
      await expect(current.getByText('Saved to your device',{exact:true})).toBeVisible();
      await capture(page,`K-saved-${scheme}`);
      await send(page,'remove page 2');await expect(page.getByTestId('result-facts')).toContainText('2 pages');
      await current.getByRole('button',{name:'Undo',exact:true}).click();
      await expect(current.getByText('Restored',{exact:true})).toBeVisible();
      // The receipt stays with the PDF that was saved: the restored Result 1 carries it, Result 2 doesn't.
      await expect(current.getByText('Saved to your device',{exact:true})).toBeVisible();
      await expect(page.getByTestId('previous-result').filter({hasText:'Result 2'}).getByText('Saved to your device')).toHaveCount(0);
      await expect(page.getByTestId('previous-result')).toHaveCount(2);
      await capture(page,`L-undo-${scheme}`);
    });

    test(`E, G, M, N: clarification, working with atePDF AI, refusal and error (${scheme})`,async({page})=>{
      let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
      await page.route('**/api/planner/status',route=>route.fulfill({json:on}));
      await page.route('**/api/planner',async route=>{
        const req=route.request().postDataJSON() as PlannerRequest;
        if(/^(merge|combine these pdfs)/i.test(req.instruction)){await route.fulfill({json:quickPlan(req,'merge')});return;}
        if(req.pendingClarification){await route.fulfill({json:quickPlan(req,'remove',2)});return;}
        if(/^Remove a page/.test(req.instruction)){await route.fulfill({json:{schemaVersion:'1.0',requestId:req.requestId,workspaceRevision:req.workspaceRevision,planner:{schemaVersion:'1.0',status:'clarify',reasonCode:'missing_parameter',steps:[],resultRefs:[],clarification:{question:'Which page should I remove?',choices:['Page 1','Page 2','Page 3']}}}});return;}
        if(/^Combine both/.test(req.instruction)){await gate;await route.fulfill({json:quickPlan(req,'merge')}).catch(()=>{});return;}
        await route.fulfill({status:503,json:{error:'Synthetic provider failure'}});
      });
      await page.goto('/');await samples(page);
      await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');
      await send(page,'Remove a page');
      await expect(page.getByRole('button',{name:'Page 2',exact:true})).toBeVisible();
      await expect(page.getByText('Answering: Which page should I remove?')).toBeVisible();
      await capture(page,`E-clarification-${scheme}`);
      await page.getByRole('button',{name:'Page 2',exact:true}).click();
      await expect(page.getByTestId('user-message').last()).toContainText('Page 2');
      await expect(page.getByText('This question is closed.')).toBeVisible();
      await send(page,'Combine both documents');
      await expect(page.getByTestId('progress-message')).toContainText('Sending your instruction to atePDF AI.');
      await expect(page.getByTestId('progress-message')).toContainText('atePDF AI');
      await capture(page,`G-working-ai-${scheme}`);
      await page.getByRole('button',{name:'Stop',exact:true}).click();
      await expect(page.getByText('Cancelled. No files were changed.')).toBeVisible();
      release();
      await send(page,'password=synthetic-state-secret');
      await expect(page.getByText('Keep keys and passwords out of chat.',{exact:false}).last()).toBeVisible();
      await send(page,'Rearrange everything');
      await expect(page.getByTestId('assistant-message').last()).toContainText(/did not finish|unavailable|failed|not enabled/i);
      await capture(page,`M-N-refusal-error-${scheme}`);
      await expect(page.locator('body')).not.toContainText('synthetic-state-secret');
    });

    test(`F, H, I: quality confirmation, processing and cancelling (${scheme})`,async({page})=>{
      await page.route('**/api/planner/status',route=>route.fulfill({json:off}));
      await page.goto('/');
      await page.getByLabel('Choose PDF files').setInputFiles(['tests/fixtures/mixed-text-and-scan.pdf','tests/fixtures/appendix.pdf']);
      await expect(page.getByText('Your 2 PDFs are ready.',{exact:false})).toBeVisible();
      await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('4 pages');
      await page.getByRole('button',{name:'Compress',exact:true}).click();
      await expect(page.getByRole('button',{name:'Create Copy',exact:true})).toBeVisible();
      await expect(page.getByRole('button',{name:'Keep Current Result',exact:true})).toBeVisible();
      await capture(page,`F-quality-confirmation-${scheme}`);
      await page.getByRole('button',{name:'Keep Current Result',exact:true}).click();
      let releaseWorker:()=>void=()=>{};const held=new Promise<void>(resolve=>{releaseWorker=resolve;});let arrived:()=>void=()=>{};const requested=new Promise<void>(resolve=>{arrived=resolve;});
      await page.route('**/eng.traineddata.gz',async route=>{arrived();await held;await route.continue().catch(()=>{});});
      await page.getByRole('button',{name:'Make searchable',exact:true}).click();await requested;
      try{
        const activity=page.getByTestId('progress-message');
        await expect(activity).toContainText(/Making \d+ scanned pages? searchable…|Making scanned pages searchable…/);
        await expect(activity.getByRole('progressbar')).toBeVisible();
        await expect(activity).toContainText('On this Mac');
        await capture(page,`H-processing-${scheme}`);
        await page.getByRole('button',{name:'Cancel',exact:true}).click();
        await expect(page.getByText(/Cancelled\. No new result was committed\.|Cancelling…/).first()).toBeVisible();
        await capture(page,`I-cancelling-${scheme}`);
      }finally{releaseWorker();}
      await expect(page.getByText('Cancelled. No new result was committed.')).toBeVisible();
      await expect(page.getByTestId('previous-result')).toHaveCount(0);
    });

    test(`O, P, Q: Privacy & Storage, Delete Local Data and retention warnings (${scheme})`,async({page})=>{
      await vault(page);
      await page.route('**/api/planner/status',route=>route.fulfill({json:off}));
      await page.goto('/');await samples(page);
      const settings=await openSettings(page,'Privacy & Storage');
      await expect(settings.getByRole('radio',{name:'Keep until I delete it'})).toBeChecked();
      await expect(settings.getByTestId('storage-usage')).toContainText('Imported PDF copies');
      await capture(page,`O-privacy-storage-${scheme}`);
      await settings.getByRole('button',{name:'Delete Local Data…'}).click();
      await expect(settings.getByRole('heading',{name:'Delete atePDF’s local data?'})).toBeVisible();
      await expect(settings.getByRole('button',{name:'Cancel'})).toBeFocused();
      await capture(page,`P-delete-local-data-${scheme}`);
      await settings.getByRole('button',{name:'Cancel'}).click();
      await settings.getByRole('radio',{name:'Delete when atePDF quits'}).click();
      await expect(settings.getByRole('heading',{name:'Stop saving this workspace?'})).toBeVisible();
      await capture(page,`Q-retention-warning-${scheme}`);
      await settings.getByRole('button',{name:'Cancel'}).click();
      await settings.getByRole('radio',{name:'7 days'}).click();await expect(settings.getByRole('radio',{name:'7 days'})).toBeChecked();
      await page.getByRole('button',{name:'Close settings'}).click();
      await page.evaluate(t=>sessionStorage.setItem('atepdf-test-clock',String(t)),T0+8*DAY);
      await page.getByRole('button',{name:'Merge',exact:true}).click();
      await expect(page.getByText('Your saved workspace was deleted because it hadn’t changed for 7 days',{exact:false})).toBeVisible();
      await capture(page,`Q-retention-expired-banner-${scheme}`);
    });

    test(`Start Over confirmation, Quick Look, palette and onboarding (${scheme})`,async({page})=>{
      await page.route('**/api/planner/status',route=>route.fulfill({json:off}));
      await page.goto('/');await samples(page);await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');
      const sheet=await openStartOver(page);
      await expect(sheet.getByRole('button',{name:'Cancel'})).toBeVisible();
      await expect(sheet.getByRole('button',{name:'Start Over',exact:true})).toBeVisible();
      await capture(page,`start-over-${scheme}`);
      await sheet.getByRole('button',{name:'Cancel'}).click();
      await expect(page.getByTestId('current-result')).toHaveCount(1);
      await page.getByTestId('current-result').getByRole('button',{name:'Preview',exact:true}).click();
      await expect(page.getByText('Page 1 of 3',{exact:true})).toBeVisible();await expect(page.getByText('Rendering page…')).toHaveCount(0);
      await capture(page,`quick-look-${scheme}`);
      await page.getByRole('button',{name:'Close preview'}).click();
      await page.getByRole('button',{name:'More actions'}).click();
      await expect(page.getByRole('textbox',{name:'Search actions'})).toBeFocused();
      await expect(page.getByRole('button',{name:'Make smaller (compress images)'})).toBeVisible();
      await capture(page,`palette-${scheme}`);
      await page.keyboard.press('Escape');
      await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('menuitem',{name:'Introduction'}).click();
      await expect(page.getByRole('heading',{name:'Just say what you need.'})).toBeVisible();
      await capture(page,`onboarding-${scheme}`);
    });
  });
}

for(const [label,width,height] of [['T-narrow-640',640,600],['U-laptop-1280',1280,800],['V-wide-1600',1600,1000]] as const){
  test(`${label}: layout holds, Files panel docks only when wide`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.route('**/api/planner/status',route=>route.fulfill({json:off}));
    await page.goto('/');await samples(page);await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');
    const docked=width>=1120;
    await expect(page.getByRole('heading',{name:'Results'})).toHaveCount(docked?1:0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const column=await page.getByTestId('current-result').boundingBox();
    expect(column!.width).toBeLessThanOrEqual(720);
    if(!docked){await page.getByRole('button',{name:'Files panel'}).click();await expect(page.getByRole('heading',{name:'Results'})).toBeVisible();}
    await still(page);await page.screenshot({path:`${dir}/${label}.png`});
  });
}

// Motion and fast tasks (SHR-106 polish): timing never races the UI, and nothing waits on sleeps.
// A page-side observer records what the conversation shows on every DOM change.
async function recordActivity(page:Page){
  await page.evaluate(()=>{
    const log:{t:number;row:boolean;checking:boolean;result:number;verified:number}[]=[];(window as unknown as {__activity:typeof log}).__activity=log;
    const sample=()=>{const row=document.querySelector('[data-testid=progress-message],[data-testid=progress-settling]');const cards=[...document.querySelectorAll('[data-testid=current-result]')];
      const entry={t:performance.now(),row:!!row,checking:!!row&&(row as HTMLElement).innerText.includes('Checking the result'),result:cards.length,verified:cards.filter(card=>(card as HTMLElement).innerText.includes('Verified')).length};
      const last=log.at(-1);if(!last||last.row!==entry.row||last.checking!==entry.checking||last.result!==entry.result||last.verified!==entry.verified)log.push(entry);};
    sample();new MutationObserver(sample).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-testid']});
  });
}
const activityLog=(page:Page)=>page.evaluate(()=>(window as unknown as {__activity:{t:number;row:boolean;checking:boolean;result:number;verified:number}[]}).__activity);

test.describe('motion and fast tasks',()=>{
  test.beforeEach(async({page})=>{await page.setViewportSize({width:1280,height:800});await page.route('**/api/planner/status',route=>route.fulfill({json:off}));});

  test('a quick task resolves into its result without being held, with no empty frame and no early Verified',async({page})=>{
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.goto('/');await samples(page);await expect(page.getByText('Checked on this Mac',{exact:true})).toBeVisible();
    await recordActivity(page);
    await page.getByRole('button',{name:'Merge',exact:true}).click();
    await expect(page.getByTestId('current-result')).toBeVisible();await still(page);
    const log=await activityLog(page);
    const shown=log.findIndex(entry=>entry.row),arrived=log.findIndex(entry=>entry.result===1);
    expect(arrived,'the result arrived').toBeGreaterThanOrEqual(0);
    // Very fast work may resolve straight into its artifact; when the row did appear, the result
    // replaced it in the same frame (no frame shows neither, and nothing is held after the work).
    if(shown>=0&&shown<arrived)expect(log.slice(shown,arrived+1).every(entry=>entry.row||entry.result),'no frame shows neither the row nor the result').toBe(true);
    // No result (and so no Verified tag) is shown while the result is still being checked.
    expect(log.filter(entry=>entry.checking).every(entry=>entry.result===0&&entry.verified===0)).toBe(true);
    expect(log.at(-1)!.verified).toBe(1);
    await expect(page.getByTestId('progress-message')).toHaveCount(0);await expect(page.getByTestId('progress-settling')).toHaveCount(0);
  });

  test('repeated quick operations keep one current result and stable numbering',async({page})=>{
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.goto('/');await samples(page);
    await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');
    // Each request is sent the moment the composer accepts it, including while the previous reply settles.
    for(const request of ['remove page 2','undo','remove page 3']){
      await expect(page.getByRole('button',{name:'Send message'})).toHaveCount(1);
      await send(page,request);
      await expect(page.getByTestId('user-message').last()).toContainText(request);
    }
    await expect(page.getByTestId('progress-message')).toHaveCount(0);
    await expect(page.getByTestId('current-result')).toHaveCount(1);
    await expect(page.getByTestId('result-facts')).toContainText('2 pages');
    await expect(page.getByTestId('current-result')).toContainText('Result 3');
    await expect(page.getByTestId('previous-result')).toHaveCount(3);
    await still(page);
  });

  test('a result that arrives after the window narrows and widens lands in the right layout',async({page})=>{
    let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
    await page.route('**/api/planner/status',route=>route.fulfill({json:on}));
    await page.route('**/api/planner',async route=>{const req=route.request().postDataJSON() as PlannerRequest;await gate;await route.fulfill({json:quickPlan(req,'merge')}).catch(()=>{});});
    await page.goto('/');await samples(page);
    await send(page,'Combine both documents');
    await expect(page.getByTestId('progress-message')).toContainText('Working…');
    await page.setViewportSize({width:700,height:700});
    await expect(page.getByRole('heading',{name:'Results'})).toHaveCount(0);
    await page.setViewportSize({width:1400,height:900});
    await page.setViewportSize({width:900,height:800});
    release();
    await expect(page.getByTestId('current-result')).toBeVisible();
    await expect(page.getByTestId('result-facts')).toContainText('3 pages');
    await page.setViewportSize({width:1300,height:850});
    await expect(page.getByRole('heading',{name:'Results'})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect((await page.getByTestId('current-result').boundingBox())!.width).toBeLessThanOrEqual(720);
  });

  test('Reduce Motion: results fade without movement and the activity glyph is still',async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/');await samples(page);
    await recordActivity(page);
    await page.getByRole('button',{name:'Merge',exact:true}).click();
    await expect(page.getByTestId('current-result')).toBeVisible();
    // No translate or scale is ever applied to the result's entrance under Reduce Motion.
    expect(await page.getByTestId('current-result').evaluate(card=>getComputedStyle(card.parentElement!).transform)).toBe('none');
    await still(page);
    const log=await activityLog(page);
    // Same contract as with motion: nothing is held, and no frame shows neither the row nor the result.
    const shown=log.findIndex(entry=>entry.row),arrived=log.findIndex(entry=>entry.result===1);
    expect(arrived).toBeGreaterThanOrEqual(0);
    if(shown>=0&&shown<arrived)expect(log.slice(shown,arrived+1).every(entry=>entry.row||entry.result)).toBe(true);
    await send(page,'remove page 2');
    const pulse=page.getByTestId('activity-pulse').first();
    if(await pulse.count())await expect(pulse).toHaveCSS('opacity','1');
    await expect(page.getByTestId('result-facts')).toContainText('2 pages');
  });

  test('Stop during progress answers at once and commits nothing',async({page})=>{
    let releaseWorker:()=>void=()=>{};const held=new Promise<void>(resolve=>{releaseWorker=resolve;});let arrived:()=>void=()=>{};const requested=new Promise<void>(resolve=>{arrived=resolve;});
    await page.goto('/');
    await page.getByLabel('Choose PDF files').setInputFiles(['tests/fixtures/mixed-text-and-scan.pdf']);
    await expect(page.getByText('Your 1 PDF is ready.',{exact:false})).toBeVisible();
    await page.route('**/eng.traineddata.gz',async route=>{arrived();await held;await route.continue().catch(()=>{});});
    await page.getByRole('button',{name:'Make searchable',exact:true}).click();await requested;
    try{
      await expect(page.getByTestId('progress-message').getByRole('progressbar')).toBeVisible();
      await page.getByRole('button',{name:'Stop',exact:true}).click();
      await expect(page.getByTestId('progress-message')).toContainText('Cancelling…');
    }finally{releaseWorker();}
    await expect(page.getByText('Cancelled. No new result was committed.')).toBeVisible();
    await expect(page.getByTestId('progress-settling')).toHaveCount(0);
    await expect(page.getByTestId('current-result')).toHaveCount(0);
  });
});
