import {test,expect,type Page} from '@playwright/test';
import {quickPlan as localQuickPlan} from '../../packages/contracts/src/protocol';
import {closeSettings,emptyWorkspace,openSettings as openSettingsSheet,startOver} from './ui';
import {hostedLocalContext,validateHosted,type HostedPayload as PlannerRequest} from '../../packages/planner/src/outbound/schema';
const quickPlan=(wire:PlannerRequest,action:Parameters<typeof localQuickPlan>[1])=>localQuickPlan(hostedLocalContext(validateHosted(wire)),action);

// SHR-40 Privacy & storage in the shared UI. The web build keeps no workspace, so this
// spec installs a synthetic in-memory stand-in for the Mac vault backend and a fake
// clock before the app loads. Its files live in sessionStorage, so a reload is a
// relaunch. Encryption, the Keychain and real file removal are covered by the Node
// and Swift suites; this checks the controls, wording, keyboard use and flows.
const T0=Date.parse('2026-09-01T09:00:00.000Z'),DAY=86_400_000;
async function install(page:Page){
  await page.addInitScript(start=>{
    const load=()=>{try{return JSON.parse(sessionStorage.getItem('atepdf-test-vault')||'{}');}catch{return {};}};
    const stored:Record<string,{aad:string;data:number[]}>=load();
    const files=new Map(Object.entries(stored).map(([name,f])=>[name,{aad:f.aad,plain:new Uint8Array(f.data)}]));
    const persist=()=>sessionStorage.setItem('atepdf-test-vault',JSON.stringify(Object.fromEntries([...files].map(([name,f])=>[name,{aad:f.aad,data:[...f.plain]}]))));
    const clock=()=>Number(sessionStorage.getItem('atepdf-test-clock')||start);
    // Sealed files carry 4 + 12 + 16 bytes of framing, as on the Mac.
    const backend={
      keyStatus:async()=>'ready',
      exists:async(name:string)=>files.has(name),
      writeSealed:async(name:string,plain:Uint8Array,aad:string)=>{files.set(name,{aad,plain:new Uint8Array(plain)});persist();(window as unknown as {__atepdfWrites:number}).__atepdfWrites++;},
      readOpened:async(name:string,aad:string)=>{const f=files.get(name);if(!f)return {status:'missing'};if(f.aad!==aad)return {status:'auth'};return {status:'ok',bytes:new Uint8Array(f.plain)};},
      list:async(directory:string)=>[...files.keys()].filter(name=>name.startsWith(`${directory}/`)),
      remove:async(name:string)=>{files.delete(name);persist();},
      syncDirectory:async()=>{},
      cleanStaging:async()=>{},
      usage:async()=>[...files].map(([name,f])=>({name,bytes:f.plain.length+32})),
    };
    let temporary=4096;(window as unknown as {__atepdfWrites:number}).__atepdfWrites=0;
    (window as unknown as Record<string,unknown>).__ATEPDF_TEST_WORKSPACE__={backend,now:()=>new Date(clock()),temporary:{usage:()=>sessionStorage.getItem('atepdf-test-temporary-unknown')?null:temporary,clear:()=>{temporary=0;return true;}}};
  },T0);
}
const writes=(page:Page)=>page.evaluate(()=>(window as unknown as {__atepdfWrites:number}).__atepdfWrites);
const stored=(page:Page)=>page.evaluate(()=>Object.keys(JSON.parse(sessionStorage.getItem('atepdf-test-vault')||'{}')).sort());
const setClock=(page:Page,t:number)=>page.evaluate(value=>sessionStorage.setItem('atepdf-test-clock',String(value)),t);
async function samples(page:Page){
  await page.getByRole('button',{name:'Try with sample PDFs'}).click();
  await expect(page.getByText(/Your 2 PDFs are ready/)).toBeVisible();
}
// Settings ▸ Privacy & Storage (an in-window sheet). Reuses the open sheet when it is already showing.
const openSettings=async(page:Page)=>{
  const dialog=page.getByRole('dialog',{name:'Settings'});
  if(await dialog.count())await dialog.getByRole('tab',{name:'Privacy & Storage',exact:true}).click();
  else await openSettingsSheet(page,'Privacy & Storage');
  await expect(dialog.getByRole('radio')).toHaveCount(4);
  return dialog;
};
const openAI=async(page:Page)=>{const dialog=page.getByRole('dialog',{name:'Settings'});if(await dialog.count())await dialog.getByRole('tab',{name:'AI',exact:true}).click();else await openSettingsSheet(page,'AI');return dialog;};

test.beforeEach(async({page})=>{await install(page);await page.goto('/');await expect(emptyWorkspace(page)).toBeVisible();});

test('a settings chunk failure preserves the workspace and can retry without reloading',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await samples(page);await page.getByRole('button',{name:'Merge',exact:true}).click();
  await expect(page.getByTestId('current-context')).toContainText('3 pages');
  let requests=0;await page.route('**/PrivacyStorage-*.js',route=>++requests===1?route.abort():route.continue());
  await openSettingsSheet(page,'Privacy & Storage');
  await expect(page.getByRole('alert')).toContainText('Your workspace is unchanged');
  await expect(page.getByTestId('current-context')).toContainText('3 pages');
  await page.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Settings'}).getByRole('radio')).toHaveCount(4);
  await closeSettings(page);
  await expect(page.getByTestId('current-context')).toContainText('3 pages');
  expect(requests).toBe(2);expect(errors).toEqual([]);
});

test('Privacy & storage: approved options, Keep until I delete it by default, keyboard reachable, usage by category',async({page})=>{
  await samples(page);
  // Command-comma opens the settings, as on the Mac.
  await page.keyboard.press('Meta+Comma');
  await expect(page.getByRole('dialog',{name:'Settings'})).toBeVisible();
  const dialog=await openSettings(page);
  const radios=dialog.getByRole('radio');
  await expect(radios).toHaveCount(4);
  await expect(radios).toHaveText([/Keep until I delete it/,/30 days/,/7 days/,/Delete when atePDF quits/]);
  await expect(dialog.getByRole('radio',{name:'Keep until I delete it'})).toBeChecked();
  const usage=dialog.getByTestId('storage-usage');
  await expect(usage).toContainText('Imported PDF copies');await expect(usage).toContainText('Results');await expect(usage).toContainText('Conversation, drafts and page text');await expect(usage).toContainText('Temporary files and previews4.1 kB');
  await expect(dialog).toContainText('Files you added from elsewhere and PDFs you saved aren’t counted.');
  // Keyboard: Tab reaches the options and the delete control; Space chooses an option.
  const thirty=dialog.getByRole('radio',{name:'30 days'});
  for(let i=0;i<30&&!(await thirty.evaluate(el=>el===document.activeElement));i++)await page.keyboard.press('Tab');
  await expect(thirty).toBeFocused();
  await page.keyboard.press('Space');
  await expect(thirty).toBeChecked();
  await page.keyboard.press('Tab');await expect(dialog.getByRole('radio',{name:'7 days'})).toBeFocused();
  await page.keyboard.press('Enter');await expect(dialog.getByRole('radio',{name:'7 days'})).toBeChecked();
  await page.keyboard.press('Shift+Tab');await page.keyboard.press('Space');await expect(thirty).toBeChecked();
  await expect(dialog).toContainText('It can’t delete anything while it isn’t running.');
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Settings'})).toHaveCount(0);
  // The setting survives a relaunch, with the workspace.
  await page.reload();await expect(page.getByText(/Your 2 PDFs are ready/)).toBeVisible();
  await expect((await openSettings(page)).getByRole('radio',{name:'30 days'})).toBeChecked();
});

test('Delete local data: explained, confirmed, removes the workspace and does not come back after relaunch',async({page})=>{
  await samples(page);
  expect((await stored(page)).filter(name=>name.startsWith('blobs/')).length).toBe(2);
  const dialog=await openSettings(page);
  await dialog.getByRole('radio',{name:'7 days'}).click();await expect(dialog.getByRole('radio',{name:'7 days'})).toBeChecked();
  await dialog.getByRole('button',{name:'Delete Local Data…'}).click();
  await expect(dialog.getByRole('heading',{name:'Delete atePDF’s local data?'})).toBeVisible();
  await expect(dialog).toContainText('Files you added from elsewhere and PDFs you saved aren’t touched. This isn’t secure erasure');
  // Focus moves into the confirmation, on Cancel; Cancel leaves everything as it was.
  await expect(dialog.getByRole('button',{name:'Cancel'})).toBeFocused();
  await dialog.getByRole('button',{name:'Cancel'}).click();
  expect((await stored(page)).filter(name=>name.startsWith('blobs/')).length).toBe(2);
  await dialog.getByRole('button',{name:'Delete Local Data…'}).click();
  await dialog.getByRole('button',{name:'Delete',exact:true}).click();
  await expect(dialog.getByTestId('storage-status')).toHaveText('atePDF’s local data was deleted from this Mac.');
  // Reset to the default setting; nothing but an empty workspace record remains.
  await expect(dialog.getByRole('radio',{name:'Keep until I delete it'})).toBeChecked();
  const left=await stored(page);expect(left.filter(name=>name.startsWith('blobs/'))).toEqual([]);expect(left.filter(name=>name.startsWith('manifests/')).length).toBe(1);
  await expect(dialog.getByTestId('storage-usage')).toContainText('Temporary files and previews0 bytes');
  await closeSettings(page);
  await expect(emptyWorkspace(page)).toBeVisible();
  await page.reload();
  await expect(emptyWorkspace(page)).toBeVisible();await expect(page.getByText(/Your 2 PDFs are ready/)).toHaveCount(0);
  // Repeated deletion is harmless.
  const again=await openSettings(page);
  await again.getByRole('button',{name:'Delete Local Data…'}).click();await again.getByRole('button',{name:'Delete',exact:true}).click();
  await expect(again.getByTestId('storage-status')).toHaveText('atePDF’s local data was deleted from this Mac.');
});

test('Delete when atePDF quits: confirmed, clears the saved copy, keeps the open session, and nothing returns after relaunch',async({page})=>{
  await samples(page);
  const dialog=await openSettings(page);
  await dialog.getByRole('radio',{name:'Delete when atePDF quits'}).click();
  await expect(dialog.getByRole('heading',{name:'Stop saving this workspace?'})).toBeVisible();
  await expect(dialog).toContainText('closing the window doesn’t delete it');
  await dialog.getByRole('button',{name:'Delete Saved Copy'}).click();
  await expect(dialog.getByRole('radio',{name:'Delete when atePDF quits'})).toBeChecked();
  await expect(dialog).toContainText('This session isn’t saved on this Mac.');
  expect((await stored(page)).filter(name=>name.startsWith('blobs/'))).toEqual([]);
  await closeSettings(page);
  // The open session stays and keeps working, in memory only.
  await expect(page.getByText(/Your 2 PDFs are ready/)).toBeVisible();
  const before=await stored(page);
  await page.getByRole('button',{name:'Merge',exact:true}).click();
  await expect(page.getByTestId('current-result')).toBeVisible();
  expect(await stored(page)).toEqual(before);
  // A relaunch (quit, crash or force quit alike) finds nothing, and the choice is kept.
  await page.reload();
  await expect(emptyWorkspace(page)).toBeVisible();
  const after=await openSettings(page);
  await expect(after.getByRole('radio',{name:'Delete when atePDF quits'})).toBeChecked();
  // Switching back starts saving the current session cleanly.
  await after.getByRole('radio',{name:'Keep until I delete it'}).click();await expect(after.getByRole('radio',{name:'Keep until I delete it'})).toBeChecked();
  await closeSettings(page);
  await samples(page);
  await page.reload();await expect(page.getByText(/Your 2 PDFs are ready/)).toBeVisible();
});

test('7 days: an idle workspace is deleted before the next action, and a shorter setting asks first when it would delete now',async({page})=>{
  await samples(page);
  let dialog=await openSettings(page);
  await dialog.getByRole('radio',{name:'7 days'}).click();await expect(dialog.getByRole('radio',{name:'7 days'})).toBeChecked();
  await closeSettings(page);
  await setClock(page,T0+8*DAY);
  await page.getByRole('button',{name:'Merge',exact:true}).click();
  await expect(page.getByText('Your saved workspace was deleted because it hadn’t changed for 7 days, as set in Keep workspace.')).toBeVisible();
  await expect(emptyWorkspace(page)).toBeVisible();
  expect((await stored(page)).filter(name=>name.startsWith('blobs/'))).toEqual([]);
  await page.reload();await expect(emptyWorkspace(page)).toBeVisible();
  // Keep, idle for 10 days, then choose 7 days: the effect is stated before anything is deleted.
  await samples(page);
  dialog=await openSettings(page);
  await dialog.getByRole('radio',{name:'Keep until I delete it'}).click();await expect(dialog.getByRole('radio',{name:'Keep until I delete it'})).toBeChecked();
  await setClock(page,T0+18*DAY);
  await dialog.getByRole('radio',{name:'7 days'}).click();
  await expect(dialog.getByRole('heading',{name:'Delete this workspace now?'})).toBeVisible();
  await expect(dialog).toContainText('It hasn’t changed for 10 days, so the 7-day setting deletes it now');
  await dialog.getByRole('button',{name:'Cancel'}).click();
  await expect(dialog.getByRole('radio',{name:'Keep until I delete it'})).toBeChecked();
  expect((await stored(page)).filter(name=>name.startsWith('blobs/')).length).toBe(2);
  await dialog.getByRole('radio',{name:'7 days'}).click();await dialog.getByRole('button',{name:'Delete Workspace'}).click();
  await expect(dialog.getByRole('radio',{name:'7 days'})).toBeChecked();
  await closeSettings(page);
  await expect(emptyWorkspace(page)).toBeVisible();
  expect((await stored(page)).filter(name=>name.startsWith('blobs/'))).toEqual([]);
});

// P1-1: a picker or sample completion that arrives after Delete local data began must
// not import, add to the conversation or save into the new, empty workspace.
async function deleteNow(page:Page,activeTask=true){
  const dialog=await openSettings(page);
  await dialog.getByRole('button',{name:'Delete Local Data…'}).click();
  if(activeTask)await expect(dialog).toContainText('The current task will be stopped first.');
  await dialog.getByRole('button',{name:'Delete',exact:true}).click();
  await expect(dialog.getByTestId('storage-status')).toHaveText('atePDF’s local data was deleted from this Mac.');
  await closeSettings(page);
}
test('P1-1 a sample download that finishes after Delete local data is discarded: nothing imported, shown or saved',async({page})=>{
  let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});let held=0;
  await page.route('**/fixtures/*.pdf',async route=>{held++;await gate;await route.continue();});
  await page.getByRole('button',{name:'Try with sample PDFs'}).click();
  await expect.poll(()=>held).toBeGreaterThan(0);
  await deleteNow(page);
  const afterDelete={writes:await writes(page),stored:await stored(page)};
  release();
  await expect.poll(()=>held).toBe(2);
  // Give the stale completion every chance to land.
  await page.waitForTimeout(1500);
  await expect(emptyWorkspace(page)).toBeVisible();
  await expect(page.getByText(/I’ve added/)).toHaveCount(0);await expect(page.getByText(/PDFs are ready/)).toHaveCount(0);
  expect(await writes(page)).toBe(afterDelete.writes);expect(await stored(page)).toEqual(afterDelete.stored);
  expect(afterDelete.stored.filter(name=>name.startsWith('blobs/'))).toEqual([]);
  await page.reload();
  await expect(emptyWorkspace(page)).toBeVisible();await expect(page.getByText(/I’ve added/)).toHaveCount(0);
});
test('P1-1 a file chooser that completes after Delete local data is discarded: nothing imported, shown or saved',async({page})=>{
  await samples(page);
  const chooser=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'Add files'}).click();
  const pending=await chooser;
  await deleteNow(page);
  // The conversation is gone; the chooser itself is still open until the user answers it.
  await expect(page.getByText(/Your 2 PDFs are ready/)).toHaveCount(0);
  const afterDelete={writes:await writes(page),stored:await stored(page)};
  await pending.setFiles('tests/fixtures/appendix.pdf');
  await page.waitForTimeout(1500);
  await expect(emptyWorkspace(page)).toBeVisible();
  await expect(page.getByText(/I’ve added/)).toHaveCount(0);
  expect(await writes(page)).toBe(afterDelete.writes);expect(await stored(page)).toEqual(afterDelete.stored);
  expect(afterDelete.stored.filter(name=>name.startsWith('blobs/'))).toEqual([]);
  await page.reload();
  await expect(emptyWorkspace(page)).toBeVisible();await expect(page.getByText(/I’ve added/)).toHaveCount(0);
});

test('temporary files that cannot be measured never produce an exact-looking total',async({page})=>{
  await samples(page);
  await page.evaluate(()=>sessionStorage.setItem('atepdf-test-temporary-unknown','1'));
  const dialog=await openSettings(page),usage=dialog.getByTestId('storage-usage');
  await expect(usage).toContainText('Temporary files and previewsCouldn’t be measured');
  await expect(usage).toContainText(/TotalAt least \d/);
});

// Final review B3: a connection-status response that arrives after Delete local data or
// Start over belongs to the emptied workspace. It adds no message and saves nothing;
// a connection check started in the new session still works.
const notConnected={connected:false,enabled:false,remaining:0,token:'synthetic-connection'};
const KEY_FIELD={name:'OpenAI project key'};
async function holdFirstStatus(page:Page){
  let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});const state={requests:0,answered:0};
  await page.route('**/api/planner/status',async route=>{const first=++state.requests===1;if(first)await gate;await route.fulfill({json:notConnected});state.answered++;});
  return {state,release};
}
async function staleResponseIsInert(page:Page,held:{state:{requests:number;answered:number};release:()=>void},after:{writes:number;stored:string[]}){
  held.release();
  await expect.poll(()=>held.state.answered).toBe(1);
  await page.waitForTimeout(1500);
  await expect(emptyWorkspace(page)).toBeVisible();
  await expect(page.getByRole('textbox',KEY_FIELD)).toHaveCount(0);await expect(page.getByTestId('assistant-message')).toHaveCount(0);
  expect(await writes(page)).toBe(after.writes);expect(await stored(page)).toEqual(after.stored);
  // A connection check started in the new session is answered normally, once.
  await openAI(page);
  await expect(page.getByRole('textbox',KEY_FIELD)).toHaveCount(1);
  expect(held.state.requests).toBe(2);await closeSettings(page);
  // Nothing from the stale response comes back after a relaunch either.
  await page.reload();
  await expect(page.getByText(/I’ve added/)).toHaveCount(0);await expect(page.getByText(/PDFs are ready/)).toHaveCount(0);
}
test('B3 a connection response that arrives after Delete local data adds no message and saves nothing',async({page})=>{
  await samples(page);
  const held=await holdFirstStatus(page);
  await openAI(page);
  await expect.poll(()=>held.state.requests).toBe(1);
  // A pending connection check is not a running task, so no stop warning is shown.
  await deleteNow(page,false);
  const after={writes:await writes(page),stored:await stored(page)};
  expect(after.stored.filter(name=>name.startsWith('blobs/'))).toEqual([]);
  await staleResponseIsInert(page,held,after);
});
test('B3 a connection response that arrives after Start over adds no message and saves nothing',async({page})=>{
  await samples(page);
  const held=await holdFirstStatus(page);
  await openAI(page);
  await expect.poll(()=>held.state.requests).toBe(1);
  await closeSettings(page);
  await startOver(page);
  await expect(emptyWorkspace(page)).toBeVisible();
  await expect.poll(async()=>(await stored(page)).filter(name=>name.startsWith('blobs/')).length).toBe(0);
  const after={writes:await writes(page),stored:await stored(page)};
  await staleResponseIsInert(page,held,after);
});

// Cross-review: the same session contract for connection errors after each reset, and a
// success after expiry (Delete and Start over successes are covered above).
for(const reset of ['Delete','Start over','Expiry'] as const){
  test(`B3 a connection error that arrives after ${reset} adds no message and a new connection works`,async({page})=>{
    await samples(page);
    if(reset==='Expiry'){const d=await openSettings(page);await d.getByRole('radio',{name:'7 days'}).click();await closeSettings(page);}
    let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});let requests=0;
    await page.route('**/api/planner/status',async route=>{const first=++requests===1;if(first){await gate;await route.abort('failed');}else await route.fulfill({json:notConnected});});
    await openAI(page);await expect.poll(()=>requests).toBe(1);
    if(reset==='Delete')await deleteNow(page,false);
    else if(reset==='Start over'){await closeSettings(page);await startOver(page);}
    else{await closeSettings(page);await setClock(page,T0+8*DAY);await page.getByRole('button',{name:'Merge',exact:true}).click();}
    await expect(emptyWorkspace(page)).toBeVisible();
    await expect.poll(async()=>(await stored(page)).filter(name=>name.startsWith('blobs/')).length).toBe(0);
    const after={writes:await writes(page),stored:await stored(page)};
    release();await page.waitForTimeout(1000);
    await expect(page.getByText(/local planner gateway is unavailable/)).toHaveCount(0);
    expect(await writes(page)).toBe(after.writes);expect(await stored(page)).toEqual(after.stored);
    await openAI(page);await expect(page.getByRole('textbox',KEY_FIELD)).toHaveCount(1);
    expect(requests).toBe(2);
  });
}
test('B3 a connection response that arrives after expiry adds no message and saves nothing',async({page})=>{
  await samples(page);const d=await openSettings(page);await d.getByRole('radio',{name:'7 days'}).click();await closeSettings(page);
  const held=await holdFirstStatus(page);await openAI(page);await expect.poll(()=>held.state.requests).toBe(1);await closeSettings(page);
  await setClock(page,T0+8*DAY);await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(emptyWorkspace(page)).toBeVisible();
  await expect.poll(async()=>(await stored(page)).filter(name=>name.startsWith('blobs/')).length).toBe(0);
  await staleResponseIsInert(page,held,{writes:await writes(page),stored:await stored(page)});
});

// Cross-review S40-02: a conversational request's whole lifecycle (setup, planning,
// choices, local execution, error and finalizer) belongs to the workspace session it
// was submitted in. The transport here ignores AbortSignal and holds its reply, so
// nothing depends on cancellation cooperating.
const CANCELLED='Planning cancelled. No local files changed.';
const fresh={connected:true,enabled:true,remaining:3,token:'synthetic-fresh-session'};
const ignoreAbort=(page:Page)=>page.evaluate(()=>{const f=window.fetch;window.fetch=(input,init)=>/\/api\/planner(\/status)?$/.test(String(input))?f(input,{...init,signal:undefined}):f(input,init);});
const composer=(page:Page)=>page.getByRole('textbox',{name:'Tell atePDF what to do'});
async function ask(page:Page,text:string){await composer(page).fill(text);await page.getByRole('button',{name:'Send message'}).click();}
// Every conversation entry that reached the vault, decoded: what a relaunch could restore.
const persistedText=(page:Page)=>page.evaluate(()=>Object.entries(JSON.parse(sessionStorage.getItem('atepdf-test-vault')||'{}')).filter(([name])=>name.startsWith('manifests/')).map(([,f])=>new TextDecoder().decode(new Uint8Array((f as {data:number[]}).data))).join('\n'));
async function staleRequestIsInert(page:Page,release:()=>void,settled:()=>Promise<void>,counts:()=>{status:number;plan:number}){
  const after={writes:await writes(page),stored:await stored(page),...counts()};
  expect(after.stored.filter(name=>name.startsWith('blobs/'))).toEqual([]);
  release();await settled();
  // Give the stale reply, its error path and its finalizer every chance to land.
  await page.waitForTimeout(1500);
  await expect(emptyWorkspace(page)).toBeVisible();
  await expect(page.getByText(CANCELLED,{exact:true})).toHaveCount(0);
  await expect(page.getByText(/Your new PDF is ready|OpenAI is not connected yet|AI planning is paused|AI connection is unavailable/)).toHaveCount(0);
  await expect(page.getByTestId('current-result')).toHaveCount(0);
  // No checkpoint write, no stored change, no further planner call, and the old
  // finalizer did not check the connection on behalf of the new session.
  expect(await writes(page)).toBe(after.writes);expect(await stored(page)).toEqual(after.stored);
  expect(counts()).toEqual({status:after.status,plan:after.plan});
  expect(await persistedText(page)).not.toContain(CANCELLED);
  // The request released its own busy state: the new session is usable.
  await expect(page.getByTestId('progress-message')).toHaveCount(0);
  // Relaunch: the replacement workspace restores zero messages.
  await page.reload();
  await expect(emptyWorkspace(page)).toBeVisible();
  await expect(page.getByText(CANCELLED,{exact:true})).toHaveCount(0);await expect(page.getByText(/I’ve added|PDFs are ready|Explain these PDFs|Combine these PDFs/)).toHaveCount(0);
  // A connection check in the new session works, with a fresh synthetic connection.
  await page.unroute('**/api/planner/status');
  await page.route('**/api/planner/status',route=>route.fulfill({json:fresh}));
  await openAI(page);
  await expect(page.getByText('Connected · up to 3 approved requests',{exact:true})).toHaveCount(1);
}
for(const reply of ['success','error'] as const){
  test(`S40-02 a planning setup ${reply} that arrives after Delete local data adds no message, saves nothing and stays gone after relaunch`,async({page})=>{
    await samples(page);await ignoreAbort(page);
    let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});const counts={status:0,plan:0},answered={status:0};
    await page.route('**/api/planner/status',async route=>{
      if(++counts.status===1){await gate;if(reply==='error')await route.abort('failed');else await route.fulfill({json:fresh});answered.status++;return;}
      await route.fulfill({json:fresh});answered.status++;
    });
    await page.route('**/api/planner',async route=>{counts.plan++;await route.fulfill({status:500,json:{error:'Unexpected synthetic planner call'}});});
    await ask(page,'Explain these PDFs');await expect.poll(()=>counts.status).toBe(1);
    // SHR-44 allows Start over to cancel asynchronous planner setup; Delete
    // independently invalidates the same owner and is exercised below.
    await page.getByRole('button',{name:'More',exact:true}).click();await expect(page.getByRole('menuitem',{name:'Start Over…'})).toBeEnabled();await page.keyboard.press('Escape');
    await deleteNow(page,true);
    await staleRequestIsInert(page,release,()=>expect.poll(()=>answered.status).toBe(1),()=>({...counts}));
  });
}
test('S40-02 a plan that arrives after Delete local data creates no result, message or checkpoint',async({page})=>{
  await samples(page);await ignoreAbort(page);
  let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});const counts={status:0,plan:0};let answered=0;
  await page.route('**/api/planner/status',route=>{counts.status++;return route.fulfill({json:fresh});});
  await page.route('**/api/planner',async route=>{counts.plan++;const req=route.request().postDataJSON() as PlannerRequest;await gate;await route.fulfill({json:quickPlan(req,'merge')});answered++;});
  await ask(page,'Combine these PDFs');await expect.poll(()=>counts.plan).toBe(1);
  await expect(page.getByText('Sending your instruction to atePDF AI.',{exact:false})).toBeVisible();
  await deleteNow(page,true);
  await staleRequestIsInert(page,release,()=>expect.poll(()=>answered).toBe(1),()=>({...counts}));
});
test('S40-02 a planning setup reply that arrives after expiry adds no message and saves nothing',async({page})=>{
  await samples(page);
  const d=await openSettings(page);await d.getByRole('radio',{name:'7 days'}).click();await closeSettings(page);
  await ignoreAbort(page);
  let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});const counts={status:0,plan:0};let answered=0;
  await page.route('**/api/planner/status',async route=>{if(++counts.status===1)await gate;await route.fulfill({json:fresh});answered++;});
  await page.route('**/api/planner',async route=>{counts.plan++;await route.fulfill({status:500,json:{error:'Unexpected synthetic planner call'}});});
  await ask(page,'Explain these PDFs');await expect.poll(()=>counts.status).toBe(1);
  // While the request is prepared the retention period passes; the next draft
  // checkpoint finds the workspace expired and empties it (no disabled control is used).
  await setClock(page,T0+8*DAY);
  await composer(page).fill('a new draft');
  await expect(page.getByText(/was deleted because it hadn’t changed for 7 days/)).toBeVisible();
  await expect(page.getByText(/I’ve added|PDFs are ready|Explain these PDFs/)).toHaveCount(0);
  await expect.poll(async()=>(await stored(page)).filter(name=>name.startsWith('blobs/')).length).toBe(0);
  await staleRequestIsInert(page,release,()=>expect.poll(()=>answered).toBe(1),()=>({...counts}));
});
