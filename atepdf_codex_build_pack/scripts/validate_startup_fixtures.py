#!/usr/bin/env python3
"""Optional fixture inspection. Requires pypdf. Does NOT run Attenlo engines or OCR."""
from pathlib import Path
import hashlib,json
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1]
D=ROOT/'fixtures/startup';expected=json.loads((D/'expectations.json').read_text())
count=0
for name,facts in expected['files'].items():
    p=D/name;b=p.read_bytes()
    assert len(b)==facts['bytes'] and hashlib.sha256(b).hexdigest()==facts['sha256'],name
    if p.suffix=='.pdf':
        reader=PdfReader(p);assert len(reader.pages)==facts['pages'],name
        for i in facts['raster_only_page_indexes']:
            assert not (reader.pages[i-1].extract_text() or '').strip(),(name,i)
        for i in facts['text_page_indexes']:
            assert (reader.pages[i-1].extract_text() or '').strip(),(name,i)
        count+=len(reader.pages)
print(f'PASS: {len(expected["files"])} fixture hashes; {count} PDF input pages; declared text/raster state.')
print('NOT RUN: production merge/compression/OCR, UI, hosted model, network security or native builds.')
