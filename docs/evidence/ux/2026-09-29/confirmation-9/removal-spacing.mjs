import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const out='.build/ux-20260929/confirmation-9';
const browser=await chromium.launch({channel:'chrome',headless:true});
const css='.aui-message-group [data-testid=current-result],.aui-message-group [data-testid=previous-result] {padding-block:12px;row-gap:8px}';
const result={kind:'targeted candidate-9 live CSS diagnostic; after is not an exported build',css};
try {
  const context=await browser.newContext({viewport:{width:320,height:568},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.route('**/*',async route=>{const r=route.request();if(new URL(r.url()).origin==='http://localhost:3213'&&r.method()==='GET')await route.continue();else await route.abort('blockedbyclient');});
  const page=await context.newPage();await page.goto('http://localhost:3213',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Try the two sample PDFs',exact:true}).click();
  await expect(page.getByText(/Your 2 PDFs are ready/)).toBeVisible();
  await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('3 pages');
  await page.getByTestId('current-result').getByRole('button',{name:'Preview',exact:true}).click();await expect(page.locator('.inline-page')).toHaveAttribute('aria-busy','false');
  await page.getByRole('button',{name:'Close preview',exact:true}).click();
  await page.getByTestId('conversation').hover();await page.mouse.wheel(0,-5000);await page.waitForTimeout(400);
  await page.getByRole('textbox',{name:'Tell atepdf what to do'}).fill('Remove physical page 2 from the merged result.');
  await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('2 pages');await page.waitForTimeout(600);
  const measure=()=>page.evaluate(()=>{
    const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom};};
    const card=document.querySelector('[data-testid=current-result]'),style=getComputedStyle(card),heading=card.querySelector('[role=heading]'),save=[...card.querySelectorAll('[role=button]')].find(e=>e.textContent==='Save PDF'),conversation=document.querySelector('[data-testid=conversation]');
    return {conversation:r(conversation),heading:r(heading),save:r(save),card:r(card),paddingTop:style.paddingTop,paddingBottom:style.paddingBottom,rowGap:style.rowGap,footer:r(document.querySelector('.aui-thread-viewport-footer'))};
  });
  result.before=await measure();
  await page.addStyleTag({content:css});await page.waitForTimeout(600);result.after=await measure();
  await page.screenshot({path:`${out}/images/compact-removal-live-spacing-probe.png`});
  for(const name of ['heading','save']) {
    const box=result.after[name],outer=result.after.conversation;
    expect(box.y).toBeGreaterThanOrEqual(outer.y-1);expect(box.bottom).toBeLessThanOrEqual(outer.bottom+1);
  }
}finally{await browser.close();result.browserClosed=true;await writeFile(`${out}/removal-spacing.json`,JSON.stringify(result,null,2));}
console.log(JSON.stringify(result,null,2));
