import type {Step} from '../../contracts/src/protocol';
export type PageInfo={text:string;width:number;height:number;rotation:number};
export type Inspection={pages:PageInfo[]};
export type OCRWord={text:string;x:number;y:number;width:number;height:number};
export type OCRPage={page:number;words:OCRWord[]};
export type EngineInput={bytes:Uint8Array;inspection:Inspection};
export type EngineResult={bytes:Uint8Array;note:string;ocrPages?:OCRPage[]};
export type EngineRequest={kind:'inspect';bytes:Uint8Array}|{kind:'transform';step:Step;inputs:EngineInput[];ocrPages?:OCRPage[]};
// Decoded rendering/workload bounds, not PDF byte admission limits.
export const LIMITS={pages:100,pixels:12_000_000};
