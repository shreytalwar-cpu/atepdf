import subprocess,json,hashlib,sys
from pathlib import Path
from PIL import Image,ImageChops
out=Path(sys.argv[1])
pairs=[('uri-only-input',1,'uri-only-merge-offset',2),('uri-only-input',1,'uri-only-merge-first',1),('interactive-input',1,'interactive-merge',2),('uri-only-input',1,'uri-with-P-merge-offset',2)]
rows=[]
for a,ap,b,bp in pairs:
 paths=[]
 for name,page in [(a,ap),(b,bp)]:
  prefix=out/f'{name}-page{page}'
  subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-singlefile','-scale-to','900','-png',str(out/(name+'.pdf')),str(prefix)],check=True,timeout=15,capture_output=True)
  paths.append(prefix.with_suffix('.png'))
 x,y=[Image.open(p).convert('RGB') for p in paths]
 rows.append({'source':a,'sourcePage':ap,'output':b,'outputPage':bp,'size':x.size,'equalDecodedPixels':x.size==y.size and ImageChops.difference(x,y).getbbox() is None,'sourcePixelsSha256':hashlib.sha256(x.tobytes()).hexdigest(),'outputPixelsSha256':hashlib.sha256(y.tobytes()).hexdigest()})
version=subprocess.run(['pdftoppm','-v'],text=True,capture_output=True).stderr.splitlines()[0]
report={'renderer':version,'scaleTo':900,'scope':'One representative page per pair. Pixel equality does not prove link behavior, form validity, or full visual fidelity.','pairs':rows}
(out/'render-comparison.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
