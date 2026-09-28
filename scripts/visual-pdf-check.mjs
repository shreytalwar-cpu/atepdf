import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const require=createRequire(import.meta.url);
const {createCanvas}=createRequire(require.resolve('pdfjs-dist/package.json'))('@napi-rs/canvas');
async function render(name){
  const task=getDocument({data:new Uint8Array(await readFile(`docs/evidence/${name}.pdf`)),verbosity:0,useSystemFonts:true});
  const doc=await task.promise,images=[];let textBoundsValid=true;
  try{for(let n=1;n<=doc.numPages;n++){
    const page=await doc.getPage(n),viewport=page.getViewport({scale:1}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
    await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;
    images.push({pixels:canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height});
    await writeFile(`docs/evidence/${name}-page-${n}.png`,canvas.toBuffer('image/png'));
    const text=await page.getTextContent();for(const item of text.items){if(!('str'in item)||!item.str.trim())continue;const [,,,,x,y]=item.transform;if(x<-.5||y<-.5||x>viewport.width+.5||y>viewport.height+.5)textBoundsValid=false;}
  }}finally{await task.destroy();}return {images,textBoundsValid};
}
const before=await render('chain-before'),ocr=await render('chain-searchable'),compressed=await render('chain-final');
function compare(a,b){if(a.width!==b.width||a.height!==b.height)throw Error('Page geometry changed');let sum=0,changed=0,max=0;for(let i=0;i<a.pixels.length;i+=4)for(let c=0;c<3;c++){const d=Math.abs(a.pixels[i+c]-b.pixels[i+c]);sum+=d;max=Math.max(max,d);if(d)changed++;}return {meanAbsoluteRGBDifference:sum/(a.width*a.height*3),changedChannels:changed,maxChannelDifference:max};}
const invisible=before.images.map((a,i)=>compare(a,ocr.images[i]));
const quality=ocr.images.map((a,i)=>compare(a,compressed.images[i]));
if(invisible.some(m=>m.changedChannels))throw Error('OCR changed the visible page');
if(!ocr.textBoundsValid||!compressed.textBoundsValid)throw Error('Text baseline outside page');
await writeFile('docs/evidence/pdf-visual-metrics.json',JSON.stringify({renderScale:1,ocrUnchangedPixels:invisible,compressionQualityMeasurements:quality,textBaselinesInPage:true},null,2));
console.log('Four pages independently rendered. OCR visible pixels identical. Text baselines within pages. Compression visual metrics recorded; manual review still required.');
