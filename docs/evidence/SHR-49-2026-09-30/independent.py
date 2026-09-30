import sys,json,hashlib
from pathlib import Path
import pypdf
from pypdf import PdfReader
root=Path(sys.argv[1]);rows=[]
for path in sorted(root.glob('*.pdf')):
 r=PdfReader(path,strict=True);page_refs={(p.indirect_reference.idnum,p.indirect_reference.generation):i+1 for i,p in enumerate(r.pages)}
 def member(ref):
  if ref is None:return None
  return page_refs.get((getattr(ref,'idnum',-1),getattr(ref,'generation',-1)))
 pages=[]
 for i,p in enumerate(r.pages):
  annotations=[]
  for ref in p.get('/Annots',[]):
   a=ref.get_object();act=a.get('/A',{});act=act.get_object() if hasattr(act,'get_object') else act
   dest=a.get('/Dest',act.get('/D'));dest=dest.get_object() if hasattr(dest,'get_object') else dest
   annotations.append({'subtype':str(a.get('/Subtype')),'rect':[float(v) for v in a.get('/Rect',[])],
    'uri':str(act.get('/URI')) if act.get('/URI') is not None else None,
    'uriOriginalBytesHex':act['/URI'].original_bytes.hex() if act.get('/URI') is not None else None,
    'destinationTargetInOutputPageTree':member(dest[0]) if isinstance(dest,list) and dest else None,
    'destinationHasPageReference':isinstance(dest,list) and bool(dest) and hasattr(dest[0],'idnum'),
    'PInOutputPageTree':member(a.raw_get('/P')) if '/P' in a else None,'PExists':'/P' in a,
    'contents':str(a.get('/Contents')) if '/Contents' in a else None,
    'fieldName':str(a.get('/T')) if '/T' in a else None,'value':str(a.get('/V')) if '/V' in a else None})
  pages.append({'index':i+1,'text':p.extract_text(),'annotations':annotations,'StructParents':p.get('/StructParents')})
 catalog=r.trailer['/Root'];rows.append({'id':path.stem,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'pages':pages,
 'catalogKeys':sorted(str(k) for k in catalog),'fields':sorted((r.get_fields() or {}).keys()),'outlineRootPresent':'/Outlines' in catalog,'structureRootPresent':'/StructTreeRoot' in catalog})
result={'reader':'pypdf','version':pypdf.__version__,'scope':'Strict independent raw-object inspection. Page-tree membership is authoritative here; PDF.js destination index alone gave misleading answers on detached pages.','records':rows}
(root/'independent.json').write_text(json.dumps(result,indent=2)+'\n')
for r in rows:
 print(r['id'],json.dumps({'catalog':r['catalogKeys'],'annotations':[p['annotations'] for p in r['pages']]}))
