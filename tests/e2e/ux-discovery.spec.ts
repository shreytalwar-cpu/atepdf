import {test,expect,type Page} from '@playwright/test';

async function localOnly(page:Page,baseURL:string|undefined,enabled=false) {
  if (!baseURL) throw new Error('This browser test needs the local atepdf base URL.');
  const origin=new URL(baseURL).origin;
  if (!['localhost','127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Only a local test server is allowed.');
  const blocked:string[]=[];
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==origin||request.method()!=='GET') {
      blocked.push(`${request.method()} ${url.origin}${url.pathname}`);
      await route.abort('blockedbyclient');return;
    }
    if(url.pathname==='/api/planner/status') {
      await route.fulfill({json:{connected:enabled,enabled,remaining:enabled?2:0,token:'synthetic-discovery'}});return;
    }
    await route.continue();
  });
  await page.emulateMedia({reducedMotion:'reduce'});
  return blocked;
}

test('initial Choose files stays fully visible in a short window at 200% text size',async({page,baseURL})=>{
  const blocked=await localOnly(page,baseURL);
  await page.setViewportSize({width:720,height:500});
  await page.goto('/');
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  const choose=page.getByRole('button',{name:'Choose files',exact:true});
  // No click, focus or scrollIntoView may repair the initial layout for this assertion.
  await expect(choose).toBeInViewport({ratio:1});
  await expect.poll(async()=>{
    const [button,welcome]=await Promise.all([choose.boundingBox(),page.getByTestId('welcome').boundingBox()]);
    return !!button&&!!welcome&&button.height>=44&&button.y>=welcome.y&&button.y+button.height<=welcome.y+welcome.height;
  }).toBe(true);
  await expect(page.getByText('Choose files',{exact:true})).toHaveCSS('font-size','28px');
  await expect(page.getByText('Then tell me what you’d like to do.',{exact:true})).toBeAttached();
  await expect(page.getByRole('textbox',{name:'Tell atepdf what to do'})).toHaveCSS('font-size','32px');
  expect(blocked).toEqual([]);
});

for(const enabled of [false,true]) test(`visible Help explains local tasks in chat with AI ${enabled?'enabled':'disconnected'}, without a provider request`,async({page,baseURL})=>{
  const blocked=await localOnly(page,baseURL,enabled);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const help=page.getByRole('button',{name:'Help',exact:true});
  await expect(help).toBeInViewport({ratio:1});
  await help.click();
  await expect(page.getByTestId('user-message').last()).toContainText('What can I do with my PDFs?');
  const answer=page.getByTestId('assistant-message').last();
  await expect(answer).toContainText('I can merge PDFs, remove pages');
  await expect(answer).toContainText('These tasks work without an AI connection. Connecting AI is optional');
  await expect(answer).toContainText('Type “undo” to restore the previous result.');
  await expect(answer.getByRole('button',{name:'AI connection',exact:true})).toHaveCount(0);
  await expect(page.getByRole('textbox',{name:'Tell atepdf what to do'})).toBeEnabled();
  expect(blocked).toEqual([]);
});

test('compact quick actions retain readable labels and full-size icons',async({page,baseURL})=>{
  await localOnly(page,baseURL);
  await page.setViewportSize({width:320,height:568});
  await page.goto('/');
  for(const name of ['Merge','Compress','Make searchable']) {
    const action=page.getByRole('button',{name,exact:true});
    await expect(action).toBeInViewport({ratio:1});
    await expect(action.getByText(name,{exact:true})).toHaveCSS('font-size','12px');
    const icon=await action.locator('svg').boundingBox();
    expect(icon).not.toBeNull();expect(icon!.width).toBeGreaterThanOrEqual(16);expect(icon!.height).toBeGreaterThanOrEqual(16);
  }
});
