import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,PDFName,PDFRawStream} from 'pdf-lib';
import {preflight} from '../../packages/web-pdf/src/engine';
import {CONTENT_WORK_LIMITS} from '../../packages/web-pdf/src/content-admission';
import {LIMITS} from '../../packages/web-pdf/src/types';
import {drawingPDF,inlineImage} from '../helpers/inline-pdf';

function rawPDF(objects:Uint8Array[]){
  const pieces=[Buffer.from('%PDF-1.7\n')],offsets:number[]=[];
  let length=pieces[0].length;
  for(const [index,object] of objects.entries()){
    offsets.push(length);const bytes=Buffer.concat([Buffer.from(`${index+1} 0 obj\n`),object,Buffer.from('\nendobj\n')]);pieces.push(bytes);length+=bytes.length;
  }
  pieces.push(Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(offset=>`${offset.toString().padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`));
  return new Uint8Array(Buffer.concat(pieces));
}

test('inline-image admission: rejects actual small/oversized inline images before any reader, compressed or plain',async()=>{
  for(const compressed of [false,true])for(const [width,height]of [[8,8],[4001,3000]]){
    const bytes=await drawingPDF([inlineImage(width,height)],{compressed});
    assert.ok(bytes.length<100_000);
    await assert.rejects(preflight(bytes),/Inline-image PDFs/);
  }
});

test('inline-image admission: upstream PDF.js parses the safe fixture but can omit oversized content, so admission cannot rely on its operator list',async()=>{
  const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const check=async(bytes:Uint8Array)=>{
    const task=getDocument({data:bytes.slice(),stopAtErrors:true,maxImageSize:LIMITS.pixels,verbosity:0});
    try{const doc=await task.promise,page=await doc.getPage(1);return await page.getOperatorList();}finally{await task.destroy();}
  };
  const operations=await check(await drawingPDF([inlineImage()]));
  assert.ok(operations.fnArray.some(operation=>operation===OPS.paintInlineImageXObject||operation===OPS.paintImageXObject));
  const oversized=await drawingPDF([inlineImage(4001,3000)]);
  assert.deepEqual((await check(oversized)).fnArray,[]);
  await assert.rejects(preflight(oversized),/Inline-image PDFs/);
});

test('inline-image admission: BI in comments, literal strings, escaped parentheses, hex strings and names remains supported',async()=>{
  const content='% BI /W 99999 /H 99999 ID ignored\r\n/BI BMC EMC\n/B#49 << /ActualText (BI) >> BDC EMC\nBT /F1 12 Tf (BI \\(escaped\\) (nested BI) \\102\\111) Tj <42 49> Tj ET';
  for(const compressed of [false,true])assert.equal((await preflight(await drawingPDF([content],{compressed}))).getPageCount(),1);
});

test('inline-image admission: content arrays preserve operator, literal, name and comment lexical state',async()=>{
  await assert.rejects(preflight(await drawingPDF(['q B','I /W 1 /H 1 /BPC 8 /CS /G ID x EI Q'])),/Inline-image PDFs/);
  const safe=[['BT /F1 12 Tf (B','I) Tj ET'],['/B','I BMC EMC'],['% B','I\nq Q'],['BT /F1 12 Tf <4','249> Tj ET']];
  for(const parts of safe)assert.equal((await preflight(await drawingPDF(parts))).getPageCount(),1);
});

test('inline-image admission: nested Forms, tiling patterns and Type 3 glyph programs cannot bypass the guard',async()=>{
  for(const container of ['form','nested-form','pattern','glyph'] as const){
    await assert.rejects(preflight(await drawingPDF([inlineImage()],{container})),/Inline-image PDFs/);
    assert.equal((await preflight(await drawingPDF(['0 0 10 10 re f'],{container}))).getPageCount(),1);
  }
});

test('inline-image admission: malformed or repair-dependent syntax fails closed without exposing decoded content',async()=>{
  for(const content of ['(unterminated SECRET_CANARY','<4249','[1 2','<< /A 1','qBI /W 1 /H 1 ID x EI','1BI /W 1 /H 1 ID x EI','ID secret EI','/A <zz> BDC EMC',']','{ BI }']){
    await assert.rejects(preflight(await drawingPDF([content])),error=>error instanceof Error&&/this build/.test(error.message)&&!error.message.includes('SECRET_CANARY'));
  }
});

test('inline-image admission: lowercase escaped drawing names cannot exploit a parser-name disagreement',async()=>{
  for(const contentsName of ['C#6fntents','Contents']){
    const body=contentsName==='Contents'?Buffer.from('/F1 Do'):inlineImage();
    const form=inlineImage();
    const bytes=rawPDF([
      Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
      Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
      Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << /XObject << /F1 5 0 R >> >> /${contentsName} 4 0 R >>`),
      Buffer.concat([Buffer.from(`<< /Length ${body.length} >>\nstream\n`),body,Buffer.from('\nendstream')]),
      Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /F#6frm /BBox [0 0 100 100] /Length ${form.length} >>\nstream\n`),form,Buffer.from('\nendstream')]),
    ]);
    assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);
    await assert.rejects(preflight(bytes),/drawing content this build/);
  }
});

test('inline-image admission: bounds decoded drawing work and nesting without interpreting image XObject bytes as operators',async()=>{
  await assert.rejects(preflight(await drawingPDF([' '.repeat(CONTENT_WORK_LIMITS.decodedBytes+1)])),/this build/);
  await assert.rejects(preflight(await drawingPDF(['['.repeat(CONTENT_WORK_LIMITS.nesting+1)+']'.repeat(CONTENT_WORK_LIMITS.nesting+1)])),/this build/);
  const document=await PDFDocument.create(),page=document.addPage([100,100]);
  const image=PDFRawStream.of(document.context.obj({Type:'XObject',Subtype:'Image',Width:3,Height:1,BitsPerComponent:8,ColorSpace:'DeviceGray'}),Buffer.from('BI '));
  page.node.setXObject(PDFName.of('SafeImage'),document.context.register(image));
  page.node.set(PDFName.of('Contents'),document.context.register(document.context.flateStream('/SafeImage Do')));
  assert.equal((await preflight(await document.save())).getPageCount(),1);
});
