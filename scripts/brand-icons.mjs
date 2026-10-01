// Renders the approved app icon (OD-1: Folio Eight, Ink) from its SVG master into the Apple
// asset catalog: the macOS AppIcon sizes for Catalyst plus a full-bleed 1024 for iOS, which
// masks its own corners. Uses the pinned Playwright Chrome; no new dependency. Development
// tool only: re-run after changing docs/design/brand/icon-a-folio-eight-ink.svg.
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const master=await readFile('docs/design/brand/icon-a-folio-eight-ink.svg','utf8');
const catalog='apps/universal/ios/atepdf/Images.xcassets/AppIcon.appiconset';
// iOS: the same layers, full bleed (no transparent margin, no rounded body).
const fullBleed=master
  .replace('<rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg)"/>','<rect width="1024" height="1024" fill="url(#bg)"/>')
  .replace(/<rect x="100.5"[^>]*\/>/,'')
  .replace('translate(212 212) scale(6)','translate(152 152) scale(7.2)');
const mac=[16,32,128,256,512].flatMap(size=>[[size,1],[size,2]]);
const browser=await chromium.launch({channel:'chrome'});
try{
  const page=await browser.newPage();
  const render=async(svg,pixels)=>{
    await page.setViewportSize({width:pixels,height:pixels});
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ',`<svg width="${pixels}" height="${pixels}" `)}</body></html>`);
    return page.screenshot({omitBackground:true,clip:{x:0,y:0,width:pixels,height:pixels}});
  };
  const images=[];
  for(const [size,scale] of mac){
    const filename=`mac-${size}@${scale}x.png`;
    await writeFile(`${catalog}/${filename}`,await render(master,size*scale));
    images.push({filename,idiom:'mac',scale:`${scale}x`,size:`${size}x${size}`});
  }
  await writeFile(`${catalog}/App-Icon-1024x1024@1x.png`,await render(fullBleed,1024));
  images.unshift({filename:'App-Icon-1024x1024@1x.png',idiom:'universal',platform:'ios',size:'1024x1024'});
  await writeFile(`${catalog}/Contents.json`,`${JSON.stringify({images,info:{version:1,author:'xcode'}},null,2)}\n`);
}finally{await browser.close();}
console.log('App icon rendered from the approved Folio Eight Ink master.');
