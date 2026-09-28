import {PDFArray,PDFDict,PDFDocument,PDFName,PDFNull,PDFNumber,PDFObject,PDFRawStream,decodePDFRawStream} from 'pdf-lib';

// Drawing-program work bounds, not a PDF file-size limit. Image XObject bytes are
// never decoded here. pdf-lib may expand a decoder block ahead of getByte(); this
// budget does not claim a hard cap on the upstream decoder's peak allocation.
export const CONTENT_WORK_LIMITS={decodedBytes:16*1024*1024,streams:10_000,objects:50_000,nesting:128,token:128} as const;
const unsupported=()=>new Error('This PDF uses drawing content this build cannot safely inspect. Your original is unchanged.');
const inline=()=>new Error('Inline-image PDFs are not supported by this build. Your original is unchanged.');
const whitespace=(byte:number)=>byte===0||byte===9||byte===10||byte===12||byte===13||byte===32;
const delimiter=(byte:number)=>whitespace(byte)||[40,41,60,62,91,93,123,125,47,37].includes(byte);
const digit=(byte:number)=>byte>=48&&byte<=57;
const hex=(byte:number)=>digit(byte)||(byte>=65&&byte<=70)||(byte>=97&&byte<=102);
// PDF 1.7 drawing operators. Unknown/repaired syntax is rejected conservatively,
// including joined commands that tolerant readers could repair into an image.
const operators=new Set('b b* B B* BDC BMC BT BX c cm CS cs d d0 d1 Do DP EMC ET EX f f* F G g gs h i j J K k l m M MP n q Q re RG rg ri s S SC sc SCN scn sh T* Tc Td TD Tf Tj TJ TL Tm Tr Ts Tw Tz v w W W* y \' "'.split(' '));
const literals=new Set(['true','false','null']);
type Budget={bytes:number;streams:number;objects:number};

/** Conservative admission lexer only: never interprets operators or image data. */
function scan(streams:PDFRawStream[],budget:Budget){
  let index=0,decoded:ReturnType<typeof decodePDFRawStream>|undefined;
  const read=():number=>{
    for(;;){
      if(!decoded){if(index===streams.length)return -1;if(++budget.streams>CONTENT_WORK_LIMITS.streams)throw unsupported();decoded=decodePDFRawStream(streams[index++]);}
      const byte=decoded.getByte();
      if(byte<0){decoded=undefined;continue;}
      if(++budget.bytes>CONTENT_WORK_LIMITS.decodedBytes)throw unsupported();
      return byte;
    }
  };
  let byte=read();
  const containers:number[]=[];
  while(byte>=0){
    if(whitespace(byte)){byte=read();continue;}
    if(byte===37){while(byte>=0&&byte!==10&&byte!==13)byte=read();continue;}
    if(byte===40){
      let depth=1;byte=read();
      while(depth){
        if(byte<0)throw unsupported();
        if(byte===92){byte=read();if(byte<0)throw unsupported();byte=read();continue;}
        if(byte===40&&++depth>CONTENT_WORK_LIMITS.nesting)throw unsupported();
        if(byte===41)depth--;
        byte=read();
      }
      continue;
    }
    if(byte===47){byte=read();while(byte>=0&&!delimiter(byte))byte=read();continue;}
    if(byte===60){
      byte=read();
      if(byte===60){containers.push(62);byte=read();}
      else{while(byte!==62){if(byte<0||(!whitespace(byte)&&!hex(byte)))throw unsupported();byte=read();}byte=read();}
      if(containers.length>CONTENT_WORK_LIMITS.nesting)throw unsupported();
      continue;
    }
    if(byte===62){byte=read();if(byte!==62||containers.pop()!==62)throw unsupported();byte=read();continue;}
    if(byte===91){containers.push(93);if(containers.length>CONTENT_WORK_LIMITS.nesting)throw unsupported();byte=read();continue;}
    if(byte===93){if(containers.pop()!==93)throw unsupported();byte=read();continue;}
    if(byte===41||byte===123||byte===125)throw unsupported();
    if(digit(byte)||byte===43||byte===45||byte===46){
      let digits=0,dots=0,length=0;
      if(byte===43||byte===45)byte=read();
      while(digit(byte)||byte===46){if(digit(byte))digits++;else dots++;if(++length>CONTENT_WORK_LIMITS.token)throw unsupported();byte=read();}
      if(!digits||dots>1)throw unsupported();
      continue;
    }
    let token='';
    while(byte>=0&&!delimiter(byte)){
      if(token.length>=CONTENT_WORK_LIMITS.token)throw unsupported();
      token+=String.fromCharCode(byte);byte=read();
    }
    if(token==='BI'||token==='ID'||token==='EI')throw inline();
    if(!literals.has(token)&&(!operators.has(token)||containers.length))throw unsupported();
  }
  if(containers.length)throw unsupported();
}

/** Run before any reader/rasterizer. Content arrays retain their lexical state. */
export function admitDrawingContent(document:PDFDocument){
  const budget:Budget={bytes:0,streams:0,objects:0},programs=new Set<PDFRawStream>(),seen=new Set<PDFObject>();
  const name=PDFName.of;
  const program=(value:PDFObject|undefined):PDFRawStream=>{
    const resolved=document.context.lookup(value);
    if(!(resolved instanceof PDFRawStream))throw unsupported();
    return resolved;
  };
  const visit=(value:PDFObject,depth=0)=>{
    if(seen.has(value))return;seen.add(value);
    if(++budget.objects>CONTENT_WORK_LIMITS.objects||depth>CONTENT_WORK_LIMITS.nesting)throw unsupported();
    if(value instanceof PDFName){
      // pdf-lib 1.17.1 does not canonicalize lowercase hex escapes in names.
      // Do not let a reader interpret an apparently different /Contents,
      // /Subtype or /Form name that this parser missed. Literal #XX names are
      // conservatively unsupported too; no second decoding rewrites a PDF.
      const text=value.decodeText();
      for(let n=0;n+2<text.length;n++)if(text.charCodeAt(n)===35&&hex(text.charCodeAt(n+1))&&hex(text.charCodeAt(n+2)))throw unsupported();
    }else if(value instanceof PDFRawStream){
      const subtype=value.dict.lookupMaybe(name('Subtype'),PDFName)?.decodeText();
      const pattern=value.dict.lookupMaybe(name('PatternType'),PDFNumber)?.asNumber();
      if(subtype==='Form'||pattern===1)programs.add(value);
      visit(value.dict,depth+1);
    }else if(value instanceof PDFDict){
      // Type 3 glyph programs are content streams too; they have no /Subtype.
      const glyphs=value.lookupMaybe(name('CharProcs'),PDFDict);
      if(glyphs)for(const [,glyph] of glyphs.entries())programs.add(program(glyph));
      for(const [key,child] of value.entries()){visit(key,depth+1);visit(child,depth+1);}
    }else if(value instanceof PDFArray){for(let n=0;n<value.size();n++)visit(value.get(n),depth+1);}
    // References are handled by enumerateIndirectObjects, not recursively.
  };
  try{
    // Inspect keys before page-program lookup, including parser-ambiguous names.
    for(const [,object] of document.context.enumerateIndirectObjects())visit(object);
    for(const page of document.getPages()){
      const contents=document.context.lookup(page.node.get(name('Contents')));
      if(contents===undefined||contents===PDFNull)continue;
      const streams=contents instanceof PDFArray?contents.asArray().map(program):[program(contents)];
      scan(streams,budget);
    }
    // Includes nested Forms, tiling patterns, soft-mask Forms and Type 3 fonts.
    for(const stream of programs)scan([stream],budget);
  }catch(error){
    if(error instanceof Error&&(error.message===inline().message||error.message===unsupported().message))throw error;
    throw unsupported();
  }
}
