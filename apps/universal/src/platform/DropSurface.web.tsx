import {useEffect,useRef,useState,type ReactNode} from 'react';
import {FilePlus2} from 'lucide-react';

export default function DropSurface({children,onFiles,disabled}:{children:ReactNode;onFiles:(files:File[])=>void;disabled:boolean}){
  const [dragging,setDragging]=useState(false),depth=useRef(0);
  const reset=()=>{depth.current=0;setDragging(false);};
  useEffect(()=>{window.addEventListener('blur',reset);window.addEventListener('dragend',reset);return()=>{window.removeEventListener('blur',reset);window.removeEventListener('dragend',reset);};},[]);
  useEffect(()=>{if(disabled)reset();},[disabled]);
  return <div style={{height:'100%',display:'flex',flexDirection:'column',position:'relative'}}
    onDragEnter={e=>{e.preventDefault();if(!disabled&&Array.from(e.dataTransfer.types).includes('Files')){depth.current++;setDragging(true);}}}
    onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect=disabled?'none':'copy';}}
    onDragLeave={e=>{e.preventDefault();depth.current=Math.max(0,depth.current-1);if(!depth.current)setDragging(false);}}
    onDrop={e=>{e.preventDefault();reset();if(!disabled)onFiles(Array.from(e.dataTransfer.files));}}>
    {children}
    {dragging&&!disabled&&<div data-testid="drop-feedback" role="status" style={{position:'absolute',inset:12,zIndex:20,pointerEvents:'none',border:'2px dashed #1769df',borderRadius:28,background:'rgba(245,249,255,.96)',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,color:'#18213b'}}><FilePlus2 size={32} color="#1769df" aria-hidden/><strong style={{fontSize:22,fontWeight:600}}>Drop your PDFs here</strong><span style={{fontSize:14,color:'#5d6980'}}>They’ll stay on this device.</span></div>}
    <input style={{position:'absolute',width:1,height:1,opacity:0,top:0,left:0}} tabIndex={-1} type="file" multiple accept=".pdf,application/pdf" aria-label="Choose PDF files" disabled={disabled} onChange={e=>{if(!disabled)onFiles(Array.from(e.target.files??[]));e.target.value='';}}/>
  </div>;
}
