import type {Step} from '@contracts/protocol';
import type {Inspection,PhysicalPage,PageBox} from '@pdf/types';

export type PageExpectation={sourceRef:string;sourcePage:number;page:PhysicalPage;text:string};
export type PageExpectations={version:1;revision:number;reader:string;pages:PageExpectation[]};
export type PageVerificationReceipt={version:1;operation:string;revision:number;pages:number;status:'passed';reader:string};
const fail=(detail:string):never=>{throw new Error(`Page preservation verification failed (${detail}). No new result was committed.`);};
const norm=(text:string)=>text.replace(/\s+/g,'').toLowerCase();
const validBox=(box:PageBox)=>box&&[box.x,box.y,box.width,box.height].every(Number.isFinite)&&box.width>0&&box.height>0;
const valid=(page:PhysicalPage)=>page&&validBox(page.mediaBox)&&validBox(page.cropBox)&&[0,90,180,270].includes(page.rotation)&&/^[a-f0-9]{64}$/.test(page.identity);
const sameBox=(a:PageBox,b:PageBox)=>['x','y','width','height'].every(k=>Math.abs(a[k as keyof PageBox]-b[k as keyof PageBox])<=0.01);

/** Explicit source mapping; later tools may supply order and intentional rotation
 * overrides through this contract without adding an executor here. */
export function expectPages(inputs:{ref:string;inspection:Inspection}[],revision:number,
  mapping?:{input:number;page:number;rotation?:number}[]):PageExpectations{
  if(!inputs.length||inputs.some(i=>i.inspection.structure?.version!==1||
    i.inspection.structure.pages.length!==i.inspection.pages.length||
    !i.inspection.structure.reader||i.inspection.structure.pages.some(p=>!valid(p))))fail('source evidence unavailable');
  const reader=inputs[0].inspection.structure!.reader;
  if(inputs.some(i=>i.inspection.structure!.reader!==reader))fail('source readers differ');
  const order:{input:number;page:number;rotation?:number}[]=mapping??inputs.flatMap((input,n)=>input.inspection.pages.map((_,page)=>({input:n,page:page+1})));
  if(!order.length||order.length>100)fail('page count');
  const pages=order.map(item=>{
    const source=inputs[item.input],p=source?.inspection.structure?.pages[item.page-1];
    if(!source||!p||!Number.isInteger(item.page)||item.page<1)return fail('source page reference');
    if(item.rotation!==undefined&&![0,90,180,270].includes(item.rotation))return fail('rotation expectation');
    return {sourceRef:source.ref,sourcePage:item.page,page:{...structuredClone(p),rotation:item.rotation??p.rotation},text:source.inspection.pages[item.page-1].text};
  });
  return {version:1,revision,reader,pages};
}
export function expectationsForStep(step:Step,inputs:Inspection[],revision:number):PageExpectations|null{
  if(step.operation!=='merge_pdf'&&step.operation!=='select_pages')return null;
  const sources=inputs.map((inspection,i)=>({ref:step.inputs[i],inspection}));
  const remove=step.operation==='select_pages'?(step.params.pages as {indices:number[]}).indices:[];
  const mapping=sources.flatMap((input,n)=>input.inspection.pages.flatMap((_,page)=>remove.includes(page+1)?[]:[{input:n,page:page+1}]));
  return expectPages(sources,revision,mapping);
}
export function verifyPages(expected:PageExpectations,actual:Inspection,currentRevision:number,signal:AbortSignal){
  signal.throwIfAborted();
  if(expected.revision!==currentRevision)fail('files changed');
  const structure=actual.structure;
  if(structure?.version!==1||structure.reader!==expected.reader||structure.pages.length!==actual.pages.length)return fail('output evidence unavailable');
  if(structure.pages.length!==expected.pages.length)fail('page count');
  expected.pages.forEach((want,index)=>{
    signal.throwIfAborted();const got=structure.pages[index];
    if(!valid(got))fail('invalid page evidence');
    if(!sameBox(want.page.mediaBox,got.mediaBox)||!sameBox(want.page.cropBox,got.cropBox))fail(`page ${index+1} box origin/size`);
    if(want.page.rotation!==got.rotation)fail(`page ${index+1} rotation`);
    if(want.page.identity!==got.identity)fail(`page ${index+1} identity/order`);
    if(norm(want.text)!==norm(actual.pages[index].text))fail(`page ${index+1} text`);
  });
  signal.throwIfAborted();
}
