import {useEffect,useRef,useState,type ReactNode} from 'react';
import FilePlus2 from 'lucide-react-native/icons/file-plus-corner';
import Ban from 'lucide-react-native/icons/ban';
import './workspace.css';

// B4 DropOverlay. The depth count keeps the overlay steady across child elements; it clears
// on leave, drop, window blur and drag end. Dropping while a task runs adds nothing.
type Drag={count:number;pdfs:number};
export default function DropSurface({children,onFiles,disabled}:{children:ReactNode;onFiles:(files:File[])=>void;disabled:boolean}){
  const [drag,setDrag]=useState<Drag|null>(null),depth=useRef(0);
  const reset=()=>{depth.current=0;setDrag(null);};
  useEffect(()=>{window.addEventListener('blur',reset);window.addEventListener('dragend',reset);return()=>{window.removeEventListener('blur',reset);window.removeEventListener('dragend',reset);};},[]);
  const describe=(transfer:DataTransfer):Drag=>{const items=Array.from(transfer.items).filter(item=>item.kind==='file');return {count:items.length,pdfs:items.filter(item=>item.type==='application/pdf'||item.type==='').length};};
  const noun=(n:number)=>n===1?'PDF':`${n} PDFs`;
  return <div className="atepdf-workspace" role="main" aria-label="PDF conversation" style={{height:'100%',display:'flex',flexDirection:'column',position:'relative',minHeight:0}}
    onDragEnter={e=>{e.preventDefault();if(Array.from(e.dataTransfer.types).includes('Files')){depth.current++;setDrag(describe(e.dataTransfer));}}}
    onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect=disabled?'none':'copy';}}
    onDragLeave={e=>{e.preventDefault();depth.current=Math.max(0,depth.current-1);if(!depth.current)setDrag(null);}}
    onDrop={e=>{e.preventDefault();reset();if(!disabled)onFiles(Array.from(e.dataTransfer.files));}}>
    {children}
    {drag&&<div data-testid="drop-feedback" role="status" className={`atepdf-drop ${disabled||drag.pdfs===0?'atepdf-drop-blocked':''}`}>
      {disabled?<><strong>Wait for the current task to finish</strong><span>Or stop it first. Nothing was added.</span></>
        :drag.pdfs===0?<><Ban size={20} strokeWidth={1.75} color="currentColor" aria-hidden/><strong>These files can’t be added</strong><span>atePDF works with PDFs.</span></>
        :<><FilePlus2 size={20} strokeWidth={1.75} color="currentColor" aria-hidden/><strong>Drop to add {drag.count?noun(drag.pdfs):'PDFs'}</strong><span>{drag.pdfs<drag.count?'Only the PDFs can be added. ':''}They’re added in this order and checked on this Mac.</span></>}
    </div>}
    <input style={{position:'absolute',width:1,height:1,opacity:0,top:0,left:0}} tabIndex={-1} type="file" multiple accept=".pdf,application/pdf" aria-label="Choose PDF files" disabled={disabled} onChange={e=>{if(!disabled)onFiles(Array.from(e.target.files??[]));e.target.value='';}}/>
  </div>;
}
