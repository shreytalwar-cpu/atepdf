import type {Step} from '../../contracts/src/protocol';
export type PageInfo={text:string;width:number;height:number;rotation:number};
export type PageBox={x:number;y:number;width:number;height:number};
export type PhysicalPage={mediaBox:PageBox;cropBox:PageBox;rotation:number;identity:string};
// Local, reader-specific evidence. Not a persistent identity or model projection.
export type PageStructure={version:1;reader:string;pages:PhysicalPage[]};
export type Inspection={pages:PageInfo[];structure?:PageStructure};
export type OCRWord={text:string;x:number;y:number;width:number;height:number};
export type OCRPage={page:number;words:OCRWord[]};
export type EngineInput={bytes:Uint8Array;inspection:Inspection};
export type EngineResult={bytes:Uint8Array;note:string;ocrPages?:OCRPage[]};
export type EngineRequest={kind:'inspect';bytes:Uint8Array}|{kind:'transform';step:Step;inputs:EngineInput[];ocrPages?:OCRPage[]};
// Decoded rendering/workload bounds, not PDF byte admission limits.
export const LIMITS={pages:100,pixels:12_000_000};
