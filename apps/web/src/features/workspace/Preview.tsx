'use client';
import {useEffect,useRef,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {ChevronLeft,ChevronRight,Minus,Plus,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {openPDF} from '@pdf/client';
import type {PDFDocumentProxy,RenderTask} from 'pdfjs-dist';
export function Preview({bytes,count,onClose}:{bytes:Uint8Array;count:number;onClose:()=>void}){
  const canvas=useRef<HTMLCanvasElement>(null),[page,setPage]=useState(1),[zoom,setZoom]=useState(1),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{
    const abort=new AbortController();let pdf:PDFDocumentProxy|undefined,render:RenderTask|undefined;
    setLoading(true);setError('');
    void (async()=>{
      pdf=await openPDF(bytes,abort.signal);abort.signal.throwIfAborted();const p=await pdf.getPage(page),base=p.getViewport({scale:1});
      const target=canvas.current;if(!target)return;
      const width=Math.min(window.innerWidth-64,780)*zoom;
      const scale=Math.min(width/base.width,Math.sqrt(8_000_000/(base.width*base.height)));
      const viewport=p.getViewport({scale});target.width=Math.ceil(viewport.width);target.height=Math.ceil(viewport.height);
      render=p.render({canvas:target,canvasContext:target.getContext('2d')!,viewport});await render.promise;if(!abort.signal.aborted)setLoading(false);
    })().catch(()=>{if(!abort.signal.aborted){setError('Preview could not render this page.');setLoading(false);}});
    return ()=>{abort.abort();render?.cancel();void pdf?.loadingTask.destroy();};
  },[bytes,page,zoom]);
  return <Dialog.Root open onOpenChange={open=>{if(!open)onClose();}}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="preview-dialog">
    <div className="preview-header"><div><Dialog.Title>Read-only preview</Dialog.Title><Dialog.Description>atepdf result · {count} pages</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close preview"><X/></Button></Dialog.Close></div>
    <div className="preview-toolbar"><Button variant="outline" size="icon" disabled={page===1} aria-label="Previous page" onClick={()=>setPage(page-1)}><ChevronLeft/></Button><span>Page {page} of {count}</span><Button variant="outline" size="icon" disabled={page===count} aria-label="Next page" onClick={()=>setPage(page+1)}><ChevronRight/></Button><span className="toolbar-spacer"/><Button variant="ghost" size="icon" aria-label="Zoom out" disabled={zoom<=0.5} onClick={()=>setZoom(zoom-0.25)}><Minus/></Button><span>{Math.round(zoom*100)}%</span><Button variant="ghost" size="icon" aria-label="Zoom in" disabled={zoom>=2} onClick={()=>setZoom(zoom+0.25)}><Plus/></Button></div>
    <div className="preview-page">{loading&&<p role="status">Rendering page…</p>}{error&&<p role="alert">{error}</p>}<canvas ref={canvas} aria-label={`PDF page ${page}`} style={{visibility:loading?'hidden':'visible'}}/></div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
