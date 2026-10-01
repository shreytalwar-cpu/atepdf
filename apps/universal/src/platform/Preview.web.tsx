import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';
import X from 'lucide-react-native/icons/x';
import type {LucideIcon} from 'lucide-react-native';
import type {PDFDocumentProxy,RenderTask} from 'pdfjs-dist';
import './preview.css';

// E1 Quick Look page view (web). The PDF.js rendering pipeline is unchanged; the page fits
// the sheet's well, and zoom pans inside it. Read-only: no editing or annotation controls.
const Icon=({as:Glyph}:{as:LucideIcon})=><Glyph size={16} strokeWidth={1.75} color="currentColor" aria-hidden/>;
export default function Preview({bytes,count,onClose}:{bytes:Uint8Array;count:number;onClose:()=>void;fill?:boolean}){
  const canvas=useRef<HTMLCanvasElement>(null),host=useRef<HTMLDivElement>(null);
  const returnFocus=useRef(document.activeElement);
  const [page,setPage]=useState(1),[zoom,setZoom]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [size,setSize]=useState({width:0,height:0});
  useLayoutEffect(()=>{
    const element=host.current;if(!element)return;
    const measure=()=>{const width=element.clientWidth,height=element.clientHeight;setSize(previous=>previous.width===width&&previous.height===height?previous:{width,height});};
    const resize=new ResizeObserver(measure);resize.observe(element);measure();
    return()=>resize.disconnect();
  },[]);
  useEffect(()=>{
    if(!size.width||!size.height)return;
    const abort=new AbortController();let pdf:PDFDocumentProxy|undefined,render:RenderTask|undefined;
    setLoading(true);setError('');
    void(async()=>{
      const {openPDF}=await import('@pdf/client');
      pdf=await openPDF(bytes,abort.signal);abort.signal.throwIfAborted();
      const p=await pdf.getPage(page);abort.signal.throwIfAborted();
      const base=p.getViewport({scale:1}),target=canvas.current;if(!target)return;
      const fitted=Math.min(Math.max(1,size.width-48)/base.width,Math.max(1,size.height-48)/base.height);
      const ratio=Math.min(2,window.devicePixelRatio||1),css=fitted*zoom;
      const viewport=p.getViewport({scale:Math.min(css*ratio,Math.sqrt(8_000_000/(base.width*base.height)))});
      target.width=Math.ceil(viewport.width);target.height=Math.ceil(viewport.height);
      target.style.width=`${Math.ceil(base.width*css)}px`;target.style.height=`${Math.ceil(base.height*css)}px`;
      render=p.render({canvas:target,canvasContext:target.getContext('2d')!,viewport});
      await render.promise;if(!abort.signal.aborted)setLoading(false);
    })().catch(()=>{if(!abort.signal.aborted){setError('This page could not be previewed. Your PDF is unchanged.');setLoading(false);}});
    return()=>{abort.abort();render?.cancel();void pdf?.loadingTask.destroy();};
  },[bytes,page,zoom,size]);
  const navigate=(next:number)=>{if(next<1||next>count)return;setLoading(true);setZoom(1);setPage(next);host.current?.scrollTo({top:0,left:0,behavior:'instant'});};
  const changeZoom=(next:number)=>{
    if(next===1)host.current?.scrollTo({top:0,left:0,behavior:'instant'});
    if(next===zoom)return;
    setLoading(true);setZoom(next);
  };
  const close=()=>{
    onClose();
    // Restore only after an explicit dismissal, never after a new job or clear.
    const trigger=returnFocus.current;
    if(trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({preventScroll:true});
  };
  return <section aria-label="Read-only preview" className="atepdf-preview"
    onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='PageDown'){event.preventDefault();navigate(page+1);}else if(event.key==='ArrowLeft'||event.key==='PageUp'){event.preventDefault();navigate(page-1);}}}>
    <div ref={host} className="atepdf-preview-well" aria-busy={loading} tabIndex={0}>
      {(loading||error)&&<div className="atepdf-preview-status">{error?<p role="alert">{error}</p>:<p role="status">Rendering page…</p>}</div>}
      <canvas ref={canvas} aria-label={`PDF page ${page}`} style={{visibility:loading||error?'hidden':'visible'}}/>
    </div>
    <div className="atepdf-preview-toolbar" role="toolbar" aria-label="Preview controls">
      <button type="button" disabled={loading||page===1} aria-label="Previous page" onClick={()=>navigate(page-1)}><Icon as={ChevronLeft}/></button>
      <span className="atepdf-preview-count" aria-live="polite">Page {page} of {count}</span>
      <button type="button" disabled={loading||page===count} aria-label="Next page" onClick={()=>navigate(page+1)}><Icon as={ChevronRight}/></button>
      <span className="atepdf-preview-divider" aria-hidden/>
      <button type="button" disabled={loading||zoom<=1} aria-label="Zoom out" onClick={()=>changeZoom(Math.max(1,zoom-.5))}><Icon as={Minus}/></button>
      <button type="button" disabled={loading} aria-label="Fit page" onClick={()=>changeZoom(1)} className="atepdf-preview-text">Fit</button>
      <button type="button" disabled={loading||zoom>=3} aria-label="Zoom in" onClick={()=>changeZoom(Math.min(3,zoom+.5))}><Icon as={Plus}/></button>
      <span className="atepdf-preview-spacer"/>
      <button type="button" onClick={close} aria-label="Close preview"><Icon as={X}/></button>
    </div>
  </section>;
}
