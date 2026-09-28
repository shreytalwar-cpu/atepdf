const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const out = __dirname;
const records = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const [name, width, height] of [['desktop',1440,1000],['phone',390,844],['compact',320,568]]) {
      const context = await browser.newContext({ viewport: {width,height}, deviceScaleFactor: 1, acceptDownloads:true });
      const page = await context.newPage();
      const snap = async state => {
        await wait(450);
        const filename = `${name}-${state}.png`;
        await page.screenshot({path:path.join(out,filename)});
        records.push({viewport:{name,width,height},state,screenshot:filename,text:await page.locator('body').innerText()});
      };
      const submit = async text => {
        await page.getByRole('textbox',{name:'Tell atepdf what to do'}).fill(text);
        await page.getByRole('button',{name:'Send message',exact:true}).click();
      };
      try {
        await page.goto('http://localhost:3213', {waitUntil:'networkidle'});
        await page.getByRole('button',{name:'Try the two sample PDFs'}).waitFor();
        await snap('empty');
        await page.getByRole('button',{name:'Try the two sample PDFs'}).click();
        await page.getByText('Your 2 PDFs are ready.',{exact:false}).waitFor();
        if(name==='desktop') await snap('import');
        await page.getByRole('button',{name:'Merge',exact:true}).click();
        await page.getByTestId('current-result').waitFor();
        await snap('merge');
        await page.getByTestId('current-result').getByRole('button',{name:'Preview',exact:true}).click();
        await page.getByRole('button',{name:'Next page',exact:true}).waitFor();
        await page.locator('.inline-page[aria-busy="false"]').waitFor();
        await snap('preview');
        await page.getByRole('button',{name:'Next page',exact:true}).click();
        await page.locator('.inline-page[aria-busy="false"]').waitFor();
        records.push({viewport:name,state:'preview-next',page:await page.locator('.inline-page-count').innerText()});
        await page.getByRole('button',{name:'Close preview',exact:true}).click();
        await submit('Remove page 2');
        await page.getByTestId('current-result').getByRole('heading',{name:'PDF with page 2 removed',exact:true}).waitFor();
        await snap('remove');
        await page.getByTestId('current-result').getByRole('button',{name:'Undo',exact:true}).click();
        await page.getByTestId('current-result').getByRole('heading',{name:'Merged PDF',exact:true}).waitFor();
        if(name!=='compact') await snap('undo');
        await submit('Remove page 99');
        await wait(650);
        if(name!=='compact') await snap('page-error');
        await submit('What can you do?');
        await page.getByText('I can merge PDFs, remove pages',{exact:false}).waitFor();
        await snap('no-ai-help');
        if(name==='compact') {
          await page.getByRole('button',{name:'Processed on your device',exact:true}).click();
          await snap('privacy');
          await page.getByRole('button',{name:'Got it',exact:true}).click();
        }
      } catch(error) {
        records.push({viewport:name,error:String(error),text:await page.locator('body').innerText()});
        await page.screenshot({path:path.join(out,`${name}-failure.png`)});
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await fs.writeFile(path.join(out,'journey.json'),JSON.stringify(records,null,2));
  }
  console.log(JSON.stringify(records.map(({viewport,state,screenshot,error,page})=>({viewport,state,screenshot,error,page})),null,2));
})();
