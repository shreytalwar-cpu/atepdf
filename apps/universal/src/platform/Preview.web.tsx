import {useEffect, useRef, useState} from 'react';
import {openPDF} from '@pdf/client';
import type {PDFDocumentProxy, RenderTask} from 'pdfjs-dist';
import './preview.css';
export default function Preview({bytes, count, onClose}: {bytes: Uint8Array; count: number; onClose: () => void}) {
  const canvas = useRef<HTMLCanvasElement>(null), host = useRef<HTMLDivElement>(null);
  const revealed = useRef(false);
  const [page, setPage] = useState(1), [zoom, setZoom] = useState(1), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    if (!loading && !revealed.current) {revealed.current = true; host.current?.parentElement?.scrollIntoView({block: 'start'});}
  }, [loading]);
  useEffect(() => {
    const abort = new AbortController(); let pdf: PDFDocumentProxy | undefined, render: RenderTask | undefined;
    setLoading(true); setError('');
    void (async () => {
      pdf = await openPDF(bytes, abort.signal); abort.signal.throwIfAborted();
      const p = await pdf.getPage(page), base = p.getViewport({scale: 1}), target = canvas.current;
      if (!target) return;
      const width = Math.max(150, (host.current?.clientWidth ?? 700) - 24) * zoom;
      const viewport = p.getViewport({scale: Math.min(width / base.width, Math.sqrt(8_000_000 / (base.width * base.height)))});
      target.width = Math.ceil(viewport.width); target.height = Math.ceil(viewport.height);
      render = p.render({canvas: target, canvasContext: target.getContext('2d')!, viewport});
      await render.promise; if (!abort.signal.aborted) setLoading(false);
    })().catch(() => {if (!abort.signal.aborted) {setError('Preview could not render this page.'); setLoading(false);}});
    return () => {abort.abort(); render?.cancel(); void pdf?.loadingTask.destroy();};
  }, [bytes, page, zoom]);
  return <section aria-label="Read-only preview" className="inline-preview">
    <div className="inline-toolbar"><strong>Read-only preview</strong><button onClick={onClose} aria-label="Close preview">Close</button></div>
    <div className="inline-toolbar"><button disabled={page === 1} aria-label="Previous page" onClick={() => setPage(page - 1)}>←</button><span>Page {page} of {count}</span><button disabled={page === count} aria-label="Next page" onClick={() => setPage(page + 1)}>→</button><button disabled={zoom <= .5} aria-label="Zoom out" onClick={() => setZoom(zoom - .25)}>−</button><span>{Math.round(zoom * 100)}%</span><button disabled={zoom >= 2} aria-label="Zoom in" onClick={() => setZoom(zoom + .25)}>+</button></div>
    <div ref={host} className="inline-page">{loading && <p role="status">Rendering page…</p>}{error && <p role="alert">{error}</p>}<canvas ref={canvas} aria-label={`PDF page ${page}`} style={{display: loading ? 'none' : 'block'}}/></div>
  </section>;
}
