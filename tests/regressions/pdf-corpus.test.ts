import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {readFile,lstat,mkdtemp,rm} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {PDFDocument,PDFDict,PDFName,PDFRawStream} from 'pdf-lib';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const corpus=resolve(root,'tests/fixtures/corpus');
const manifest=JSON.parse(readFileSync(resolve(corpus,'manifest.json'),'utf8'));
const schema=JSON.parse(readFileSync(resolve(corpus,'manifest.schema.json'),'utf8'));
const fixturePath=(fixture:{path:string})=>resolve(root,fixture.path);

function labels(fixture:{pageCount:number;pageOrder:string[]|{prefix:string;start:number;digits:number}}){
  if(Array.isArray(fixture.pageOrder))return fixture.pageOrder;
  return Array.from({length:fixture.pageCount},(_,index)=>
    fixture.pageOrder.prefix+String(fixture.pageOrder.start+index).padStart(fixture.pageOrder.digits,'0'));
}

async function reader(fixture:{path:string;testPassword?:string}){
  const task=getDocument({data:new Uint8Array(await readFile(fixturePath(fixture))),password:fixture.testPassword,
    verbosity:0,stopAtErrors:true});
  const document=await task.promise;
  return {document,task};
}

test('SHR-45 manifest schema, provenance, hashes and fixture path boundary',async()=>{
  const validate=new Ajv2020({allErrors:true}).compile(schema);
  assert.equal(validate(manifest),true,JSON.stringify(validate.errors));
  const ids=new Set<string>(),paths=new Set<string>();
  assert.ok(manifest.fixtures.length>=14);
  for(const fixture of manifest.fixtures){
    assert.ok(!ids.has(fixture.id),`duplicate id ${fixture.id}`);ids.add(fixture.id);
    assert.ok(!paths.has(fixture.path),`duplicate path ${fixture.path}`);paths.add(fixture.path);
    const path=fixturePath(fixture);
    assert.ok(path.startsWith(resolve(root,'tests/fixtures')+sep));
    assert.ok((await lstat(path)).isFile(),`${fixture.id} must be a regular local file, not a symlink`);
    assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),fixture.sha256,fixture.id);
    assert.equal(labels(fixture).length,fixture.pageCount,fixture.id);
    assert.ok(/synthetic|locally authored|original fictional/i.test(fixture.provenance.permission),fixture.id);
    assert.ok(/generate|git show|make-compression-fixture/.test(fixture.provenance.generation),fixture.id);
    assert.ok(fixture.features.length>0&&fixture.operationExpectations.length>0,fixture.id);
    for(const expectation of fixture.operationExpectations){
      if(expectation.basis==='approved_product_policy')assert.equal(expectation.disposition,'preserve_or_refuse',fixture.id);
      if(expectation.basis==='unknown')assert.equal(expectation.disposition,'unknown',fixture.id);
      if(expectation.basis==='observed_prototype')assert.ok(['supported','refused'].includes(expectation.disposition),fixture.id);
    }
    assert.equal(Boolean(fixture.testPassword),fixture.readerExpectation==='password_required',fixture.id);
  }
  for(const required of ['text','multi_page','image_and_text','mixed_geometry','rotation','annotations','uri_link','internal_link',
    'outlines','acroform','tagged','embedded_font','raster_only','hybrid','blank_scan','noisy_scan','image_heavy',
    'encrypted_aes256','encoded_dimension_mismatch','page_limit_100','over_page_limit_101','missing_page_object']){
    assert.ok(manifest.fixtures.some((fixture:{features:string[]})=>fixture.features.includes(required)),required);
  }
});

test('SHR-45 local generator reproduces deterministic outputs when its optional Python environment is available',
  {skip:!process.env.ATEPDF_CORPUS_PYTHON},async()=>{
  const output=await mkdtemp(resolve(tmpdir(),'atepdf-shr45-corpus-'));
  try{
    const run=spawnSync(process.env.ATEPDF_CORPUS_PYTHON!,[resolve(corpus,'generate.py'),'--output-dir',output],
      {cwd:root,encoding:'utf8',timeout:10000,maxBuffer:64*1024});
    assert.equal(run.error,undefined,String(run.error));
    assert.equal(run.status,0,run.stderr);
    for(const fixture of manifest.fixtures.filter((item:{path:string})=>item.path.startsWith('tests/fixtures/corpus/')&&item.id!=='encrypted-aes256')){
      const generated=await readFile(resolve(output,fixture.path.split('/').at(-1)!));
      assert.equal(createHash('sha256').update(generated).digest('hex'),fixture.sha256,fixture.id);
    }
  }finally{await rm(output,{recursive:true,force:true});}
});

test('SHR-45 independent reader checks declared counts and digital page order',async()=>{
  for(const fixture of manifest.fixtures){
    if(fixture.readerExpectation==='damaged')continue;
    const {document,task}=await reader(fixture);
    try{
      assert.equal(document.numPages,fixture.pageCount,fixture.id);
      const ordered=labels(fixture);
      for(let index=0;index<document.numPages;index++){
        const page=await document.getPage(index+1);
        const content=await page.getTextContent();
        const text=content.items.map((item:any)=>'str'in item?item.str:'').join(' ');
        if(fixture.id.startsWith('boundary-')||['ordinary-brief','ordinary-appendix','geometry-font','interactive','tagged',
          'encoded-dimension-mismatch','encrypted-aes256'].includes(fixture.id)){
          assert.ok(text.includes(ordered[index]),`${fixture.id} page ${index+1} marker/order`);
        }
        if(['raster-note','blank-noisy-scans'].includes(fixture.id)||fixture.id==='hybrid-note'&&index===1){
          assert.equal(text.trim(),'',`${fixture.id} page ${index+1} must have no text layer`);
        }
        if(fixture.id==='hybrid-note'&&index!==1)assert.ok(text.includes(index===0?'A1':'B1'));
      }
    }finally{await task.destroy();}
  }
});

test('SHR-45 genuine links, annotations, outline, form fields and tag relation',async()=>{
  const interactive=manifest.fixtures.find((item:{id:string})=>item.id==='interactive');
  const {document,task}=await reader(interactive);
  try{
    const annotations=await (await document.getPage(1)).getAnnotations();
    const subtypes=annotations.map((item:any)=>item.subtype);
    for(const type of ['Link','Widget','Highlight','Text'])assert.ok(subtypes.includes(type),type);
    assert.ok(annotations.some((item:any)=>item.url==='https://example.invalid/shr45'));
    assert.ok(annotations.some((item:any)=>item.subtype==='Link'&&item.dest));
    const outline=await document.getOutline();
    assert.ok(outline?.[0]?.title==='Synthetic guide'&&outline[0].items?.[0]?.title==='Second section');
  }finally{await task.destroy();}
  const form=await PDFDocument.load(await readFile(fixturePath(interactive)));
  assert.deepEqual(form.getForm().getFields().map(field=>field.getName()).sort(),['synthetic_check','synthetic_name']);
  assert.equal(form.getForm().getTextField('synthetic_name').getText(),'Example');
  assert.equal(form.getForm().getCheckBox('synthetic_check').isChecked(),true);

  const tagged=manifest.fixtures.find((item:{id:string})=>item.id==='tagged');
  const taggedReader=await reader(tagged);
  try{
    assert.equal((await taggedReader.document.getMarkInfo())?.get('Marked'),true);
    const tree=await (await taggedReader.document.getPage(1)).getStructTree();
    assert.equal(tree?.children?.[0]?.role,'P');
    assert.equal(tree.children[0].children[0].type,'content');
  }finally{await taggedReader.task.destroy();}
});

test('SHR-45 embedded font, rotated/nonzero boxes, raster pages and encoded JPEG mismatch',async()=>{
  const geometry=await PDFDocument.load(await readFile(resolve(corpus,'geometry-font.pdf')));
  assert.equal(geometry.getPage(1).getRotation().angle,90);
  assert.deepEqual(geometry.getPage(2).getMediaBox(),{x:20,y:30,width:600,height:800});
  assert.deepEqual(geometry.getPage(2).getCropBox(),{x:40,y:50,width:560,height:730});
  const fonts=geometry.getPage(0).node.Resources().lookup(PDFName.of('Font'),PDFDict);
  assert.ok(fonts.entries().some(([,ref])=>{
    const font=geometry.context.lookup(ref,PDFDict);
    const descriptor=font.lookupMaybe(PDFName.of('FontDescriptor'),PDFDict);
    return Boolean(descriptor?.get(PDFName.of('FontFile2')));
  }),'font bytes must actually be embedded');
  const xobjects=geometry.getPage(0).node.Resources().lookup(PDFName.of('XObject'),PDFDict);
  assert.ok(xobjects.entries().some(([,ref])=>geometry.context.lookup(ref) instanceof PDFRawStream));

  for(const [name,pageIndexes] of [['scanned-note.pdf',[0]],['mixed-text-and-scan.pdf',[1]],
    ['corpus/blank-noisy-scan.pdf',[0,1]],['image-heavy.pdf',[0]]] as const){
    const source=await PDFDocument.load(await readFile(resolve(root,'tests/fixtures',name)));
    for(const index of pageIndexes){
      const resources=source.getPage(index).node.Resources().lookup(PDFName.of('XObject'),PDFDict);
      assert.ok(resources.entries().some(([,ref])=>{
        const object=source.context.lookup(ref);
        return object instanceof PDFRawStream&&object.dict.get(PDFName.of('Subtype'))?.toString()==='/Image';
      }),`${name} page ${index+1} needs a real raster XObject`);
    }
    if(name==='image-heavy.pdf'){
      const resources=source.getPage(0).node.Resources().lookup(PDFName.of('XObject'),PDFDict);
      assert.ok(resources.entries().some(([,ref])=>{
        const object=source.context.lookup(ref,PDFRawStream);
        const width=Number(object.dict.get(PDFName.of('Width'))?.toString());
        const height=Number(object.dict.get(PDFName.of('Height'))?.toString());
        return width*height>5_000_000;
      }),'image-heavy fixture needs a multi-megapixel encoded image');
    }
  }

  const mismatch=await PDFDocument.load(await readFile(resolve(corpus,'encoded-dimension-mismatch.pdf')));
  const images=mismatch.getPage(0).node.Resources().lookup(PDFName.of('XObject'),PDFDict);
  const image=mismatch.context.lookup(images.get(PDFName.of('Im1')),PDFRawStream);
  assert.equal(image.dict.get(PDFName.of('Width'))?.toString(),'40');
  assert.equal(image.dict.get(PDFName.of('Height'))?.toString(),'24');
  // The bounded JPEG has a real SOF marker whose dimensions disagree with the XObject.
  const jpeg=image.contents;
  const jpegView=new DataView(jpeg.buffer,jpeg.byteOffset,jpeg.byteLength);
  let encodedDimensions:number[]|null=null;
  for(let offset=2;offset<jpeg.length-9;){
    if(jpeg[offset]!==0xff){offset++;continue;}
    const marker=jpeg[offset+1];
    if(marker===0xc0||marker===0xc2){encodedDimensions=[jpegView.getUint16(offset+7),jpegView.getUint16(offset+5)];break;}
    const length=jpegView.getUint16(offset+2);
    assert.ok(length>=2&&offset+length+2<=jpeg.length);
    offset+=length+2;
  }
  assert.deepEqual(encodedDimensions,[32,24]);
});

test('SHR-45 encrypted fixture requires the test-only password and damaged PDF is isolated',async()=>{
  const encrypted=manifest.fixtures.find((item:{id:string})=>item.id==='encrypted-aes256');
  const wrong=getDocument({data:new Uint8Array(await readFile(fixturePath(encrypted))),password:'wrong synthetic test value',verbosity:0});
  try{await assert.rejects(wrong.promise);}finally{await wrong.destroy();}
  const {document,task}=await reader(encrypted);
  try{assert.equal(document.numPages,1);}finally{await task.destroy();}

  const damaged=manifest.fixtures.find((item:{id:string})=>item.id==='damaged-missing-page');
  const child=spawnSync(process.execPath,['--max-old-space-size=128',resolve(corpus,'inspect-damaged.mjs'),fixturePath(damaged)],
    {cwd:root,encoding:'utf8',timeout:5000,maxBuffer:64*1024});
  assert.equal(child.error,undefined,String(child.error));
  assert.equal(child.status,0,child.stderr);
  assert.equal(child.stdout.trim(),'missing-page-rejected');
});
