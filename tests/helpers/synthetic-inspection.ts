import type {Inspection} from '../../packages/web-pdf/src/types';
// Orchestration-only mocks: identical synthetic pages, not fidelity evidence.
export const syntheticInspection=(count:number):Inspection=>({
  pages:Array.from({length:count},()=>({width:612,height:792,rotation:0,text:''})),
  structure:{version:1,reader:'synthetic-test-only',pages:Array.from({length:count},()=>({
    mediaBox:{x:0,y:0,width:612,height:792},cropBox:{x:0,y:0,width:612,height:792},rotation:0,identity:'a'.repeat(64),
  }))},
});
