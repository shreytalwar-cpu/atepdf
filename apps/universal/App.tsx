import React, {createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {View, Text, Image, Pressable, TextInput, ScrollView, Modal, Platform, Keyboard, useWindowDimensions} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import ArrowDownToLine from 'lucide-react-native/icons/arrow-down-to-line';
import Check from 'lucide-react-native/icons/check';
import FileText from 'lucide-react-native/icons/file-text';
import FolderOpen from 'lucide-react-native/icons/folder-open';
import LockKeyhole from 'lucide-react-native/icons/lock-keyhole';
import Plus from 'lucide-react-native/icons/plus';
import ScanText from 'lucide-react-native/icons/scan-text';
import Copy from 'lucide-react-native/icons/copy';
import Undo2 from 'lucide-react-native/icons/undo-2';
import SquarePen from 'lucide-react-native/icons/square-pen';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import Eye from 'lucide-react-native/icons/eye';
import type {LucideIcon} from 'lucide-react-native';
import {AssistantRuntimeProvider, useExternalStoreRuntime, useAuiState, type ThreadMessageLike} from '@assistant-ui/react-native';
import * as Clipboard from 'expo-clipboard';
import {Thread} from './src/components/assistant-ui/elements/thread.aui';
import {Icon} from './src/components/ui/icon';
import type {LocalFileStore, Artifact} from '@core/local-file-store';
import {createController, chooseFiles, sampleFiles, save, nativeEngineReady, ocrAvailable} from './src/platform/runtime';
import Preview from './src/platform/Preview';
import DropSurface from './src/platform/DropSurface';
import {nativeComposerComponents} from './src/platform/ComposerInput';
import {JobActivity} from './src/components/JobActivity';
import {useAnnounce,useMotion} from './src/components/assistant-ui/elements/surfaces';
import {privateInstruction} from '@planner/privacy';
import {plannerStatus,requestPlan,savePlannerKey,createNativePairing,pairNativePlanner,disconnectNativePlanner,plannerAvailable,type PlannerStatus} from './src/platform/planner';
import {validateEnvelope,type Request as PlannerRequest,type Envelope, type Step} from '@contracts/protocol';

const formatSize = (n: number) => n < 1_000_000 ? `${(n / 1000).toFixed(1)} kB` : `${(n / 1_000_000).toFixed(2)} MB`;
const pageCount = (count: number) => `${count} ${count === 1 ? 'page' : 'pages'}`;
const localResultTitle = (type: Action, page = 2) => type === 'merge' ? 'Merged PDF' : type === 'remove' ? `PDF with page ${page} removed` : type === 'ocr' ? 'Searchable PDF' : type === 'chain' ? 'Searchable, optimised PDF' : 'Optimised PDF';
function plannedResultTitle(steps: Step[]) {
  const last = steps.at(-1);
  if (last?.operation === 'select_pages') {
    const pages = (last.params.pages as {indices: number[]}).indices;
    return pages.length === 1 ? localResultTitle('remove', pages[0]) : `PDF with ${pages.length} pages removed`;
  }
  if (steps.some(step => step.operation === 'ocr_pdf') && last?.operation === 'compress_pdf') return localResultTitle('chain');
  return localResultTitle(last?.operation === 'merge_pdf' ? 'merge' : last?.operation === 'ocr_pdf' ? 'ocr' : 'compress');
}
type Action = 'merge' | 'ocr' | 'remove' | 'compress' | 'chain';
type Entry = {id: number; role: 'user' | 'assistant'; text: string; files?: {name: string; size: number}[]; artifact?: Artifact; resultTitle?: string; choice?: 'compress' | 'chain' | 'clear' | 'execute' | 'connect' | 'native-link' | 'native-pair' | 'connection-help'; revision?: number; request?:PlannerRequest; envelope?:Envelope; token?:string};
function Button({children, onPress, disabled=false, primary=false, quiet=false, icon: Glyph, label}: {children?: React.ReactNode; onPress:()=>void; disabled?:boolean; primary?:boolean; quiet?:boolean; icon?:LucideIcon; label?:string}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label ?? (typeof children === 'string' ? children : undefined)} disabled={disabled} aria-disabled={disabled} onPress={onPress} className={`atepdf-button min-h-11 flex-row items-center justify-center gap-2 rounded-xl px-3 py-2 active:opacity-70 web:focus-visible:outline-2 web:focus-visible:outline-primary ${primary ? 'atepdf-button-primary bg-primary' : quiet ? 'bg-transparent' : 'border border-border bg-background'} ${disabled ? 'opacity-40' : ''}`}>
    {Glyph && <Icon as={Glyph} className={`size-4 ${primary ? 'text-primary-foreground' : 'text-foreground'}`}/>}<Text className={`text-sm font-medium ${primary ? 'text-primary-foreground' : 'text-foreground'}`}>{children}</Text>
  </Pressable>;
}
function InlinePreview({store, artifact, onClose}: {store:LocalFileStore; artifact:Artifact; onClose:()=>void}) {
  const bytes=useMemo(()=>store.get(artifact.ref).bytes,[store,artifact.ref]);
  return <Preview bytes={bytes} count={artifact.pageCount} onClose={onClose}/>;
}
function useWorkspace() {
  const [controller] = useState(createController);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot), store = controller.store;
  const [entries, setEntries] = useState<Entry[]>([]), [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<number | null>(null), [privacy, setPrivacy] = useState(false), [choice, setChoice] = useState<number | null>(null);
  const [saving, setSaving] = useState<string | null>(null), [receipts, setReceipts] = useState<Record<string, string>>({});
  const nextId = useRef(0), operation = useRef(false);
  const [planning,setPlanning]=useState(false),[connection,setConnection]=useState<PlannerStatus|null>(null);
  const plannerAbort=useRef<AbortController|null>(null);
  const busy = state.busy || loading || planning;
  const currentEntry = entries.findLast(e => e.artifact), current = currentEntry?.id;
  const focus = store.focus ? store.list.find(f => f.ref === store.focus) : null;
  const append = (entry: Omit<Entry, 'id'>) => { const id = ++nextId.current; setEntries(previous => [...previous, {...entry, id}]); return id; };
  const say = (text: string) => append({role: 'assistant', text});
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const fn = (e: BeforeUnloadEvent) => { if (store.list.length || controller.state.busy) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', fn); return () => window.removeEventListener('beforeunload', fn);
  }, [store, controller]);
  const finish = (previous: string | null, text: string, resultTitle: string) => {
    if (controller.state.error) say(controller.state.error);
    else if (controller.state.stage === 'cancelled') say(controller.state.message);
    else if (store.focus && store.focus !== previous) append({role: 'assistant', text, artifact: store.get(store.focus).meta, resultTitle});
    else say(controller.state.message || 'No new result was created.');
  };
  const importFiles = async (files: File[]) => {
    if (!files.length || operation.current) return;
    operation.current = true; setChoice(null);
    append({role: 'user', text: `I’ve added ${files.length === 1 ? 'a PDF' : `${files.length} PDFs`}.`, files: files.map(f => ({name: f.name, size: f.size}))});
    try {
      await controller.import(files);
      if (controller.state.error || controller.state.stage === 'cancelled') say(controller.state.error || controller.state.message);
      else say(`Your ${store.originals.length} ${store.originals.length === 1 ? 'PDF is' : 'PDFs are'} ready. ${store.originals.map(r => store.get(r).meta.pageCount).reduce((a, b) => a + b, 0)} pages in total. ${focus ? 'Follow-ups still use the current result; Merge uses all originals in the order added.' : 'What would you like to do? Merge uses the order you added them.'}`);
    } catch (e) { say(e instanceof Error ? e.message : 'Files could not be opened.'); }
    finally { operation.current = false; }
  };
  const pick = async (sample = false) => {
    if (operation.current) return;
    setLoading(true);
    try { await importFiles(await (sample ? sampleFiles() : chooseFiles())); }
    catch (e) { say(e instanceof Error ? e.message : 'Files could not be opened.'); }
    finally { setLoading(false); }
  };
  const executeLocal = async (type: Action, page = 2) => {
    const previous = store.focus;
    try {
      await controller.quick(type, page);
      finish(previous, type === 'remove' ? `I removed page ${page}. Here’s the new copy.` : type === 'merge' ? 'I merged your PDFs in the order added. Here’s your PDF.' : type === 'ocr' ? 'Your searchable copy is ready.' : type === 'chain' ? 'Your merged, searchable and optimised copy is ready.' : 'I checked the optimised copy. Here’s the result.', localResultTitle(type, page));
    } catch (e) { say(e instanceof Error ? e.message : 'This action could not finish.'); }
  };
  const execute = async (type: Action, page = 2) => {
    if (operation.current) return;
    operation.current = true;
    try { await executeLocal(type,page); }
    finally { operation.current = false; }
  };
  const action = (type: Action, text: string, page = 2) => {
    if (busy || operation.current) return;
    setChoice(null); append({role: 'user', text});
    if(plannerAvailable){void preparePlanning(text,{type,page});return;}
    if ((type === 'compress' || type === 'chain') && store.originals.length) {
      const id = append({role: 'assistant', text: 'I can re-encode supported JPEG images at their original dimensions. Image quality may change; text and vectors stay intact. Some PDFs may not get smaller. Shall I create a new copy for you to preview?', choice: type, revision: store.revision});
      setChoice(id); return;
    }
    void execute(type, page);
  };
  const undoLocal = () => {
    if (!store.canUndo) { say('There’s no earlier result to restore yet. Your original files are unchanged.'); return; }
    controller.undo();
    append({role: 'assistant', text: 'I restored your previous result. Your original files are unchanged.', artifact: store.get(store.focus!).meta, resultTitle: entries.findLast(entry => entry.artifact?.ref === store.focus)?.resultTitle});
  };
  const undo = () => {
    if (busy) return;
    setChoice(null); append({role: 'user', text: 'Undo the last change.'});
    undoLocal();
  };
  const submit = (draft: string) => {
    if (busy || operation.current || !draft.trim()) return;
    const text = draft.trim(), command = text.replace(/[.!]$/, '').toLowerCase();
    const remove = command.match(/^remove (?:physical )?page (\d+)(?: from (?:the )?(?:merged )?result)?$/);
    if(plannerAvailable){
      const fallback=remove?{type:'remove' as const,page:Number(remove[1])}:['merge', 'merge pdfs', 'merge these pdfs'].includes(command)?{type:'merge' as const,page:2}:['make searchable','ocr'].includes(command)?{type:'ocr' as const,page:2}:command==='compress'?{type:'compress' as const,page:2}:command==='merge, ocr, compress'?{type:'chain' as const,page:2}:command==='undo'?{type:'undo' as const,page:2}:undefined;
      setChoice(null);append({role:'user',text});void preparePlanning(text,fallback);return;
    }
    if (command === 'undo') undo();
    else if (remove) action('remove', text, Number(remove[1]));
    else if (['merge', 'merge pdfs', 'merge these pdfs'].includes(command)) action('merge', text);
    else if (['make searchable', 'ocr'].includes(command)) action('ocr', text);
    else if (command === 'compress') action('compress', text);
    else if (command === 'merge, ocr, compress') action('chain', text);
    else { setChoice(null); append({role:'user',text}); void preparePlanning(text); }
  };
  const checkConnection=async(signal?:AbortSignal,quiet=false)=>{
    if(!plannerAvailable){if(!quiet)say('AI connection is not available on this device yet. Local quick actions still work.');return null;}
    try{const status=await plannerStatus(signal);signal?.throwIfAborted();setConnection(status);return status;}
    catch(error){if(signal?.aborted)throw error;if(!quiet)say('The local planner gateway is unavailable. You can still use the quick actions.');return null;}
  };
  const refreshConnection=async()=>{
    try{setConnection(await plannerStatus());}
    catch{setConnection(previous=>previous?{...previous,enabled:false}:null);}
  };
  const connect=async()=>{
    const status=await checkConnection();if(!status)return;
    if(Platform.OS!=='web'){const id=append({role:'assistant',text:status.pairingRequired?'Create a pairing code in atepdf on your Mac, then paste it below. On iPhone or iPad, keep both devices on the same Wi-Fi and use the private beta connection.':'This app is paired with the planner on your Mac.',choice:'native-pair'});setChoice(id);return;}
    if(!status.connected){const id=append({role:'assistant',text:'Connect OpenAI for optional AI planning. Enter your key in the secure field below. It is saved only by atepdf’s local server and never added to the conversation. Saving makes no OpenAI calls.',choice:'connect',token:status.token});setChoice(id);return;}
    const id=append({role:'assistant',text:status.enabled?`AI planning is ready for up to ${status.remaining} approved requests. Tell me what you’d like to do.`:'Your key is saved locally. Paid planning is paused until you approve a request limit in the local setup. Quick actions work now.',choice:'native-link',token:status.token});setChoice(id);
  };
  const preparePlanning=async(text:string,fallback?:{type:Action|'undo';page:number})=>{
    if(operation.current)return;
    operation.current=true;setLoading(true);
    const abort=new AbortController();plannerAbort.current=abort;
    try{
      // One submission owns setup, planning and local execution. Only the
      // positive metadata projection crosses the planner boundary.
      const instruction=privateInstruction(text,store.list),request=controller.request(instruction);
      const status=await checkConnection(abort.signal,true);
      abort.signal.throwIfAborted();
      if(!status?.enabled){
        if(fallback){
          setLoading(false);
          if(fallback.type==='undo')undoLocal();
          else if((fallback.type==='compress'||fallback.type==='chain')&&store.originals.length){const id=append({role:'assistant',text:'I can re-encode supported JPEG images at their original dimensions. Image quality may change; text and vectors stay intact. Some PDFs may not get smaller. Shall I create a new copy for you to preview?',choice:fallback.type,revision:store.revision});setChoice(id);}
          else await executeLocal(fallback.type,fallback.page);
          return;
        }
        const help = /^(?:what (?:can you|can atepdf|do you) do|(?:how )?can you help(?: me)?|help|what (?:are your|are atepdf.?s) capabilities)[?.!]*$/i.test(text.trim());
        const localHelp = `I can merge PDFs, remove pages${ocrAvailable ? ', make scanned English PDFs searchable' : ''}, and compress supported images inside a PDF. Add PDFs, then use the quick actions or type a request such as “remove page 2”.`;
        const reason = !plannerAvailable ? 'AI planning is not available on this device yet.' : status?.connected ? 'AI planning is paused. Open AI connection to check the local request allowance.' : status ? 'OpenAI is not connected yet. You can connect it here for conversational help.' : 'The AI connection is unavailable. Check that atepdf’s local server is running, then try AI connection again.';
        const id = append({role:'assistant', text: help ? `${localHelp}\n\n${reason}` : `${reason} You can still use Merge, Compress${ocrAvailable ? ' or Make searchable' : ''}. Your files are unchanged.`, choice:plannerAvailable?'connection-help':undefined});
        setChoice(id);return;
      }
      setLoading(false);setPlanning(true);
      const result=await requestPlan(request,status.token,abort.signal);
      abort.signal.throwIfAborted();
      if(store.revision!==request.workspaceRevision)throw new Error('Your files changed. Please ask again.');
      // requestPlan validates clarification shape and response binding too.
      if(result.planner.status==='undo'){undoLocal();return;}
      if(result.planner.status!=='plan'){say(result.planner.clarification!.question);return;}
      const envelope=validateEnvelope(result,request,store.revision);
      setPlanning(false);
      // Retain a choice only when the requested operation can change image
      // quality. Safe copy-producing plans run after full local validation.
      if(envelope.planner.steps.some(step=>step.operation==='compress_pdf'&&step.params.preset!=='lossless')){
        const id=append({role:'assistant',text:'I can make a smaller copy by optimising its images. Image quality may change; your originals will stay intact.',choice:'execute',revision:store.revision,request,envelope});setChoice(id);return;
      }
      plannerAbort.current=null;
      const previous=store.focus;
      await controller.execute(envelope,request);
      finish(previous,'Your new PDF is ready.',plannedResultTitle(envelope.planner.steps));
    }catch(e){say(abort.signal.aborted?'Planning cancelled. No local files changed.':e instanceof Error?e.message:'This request could not finish. Your files are unchanged.');}
    finally{operation.current=false;setLoading(false);setPlanning(false);plannerAbort.current=null;if(plannerAvailable)void refreshConnection();}
  };
  const executePlanned=async(entry:Entry)=>{
    if(!entry.envelope||!entry.request||operation.current)return;
    operation.current=true;const previous=store.focus;
    try{await controller.execute(entry.envelope,entry.request);finish(previous,'Your new copy is ready. I checked it with an independent PDF reader.',plannedResultTitle(entry.envelope.planner.steps));}
    catch(e){say(e instanceof Error?e.message:'The plan could not be applied.');}finally{operation.current=false;}
  };
  const cancel=()=>{plannerAbort.current?.abort();controller.cancel();};
  const confirm = (entry: Entry) => {
    if (busy || choice !== entry.id) return;
    setChoice(null);
    if (entry.revision !== store.revision) { say('Your files changed. Please ask again so I use the current files.'); return; }
    if(entry.choice==='connect'||entry.choice==='native-link'||entry.choice==='native-pair'||entry.choice==='connection-help')return;
    if(entry.choice==='execute'){void executePlanned(entry);return;}
    if (entry.choice === 'clear') {
      controller.clear(); setPreview(null); setReceipts({}); setEntries([]);
    } else if (entry.choice) { append({role: 'user', text: 'Yes, create an optimised copy.'}); void execute(entry.choice); }
  };
  const exportResult = async (artifact: Artifact) => {
    if (saving) return;
    setSaving(artifact.ref);
    try { const outcome = await save(store.get(artifact.ref).bytes); setReceipts(previous => ({...previous, [artifact.ref]: outcome === 'shared' ? 'Share sheet closed · check the destination you chose' : outcome === 'saved' ? 'Saved to your device' : outcome === 'cancelled' ? 'Ready · save cancelled' : 'Download started · check your downloads'})); }
    catch (e) { setReceipts(previous => ({...previous, [artifact.ref]: e instanceof Error ? e.message : 'Saving failed. Try again.'})); }
    finally { setSaving(null); }
  };
  return {controller, state, store, entries, busy, loading, current, currentTitle:currentEntry?.resultTitle, focus, preview, setPreview, privacy, setPrivacy,
    choice, setChoice, saving, receipts, append, say, importFiles, pick, action, undo, submit, confirm, exportResult, planning, connection, connect, refreshConnection, cancel};
}

const WorkspaceContext=createContext<ReturnType<typeof useWorkspace>|null>(null);
const useWorkspaceContext=()=>{const context=useContext(WorkspaceContext);if(!context)throw new Error('Workspace unavailable');return context;};
const convertEntry=(entry:Entry):ThreadMessageLike=>({id:String(entry.id),role:entry.role,content:[{type:'text',text:entry.text}],metadata:{custom:{entryId:entry.id,hasArtifact:!!entry.artifact}},...(entry.id===-1?{status:{type:'running' as const}}:{})});
function Processing(){const w=useWorkspaceContext();return <JobActivity state={w.state} planning={w.planning} loading={w.loading}/>;}
const threadComponents={Welcome,MessageExtras,Activity:Processing,AddAttachment:AddFiles,Footer,...nativeComposerComponents};

export default function App(){return <SafeAreaProvider style={{height:'100%'}}><Screen/></SafeAreaProvider>;}
function Screen(){
  const workspace=useWorkspace(),{entries,busy,controller,state}=workspace;
  const {width}=useWindowDimensions();
  const motion=useMotion();
  const announcement=entries.findLast(entry=>entry.role==='assistant')?.text;
  useAnnounce(announcement);
  const messages=useMemo(()=>busy?[...entries,{id:-1,role:'assistant' as const,text:state.busy?state.message:workspace.planning?'Planning your request…':'Checking local setup…'}]:entries,[entries,busy,state.message,state.busy,workspace.planning]);
  const runtime=useExternalStoreRuntime({messages,convertMessage:convertEntry,isRunning:busy,isSendDisabled:busy||!nativeEngineReady,
    onNew:async message=>{workspace.submit(message.content.filter(p=>p.type==='text').map(p=>p.text).join('\n'));},
    onCancel:async()=>{workspace.cancel();},
  });
  return <WorkspaceContext.Provider value={workspace}><AssistantRuntimeProvider runtime={runtime}>
    <SafeAreaView style={{flex:1,backgroundColor:"#fff"}} edges={['top','left','right']}>
      <DropSurface disabled={busy} onFiles={files=>void workspace.importFiles(files)}>
        <View className="flex-row items-center justify-between gap-3 px-4 py-2 md:px-8 md:py-4">
          <View className="flex-row items-center gap-2"><Image source={require('./assets/approved-8-mark-source-crop.png')} resizeMode="contain" style={{width:28,height:37}}/><Image accessibilityLabel="atepdf" source={require('./assets/approved-atepdf-wordmark-source-crop.png')} resizeMode="contain" style={{width:90,height:30}}/></View>
          <View className="flex-row items-center gap-1">
            <Pressable accessibilityRole="button" accessibilityLabel="Processed on your device" onPress={()=>workspace.setPrivacy(true)} className="atepdf-button min-h-11 min-w-11 flex-row items-center justify-center gap-2 rounded-full bg-[#edf9f4] px-3"><LockKeyhole size={15} color="#26715c"/>{width>=430&&<Text className="text-xs text-[#26715c]">Processed on your device</Text>}</Pressable>
            {plannerAvailable&&<Pressable accessibilityRole="button" accessibilityLabel={Platform.OS==='web'?'OpenAI connection':'AI connection'} accessibilityHint="Manage optional AI planning" disabled={busy} onPress={()=>void workspace.connect()} className={`atepdf-button size-11 items-center justify-center rounded-full ${busy?'opacity-40':''}`}><SlidersHorizontal size={19} color="#5d6980"/></Pressable>}
            {!!entries.length&&<Pressable accessibilityRole="button" accessibilityLabel="Start over" disabled={busy} onPress={()=>{workspace.append({role:'user',text:'Start over.'});const id=workspace.append({role:'assistant',text:'Save any results you want to keep first. Shall I clear this conversation and its local files? Your originals on your device will stay unchanged.',choice:'clear',revision:workspace.store.revision});workspace.setChoice(id);}} className={`atepdf-button size-11 items-center justify-center rounded-full ${busy?'opacity-40':''}`}><SquarePen size={19} color="#5d6980"/></Pressable>}
          </View>
        </View>
        {!nativeEngineReady&&<Text className="mx-5 text-xs text-muted-foreground">Native development preview · local PDF processing is not connected yet.</Text>}
        <Thread components={threadComponents}/>
      </DropSurface>
      <Modal accessibilityLabel={Platform.OS==='web'?'Processed on your device':undefined} visible={workspace.privacy} transparent animationType={motion?'fade':'none'} onRequestClose={()=>workspace.setPrivacy(false)}><SafeAreaView style={{flex:1}} className="bg-black/25"><ScrollView contentContainerStyle={{flexGrow:1,justifyContent:'center',padding:20}}><View accessibilityViewIsModal role={Platform.OS==='web'?undefined:'dialog'} className="w-full max-w-lg self-center gap-4 rounded-3xl bg-background p-6"><Text accessibilityRole="header" className="text-xl font-semibold text-foreground">Processed on your device</Text><Text className="text-base leading-6 text-foreground">PDF files, previews and recognised text stay on this device. PDF operations run in local engines.</Text><Text className="text-sm leading-6 text-muted-foreground">When AI is enabled, chat requests and quick actions send your instruction and anonymous file references, page counts and sizes for planning. Filenames, passwords, paths, checksums and document contents are excluded. Your OpenAI key stays in the local server, outside the app.</Text><Text className="text-sm leading-6 text-muted-foreground">Save before closing. Chat and files stay in this session. Saving to a cloud folder or sharing through a chosen provider may transfer the saved file outside atepdf.</Text><Button primary onPress={()=>workspace.setPrivacy(false)}>Got it</Button></View></ScrollView></SafeAreaView></Modal>
    </SafeAreaView>
  </AssistantRuntimeProvider></WorkspaceContext.Provider>;
}
function Welcome(){
  const {busy,pick}=useWorkspaceContext();const {width,height}=useWindowDimensions();const compact=height<760;
  return <ScrollView style={{flex:1}} keyboardShouldPersistTaps="handled" contentContainerStyle={{flexGrow:1,justifyContent:"center",paddingHorizontal:20,paddingVertical:12}}>
    <View className="w-full max-w-xl self-center items-center gap-3 rounded-[28px] border border-dashed border-[#ccd9ec] bg-[#f8faff] px-6 py-5 sm:py-7">
      {height>=620&&<Image source={require('./assets/paper.png')} resizeMode="contain" style={{width:compact?144:184,height:compact?84:132}}/>}
      <Text accessibilityRole="header" className="text-center text-[26px] font-semibold tracking-tight text-foreground">{Platform.OS!=='web'||width<640?'Add your files':'Drop files here'}</Text>
      <Text className="text-center text-sm text-muted-foreground">Then tell me what you’d like to do.</Text>
      <Button primary icon={FolderOpen} disabled={busy} onPress={()=>void pick()}>Choose files</Button>
      <Pressable accessibilityRole="button" disabled={busy||!nativeEngineReady} onPress={()=>void pick(true)} className="atepdf-button min-h-11 items-center justify-center rounded-xl px-3"><Text className="text-sm text-muted-foreground">Try the two sample PDFs</Text></Pressable>
    </View>
  </ScrollView>;
}
function AddFiles(){const {busy,pick}=useWorkspaceContext();return <Pressable accessibilityRole="button" accessibilityLabel="Add files" disabled={busy} onPress={()=>void pick()} className="size-11 items-center justify-center rounded-full active:bg-muted"><Plus size={21} color="#637089"/></Pressable>;}
function Footer(){
  const w=useWorkspaceContext();
  const {width,height,fontScale}=useWindowDimensions();
  const [keyboardVisible,setKeyboardVisible]=useState(()=>Platform.OS!=='web'&&Keyboard.isVisible());
  useEffect(()=>{
    if(Platform.OS==='web')return;
    const shown=Keyboard.addListener('keyboardDidShow',()=>setKeyboardVisible(true));
    const hidden=Keyboard.addListener('keyboardDidHide',()=>setKeyboardVisible(false));
    return()=>{shown.remove();hidden.remove();};
  },[]);
  useEffect(()=>{
    // Rotation can keep the keyboard open without another show event.
    if(Platform.OS!=='web')setKeyboardVisible(Keyboard.isVisible());
  },[width,height]);
  // The thread already moves the composer above the keyboard. Give its
  // conversation the secondary controls' space in landscape or at larger text.
  const largeText=Platform.OS!=='web'&&fontScale>=1.3;
  const scrollActions=largeText&&width<600;
  if(Platform.OS!=='web'&&keyboardVisible&&(width>height||largeText))return null;
  const actions=[{title:'Merge',type:'merge',prompt:'Merge my PDFs.',icon:Copy,color:'#aa405e'},{title:'Compress',type:'compress',prompt:'Compress the current PDF.',icon:ArrowDownToLine,color:'#26715c'},{title:'Make searchable',type:'ocr',prompt:'Make this PDF searchable.',icon:ScanText,color:'#7460b0'}].map(item=>{
    const disabled=w.busy||!nativeEngineReady||(item.type==='ocr'&&!ocrAvailable);
    return <Pressable key={item.title} accessibilityRole="button" disabled={disabled} aria-disabled={disabled} onPress={()=>w.action(item.type as Action,item.prompt)} className={`atepdf-button min-h-11 ${scrollActions?'flex-none':'flex-1'} ${Platform.OS==='web'?'sm:flex-none':''} flex-row items-center justify-center gap-1.5 rounded-full border border-border px-2 sm:px-4 active:bg-muted ${disabled?'opacity-40':''}`}>
      <item.icon size={16} color={item.color}/><Text numberOfLines={scrollActions?1:undefined} className={`${scrollActions?'':'flex-shrink'} text-[11px] sm:text-xs text-foreground`}>{item.title}</Text>
    </Pressable>;
  });
  return <View className="gap-2 pb-1">
    {scrollActions?<ScrollView horizontal style={{flexGrow:0}} showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{actions}</ScrollView>:<View className="flex-row justify-center gap-2">{actions}</View>}
    <View className="min-h-7 flex-row items-center justify-center gap-1.5">{w.focus&&<FileText size={12} color="#5d6980"/>}<Text testID="current-context" className="flex-shrink text-center text-xs text-muted-foreground">{w.focus?`Current: ${w.currentTitle ?? 'Your PDF'} · ${pageCount(w.focus.pageCount)}`:w.entries.length?`${w.store.originals.length} originals in this chat`:'Your files stay on this device'}</Text></View>
  </View>;
}
function MessageExtras(){
  const id=useAuiState(s=>s.message.metadata.custom.entryId),w=useWorkspaceContext(),entry=w.entries.find(e=>e.id===id);
  if(id===-1)return null;
  if(!entry)return null;
  const artifact=entry.artifact;
  return <>
    {entry.files?.map((file,index)=><View key={index} className="max-w-full flex-row items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3"><FileText color="#c45167" size={23}/><View className="min-w-0 flex-shrink"><Text className="text-sm font-medium text-foreground">{file.name}</Text><Text className="mt-1 text-xs text-muted-foreground">{formatSize(file.size)} · Original · {index+1}</Text></View></View>)}
    {artifact&&<View testID={entry.id===w.current?'current-result':'previous-result'} className={`gap-3 sm:gap-4 rounded-[20px] border bg-background p-4 sm:p-5 ${entry.id===w.current?'border-[#d4dfed]':'border-border'}`}>
      <View className="flex-row items-center gap-3"><View className={`size-11 items-center justify-center rounded-xl ${entry.id===w.current?'bg-[#eef4ff]':'bg-muted'}`}><FileText size={23} color={entry.id===w.current?'#1769df':'#5d6980'}/></View><View className="min-w-0 flex-1"><Text accessibilityRole="header" className="text-base font-semibold text-foreground">{entry.resultTitle ?? 'Your PDF'}</Text><Text testID={entry.id===w.current?'result-facts':undefined} className="mt-1 text-sm text-muted-foreground">{pageCount(artifact.pageCount)} · {formatSize(artifact.sizeBytes)}</Text><Text className="mt-1 text-xs font-medium text-muted-foreground">{entry.id===w.current?'Current result':'Earlier result'}</Text></View><Check accessibilityLabel="Validated" size={18} color="#26715c"/></View>
      {!!artifact.note&&<Text className="text-sm leading-5 text-muted-foreground">{artifact.note}</Text>}
      <View className="flex-row flex-wrap items-center gap-2"><Button primary={entry.id===w.current} icon={ArrowDownToLine} disabled={!!w.saving} onPress={()=>void w.exportResult(artifact)}>{w.saving===artifact.ref?'Saving…':'Save PDF'}</Button><Button icon={Eye} onPress={()=>w.setPreview(w.preview===entry.id?null:entry.id)}>{w.preview===entry.id?'Hide preview':'Preview'}</Button>{entry.id===w.current&&w.store.canUndo&&<Button quiet icon={Undo2} disabled={w.busy} onPress={w.undo}>Undo</Button>}</View>
      {!!w.receipts[artifact.ref]&&<Text accessibilityLiveRegion="polite" className="text-xs text-muted-foreground">{w.receipts[artifact.ref]}</Text>}
      {w.preview===entry.id&&<InlinePreview store={w.store} artifact={artifact} onClose={()=>w.setPreview(null)}/>}
      {entry.id===w.current&&<Text className="border-t border-border pt-3 text-sm text-muted-foreground">Tell me what you’d like to do next.</Text>}
    </View>}
    {entry.choice&&['clear','compress','chain','execute'].includes(entry.choice)&&w.choice===entry.id&&<View className="flex-row flex-wrap gap-2"><Button primary disabled={w.busy} onPress={()=>w.confirm(entry)}>{entry.choice==='clear'?'Clear session':'Create optimised copy'}</Button><Button disabled={w.busy} onPress={()=>{w.setChoice(null);w.append({role:'user',text:'Keep things as they are.'});w.say('Okay. Your current files and result are unchanged.');}}>Keep working</Button></View>}
    {entry.choice==='connect'&&w.choice===entry.id&&<KeyEntry token={entry.token!}/>}
    {entry.choice==='native-link'&&w.choice===entry.id&&<BrowserPairing token={entry.token!}/>}
    {entry.choice==='native-pair'&&w.choice===entry.id&&<NativePairing/>}
    {plannerAvailable&&entry.choice==='connection-help'&&w.choice===entry.id&&<View className="items-start"><Button icon={SlidersHorizontal} disabled={w.busy} onPress={()=>void w.connect()}>AI connection</Button></View>}
    {entry.choice&&entry.choice!=='connection-help'&&w.choice!==entry.id&&<Text className="text-xs text-muted-foreground">This question is closed.</Text>}
  </>;
}

function BrowserPairing({token}:{token:string}){
  const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const generate=async()=>{setBusy(true);setCode('');setMessage('');try{const pairing=await createNativePairing(token);setCode(pairing.code);setMessage('Valid once, for five minutes. Paste it in your app’s AI connection controls.');}catch{setMessage('A code could not be created. Open connection controls and try again.');}finally{setBusy(false);}};
  return <View className="gap-3 rounded-2xl border border-border p-4"><Text className="text-sm font-medium text-foreground">Connect an Apple device</Text><Text className="text-sm text-muted-foreground">Pair the native app with this local planner. Your OpenAI key stays on this computer.</Text><Button disabled={busy} onPress={()=>void generate()}>Create pairing code</Button>{!!code&&<><TextInput accessibilityLabel="Native pairing code" value={code} readOnly secureTextEntry className="min-h-11 rounded-xl border border-border px-3 text-foreground"/><Button onPress={()=>{void Clipboard.setStringAsync(code);setMessage('Copied. Paste it in the native app’s AI connection controls.');}}>Copy pairing code</Button></>}{!!message&&<Text accessibilityLiveRegion="polite" className="text-sm text-muted-foreground">{message}</Text>}</View>;
}
function NativePairing(){
  const w=useWorkspaceContext(),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const pair=async()=>{setBusy(true);setError('');try{await pairNativePlanner(code);setCode('');await w.refreshConnection();w.setChoice(null);w.say('Connected to the local planner. Tell me what you’d like to do.');}catch{setCode('');setError('Pairing did not finish. Create a fresh code in the browser and try again.');}finally{setBusy(false);}};
  const disconnect=async()=>{setBusy(true);try{await disconnectNativePlanner();await w.refreshConnection();w.setChoice(null);w.say('Disconnected. Local quick actions still work.');}finally{setBusy(false);}};
  return <View className="gap-3 rounded-2xl border border-border p-4">{w.connection?.pairingRequired?<><Text className="text-sm font-medium text-foreground">Pairing code</Text><TextInput accessibilityLabel="Pairing code" secureTextEntry autoComplete="off" autoCorrect={false} autoCapitalize="none" textContentType="none" value={code} onChangeText={setCode} editable={!busy} placeholder="Paste pairing code" className="min-h-12 rounded-xl border border-border px-3 py-2 text-base text-foreground"/><Button primary disabled={busy||!code.trim()} onPress={()=>void pair()}>Connect this app</Button><Text className="text-xs text-muted-foreground">This connection lasts for this app session. Keep atepdf running on your Mac.</Text></>:<Button disabled={busy} onPress={()=>void disconnect()}>Disconnect this app</Button>}{!!error&&<Text className="text-sm text-destructive">{error}</Text>}</View>;
}
function KeyEntry({token}:{token:string}){
  const w=useWorkspaceContext();const [key,setKey]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const saveKey=async()=>{
    if(saving||!key.trim())return;setSaving(true);setError('');
    try{await savePlannerKey(key.trim(),token);setKey('');w.setChoice(null);void w.refreshConnection();w.say('Your key is saved on this computer. Paid planning is paused until you approve a request limit. Local quick actions work as usual.');}
    catch{setKey('');setError('The key could not be saved. Check its format or your existing local setup.');}
    finally{setSaving(false);}
  };
  return <View className="gap-3 rounded-2xl border border-border p-4"><Text className="text-sm font-medium text-foreground">OpenAI project key</Text><TextInput accessibilityLabel="OpenAI project key" secureTextEntry autoComplete="off" autoCorrect={false} autoCapitalize="none" textContentType="none" value={key} onChangeText={setKey} editable={!saving} placeholder="Paste your key here" className="min-h-12 rounded-xl border border-border px-3 py-2 text-base text-foreground"/><Text className="text-xs leading-5 text-muted-foreground">Private local setup · no API calls are made. The key is not checked with OpenAI yet.</Text>{!!error&&<Text accessibilityLiveRegion="polite" className="text-sm text-destructive">{error}</Text>}<View className="flex-row flex-wrap gap-2"><Button primary disabled={saving||!key.trim()} onPress={()=>void saveKey()}>{saving?'Saving key…':'Save key on this computer'}</Button><Button disabled={saving} onPress={()=>{setKey('');w.setChoice(null);}}>Keep working</Button></View></View>;
}
