// Renders the app icon (Folio Eight on black, the owner's SHR-106 polish direction) from its SVG
// master into the Apple asset catalog: the macOS AppIcon sizes for Catalyst plus a full-bleed
// 1024 for iOS, which masks its own corners. Uses the pinned Playwright Chrome; no new dependency.
// Development tool only: re-run after changing docs/design/brand/icon-folio-eight-black.svg.
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const master=await readFile('docs/design/brand/icon-folio-eight-black.svg','utf8');
const catalog='apps/universal/ios/atepdf/Images.xcassets/AppIcon.appiconset';
// iOS: the same layers, full bleed (no transparent margin, no rounded body, no edge hairline).
const fullBleed=master
  .replace('<rect x="100" y="100" width="824" height="824" rx="185" fill="#000000"/>','<rect width="1024" height="1024" fill="#000000"/>')
  .replace(/<rect x="101"[^>]*\/>/,'')
  .replace('translate(212 212) scale(6)','translate(152 152) scale(7.2)');
// 16 and 32 px: the fold tint drops out and the mark grows slightly so its counters stay open.
const small=master.replace(/<path id="fold"[^>]*\/>/,'').replace('translate(212 212) scale(6)','translate(182 182) scale(6.6)');
const mac=[16,32,128,256,512].flatMap(size=>[[size,1],[size,2]]);
const browser=await chromium.launch({channel:'chrome'});
try{
  const page=await browser.newPage();
  // Each master is rasterised once at 1024 px; every size is then a high-quality canvas
  // downscale of that raster. Rasterising the SVG at each small viewport occasionally came
  // back tiled/corrupt in headless Chrome, so each output is also checked against the master.
  const raster=async svg=>{
    await page.setViewportSize({width:1024,height:1024});
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ','<svg width="1024" height="1024" ')}</body></html>`);
    return (await page.screenshot({omitBackground:true,clip:{x:0,y:0,width:1024,height:1024}})).toString('base64');
  };
  const scaled=(source,pixels)=>page.evaluate(async([source,pixels])=>{
    const image=new Image();image.src=`data:image/png;base64,${source}`;await image.decode();
    // Halve in steps for a clean downscale, then draw the exact size.
    let canvas=document.createElement('canvas'),size=1024;canvas.width=canvas.height=size;canvas.getContext('2d').drawImage(image,0,0);
    while(size/2>=pixels){const next=document.createElement('canvas');next.width=next.height=size/2;const context=next.getContext('2d');context.imageSmoothingQuality='high';context.drawImage(canvas,0,0,size/2,size/2);canvas=next;size/=2;}
    const out=document.createElement('canvas');out.width=out.height=pixels;const context=out.getContext('2d');context.imageSmoothingQuality='high';context.drawImage(canvas,0,0,pixels,pixels);
    // Integrity check: the output must match the master's own downscale closely (no tiling).
    const reference=document.createElement('canvas');reference.width=reference.height=16;reference.getContext('2d').drawImage(image,0,0,16,16);
    const probe=document.createElement('canvas');probe.width=probe.height=16;probe.getContext('2d').drawImage(out,0,0,16,16);
    const a=reference.getContext('2d').getImageData(0,0,16,16).data,b=probe.getContext('2d').getImageData(0,0,16,16).data;
    let difference=0;for(let i=0;i<a.length;i++)difference+=Math.abs(a[i]-b[i]);
    return {data:out.toDataURL('image/png').split(',')[1],difference:difference/a.length};
  },[source,pixels]);
  const masters={master:await raster(master),small:await raster(small)};
  const images=[];
  for(const [size,scale] of mac){
    const filename=`mac-${size}@${scale}x.png`,pixels=size*scale;
    const {data,difference}=await scaled(pixels<=32?masters.small:masters.master,pixels);
    if(difference>12)throw new Error(`${filename} does not match its master (difference ${difference.toFixed(1)}).`);
    await writeFile(`${catalog}/${filename}`,Buffer.from(data,'base64'));
    images.push({filename,idiom:'mac',scale:`${scale}x`,size:`${size}x${size}`});
  }
  const render=async(svg,pixels)=>Buffer.from(pixels===1024?await raster(svg):(await scaled(await raster(svg),pixels)).data,'base64');
  await writeFile(`${catalog}/App-Icon-1024x1024@1x.png`,await render(fullBleed,1024));
  images.unshift({filename:'App-Icon-1024x1024@1x.png',idiom:'universal',platform:'ios',size:'1024x1024'});
  await writeFile(`${catalog}/Contents.json`,`${JSON.stringify({images,info:{version:1,author:'xcode'}},null,2)}\n`);
}finally{await browser.close();}
console.log('App icon rendered from the Folio Eight black master.');
