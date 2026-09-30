import {build} from 'esbuild';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import type {JobController} from '../../packages/core/src/job-controller';
import type {WorkspaceVaultBackend} from '../../packages/core/src/workspace-vault';

// Run the actual App workspace hook with deterministic React state/effect slots.
// Engines, OS dialogs and setup transport are injected; no UI renderer or provider
// is used. Effects and renders are flushed, so this also exercises chat checkpoints.
export async function workspaceHook(controller:JobController, options:{sampleFiles?:()=>Promise<File[]>;chooseFiles?:()=>Promise<File[]>;save?:(bytes:Uint8Array)=>Promise<string>;plannerStatus?:()=>Promise<unknown>;backend?:WorkspaceVaultBackend;plannerAvailable?:boolean}={}){
  let cursor=0,queued=false,disposed=false,view:any;
  const slots:any[]=[],effects:(()=>void)[]=[],cleanups:(()=>void)[]=[];
  const hooks={
    createContext:()=>({}),useContext:()=>null,
    useState:(initial:any)=>{const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return [slots[index],(value:any)=>{if(disposed)return;slots[index]=typeof value==='function'?value(slots[index]):value;schedule();}];},
    useRef:(initial:any)=>{const index=cursor++;return slots[index]??(slots[index]={current:initial});},
    useMemo:(fn:()=>any)=>fn(),
    useSyncExternalStore:(_subscribe:any,snapshot:()=>any)=>snapshot(),
    useEffect:(fn:()=>void|(()=>void),deps?:any[])=>{const index=cursor++,prior=slots[index];if(!deps||!prior||deps.some((x,i)=>x!==prior[i])){slots[index]=deps;effects.push(()=>{cleanups[index]?.();const cleanup=fn();cleanups[index]=typeof cleanup==='function'?cleanup:()=>{};});}},
  };
  const env={hooks,createController:()=>controller,createWorkspaceBackend:()=>options.backend??null,sampleFiles:options.sampleFiles??(async()=>[]),chooseFiles:options.chooseFiles??(async()=>[]),save:options.save??(async()=> 'saved'),plannerStatus:options.plannerStatus??(async()=>({connected:false,enabled:false,remaining:0,token:''})),plannerAvailable:options.plannerAvailable??true};
  (globalThis as any).__atepdfHook=env;
  const runtimeSource=`const e=globalThis.__atepdfHook; export const createController=e.createController,chooseFiles=e.chooseFiles,sampleFiles=e.sampleFiles,save=e.save,nativeEngineReady=true,ocrAvailable=true;`;
  const plannerSource=`const e=globalThis.__atepdfHook; export const plannerStatus=(...a)=>e.plannerStatus(...a),plannerAvailable=e.plannerAvailable; export const requestPlan=()=>{throw new Error('Unexpected provider call')}; export const savePlannerKey=()=>{},createNativePairing=()=>{},pairNativePlanner=()=>{},disconnectNativePlanner=()=>{};`;
  const app=resolve('apps/universal/App.tsx');
  const output=await build({stdin:{contents:`export {useWorkspace} from ${JSON.stringify(app)};`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'cjs',platform:'node',tsconfig:'apps/universal/tsconfig.json',plugins:[{name:'workspace-hook',setup(build){
    build.onLoad({filter:/App\.tsx$/},async args=>({contents:(await readFile(args.path,'utf8'))+'\nexport {useWorkspace};',loader:'tsx'}));
    build.onResolve({filter:/^react$/},()=>({path:'react',namespace:'hook'}));
    build.onResolve({filter:/^\.\/src\/platform\/(runtime|planner|workspace)$/},args=>({path:args.path.split('/').at(-1)!,namespace:'hook'}));
    build.onResolve({filter:/.*/},args=>{if(args.importer===app&&!/^@(core|contracts|planner)\//.test(args.path))return {path:args.path,namespace:'ui'};});
    build.onLoad({filter:/.*/,namespace:'hook'},args=>({contents:args.path==='react'?`const h=globalThis.__atepdfHook.hooks; export const {createContext,useContext,useState,useRef,useMemo,useSyncExternalStore,useEffect}=h;export default h;`:args.path==='runtime'?runtimeSource:args.path==='planner'?plannerSource:`export const createWorkspaceBackend=globalThis.__atepdfHook.createWorkspaceBackend;`,loader:'js'}));
    build.onLoad({filter:/.*/,namespace:'ui'},()=>({contents:`export default ()=>null; export const jsx=()=>null,jsxs=()=>null,Fragment=()=>null,setStringAsync=()=>{},Platform={OS:'test'},View=()=>null,Text=()=>null,Image=()=>null,Pressable=()=>null,TextInput=()=>null,ScrollView=()=>null,Modal=()=>null,Keyboard={},useWindowDimensions=()=>({width:1000,height:1000}),SafeAreaProvider=()=>null,SafeAreaView=()=>null,AssistantRuntimeProvider=()=>null,useExternalStoreRuntime=()=>null,useAuiState=()=>null,Thread=()=>null,Icon=()=>null,nativeComposerComponents={},resetComposerInput=()=>{},JobActivity=()=>null,useAnnounce=()=>{},useMotion=()=>false;`,loader:'js'}));
  }}]});
  const bundleDirectory=await mkdtemp(join(tmpdir(),'atepdf-hook-'));
  const bundlePath=join(bundleDirectory,'workspace.cjs');
  let workspace:{useWorkspace:()=>any};
  try{
    await writeFile(bundlePath,output.outputFiles[0].text,{flag:'wx',mode:0o600});
    workspace=createRequire(import.meta.url)(bundlePath);
  }finally{await rm(bundleDirectory,{recursive:true,force:true});}
  function render(){cursor=0;view=workspace.useWorkspace();for(const effect of effects.splice(0))effect();return view;}
  function schedule(){if(queued||disposed)return;queued=true;queueMicrotask(()=>{queued=false;if(!disposed)render();});}
  const unsubscribe=controller.subscribe(schedule);render();
  return {get view(){return render();},async flush(){for(let i=0;i<8;i++)await new Promise(done=>setTimeout(done,0));return render();},dispose(){disposed=true;unsubscribe();cleanups.forEach(fn=>fn?.());}};
}
export function deferred<T>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
