import {test, expect, type Page} from '@playwright/test';

async function settledPreview(page:Page,pageNumber:number){
  const preview=page.getByRole('region',{name:'Read-only preview'});
  await expect(preview.getByText(`Page ${pageNumber} of 3`,{exact:true})).toBeVisible();
  let previous='',stableSamples=0;
  const geometry=()=>preview.evaluate((element,expectedPage)=>{
    const canvas=element.querySelector('canvas')!,host=element.querySelector<HTMLElement>('.inline-page')!;
    const conversation=element.closest<HTMLElement>('.aui-message-group')!;
    const box=(node:Element)=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
    return {ready:host.getAttribute('aria-busy')==='false'&&getComputedStyle(canvas).visibility==='visible'&&canvas.getAttribute('aria-label')===`PDF page ${expectedPage}`,
      canvas:box(canvas),host:box(host),conversation:box(conversation),pixels:{width:canvas.width,height:canvas.height}};
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

function expectWholePageVisible({canvas,host,conversation}:Awaited<ReturnType<typeof settledPreview>>){
  for(const bounds of [host,conversation]){
    expect(canvas.x).toBeGreaterThanOrEqual(bounds.x);
    expect(canvas.y).toBeGreaterThanOrEqual(bounds.y);
    expect(canvas.x+canvas.width).toBeLessThanOrEqual(bounds.x+bounds.width);
    expect(canvas.y+canvas.height).toBeLessThanOrEqual(bounds.y+bounds.height);
  }
}

test('closing the inline PDF preview returns keyboard focus to its trigger', async ({page}) => {
  await page.route('**/api/planner/status', route => route.fulfill({json: {
    connected: false, enabled: false, remaining: 0, token: 'synthetic-focus-test',
  }}));
  await page.goto('/');
  await page.getByRole('button', {name: 'Try the two sample PDFs'}).click();
  await expect(page.getByText('Your 2 PDFs are ready.', {exact: false})).toBeVisible();
  await page.getByRole('button', {name: 'Merge', exact: true}).click();
  await expect(page.getByTestId('result-facts')).toContainText('3 pages');
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

test('compact preview fits the whole page and every control through Next, Zoom and Fit', async ({page}) => {
  await page.setViewportSize({width:320,height:568});
  await page.route('**/api/planner/status', route => route.fulfill({json:{connected:false,enabled:false,remaining:0,token:'synthetic-preview'}}));
  await page.goto('/');
  await page.getByRole('button', {name:'Try the two sample PDFs'}).click();
  await expect(page.getByText('Your 2 PDFs are ready.', {exact:false})).toBeVisible();
  await page.getByRole('button', {name:'Merge',exact:true}).click();
  await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  await page.getByTestId('current-result').getByRole('button', {name:'Preview',exact:true}).click();
  const preview = page.getByRole('region', {name:'Read-only preview'});
  const first=await settledPreview(page,1);
  expectWholePageVisible(first);
  for (const name of ['Close preview','Fit page','Previous page','Next page','Zoom out','Zoom in']) {
    await expect.poll(async () => {
      const outer=await page.getByTestId('conversation').boundingBox(), box=await preview.getByRole('button',{name,exact:true}).boundingBox();
      return !!outer&&!!box&&box.width>=44&&box.height>=44&&box.x>=outer.x&&box.x+box.width<=outer.x+outer.width&&box.y>=outer.y&&box.y+box.height<=outer.y+outer.height;
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

test('compact privacy explanation scrolls to a complete dismissal control and restores focus', async ({page}) => {
  await page.setViewportSize({width:320,height:568});
  await page.goto('/');
  const trigger=page.getByRole('button',{name:'Processed on your device',exact:true});
  await trigger.focus();await trigger.press('Enter');
  const dialog=page.getByRole('dialog');
  await expect(dialog).toHaveCount(1);
  await expect(dialog).toHaveAccessibleName('Processed on your device');
  await expect(dialog).toBeVisible();
  const heading=dialog.getByRole('heading',{name:'Processed on your device',exact:true});
  await expect.poll(async () => (await heading.boundingBox())?.y??-1).toBeGreaterThanOrEqual(0);
  const close=dialog.getByRole('button',{name:'Got it',exact:true});
  await close.scrollIntoViewIfNeeded();
  const box=await close.boundingBox();
  expect(box).not.toBeNull();expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(568);
  await close.focus();await close.press('Enter');
  await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
});

test('keyboard users can see focus on the composer in the built web app', async ({page}) => {
  await page.goto('/');
  const composer=page.getByRole('textbox',{name:'Tell atepdf what to do'});
  // Reach the field through the actual tab order, not a mouse click.
  for(let count=0;count<15&&!await composer.evaluate(element=>element===document.activeElement);count++)await page.keyboard.press('Tab');
  await expect(composer).toBeFocused();
  const shell=page.locator('.aui-composer-shell');
  await expect(shell).toHaveCSS('outline-style','solid');
  await expect(shell).toHaveCSS('outline-width','2px');
  await expect(shell).toHaveCSS('outline-color','rgb(23, 105, 223)');
});

test('larger text and a short web viewport keep the actual PDF workflow reachable', async ({page}) => {
  await page.setViewportSize({width:720,height:500});
  await page.route('**/api/planner/status',route=>route.fulfill({json:{connected:false,enabled:false,remaining:0,token:'synthetic-large-text'}}));
  await page.goto('/');
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  await page.getByRole('button',{name:'Try the two sample PDFs'}).click();
  await expect(page.getByText('Your 2 PDFs are ready.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Merge',exact:true}).click();
  await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  await expect.poll(async()=>(await page.getByTestId('conversation').boundingBox())?.height??0).toBeGreaterThan(150);
  const trigger=page.getByTestId('current-result').getByRole('button',{name:'Preview',exact:true});
  await trigger.click();
  const preview=page.getByRole('region',{name:'Read-only preview'});
  expectWholePageVisible(await settledPreview(page,1));
  await preview.getByRole('button',{name:'Next page',exact:true}).click();
  await expect(preview.getByText('Page 2 of 3',{exact:true})).toBeVisible();
  expectWholePageVisible(await settledPreview(page,2));
  await preview.getByRole('button',{name:'Close preview',exact:true}).click();
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('textbox',{name:'Tell atepdf what to do'})).toHaveCSS('font-size','32px');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
