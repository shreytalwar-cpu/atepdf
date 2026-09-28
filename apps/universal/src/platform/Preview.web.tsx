import {useEffect,useRef,useState} from 'react';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';
import X from 'lucide-react-native/icons/x';
import {Icon} from '../components/ui/icon';
import {openPDF} from '@pdf/client';
import type {PDFDocumentProxy,RenderTask} from 'pdfjs-dist';
import './preview.css';

export default function Preview({bytes,count,onClose}:{bytes:Uint8Array;count:number;onClose:()=>void}){
  const canvas=useRef<HTMLCanvasElement>(null),host=useRef<HTMLDivElement>(null),region=useRef<HTMLElement>(null);
  const returnFocus=useRef(document.activeElement);
  const revealed=useRef(false);
  const [page,setPage]=useState(1),[zoom,setZoom]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [size,setSize]=useState({width:0,height:0});
  useEffect(()=>{
    const element=host.current;if(!element)return;
    const resize=new ResizeObserver(()=>setSize({width:element.clientWidth,height:element.clientHeight}));
    resize.observe(element);return()=>resize.disconnect();
  },[]);
  useEffect(()=>{
    if(!loading&&!revealed.current){revealed.current=true;region.current?.scrollIntoView({block:'start',behavior:'instant'});}
  },[loading]);
  useEffect(()=>{
    if(!size.width||!size.height)return;
    const abort=new AbortController();let pdf:PDFDocumentProxy|undefined,render:RenderTask|undefined;
    setLoading(true);setError('');
    void(async()=>{
      pdf=await openPDF(bytes,abort.signal);abort.signal.throwIfAborted();
      const p=await pdf.getPage(page);abort.signal.throwIfAborted();
      const base=p.getViewport({scale:1}),target=canvas.current;if(!target)return;
      const fitted=Math.min(Math.max(1,size.width-24)/base.width,Math.max(1,size.height-24)/base.height);
      const viewport=p.getViewport({scale:Math.min(fitted*zoom,Math.sqrt(8_000_000/(base.width*base.height)))});
      target.width=Math.ceil(viewport.width);target.height=Math.ceil(viewport.height);
      render=p.render({canvas:target,canvasContext:target.getContext('2d')!,viewport});
      await render.promise;if(!abort.signal.aborted)setLoading(false);
    })().catch(()=>{if(!abort.signal.aborted){setError('This page could not be previewed. Your PDF is unchanged.');setLoading(false);}});
    return()=>{abort.abort();render?.cancel();void pdf?.loadingTask.destroy();};
  },[bytes,page,zoom,size]);
  const navigate=(next:number)=>{setLoading(true);setZoom(1);setPage(next);host.current?.scrollTo({top:0,left:0,behavior:'instant'});};
  const close=()=>{
    onClose();
    // Restore only after an explicit dismissal, never after a new job or clear.
    const trigger=returnFocus.current;
    if(trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({preventScroll:true});
  };
  return <section ref={region} aria-label="Read-only preview" className="inline-preview">
    <div className="inline-preview-header"><strong>Read-only preview</strong><button type="button" disabled={loading} onClick={()=>setZoom(1)} aria-label="Fit page">Fit</button><button type="button" onClick={close} aria-label="Close preview"><Icon as={X} size={18}/></button></div>
    <div className="inline-toolbar">
      <div className="inline-page-navigation">
      <button type="button" disabled={loading||page===1} aria-label="Previous page" onClick={()=>navigate(page-1)}><Icon as={ChevronLeft} size={18}/></button>
      <span className="inline-page-count" aria-live="polite">Page {page} of {count}</span>
      <button type="button" disabled={loading||page===count} aria-label="Next page" onClick={()=>navigate(page+1)}><Icon as={ChevronRight} size={18}/></button>
      </div>
      <div className="inline-zoom-controls">
      <button type="button" disabled={loading||zoom<=1} aria-label="Zoom out" onClick={()=>setZoom(value=>Math.max(1,value-.5))}><Icon as={Minus} size={18}/></button>
      <button type="button" disabled={loading||zoom>=3} aria-label="Zoom in" onClick={()=>setZoom(value=>Math.min(3,value+.5))}><Icon as={Plus} size={18}/></button>
      </div>
    </div>
    <div ref={host} className="inline-page" aria-busy={loading}>
      {(loading||error)&&<div className="inline-preview-status">{error?<p role="alert">{error}</p>:<p role="status"><span className="inline-preview-spinner" aria-hidden="true"/>Rendering page…</p>}</div>}
      <canvas ref={canvas} aria-label={`PDF page ${page}`} style={{visibility:loading||error?'hidden':'visible'}}/>
    </div>
  </section>;
}
