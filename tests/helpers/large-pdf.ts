import {PDFDocument,PDFName,PDFRawStream,pushGraphicsState,popGraphicsState,concatTransformationMatrix,drawObject} from 'pdf-lib';
// Valid visible image content, not trailing padding or a faked File.size.
// Four uncompressed RGB images exceed the former per-file byte ceiling while
// keeping each decoded image comfortably inside the existing pixel safety bound.
export async function largePDF(marker:string){
  const doc=await PDFDocument.create(),page=doc.addPage([612,792]);page.drawText(marker,{x:40,y:740,size:18});
  const width=1536,height=1152,pixels=new Uint8Array(width*height*3);
  for(let i=0;i<pixels.length;i+=3){pixels[i]=(i/3)%256;pixels[i+1]=Math.floor(i/(width*3))%256;pixels[i+2]=110;}
  for(let n=0;n<4;n++){
    const stream=PDFRawStream.of(doc.context.obj({Type:'XObject',Subtype:'Image',Width:width,Height:height,ColorSpace:'DeviceRGB',BitsPerComponent:8}),pixels.slice());
    const ref=doc.context.register(stream),key=PDFName.of(`Synthetic${n}`);page.node.setXObject(key,ref);
    page.pushOperators(pushGraphicsState(),concatTransformationMatrix(256,0,0,192,40+(n%2)*270,500-Math.floor(n/2)*220),drawObject(key),popGraphicsState());
  }
  return doc.save({useObjectStreams:true});
}
