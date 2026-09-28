import type {Step} from '../../contracts/src/protocol';
export type PageInfo={text:string;width:number;height:number;rotation:number};
export type Inspection={pages:PageInfo[]};
export type OCRWord={text:string;x:number;y:number;width:number;height:number};
export type OCRPage={page:number;words:OCRWord[]};
export type EngineInput={bytes:Uint8Array;inspection:Inspection};
export type EngineResult={bytes:Uint8Array;note:string;ocrPages?:OCRPage[]};
export type EngineRequest={kind:'inspect';bytes:Uint8Array}|{kind:'transform';step:Step;inputs:EngineInput[];ocrPages?:OCRPage[]};
export const LIMITS={file:20_000_000,total:40_000_000,pages:100,pixels:12_000_000,retained:100_000_000};
