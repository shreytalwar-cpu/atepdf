import {useEffect,useLayoutEffect,useRef,useState} from 'react';
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
  const header=useRef<HTMLDivElement>(null),toolbar=useRef<HTMLDivElement>(null);
  const returnFocus=useRef(document.activeElement);
  const revealed=useRef(false);
  const [page,setPage]=useState(1),[zoom,setZoom]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [size,setSize]=useState({width:0,height:0});
  const [pageHeight,setPageHeight]=useState<number>();
  useLayoutEffect(()=>{
    const element=host.current,heading=header.current,controls=toolbar.current;
    const conversation=region.current?.closest<HTMLElement>('.aui-message-group');
    if(!element||!heading||!controls||!conversation)return;
    const measure=()=>{
      // The composer and footer can grow independently. Fit the actual page
      // below the unchanged controls inside the remaining conversation space.
      const chrome=heading.getBoundingClientRect().height+controls.getBoundingClientRect().height+2;
      const available=Math.max(48,Math.floor(conversation.clientHeight-chrome-8));
      const height=Math.min(Math.max(160,window.innerHeight*.4),400,available);
      setPageHeight(previous=>previous===height?previous:height);
      const width=element.clientWidth,currentHeight=element.clientHeight;
      setSize(previous=>previous.width===width&&previous.height===currentHeight?previous:{width,height:currentHeight});
    };
    const resize=new ResizeObserver(measure);
    [element,heading,controls,conversation].forEach(node=>resize.observe(node));
    measure();
    return()=>resize.disconnect();
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
  return <section ref={region} aria-label="Read-only preview" className="inline-preview">
    <div ref={header} className="inline-preview-header"><strong>Read-only preview</strong><button type="button" disabled={loading} onClick={()=>changeZoom(1)} aria-label="Fit page">Fit</button><button type="button" onClick={close} aria-label="Close preview"><Icon as={X} size={18}/></button></div>
    <div ref={toolbar} className="inline-toolbar">
      <div className="inline-page-navigation">
      <button type="button" disabled={loading||page===1} aria-label="Previous page" onClick={()=>navigate(page-1)}><Icon as={ChevronLeft} size={18}/></button>
      <span className="inline-page-count" aria-live="polite">Page {page} of {count}</span>
      <button type="button" disabled={loading||page===count} aria-label="Next page" onClick={()=>navigate(page+1)}><Icon as={ChevronRight} size={18}/></button>
      </div>
      <div className="inline-zoom-controls">
      <button type="button" disabled={loading||zoom<=1} aria-label="Zoom out" onClick={()=>changeZoom(Math.max(1,zoom-.5))}><Icon as={Minus} size={18}/></button>
      <button type="button" disabled={loading||zoom>=3} aria-label="Zoom in" onClick={()=>changeZoom(Math.min(3,zoom+.5))}><Icon as={Plus} size={18}/></button>
      </div>
    </div>
    <div ref={host} className="inline-page" aria-busy={loading} style={{height:pageHeight}}>
      {(loading||error)&&<div className="inline-preview-status">{error?<p role="alert">{error}</p>:<p role="status"><span className="inline-preview-spinner" aria-hidden="true"/>Rendering page…</p>}</div>}
      <canvas ref={canvas} aria-label={`PDF page ${page}`} style={{visibility:loading||error?'hidden':'visible'}}/>
    </div>
  </section>;
}
