'use client';
import {lazy,Suspense,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {ArrowDownToLine,ArrowUp,Check,ChevronDown,Copy,FileText,FolderOpen,LockKeyhole,Plus,ScanText,ShieldCheck,Sparkles,Undo2,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {LocalFileStore} from '@core/local-file-store';
import {JobController} from '@core/job-controller';
import {savePDF,type SavePicker} from '@/services/export';
import {inspect,recognize,runWorker} from '@pdf/client';
const Preview=lazy(()=>import('./Preview').then(m=>({default:m.Preview})));
const size=(n:number)=>n<1_000_000?`${(n/1000).toFixed(1)} kB`:`${(n/1_000_000).toFixed(2)} MB`;
export default function Workspace(){
  const [controller]=useState(()=>new JobController(new LocalFileStore(),{worker:runWorker,inspect,recognize}));
  const state=useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
  const store=controller.store,input=useRef<HTMLInputElement>(null),composer=useRef<HTMLTextAreaElement>(null);
  const [draft,setDraft]=useState(''),[message,setMessage]=useState(''),[drag,setDrag]=useState(false),[preview,setPreview]=useState(false),[privacy,setPrivacy]=useState(false),[quality,setQuality]=useState<'compress'|'chain'|null>(null),[saveState,setSaveState]=useState<Record<string,string>>({}),[saving,setSaving]=useState(false),[sampleLoading,setSampleLoading]=useState(false),[removePage,setRemovePage]=useState('2');
  const files=store.originals.map(r=>store.get(r).meta),current=store.focus?store.get(store.focus):null;
  const busy=state.busy||sampleLoading;
  useEffect(()=>{const fn=(e:BeforeUnloadEvent)=>{if(store.list.length||controller.state.busy){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',fn);return()=>window.removeEventListener('beforeunload',fn);},[store,controller]);
  useEffect(()=>{const update=()=>document.documentElement.style.setProperty('--visible-height',`${window.visualViewport?.height??window.innerHeight}px`);update();window.visualViewport?.addEventListener('resize',update);return()=>window.visualViewport?.removeEventListener('resize',update);},[]);
  const add=async(files:File[])=>{setMessage('');await controller.import(files);};
  const sample=async()=>{setSampleLoading(true);setMessage('');try{const files=await Promise.all(['brief.pdf','appendix.pdf'].map(async name=>{const r=await fetch(`/fixtures/${name}`);if(!r.ok)throw Error();return new File([await r.arrayBuffer()],name,{type:'application/pdf'});}));await add(files);}catch{setMessage('Sample files could not be loaded. Choose PDFs from your device.');}finally{setSampleLoading(false);}};
  const action=async(type:'merge'|'remove'|'ocr'|'compress'|'chain',page=2)=>{setMessage('');if(type==='compress'||type==='chain'){setQuality(type);return;}await controller.quick(type,page);};
  const submit=()=>{
    if(busy||!draft.trim())return;
    const command=draft.trim().replace(/[.!]$/,'').toLowerCase();
    if(command==='undo'){if(store.canUndo){controller.undo();setDraft('');}else setMessage('There is no previous result to restore.');return;}
    const remove=command.match(/^remove (?:physical )?page (\d+)(?: from (?:the )?(?:merged )?result)?$/);
    if(remove){void action('remove',Number(remove[1]));setDraft('');}
    else if(['merge','merge pdfs','merge these pdfs'].includes(command)){void action('merge');setDraft('');}
    else if(['make searchable','ocr'].includes(command)){void action('ocr');setDraft('');}
    else if(command==='compress'){void action('compress');setDraft('');}
    else if(command==='merge, ocr, compress'){void action('chain');setDraft('');}
    else setMessage('Hosted AI is not connected. Local commands: “merge”, “remove page 2”, “make searchable”, “compress”, or “undo”.');
  };
  const save=async()=>{if(!current||saving)return;const ref=current.meta.ref;setSaving(true);try{const picker=(window as unknown as {showSaveFilePicker?:SavePicker}).showSaveFilePicker;const outcome=await savePDF(current.bytes,picker?.bind(window));setSaveState(s=>({...s,[ref]:outcome==='saved'?'Saved to your device':outcome==='cancelled'?'Ready · save cancelled':'Download started · check your downloads'}));}catch(e){setMessage(e instanceof Error?e.message:'Save failed.');}finally{setSaving(false);}};
  return <div className="app-shell" onDragOver={e=>{e.preventDefault();if(!busy)setDrag(true);}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDrag(false);}} onDrop={e=>{e.preventDefault();setDrag(false);if(!busy)void add(Array.from(e.dataTransfer.files));}}>
    <header className="app-header"><a className="brand" href="/" aria-label="atepdf home" onClick={e=>e.preventDefault()}><img src="/brand/approved-8-mark-source-crop.png" alt="" className="brand-mark"/><img src="/brand/approved-atepdf-wordmark-source-crop.png" alt="atepdf" className="wordmark"/></a><Button variant="ghost" className="privacy-badge" onClick={()=>setPrivacy(true)}><LockKeyhole/><span>Processed on your device</span></Button></header>
    <main className="workspace">
      <input ref={input} type="file" accept="application/pdf,.pdf" multiple aria-label="Choose PDF files" className="file-input" onChange={e=>{void add(Array.from(e.target.files??[]));e.target.value='';}}/>
      {!files.length?<section className={`drop-zone ${drag?'drag-active':''}`} aria-label="Local PDF import">
        <img src="/art/paper.png" className="paper-art" alt=""/>
        <h1><span className="wide-heading">Drop files here</span><span className="phone-heading">Add your files</span></h1>
        <p>or choose files from your device</p>
        <Button className="choose-button" disabled={busy} onClick={()=>input.current?.click()}><FolderOpen/>Choose files</Button>
        <span className="file-hint">PDF · up to 20 MB per file</span>
        <Button variant="ghost" className="sample-button" disabled={busy} onClick={()=>void sample()}>Try the two sample PDFs</Button>
      </section>:<section className={`files-section ${drag?'drag-active':''}`} aria-label="Your local files">
        <div className="section-heading"><div><h1>Your files</h1><p>Kept on this device · merged in the order below</p></div><Button variant="outline" disabled={busy} onClick={()=>input.current?.click()}><Plus/>Add files</Button></div>
        <ol className="file-list">{files.map((f,i)=><li key={f.ref}><span className="file-icon"><FileText/></span><div className="file-details"><strong>{f.name}</strong><span>{f.pageCount} {f.pageCount===1?'page':'pages'} · {size(f.sizeBytes)} · Original</span></div><span className="order-number" aria-label={`Position ${i+1}`}>{i+1}</span></li>)}</ol>
        {current&&<article className="result-card" aria-label="Current result"><div className="result-top"><span className="result-icon"><Check/></span><div><h2>Your PDF is ready</h2><p data-testid="result-facts">{current.meta.pageCount} pages · {size(current.meta.sizeBytes)}</p></div></div>{current.meta.note&&<p className="result-note">{current.meta.note}</p>}<div className="result-actions"><Button variant="outline" onClick={()=>setPreview(true)}>Preview</Button><Button onClick={()=>void save()} disabled={saving}><ArrowDownToLine/>{saving?'Saving…':'Save PDF'}</Button><Button variant="ghost" disabled={!store.canUndo||busy} onClick={()=>controller.undo()}><Undo2/>Undo</Button></div><p className="save-status" role="status">{saveState[current.meta.ref]??'Ready to save'}</p><div className="remove-control"><label htmlFor="remove-page">Remove physical page</label><input id="remove-page" type="number" min="1" max={current.meta.pageCount} value={removePage} onChange={e=>setRemovePage(e.target.value)}/><Button variant="outline" disabled={busy} onClick={()=>void action('remove',Number(removePage))}>Remove page</Button></div></article>}
        <div className="session-actions"><Dialog.Root><Dialog.Trigger asChild><Button variant="ghost" disabled={busy}>Start over</Button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="small-dialog"><Dialog.Title>Clear this local session?</Dialog.Title><Dialog.Description>Save any results you want to keep first. This clears the files and results held in this tab. Your original files stay unchanged.</Dialog.Description><div className="dialog-actions"><Dialog.Close asChild><Button variant="outline">Keep working</Button></Dialog.Close><Dialog.Close asChild><Button onClick={()=>{controller.clear();setSaveState({});setMessage('');}}>Clear session</Button></Dialog.Close></div></Dialog.Content></Dialog.Portal></Dialog.Root></div>
      </section>}
      {(busy||state.message||state.error||message)&&<div className={`job-status ${state.error?'has-error':''}`} role={state.error?'alert':'status'} aria-live="polite"><span>{state.error||message||(sampleLoading?'Loading sample PDFs…':state.message)}</span>{state.busy&&<Button variant="outline" onClick={()=>controller.cancel()}>Cancel</Button>}</div>}
      <div className="interaction-area">
        <div className="shortcuts"><Button variant="outline" className="shortcut merge" disabled={busy} onClick={()=>void action('merge')}><Copy/><span>Merge</span></Button><Button variant="outline" className="shortcut compress" disabled={busy} onClick={()=>void action('compress')}><ArrowDownToLine/><span>Compress</span></Button><Button variant="outline" className="shortcut searchable" disabled={busy} onClick={()=>void action('ocr')}><ScanText/><span>Make searchable</span></Button></div>
        <div className="composer-group">{current&&<div className="focus-chip"><FileText size={14}/>Current result · {current.meta.pageCount} pages</div>}<div className="composer"><Sparkles className="composer-spark"/><textarea ref={composer} rows={1} aria-label="Tell atepdf what to do" placeholder="Tell atepdf what to do…" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();submit();}}}/><Button className="send-button" size="icon" disabled={!draft.trim()||busy} aria-label="Run local command" onClick={submit}><ArrowUp/></Button></div><p className="local-mode">Local commands · hosted AI is not connected</p></div>
      </div>
      {files.length>1&&<details className="recipe"><summary>Local recipe <ChevronDown size={14}/></summary><p>Merge these files, add English searchable text where needed, then optimise supported JPEG images.</p><Button variant="outline" disabled={busy} onClick={()=>void action('chain')}>Merge → make searchable → compress</Button></details>}
      <p className="session-note">Files stay in this tab until you save them. Closing or reloading clears this session.</p>
    </main>
    {preview&&current&&<Suspense fallback={<p role="status">Opening preview…</p>}><Preview bytes={current.bytes} count={current.meta.pageCount} onClose={()=>{setPreview(false);composer.current?.focus();}}/></Suspense>}
    <Dialog.Root open={privacy} onOpenChange={setPrivacy}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="small-dialog"><ShieldCheck className="dialog-icon"/><Dialog.Title>Processed on your device</Dialog.Title><Dialog.Description>PDF files, previews and recognised text stay in this browser. The local commands in this build do not contact an AI provider.</Dialog.Description><p>When hosted AI is enabled, AI reads your instructions, not your files. Your instructions and limited file details will be sent for interpretation only after consent. Filenames, passwords, paths and checksums are excluded.</p><p>Saving to a cloud folder or using your device’s sharing tools may transfer a file through your chosen provider.</p><Dialog.Close asChild><Button>Got it</Button></Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>
    <Dialog.Root open={!!quality} onOpenChange={v=>{if(!v)setQuality(null);}}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="small-dialog"><Dialog.Title>Optimise a new copy</Dialog.Title><Dialog.Description>Re-encode supported JPEG images at their original dimensions. Text and vector content are retained. Image quality may change; preview the result before using it. Some PDFs may not get smaller.</Dialog.Description><div className="dialog-actions"><Dialog.Close asChild><Button variant="outline">Cancel</Button></Dialog.Close><Button onClick={()=>{const action=quality;setQuality(null);if(action)void controller.quick(action);}}>Create optimised copy</Button></div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
