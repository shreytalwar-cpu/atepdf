// Shared controls for the SHR-106 interface (docs/design/MIGRATION_MAP.md section 4).
// Behavioural assertions stay in each spec; these only locate the redesigned controls.
import {expect,type Page} from '@playwright/test';

export const composer=(page:Page)=>page.getByRole('textbox',{name:'Tell atePDF what to do'});
export async function send(page:Page,text:string){await composer(page).fill(text);await page.getByRole('button',{name:'Send message',exact:true}).click();}
export async function samples(page:Page){await page.getByRole('button',{name:'Try with sample PDFs'}).click();await expect(page.getByText(/Your 2 PDFs are ready/)).toBeVisible();}
export const emptyWorkspace=(page:Page)=>page.getByRole('heading',{name:'Drop PDFs here'});

async function menu(page:Page,item:string){
  await page.getByRole('button',{name:'More',exact:true}).click();
  await page.getByRole('menuitem',{name:item,exact:true}).click();
}
/** ⋯ ▸ Start Over… ▸ the confirmation sheet's destructive button. */
export async function startOver(page:Page){
  await menu(page,'Start Over…');
  const sheet=page.getByRole('dialog',{name:'Start over?'});
  await sheet.getByRole('button',{name:'Start Over',exact:true}).click();
  await expect(sheet).toHaveCount(0);
}
export async function openStartOver(page:Page){await menu(page,'Start Over…');return page.getByRole('dialog',{name:'Start over?'});}
/** ⋯ ▸ Settings… (an in-window sheet), optionally on one tab. */
export async function openSettings(page:Page,tab?:'General'|'Privacy & Storage'|'AI'|'About'){
  await menu(page,'Settings…');
  const dialog=page.getByRole('dialog',{name:'Settings'});
  await expect(dialog).toBeVisible();
  if(tab)await dialog.getByRole('tab',{name:tab,exact:true}).click();
  return dialog;
}
export async function closeSettings(page:Page){await page.getByRole('button',{name:'Close settings',exact:true}).click();await expect(page.getByRole('dialog',{name:'Settings'})).toHaveCount(0);}
/** Local help (⋯ ▸ What can atePDF do?): no model call. */
export async function help(page:Page){await menu(page,'What can atePDF do?');}
/** A typed merge request: the same path as the Merge suggestion chip (D-04). */
export async function typedMerge(page:Page){await send(page,'merge');}
