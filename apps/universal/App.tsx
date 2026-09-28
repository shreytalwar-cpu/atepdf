import React, {createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {View, Text, Image, Pressable, TextInput, ScrollView, Modal, Platform, useWindowDimensions} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {ArrowDownToLine, Check, FileText, FolderOpen, LockKeyhole, Plus, ScanText, Copy, Undo2, X} from 'lucide-react-native';
import type {LucideIcon} from 'lucide-react-native';
import {AssistantRuntimeProvider, useExternalStoreRuntime, useAuiState, type ThreadMessageLike} from '@assistant-ui/react-native';
import {Thread} from './src/components/assistant-ui/elements/thread.aui';
import {Icon} from './src/components/ui/icon';
import type {LocalFileStore, Artifact} from '@core/local-file-store';
import {createController, chooseFiles, sampleFiles, save, nativeEngineReady} from './src/platform/runtime';
import Preview from './src/platform/Preview';
import DropSurface from './src/platform/DropSurface';
import {privateInstruction} from '@planner/privacy';
import {plannerStatus,requestPlan,savePlannerKey,type PlannerStatus} from '@planner/client';
import {validateEnvelope,type Request as PlannerRequest,type Envelope} from '@contracts/protocol';

const formatSize = (n: number) => n < 1_000_000 ? `${(n / 1000).toFixed(1)} kB` : `${(n / 1_000_000).toFixed(2)} MB`;
type Action = 'merge' | 'ocr' | 'remove' | 'compress' | 'chain';
type Entry = {id: number; role: 'user' | 'assistant'; text: string; files?: {name: string; size: number}[]; artifact?: Artifact; choice?: 'compress' | 'chain' | 'clear' | 'planner' | 'execute' | 'connect'; revision?: number; request?:PlannerRequest; envelope?:Envelope; token?:string};
function Button({children, onPress, disabled=false, primary=false, icon: Glyph, label}: {children?: React.ReactNode; onPress:()=>void; disabled?:boolean; primary?:boolean; icon?:LucideIcon; label?:string}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label ?? (typeof children === 'string' ? children : undefined)} disabled={disabled} aria-disabled={disabled} onPress={onPress} className={`min-h-11 flex-row items-center justify-center gap-2 rounded-xl px-3 py-2 active:opacity-70 web:focus-visible:outline-2 web:focus-visible:outline-primary ${primary ? 'bg-primary' : 'border border-border bg-background'} ${disabled ? 'opacity-40' : ''}`}>
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
  const nextId = useRef(0), operation = useRef(false), stickToEnd = useRef(true);
  const [planning,setPlanning]=useState(false),[connection,setConnection]=useState<PlannerStatus|null>(null);
  const plannerAbort=useRef<AbortController|null>(null);
  const busy = state.busy || loading || planning;
  const current = entries.findLast(e => e.artifact)?.id;
  const focus = store.focus ? store.list.find(f => f.ref === store.focus) : null;
  const append = (entry: Omit<Entry, 'id'>) => { const id = ++nextId.current; setEntries(previous => [...previous, {...entry, id}]); stickToEnd.current = true; return id; };
  const say = (text: string) => append({role: 'assistant', text});
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const fn = (e: BeforeUnloadEvent) => { if (store.list.length || controller.state.busy) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', fn); return () => window.removeEventListener('beforeunload', fn);
  }, [store, controller]);
  const finish = (previous: string | null, text: string) => {
    if (controller.state.error) say(controller.state.error);
    else if (controller.state.stage === 'cancelled') say(controller.state.message);
    else if (store.focus && store.focus !== previous) append({role: 'assistant', text, artifact: store.get(store.focus).meta});
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
  const execute = async (type: Action, page = 2) => {
    if (operation.current) return;
    operation.current = true;
    const previous = store.focus;
    try {
      await controller.quick(type, page);
      finish(previous, type === 'remove' ? `I removed physical page ${page}. Here’s the new copy.` : type === 'merge' ? 'I merged your PDFs in the order added. Here’s your PDF.' : type === 'ocr' ? 'Your searchable copy is ready.' : type === 'chain' ? 'Your merged, searchable and optimised copy is ready.' : 'I checked the optimised copy. Here’s the result.');
    } catch (e) { say(e instanceof Error ? e.message : 'This action could not finish.'); }
    finally { operation.current = false; }
  };
  const action = (type: Action, text: string, page = 2) => {
    if (busy || operation.current) return;
    setChoice(null); append({role: 'user', text});
    if ((type === 'compress' || type === 'chain') && store.originals.length) {
      const id = append({role: 'assistant', text: 'I can re-encode supported JPEG images at their original dimensions. Image quality may change; text and vectors stay intact. Some PDFs may not get smaller. Shall I create a new copy for you to preview?', choice: type, revision: store.revision});
      setChoice(id); return;
    }
    void execute(type, page);
  };
  const undo = () => {
    if (busy) return;
    setChoice(null); append({role: 'user', text: 'Undo the last change.'});
    if (!store.canUndo) { say('There’s no earlier result to restore yet. Your original files are unchanged.'); return; }
    controller.undo();
    append({role: 'assistant', text: 'I restored your previous result. Your original files are unchanged.', artifact: store.get(store.focus!).meta});
  };
  const submit = (draft: string) => {
    if (busy || !draft.trim()) return;
    const text = draft.trim(), command = text.replace(/[.!]$/, '').toLowerCase();
    const remove = command.match(/^remove (?:physical )?page (\d+)(?: from (?:the )?(?:merged )?result)?$/);
    if (command === 'undo') undo();
    else if (remove) action('remove', text, Number(remove[1]));
    else if (['merge', 'merge pdfs', 'merge these pdfs'].includes(command)) action('merge', text);
    else if (['make searchable', 'ocr'].includes(command)) action('ocr', text);
    else if (command === 'compress') action('compress', text);
    else if (command === 'merge, ocr, compress') action('chain', text);
    else { setChoice(null); append({role:'user',text}); void preparePlanning(text); }
  };
  const checkConnection=async()=>{
    try{const status=await plannerStatus();setConnection(status);return status;}
    catch{say('The local planner gateway is unavailable. You can still use the quick actions.');return null;}
  };
  const refreshConnection=async()=>{
    try{setConnection(await plannerStatus());}
    catch{setConnection(previous=>previous?{...previous,enabled:false}:null);}
  };
  const connect=async()=>{
    const status=await checkConnection();if(!status)return;
    if(!status.connected){const id=append({role:'assistant',text:'Connect OpenAI for optional AI planning. Enter your key in the secure field below. It is saved only by atepdf’s local server and never added to the conversation. Saving makes no OpenAI calls.',choice:'connect',token:status.token});setChoice(id);return;}
    say(status.enabled?`AI planning is ready for up to ${status.remaining} approved requests. Type what you’d like to do; I’ll show you what will be sent first.`:status.connected?'Your key is saved locally. Paid planning is paused until you approve a request limit in the local setup. Quick actions work now.':'OpenAI is not connected yet. Use the masked local setup step to save your key on this computer. Don’t paste it into this chat. Quick actions work now.');
  };
  const preparePlanning=async(text:string)=>{
    if(operation.current)return;
    operation.current=true;setLoading(true);
    try{
      const instruction=privateInstruction(text,store.list),request=controller.request(instruction);
      const status=await checkConnection();
      if(!status)return;
      if(!status.enabled){say(status.connected?'Your key is saved. AI planning is paused until a request limit is approved. You can use Merge, Compress, Make searchable, “remove page 2”, or “undo”.':'OpenAI is not connected yet. You can use Merge, Compress, Make searchable, “remove page 2”, or “undo” while the masked key setup is completed.');return;}
      const id=append({role:'assistant',text:`To plan this, I’ll send OpenAI this instruction: “${instruction}” — plus anonymous file references, page counts and sizes. PDF content and filenames stay here. This uses one of your ${status.remaining} approved requests.`,choice:'planner',revision:store.revision,request,token:status.token});setChoice(id);
    }catch(e){say(e instanceof Error?e.message:'This instruction cannot be sent safely.');}
    finally{operation.current=false;setLoading(false);}
  };
  const plan=async(entry:Entry)=>{
    if(!entry.request||!entry.token||operation.current)return;
    operation.current=true;setPlanning(true);const abort=new AbortController();plannerAbort.current=abort;
    try{
      const result=await requestPlan(entry.request,entry.token,abort.signal);
      abort.signal.throwIfAborted();if(store.revision!==entry.request.workspaceRevision)throw new Error('Your files changed. Please ask again.');
      if(result.planner.status!=='plan'){say(result.planner.clarification!.question);return;}
      const envelope=validateEnvelope(result,entry.request,store.revision);
      const labels=envelope.planner.steps.map(step=>step.operation==='merge_pdf'?`merge ${step.inputs.length} PDFs`:step.operation==='select_pages'?`remove physical page(s) ${(step.params.pages as {indices:number[]}).indices.join(', ')}`:step.operation==='ocr_pdf'?'add searchable English text':'optimise supported JPEG images (image quality may change)');
      const id=append({role:'assistant',text:`I can ${labels.join(', then ')}. Shall I create a new copy on this device?`,choice:'execute',revision:store.revision,request:entry.request,envelope});setChoice(id);
    }catch(e){say(abort.signal.aborted?'Planning cancelled. No local files changed.':e instanceof Error?e.message:'Planning failed. No local files changed.');}
    finally{operation.current=false;setPlanning(false);plannerAbort.current=null;void refreshConnection();}
  };
  const executePlanned=async(entry:Entry)=>{
    if(!entry.envelope||!entry.request||operation.current)return;
    operation.current=true;const previous=store.focus;
    try{await controller.execute(entry.envelope,entry.request);finish(previous,'Your new copy is ready. I checked it with an independent PDF reader.');}
    catch(e){say(e instanceof Error?e.message:'The plan could not be applied.');}finally{operation.current=false;}
  };
  const cancel=()=>{plannerAbort.current?.abort();controller.cancel();};
  const confirm = (entry: Entry) => {
    if (busy || choice !== entry.id) return;
    setChoice(null);
    if (entry.revision !== store.revision) { say('Your files changed. Please ask again so I use the current files.'); return; }
    if(entry.choice==='connect')return;
    if(entry.choice==='planner'){void plan(entry);return;}
    if(entry.choice==='execute'){void executePlanned(entry);return;}
    if (entry.choice === 'clear') {
      controller.clear(); setPreview(null); setReceipts({}); setEntries([]);
    } else if (entry.choice) { append({role: 'user', text: 'Yes, create an optimised copy.'}); void execute(entry.choice); }
  };
  const exportResult = async (artifact: Artifact) => {
    if (saving) return;
    setSaving(artifact.ref);
    try { const outcome = await save(store.get(artifact.ref).bytes); setReceipts(previous => ({...previous, [artifact.ref]: outcome === 'saved' ? 'Saved to your device' : outcome === 'cancelled' ? 'Ready · save cancelled' : 'Download started · check your downloads'})); }
    catch (e) { setReceipts(previous => ({...previous, [artifact.ref]: e instanceof Error ? e.message : 'Saving failed. Try again.'})); }
    finally { setSaving(null); }
  };
  return {controller, state, store, entries, busy, current, focus, preview, setPreview, privacy, setPrivacy,
    choice, setChoice, saving, receipts, append, say, importFiles, pick, action, undo, submit, confirm, exportResult, planning, connection, connect, refreshConnection, cancel};
}

const WorkspaceContext=createContext<ReturnType<typeof useWorkspace>|null>(null);
const useWorkspaceContext=()=>{const context=useContext(WorkspaceContext);if(!context)throw new Error('Workspace unavailable');return context;};
const convertEntry=(entry:Entry):ThreadMessageLike=>({id:String(entry.id),role:entry.role,content:[{type:'text',text:entry.text}],metadata:{custom:{entryId:entry.id}},...(entry.id===-1?{status:{type:'running' as const}}:{})});
const threadComponents={Welcome,MessageExtras,AddAttachment:AddFiles,Footer};

export default function App(){return <SafeAreaProvider style={{height:'100%'}}><Screen/></SafeAreaProvider>;}
function Screen(){
  const workspace=useWorkspace(),{entries,busy,controller,state}=workspace;
  const {width}=useWindowDimensions();
  const messages=useMemo(()=>busy?[...entries,{id:-1,role:'assistant' as const,text:state.busy?state.message:workspace.planning?'Planning your request…':'Checking local setup…'}]:entries,[entries,busy,state.message,state.busy,workspace.planning]);
  const runtime=useExternalStoreRuntime({messages,convertMessage:convertEntry,isRunning:busy,isSendDisabled:busy||!nativeEngineReady,
    onNew:async message=>{workspace.submit(message.content.filter(p=>p.type==='text').map(p=>p.text).join('\n'));},
    onCancel:async()=>{workspace.cancel();},
  });
  return <WorkspaceContext.Provider value={workspace}><AssistantRuntimeProvider runtime={runtime}>
    <SafeAreaView style={{flex:1,backgroundColor:"#fff"}} edges={['top','left','right']}>
      <DropSurface disabled={busy} onFiles={files=>void workspace.importFiles(files)}>
        <View className="flex-row items-center justify-between px-5 py-3 md:px-8 md:py-5">
          <View className="flex-row items-center gap-2"><Image source={require('./assets/approved-8-mark-source-crop.png')} resizeMode="contain" style={{width:28,height:37}}/><Image accessibilityLabel="atepdf" source={require('./assets/approved-atepdf-wordmark-source-crop.png')} resizeMode="contain" style={{width:90,height:30}}/></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Processed on your device" onPress={()=>workspace.setPrivacy(true)} className="min-h-11 flex-row items-center gap-2 rounded-full bg-[#edf9f4] px-3"><LockKeyhole size={14} color="#26715c"/><Text className="text-xs text-[#26715c]">{width<360?"On-device":"Processed on your device"}</Text></Pressable>
        </View>
        {!nativeEngineReady&&<Text className="mx-5 text-xs text-muted-foreground">Native development preview · local PDF processing is not connected yet.</Text>}
        <Thread components={threadComponents}/>
      </DropSurface>
      <Modal visible={workspace.privacy} transparent animationType="fade" onRequestClose={()=>workspace.setPrivacy(false)}><View className="flex-1 items-center justify-center bg-black/25 px-5"><View accessibilityViewIsModal role="dialog" className="w-full max-w-lg gap-4 rounded-3xl bg-background p-6"><Text accessibilityRole="header" className="text-xl font-semibold text-foreground">Processed on your device</Text><Text className="text-base leading-6 text-foreground">PDF files, previews and recognised text stay on this device. Local quick actions do not contact an AI provider.</Text><Text className="text-sm leading-6 text-muted-foreground">Optional AI planning receives only your approved instruction and limited file details. Filenames, passwords, paths, checksums and document contents are excluded. Your OpenAI key stays in the local server, outside the app.</Text><Text className="text-sm leading-6 text-muted-foreground">Save before closing. Chat and files stay in this session. Saving to a cloud folder or sharing through a chosen provider may transfer the saved file outside atepdf.</Text><Button primary onPress={()=>workspace.setPrivacy(false)}>Got it</Button></View></View></Modal>
    </SafeAreaView>
  </AssistantRuntimeProvider></WorkspaceContext.Provider>;
}
function Welcome(){
  const {busy,pick}=useWorkspaceContext();const {width,height}=useWindowDimensions();const compact=height<800;
  return <ScrollView style={{flex:1}} keyboardShouldPersistTaps="handled" contentContainerStyle={{flexGrow:1,justifyContent:"center",paddingHorizontal:20,paddingVertical:12}}>
    <View className="w-full max-w-lg self-center items-center gap-2 rounded-3xl border border-dashed border-[#ccdaf0] bg-[#f9fbff] px-5 py-4">
      {height>=620&&<Image source={require('./assets/paper.png')} resizeMode="contain" style={{width:compact?116:168,height:compact?70:124}}/>}
      <Text accessibilityRole="header" className="text-center text-2xl font-semibold tracking-tight text-foreground">{width<640?'Add your files':'Drop files here'}</Text>
      <Text className="text-center text-sm text-muted-foreground">Then tell me what you’d like to do.</Text>
      <Button primary icon={FolderOpen} disabled={busy} onPress={()=>void pick()}>Choose files</Button>
      <Text className="text-xs text-muted-foreground">PDF · processed on your device</Text>
      <Pressable accessibilityRole="button" disabled={busy||!nativeEngineReady} onPress={()=>void pick(true)} className="min-h-11 items-center justify-center px-2"><Text className="text-sm text-muted-foreground underline">Try the two sample PDFs</Text></Pressable>
    </View>
  </ScrollView>;
}
function AddFiles(){const {busy,pick}=useWorkspaceContext();return <Pressable accessibilityRole="button" accessibilityLabel="Add files" disabled={busy} onPress={()=>void pick()} className="size-11 items-center justify-center rounded-full active:bg-muted"><Plus size={21} color="#637089"/></Pressable>;}
function Footer(){
  const w=useWorkspaceContext();
  return <View className="gap-2 pb-1">
    <View className="flex-row justify-center gap-2">{[{title:'Merge',type:'merge',prompt:'Merge my PDFs.',icon:Copy},{title:'Compress',type:'compress',prompt:'Compress the current PDF.',icon:ArrowDownToLine},{title:'Make searchable',type:'ocr',prompt:'Make this PDF searchable.',icon:ScanText}].map(item=><Pressable key={item.title} accessibilityRole="button" disabled={w.busy||!nativeEngineReady} onPress={()=>w.action(item.type as Action,item.prompt)} className="min-h-11 flex-1 sm:flex-none flex-row items-center justify-center gap-1.5 rounded-full border border-border px-2 sm:px-3 active:bg-muted"><Icon as={item.icon} className="size-4 text-muted-foreground"/><Text className="flex-shrink text-[11px] sm:text-xs text-foreground">{item.title}</Text></Pressable>)}</View>
    <View className="flex-row items-center justify-center gap-3"><Text className="text-xs text-muted-foreground">{w.focus?`Current result · ${w.focus.pageCount} pages`:w.entries.length?`${w.store.originals.length} originals in this chat`:'Your files stay on this device'}</Text>{!!w.entries.length&&<Pressable accessibilityRole="button" accessibilityLabel="Start over" disabled={w.busy} onPress={()=>{w.append({role:'user',text:'Start over.'});const id=w.append({role:'assistant',text:'Save any results you want to keep first. Shall I clear this conversation and its local files? Your originals on your device will stay unchanged.',choice:'clear',revision:w.store.revision});w.setChoice(id);}} className="size-10 items-center justify-center"><X size={15} color="#637089"/></Pressable>}</View>
    <Pressable accessibilityRole="button" accessibilityLabel="OpenAI connection" disabled={w.busy} onPress={()=>void w.connect()} className="min-h-9 items-center justify-center"><Text className="text-center text-[11px] text-muted-foreground">{w.connection?.enabled?"AI planning ready · quick actions stay local":w.connection?.connected?"AI planning paused · quick actions stay local":"Connect OpenAI · quick actions stay local"}</Text></Pressable>
  </View>;
}
function MessageExtras(){
  const id=useAuiState(s=>s.message.metadata.custom.entryId),w=useWorkspaceContext(),entry=w.entries.find(e=>e.id===id);
  if(id===-1)return <View testID="progress-message"/>;
  if(!entry)return null;
  const artifact=entry.artifact;
  return <>
    {entry.files?.map((file,index)=><View key={index} className="max-w-full flex-row items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3"><FileText color="#c45167" size={23}/><View className="min-w-0 flex-shrink"><Text className="text-sm font-medium text-foreground">{file.name}</Text><Text className="mt-1 text-xs text-muted-foreground">{formatSize(file.size)} · Original · {index+1}</Text></View></View>)}
    {artifact&&<View testID={entry.id===w.current?'current-result':'previous-result'} className="gap-4 rounded-2xl border border-border bg-background p-4">
      <View className="flex-row items-center gap-3"><View className="size-10 items-center justify-center rounded-xl bg-[#ecf8f2]"><Check size={21} color="#26715c"/></View><View><Text accessibilityRole="header" className="text-base font-semibold text-foreground">Your PDF is ready</Text><Text testID={entry.id===w.current?'result-facts':undefined} className="mt-1 text-sm text-muted-foreground">{artifact.pageCount} pages · {formatSize(artifact.sizeBytes)}</Text></View></View>
      {!!artifact.note&&<Text className="text-sm leading-5 text-muted-foreground">{artifact.note}</Text>}
      <View className="flex-row flex-wrap gap-2"><Button onPress={()=>w.setPreview(w.preview===entry.id?null:entry.id)}>{w.preview===entry.id?'Hide preview':'Preview'}</Button><Button primary icon={ArrowDownToLine} disabled={!!w.saving} onPress={()=>void w.exportResult(artifact)}>{w.saving===artifact.ref?'Saving…':'Save PDF'}</Button>{entry.id===w.current&&<Button icon={Undo2} disabled={w.busy||!w.store.canUndo} onPress={w.undo}>Undo</Button>}</View>
      <Text accessibilityLiveRegion="polite" className="text-xs text-muted-foreground">{w.receipts[artifact.ref]??'Ready to save'}</Text>
      {w.preview===entry.id&&<InlinePreview store={w.store} artifact={artifact} onClose={()=>w.setPreview(null)}/>}
      {entry.id===w.current&&<View className="flex-row flex-wrap items-center gap-3 border-t border-border pt-3"><Text className="text-xs text-muted-foreground">Keep going with this result</Text><Button disabled={w.busy||artifact.pageCount<2} onPress={()=>w.action('remove','Remove physical page 2 from this result.',2)}>Remove page 2</Button></View>}
    </View>}
    {entry.choice&&entry.choice!=='connect'&&w.choice===entry.id&&<View className="flex-row flex-wrap gap-2"><Button primary disabled={w.busy} onPress={()=>w.confirm(entry)}>{entry.choice==='clear'?'Clear session':entry.choice==='planner'?'Plan this request':entry.choice==='execute'?'Create local copy':'Create optimised copy'}</Button><Button disabled={w.busy} onPress={()=>{w.setChoice(null);w.append({role:'user',text:'Keep things as they are.'});w.say('Okay. Your current files and result are unchanged.');}}>Keep working</Button></View>}
    {entry.choice==='connect'&&w.choice===entry.id&&<KeyEntry token={entry.token!}/>}
    {entry.choice&&w.choice!==entry.id&&<Text className="text-xs text-muted-foreground">This question is closed.</Text>}
  </>;
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
