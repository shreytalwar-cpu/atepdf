import {deflateSync} from 'node:zlib';
import {PDFDocument,PDFName,PDFRawStream,StandardFonts} from 'pdf-lib';

export function inlineImage(width=8,height=8){
  return Buffer.concat([
    Buffer.from(`q 100 0 0 100 0 0 cm\nBI /W ${width} /H ${height} /BPC 8 /CS /G /F /Fl ID\n`),
    deflateSync(Buffer.alloc(width*height,128)),Buffer.from('\nEI\nQ'),
  ]);
}

export async function drawingPDF(parts:(string|Uint8Array)[],options:{compressed?:boolean;container?:'form'|'nested-form'|'pattern'|'glyph'}={}){
  const document=await PDFDocument.create(),page=document.addPage([100,100]);
  const font=await document.embedFont(StandardFonts.Helvetica);page.node.setFontDictionary(PDFName.of('F1'),font.ref);
  const raw=(part:string|Uint8Array,dict:Record<string,unknown>={})=>{
    const data=typeof part==='string'?Buffer.from(part):part;
    return options.compressed===false?PDFRawStream.of(document.context.obj(dict),data):document.context.flateStream(data,dict);
  };
  const refs=parts.map(part=>document.context.register(raw(part)));
  page.node.set(PDFName.of('Contents'),document.context.obj(refs));
  if(options.container){
    if(parts.length!==1)throw new Error('One synthetic nested program is required.');
    const body=parts[0];
    if(options.container==='form'||options.container==='nested-form'){
      const form=document.context.register(raw(body,{Type:'XObject',Subtype:'Form',BBox:[0,0,100,100],Resources:{}}));
      const outer=options.container==='nested-form'?document.context.register(raw('/Inner Do',{Type:'XObject',Subtype:'Form',BBox:[0,0,100,100],Resources:{XObject:{Inner:form}}})):form;
      page.node.setXObject(PDFName.of('ImageForm'),outer);
      page.node.set(PDFName.of('Contents'),document.context.register(raw('/ImageForm Do')));
    }else if(options.container==='pattern'){
      const pattern=document.context.register(raw(body,{Type:'Pattern',PatternType:1,PaintType:1,TilingType:1,BBox:[0,0,100,100],XStep:100,YStep:100,Resources:{}}));
      page.node.Resources()!.set(PDFName.of('Pattern'),document.context.obj({P1:pattern}));
      page.node.set(PDFName.of('Contents'),document.context.register(raw('/Pattern cs /P1 scn 0 0 100 100 re f')));
    }else{
      const glyph=document.context.register(raw(Buffer.concat([Buffer.from('100 0 d0\n'),typeof body==='string'?Buffer.from(body):body])));
      const type3=document.context.register(document.context.obj({Type:'Font',Subtype:'Type3',FontBBox:[0,0,100,100],FontMatrix:[.01,0,0,.01,0,0],CharProcs:{A:glyph},Encoding:{Type:'Encoding',Differences:[65,'A']},FirstChar:65,LastChar:65,Widths:[100],Resources:{}}));
      page.node.setFontDictionary(PDFName.of('Glyph'),type3);
      page.node.set(PDFName.of('Contents'),document.context.register(raw('BT /Glyph 20 Tf (A) Tj ET')));
    }
  }
  return document.save({useObjectStreams:true});
}
