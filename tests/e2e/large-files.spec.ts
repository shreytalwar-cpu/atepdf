import {test,expect} from '@playwright/test';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {largePDF} from '../helpers/large-pdf';
test('large local PDFs: import → >40 MB merge → preview/save → remove → undo without egress',async({page})=>{
  const dir=await mkdtemp(join(tmpdir(),'atepdf-large-browser-'));const requests:{url:string;method:string}[]=[],errors:string[]=[];
  page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('pageerror',e=>errors.push(e.message));
  try{
    const a=await largePDF('LARGE-A1'),b=await largePDF('LARGE-B1');expect(a.length).toBeGreaterThan(20_000_000);expect(b.length).toBeGreaterThan(20_000_000);
    await writeFile(join(dir,'large-a.pdf'),a);await writeFile(join(dir,'large-b.pdf'),b);
    await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
    await page.goto('/');await expect(page.getByText(/up to 20 MB/)).toHaveCount(0);await page.getByLabel('Choose PDF files').setInputFiles([join(dir,'large-a.pdf'),join(dir,'large-b.pdf')]);await expect(page.getByText('Your 2 PDFs are ready.',{exact:false})).toBeVisible();
    await page.getByRole('button',{name:'Merge',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('2 pages');
    const result=page.getByTestId('current-result');await result.getByRole('button',{name:'Preview',exact:true}).click();await expect(result.getByRole('region',{name:'Read-only preview'})).toBeVisible();await expect(page.getByText('Rendering page…')).not.toBeVisible();await page.screenshot({path:'docs/evidence/planner/large-pdf-preview.png'});await page.getByRole('button',{name:'Close preview'}).click();
    const download=page.waitForEvent('download');await result.getByRole('button',{name:'Save PDF',exact:true}).click();await (await download).saveAs(join(dir,'merged.pdf'));const merged=await readFile(join(dir,'merged.pdf'));expect(merged.length).toBeGreaterThan(40_000_000);
    await result.getByRole('button',{name:'Remove page 2',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('1 pages');await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByTestId('result-facts')).toContainText('2 pages');
    const restoredDownload=page.waitForEvent('download');await page.getByTestId('current-result').getByRole('button',{name:'Save PDF',exact:true}).click();await (await restoredDownload).saveAs(join(dir,'undo.pdf'));const undo=await readFile(join(dir,'undo.pdf'));expect(createHash('sha256').update(undo).digest('hex')).toBe(createHash('sha256').update(merged).digest('hex'));
    expect(errors).toEqual([]);expect(requests.filter(r=>r.method!=='GET'||new URL(r.url).origin!==new URL(page.url()).origin)).toEqual([]);
    await writeFile('docs/evidence/planner/large-files.json',JSON.stringify({inputBytes:[a.length,b.length],mergedBytes:merged.length,undoByteIdentical:true,previewRendered:true,noPDFEgress:true,requests},null,2));
  }finally{await rm(dir,{recursive:true,force:true});}
});
