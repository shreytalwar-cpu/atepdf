import {test, expect, type Page} from '@playwright/test';
import {composer,samples} from './ui';

// Quick Look (SHR-106, UX_SPEC S9.6) replaces the inline preview: the same read-only
// renderer, page navigation, zoom and Fit, inside a sheet that returns focus to its invoker.
async function settledPreview(page:Page,pageNumber:number){
  const preview=page.getByRole('region',{name:'Read-only preview'});
  await expect(preview.getByText(`Page ${pageNumber} of 3`,{exact:true})).toBeVisible();
  let previous='',stableSamples=0;
  const geometry=()=>preview.evaluate((element,expectedPage)=>{
    const canvas=element.querySelector('canvas')!,well=element.querySelector<HTMLElement>('.atepdf-preview-well')!;
    const box=(node:Element)=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
    return {ready:well.getAttribute('aria-busy')==='false'&&getComputedStyle(canvas).visibility==='visible'&&canvas.getAttribute('aria-label')===`PDF page ${expectedPage}`,
      canvas:box(canvas),well:box(well),viewport:{x:0,y:0,width:innerWidth,height:innerHeight},pixels:{width:canvas.width,height:canvas.height}};
  },pageNumber);
  // aria-busy alone can still describe the preceding render immediately after
  // a click. Require the requested page and unchanged geometry across frames.
  await expect.poll(async()=>{
    const current=await geometry(),signature=JSON.stringify(current);
    stableSamples=current.ready&&signature===previous?stableSamples+1:0;
    previous=signature;
    return current.ready&&stableSamples>=2;
  },{intervals:[100,150,200]}).toBe(true);
  return geometry();
}

function expectWholePageVisible({canvas,well,viewport}:Awaited<ReturnType<typeof settledPreview>>){
  for(const bounds of [well,viewport]){
    expect(canvas.x).toBeGreaterThanOrEqual(bounds.x);
    expect(canvas.y).toBeGreaterThanOrEqual(bounds.y);
    expect(canvas.x+canvas.width).toBeLessThanOrEqual(bounds.x+bounds.width+0.5);
    expect(canvas.y+canvas.height).toBeLessThanOrEqual(bounds.y+bounds.height+0.5);
  }
}
async function mergedSamples(page:Page){
  await page.route('**/api/planner/status', route => route.fulfill({json:{connected:false,enabled:false,remaining:0,token:'synthetic-focus-test'}}));
  await page.goto('/');
  await samples(page);
  await page.getByRole('button', {name:'Merge', exact:true}).click();
  await expect(page.getByTestId('result-facts')).toContainText('3 pages');
}

test('closing Quick Look returns keyboard focus to its trigger', async ({page}) => {
  await mergedSamples(page);
  const result = page.getByTestId('current-result');
  const trigger = result.getByRole('button', {name: 'Preview', exact: true});
  await trigger.focus();
  await trigger.press('Enter');
  await expect(page.getByRole('region', {name: 'Read-only preview'})).toBeVisible();
  const close = page.getByRole('button', {name: 'Close preview'});
  await close.focus();
  await close.press('Enter');
  await expect(page.getByRole('region', {name: 'Read-only preview'})).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('compact Quick Look fits the whole page and every control through Next, Zoom and Fit', async ({page}) => {
  await page.setViewportSize({width:320,height:568});
  await mergedSamples(page);
  await page.getByTestId('current-result').getByRole('button', {name:'Preview',exact:true}).click();
  const preview = page.getByRole('region', {name:'Read-only preview'});
  const first=await settledPreview(page,1);
  expectWholePageVisible(first);
  for (const name of ['Close preview','Fit page','Previous page','Next page','Zoom out','Zoom in']) {
    await expect.poll(async () => {
      const box=await preview.getByRole('button',{name,exact:true}).boundingBox();
      return !!box&&box.width>=28&&box.height>=28&&box.x>=0&&box.x+box.width<=320&&box.y>=0&&box.y+box.height<=568;
    }).toBe(true);
  }
  await preview.getByRole('button',{name:'Next page',exact:true}).click();
  const next=await settledPreview(page,2);
  expectWholePageVisible(next);
  expect(next.pixels).toEqual(first.pixels);
  await preview.getByRole('button',{name:'Zoom in',exact:true}).click();
  const zoomed=await settledPreview(page,2);
  expect(zoomed.pixels.width).toBeGreaterThan(next.pixels.width);
  expect(zoomed.pixels.height).toBeGreaterThan(next.pixels.height);
  await expect(preview.getByRole('button',{name:'Zoom out',exact:true})).toBeEnabled();
  await preview.getByRole('button',{name:'Fit page',exact:true}).click();
  const fitted=await settledPreview(page,2);
  expect(fitted.pixels).toEqual(next.pixels);
  expectWholePageVisible(fitted);
  await page.setViewportSize({width:320,height:700});
  const resized=await settledPreview(page,2);
  expect(resized.pixels.height).toBeGreaterThan(fitted.pixels.height);
  expectWholePageVisible(resized);
  await preview.getByRole('button',{name:'Close preview',exact:true}).click();
  await expect(preview).toHaveCount(0);
});

test('compact privacy popover explains local processing, closes with Escape and restores focus', async ({page}) => {
  await page.setViewportSize({width:320,height:568});
  await page.goto('/');
  const trigger=page.getByRole('button',{name:'Processed on your device',exact:true});
  await trigger.focus();await trigger.press('Enter');
  const popover=page.getByRole('dialog');
  await expect(popover).toHaveCount(1);
  await expect(popover).toContainText('processed on this Mac');
  await expect(popover).toContainText('File contents, names, paths and passwords are not');
  const box=await popover.getByText('How atePDF handles your files').boundingBox();
  expect(box).not.toBeNull();expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(320);
  await page.keyboard.press('Escape');
  await expect(popover).toHaveCount(0);await expect(trigger).toBeFocused();
});

test('keyboard users can see focus on the composer in the built web app', async ({page}) => {
  await page.goto('/');
  const input=composer(page);
  // Reach the field through the actual tab order, not a mouse click.
  for(let count=0;count<20&&!await input.evaluate(element=>element===document.activeElement);count++)await page.keyboard.press('Tab');
  await expect(input).toBeFocused();
  const shell=page.locator('.aui-composer-shell');
  await expect(shell).toHaveCSS('outline-style','solid');
  await expect(shell).toHaveCSS('outline-width','2px');
});

test('larger text and a short web viewport keep the actual PDF workflow reachable', async ({page}) => {
  await page.setViewportSize({width:720,height:500});
  await page.route('**/api/planner/status',route=>route.fulfill({json:{connected:false,enabled:false,remaining:0,token:'synthetic-large-text'}}));
  await page.goto('/');
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  await samples(page);
  await page.getByRole('button',{name:'Merge',exact:true}).click();
  await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  await expect.poll(async()=>(await page.getByTestId('conversation').boundingBox())?.height??0).toBeGreaterThan(120);
  const trigger=page.getByTestId('current-result').getByRole('button',{name:'Preview',exact:true});
  await trigger.click();
  const preview=page.getByRole('region',{name:'Read-only preview'});
  expectWholePageVisible(await settledPreview(page,1));
  await preview.getByRole('button',{name:'Next page',exact:true}).click();
  await expect(preview.getByText('Page 2 of 3',{exact:true})).toBeVisible();
  expectWholePageVisible(await settledPreview(page,2));
  await preview.getByRole('button',{name:'Close preview',exact:true}).click();
  await expect(trigger).toBeFocused();
  // The browser's text size scales the conversation text (body 14 pt at 200%).
  await expect(composer(page)).toHaveCSS('font-size','28px');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
