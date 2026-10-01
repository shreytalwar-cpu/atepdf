// First-page thumbnails for file rows and result cards (COMPONENT_INVENTORY C6), rendered
// locally with the same PDF.js reader as the preview. Loaded on first use, never at startup.
export async function renderThumbnail(bytes:Uint8Array,maxDimension:number,signal:AbortSignal):Promise<string>{
  const {openPDF}=await import('@pdf/client');
  const pdf=await openPDF(bytes,signal);
  try{
    const page=await pdf.getPage(1);signal.throwIfAborted();
    const base=page.getViewport({scale:1}),scale=maxDimension/Math.max(base.width,base.height);
    const viewport=page.getViewport({scale});
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport}).promise;signal.throwIfAborted();
    return canvas.toDataURL('image/png');
  }finally{void pdf.loadingTask.destroy();}
}
