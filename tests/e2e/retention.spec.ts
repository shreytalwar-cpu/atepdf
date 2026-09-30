import {test,expect,type Page} from '@playwright/test';

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
  await page.getByRole('button',{name:'Try the two sample PDFs'}).click();
  await expect(page.getByText(/Your 2 PDFs are ready/)).toBeVisible();
}
const openSettings=async(page:Page)=>{await page.getByRole('button',{name:'Processed on your device',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toHaveAccessibleName('Privacy & storage');return dialog;};

test.beforeEach(async({page})=>{await install(page);await page.goto('/');await expect(page.getByRole('heading',{name:'Drop files here'})).toBeVisible();});

test('Privacy & storage: approved options, Keep until I delete it by default, keyboard reachable, usage by category',async({page})=>{
  await samples(page);
  // Command-comma opens the settings, as on the Mac.
  await page.keyboard.press('Meta+Comma');
  const dialog=page.getByRole('dialog');await expect(dialog).toHaveAccessibleName('Privacy & storage');
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
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
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
  await dialog.getByRole('button',{name:'Done'}).click();
  await expect(page.getByRole('heading',{name:'Drop files here'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Drop files here'})).toBeVisible();await expect(page.getByText(/Your 2 PDFs are ready/)).toHaveCount(0);
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
  await dialog.getByRole('button',{name:'Done'}).click();
  // The open session stays and keeps working, in memory only.
  await expect(page.getByText(/Your 2 PDFs are ready/)).toBeVisible();
  const before=await stored(page);
  await page.getByRole('button',{name:'Merge',exact:true}).click();
  await expect(page.getByTestId('current-result')).toBeVisible();
  expect(await stored(page)).toEqual(before);
  // A relaunch (quit, crash or force quit alike) finds nothing, and the choice is kept.
  await page.reload();
  await expect(page.getByRole('heading',{name:'Drop files here'})).toBeVisible();
  const after=await openSettings(page);
  await expect(after.getByRole('radio',{name:'Delete when atePDF quits'})).toBeChecked();
  // Switching back starts saving the current session cleanly.
  await after.getByRole('radio',{name:'Keep until I delete it'}).click();await expect(after.getByRole('radio',{name:'Keep until I delete it'})).toBeChecked();
  await after.getByRole('button',{name:'Done'}).click();
  await samples(page);
  await page.reload();await expect(page.getByText(/Your 2 PDFs are ready/)).toBeVisible();
});

test('7 days: an idle workspace is deleted before the next action, and a shorter setting asks first when it would delete now',async({page})=>{
  await samples(page);
  let dialog=await openSettings(page);
  await dialog.getByRole('radio',{name:'7 days'}).click();await expect(dialog.getByRole('radio',{name:'7 days'})).toBeChecked();
  await dialog.getByRole('button',{name:'Done'}).click();
  await setClock(page,T0+8*DAY);
  await page.getByRole('button',{name:'Merge',exact:true}).click();
  await expect(page.getByText('Your saved workspace was deleted because it hadn’t changed for 7 days, as set in Keep workspace.')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Drop files here'})).toBeVisible();
  expect((await stored(page)).filter(name=>name.startsWith('blobs/'))).toEqual([]);
  await page.reload();await expect(page.getByRole('heading',{name:'Drop files here'})).toBeVisible();
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
  await dialog.getByRole('button',{name:'Done'}).click();
  await expect(page.getByRole('heading',{name:'Drop files here'})).toBeVisible();
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
  await dialog.getByRole('button',{name:'Done'}).click();
}
test('P1-1 a sample download that finishes after Delete local data is discarded: nothing imported, shown or saved',async({page})=>{
  let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});let held=0;
  await page.route('**/fixtures/*.pdf',async route=>{held++;await gate;await route.continue();});
  await page.getByRole('button',{name:'Try the two sample PDFs'}).click();
  await expect.poll(()=>held).toBeGreaterThan(0);
  await deleteNow(page);
  const afterDelete={writes:await writes(page),stored:await stored(page)};
  release();
  await expect.poll(()=>held).toBe(2);
  // Give the stale completion every chance to land.
  await page.waitForTimeout(1500);
  await expect(page.getByRole('heading',{name:'Drop files here'})).toBeVisible();
  await expect(page.getByText(/I’ve added/)).toHaveCount(0);await expect(page.getByText(/PDFs are ready/)).toHaveCount(0);
  expect(await writes(page)).toBe(afterDelete.writes);expect(await stored(page)).toEqual(afterDelete.stored);
  expect(afterDelete.stored.filter(name=>name.startsWith('blobs/'))).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Drop files here'})).toBeVisible();await expect(page.getByText(/I’ve added/)).toHaveCount(0);
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
  await expect(page.getByRole('heading',{name:'Drop files here'})).toBeVisible();
  await expect(page.getByText(/I’ve added/)).toHaveCount(0);
  expect(await writes(page)).toBe(afterDelete.writes);expect(await stored(page)).toEqual(afterDelete.stored);
  expect(afterDelete.stored.filter(name=>name.startsWith('blobs/'))).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Drop files here'})).toBeVisible();await expect(page.getByText(/I’ve added/)).toHaveCount(0);
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
const CONNECT_PROMPT=/Connect OpenAI for optional AI planning/;
async function holdFirstStatus(page:Page){
  let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});const state={requests:0,answered:0};
  await page.route('**/api/planner/status',async route=>{const first=++state.requests===1;if(first)await gate;await route.fulfill({json:notConnected});state.answered++;});
  return {state,release};
}
async function staleResponseIsInert(page:Page,held:{state:{requests:number;answered:number};release:()=>void},after:{writes:number;stored:string[]}){
  held.release();
  await expect.poll(()=>held.state.answered).toBe(1);
  await page.waitForTimeout(1500);
  await expect(page.getByRole('heading',{name:'Drop files here'})).toBeVisible();
  await expect(page.getByText(CONNECT_PROMPT)).toHaveCount(0);
  expect(await writes(page)).toBe(after.writes);expect(await stored(page)).toEqual(after.stored);
  // A connection check started in the new session is answered normally, once.
  await page.getByRole('button',{name:'OpenAI connection'}).click();
  await expect(page.getByText(CONNECT_PROMPT)).toHaveCount(1);
  expect(held.state.requests).toBe(2);
  // Nothing from the stale response comes back after a relaunch either.
  await page.reload();
  await expect(page.getByText(/I’ve added/)).toHaveCount(0);await expect(page.getByText(/PDFs are ready/)).toHaveCount(0);
}
test('B3 a connection response that arrives after Delete local data adds no message and saves nothing',async({page})=>{
  await samples(page);
  const held=await holdFirstStatus(page);
  await page.getByRole('button',{name:'OpenAI connection'}).click();
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
  await page.getByRole('button',{name:'OpenAI connection'}).click();
  await expect.poll(()=>held.state.requests).toBe(1);
  await page.getByRole('button',{name:'Start over'}).click();
  await page.getByRole('button',{name:'Clear session'}).click();
  await expect(page.getByRole('heading',{name:'Drop files here'})).toBeVisible();
  await expect.poll(async()=>(await stored(page)).filter(name=>name.startsWith('blobs/')).length).toBe(0);
  const after={writes:await writes(page),stored:await stored(page)};
  await staleResponseIsInert(page,held,after);
});
