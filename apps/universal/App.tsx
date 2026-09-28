import React, {useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {View, Text, Image, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Modal, Platform, StyleSheet, useWindowDimensions} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {ArrowDownToLine, ArrowUp, Check, Copy, FileText, FolderOpen, LockKeyhole, Plus, ScanText, Sparkles, Undo2, X} from 'lucide-react-native';
import type {LucideIcon} from 'lucide-react-native';
import type {LocalFileStore, Artifact} from '@core/local-file-store';
import {createController, chooseFiles, sampleFiles, save, nativeEngineReady} from './src/platform/runtime';
import Preview from './src/platform/Preview';
import DropSurface from './src/platform/DropSurface';

const imageSource = (source: number | {src?: string; default?: {src?: string}}) => typeof source === 'object' && (source.src || source.default?.src) ? {uri: source.src ?? source.default?.src} : source as number;
const ink = '#11183f', muted = '#596783', blue = '#267bff';
const formatSize = (n: number) => n < 1_000_000 ? `${(n / 1000).toFixed(1)} kB` : `${(n / 1_000_000).toFixed(2)} MB`;
type Action = 'merge' | 'ocr' | 'remove' | 'compress' | 'chain';
type Entry = {id: number; role: 'user' | 'assistant'; text: string; files?: {name: string; size: number}[]; artifact?: Artifact; choice?: 'compress' | 'chain' | 'clear'; revision?: number};

function Button({children, onPress, disabled = false, kind = 'outline', icon: Icon, label}: {children?: React.ReactNode; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'outline' | 'quiet'; icon?: LucideIcon; label?: string}) {
  const [focus, setFocus] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={label ?? (typeof children === 'string' ? children : undefined)} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} style={({pressed}) => [s.button, kind === 'primary' && s.primary, kind === 'quiet' && s.quiet, disabled && {opacity: .45}, pressed && {opacity: .75}, focus && s.focus]}>{Icon && <Icon size={19} color={kind === 'primary' ? '#fff' : ink}/>}<Text style={[s.buttonText, kind === 'primary' && {color: '#fff'}]}>{children}</Text></Pressable>;
}
function InlinePreview({store, artifact, onClose}: {store: LocalFileStore; artifact: Artifact; onClose: () => void}) {
  const bytes = useMemo(() => store.get(artifact.ref).bytes, [store, artifact.ref]);
  return <Preview bytes={bytes} count={artifact.pageCount} onClose={onClose}/>;
}
export default function App() { return <SafeAreaProvider style={{height: '100%'}}><Screen/></SafeAreaProvider>; }
function Screen() {
  const {width, height} = useWindowDimensions(), phone = width < 640, compact = phone && height < 650;
  const [controller] = useState(createController);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot), store = controller.store;
  const [entries, setEntries] = useState<Entry[]>([]), [draft, setDraft] = useState(''), [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<number | null>(null), [privacy, setPrivacy] = useState(false), [choice, setChoice] = useState<number | null>(null);
  const [saving, setSaving] = useState<string | null>(null), [receipts, setReceipts] = useState<Record<string, string>>({});
  const nextId = useRef(0), operation = useRef(false), composer = useRef<TextInput>(null), scroll = useRef<ScrollView>(null), stickToEnd = useRef(true);
  const busy = state.busy || loading;
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
  const submit = () => {
    if (busy || !draft.trim()) return;
    const text = draft.trim(), command = text.replace(/[.!]$/, '').toLowerCase();
    const remove = command.match(/^remove (?:physical )?page (\d+)(?: from (?:the )?(?:merged )?result)?$/);
    setDraft('');
    if (command === 'undo') undo();
    else if (remove) action('remove', text, Number(remove[1]));
    else if (['merge', 'merge pdfs', 'merge these pdfs'].includes(command)) action('merge', text);
    else if (['make searchable', 'ocr'].includes(command)) action('ocr', text);
    else if (command === 'compress') action('compress', text);
    else if (command === 'merge, ocr, compress') action('chain', text);
    else { setChoice(null); append({role: 'user', text}); say('Hosted AI is not connected yet, so I can only understand these local commands: “merge”, “remove page 2”, “make searchable”, “compress”, “merge, OCR, compress”, or “undo”. You can also use the buttons below.'); }
  };
  const confirm = (entry: Entry) => {
    if (busy || choice !== entry.id) return;
    setChoice(null);
    if (entry.revision !== store.revision) { say('Your files changed. Please ask again so I use the current files.'); return; }
    if (entry.choice === 'clear') {
      controller.clear(); setPreview(null); setReceipts({}); setEntries([]); setDraft('');
    } else if (entry.choice) { append({role: 'user', text: 'Yes, create an optimised copy.'}); void execute(entry.choice); }
  };
  const exportResult = async (artifact: Artifact) => {
    if (saving) return;
    setSaving(artifact.ref);
    try { const outcome = await save(store.get(artifact.ref).bytes); setReceipts(previous => ({...previous, [artifact.ref]: outcome === 'saved' ? 'Saved to your device' : outcome === 'cancelled' ? 'Ready · save cancelled' : 'Download started · check your downloads'})); }
    catch (e) { setReceipts(previous => ({...previous, [artifact.ref]: e instanceof Error ? e.message : 'Saving failed. Try again.'})); }
    finally { setSaving(null); }
  };
  return <SafeAreaView style={s.safe}><DropSurface disabled={busy} onFiles={files => void importFiles(files)}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1}}>
    <View style={[s.header, phone && s.phoneHeader]}><View style={s.brand}><Image source={imageSource(require('./assets/approved-8-mark-source-crop.png'))} resizeMode="contain" style={[s.mark, phone && {width: 28, height: 38}]}/><Image accessibilityLabel="atepdf" source={imageSource(require('./assets/approved-atepdf-wordmark-source-crop.png'))} resizeMode="contain" style={[s.wordmark, phone && {width: 87, height: 29}]}/></View><Pressable accessibilityRole="button" accessibilityLabel="Processed on your device" onPress={() => setPrivacy(true)} style={[s.privacy, phone && {paddingHorizontal: 9}]}><LockKeyhole size={phone ? 13 : 16} color="#116853"/><Text style={[s.privacyText, phone && {fontSize: 10}]}>{width < 360 ? 'On-device' : 'Processed on your device'}</Text></Pressable></View>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" style={{flex: 1}} contentContainerStyle={s.scroll} onScroll={e => {const {contentOffset, layoutMeasurement, contentSize} = e.nativeEvent; stickToEnd.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;}} scrollEventThrottle={100} onContentSizeChange={() => {if (stickToEnd.current && entries.length) scroll.current?.scrollToEnd({animated: false});}}>
      <View style={[s.workspace, phone && {paddingHorizontal: 18}]}>
        {!nativeEngineReady && <Text style={s.nativeNotice}>Native development preview · local PDF processing is not connected yet. The tested browser workflow is available.</Text>}
        {!entries.length ? <View style={[s.drop, phone && {minHeight: compact ? 245 : 354, padding: 14}]}><Image source={imageSource(require('./assets/paper.png'))} resizeMode="contain" style={{width: phone ? 192 : 224, height: compact ? 90 : phone ? 155 : 190}}/><Text accessibilityRole="header" style={[s.title, phone && {fontSize: 25}]}>{phone ? 'Add your files' : 'Drop files here'}</Text><Text style={s.subtitle}>Then tell me what you’d like to do.</Text><Button kind="primary" icon={FolderOpen} disabled={busy} onPress={() => void pick()}>Choose files</Button><Text style={s.hint}>PDF · up to 20 MB per file</Text><Button kind="quiet" disabled={busy || !nativeEngineReady} onPress={() => void pick(true)}>Try the two sample PDFs</Button></View> : <View accessibilityLabel="Conversation" testID="conversation" style={s.thread}>
          {entries.map(entry => <View key={entry.id} testID={entry.role === 'user' ? 'user-message' : 'assistant-message'} style={[s.turn, entry.role === 'user' && s.userTurn]}>
            <Text style={s.speaker}>{entry.role === 'user' ? 'You' : 'atepdf'}</Text>
            <View style={[s.bubble, entry.role === 'user' && s.userBubble]}><Text style={s.message}>{entry.text}</Text>
              {entry.files?.map((file, index) => <View key={index} style={s.fileCard}><FileText color="#ca5366" size={23}/><View style={{flex: 1, minWidth: 0}}><Text style={s.filename}>{file.name}</Text><Text style={s.caption}>{formatSize(file.size)} · Original · {index + 1}</Text></View></View>)}
              {entry.artifact && <View testID={entry.id === current ? 'current-result' : 'previous-result'} accessibilityLabel={entry.id === current ? 'Current result' : 'Earlier result'} style={s.result}>
                <View style={s.row}><View style={s.check}><Check color="#14866d" size={22}/></View><View style={{flex: 1}}><Text accessibilityRole="header" style={s.resultTitle}>Your PDF is ready</Text><Text testID={entry.id === current ? 'result-facts' : undefined} style={s.caption}>{entry.artifact.pageCount} pages · {formatSize(entry.artifact.sizeBytes)}</Text></View></View>
                {!!entry.artifact.note && <Text style={s.resultNote}>{entry.artifact.note}</Text>}
                <View style={s.actions}><Button onPress={() => {stickToEnd.current = false; setPreview(preview === entry.id ? null : entry.id);}}>{preview === entry.id ? 'Hide preview' : 'Preview'}</Button><Button kind="primary" icon={ArrowDownToLine} disabled={!!saving} onPress={() => void exportResult(entry.artifact!)}>{saving === entry.artifact.ref ? 'Saving…' : 'Save PDF'}</Button>{entry.id === current && <Button kind="quiet" icon={Undo2} disabled={busy || !store.canUndo} onPress={undo}>Undo</Button>}</View>
                <Text accessibilityLiveRegion="polite" style={s.receipt}>{receipts[entry.artifact.ref] ?? 'Ready to save'}</Text>
                {preview === entry.id && <InlinePreview store={store} artifact={entry.artifact} onClose={() => setPreview(null)}/>}
                {entry.id === current && <View style={s.followups}><Text style={s.caption}>Keep going with this result</Text><Button kind="quiet" disabled={busy || entry.artifact.pageCount < 2} onPress={() => action('remove', 'Remove physical page 2 from this result.', 2)}>Remove page 2</Button></View>}
              </View>}
              {entry.choice && choice === entry.id && <View style={s.actions}><Button kind="primary" disabled={busy} onPress={() => confirm(entry)}>{entry.choice === 'clear' ? 'Clear session' : 'Create optimised copy'}</Button><Button disabled={busy} onPress={() => {setChoice(null); append({role: 'user', text: 'Keep things as they are.'}); say('Okay. Your current files and result are unchanged.');}}>Keep working</Button></View>}
              {entry.choice && choice !== entry.id && <Text style={s.caption}>This question is closed.</Text>}
            </View>
          </View>)}
        </View>}
        {busy && <View style={s.turn}><Text style={s.speaker}>atepdf</Text><View testID="progress-message" style={[s.bubble, s.row]}><Text accessibilityLiveRegion="polite" style={[s.message, {flex: 1}]}>{state.busy ? state.message : 'Opening local files…'}</Text>{state.busy && <Button onPress={() => controller.cancel()}>Cancel</Button>}</View></View>}
      </View>
    </ScrollView>
    <View style={[s.footer, phone && {paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10}]}>
      {!!entries.length && <View style={s.contextRow}><Text style={[s.caption, {flex: 1}]}>{focus ? `Current result · ${focus.pageCount} pages` : `${store.originals.length} originals in this chat`}</Text><Button kind="quiet" icon={Plus} disabled={busy} onPress={() => void pick()}>Add files</Button><Button kind="quiet" label="Start over" disabled={busy} onPress={() => {append({role: 'user', text: 'Start over.'}); const id = append({role: 'assistant', text: 'Save any results you want to keep first. Shall I clear this conversation and its local files? Your originals on your device will stay unchanged.', choice: 'clear', revision: store.revision}); setChoice(id);}} icon={X}/></View>}
      <View style={s.composer}><Sparkles color="#7c62ef" size={22}/><TextInput ref={composer} accessibilityLabel="Tell atepdf what to do" placeholder="Tell atepdf what to do…" placeholderTextColor="#637194" value={draft} onChangeText={setDraft} multiline style={s.prompt} onKeyPress={e => {const n = e.nativeEvent as unknown as {key: string; shiftKey?: boolean; isComposing?: boolean}; if (Platform.OS === 'web' && n.key === 'Enter' && !n.shiftKey && !n.isComposing) {e.preventDefault(); submit();}}}/><Button icon={ArrowUp} label="Run local command" kind="primary" disabled={!draft.trim() || busy || !nativeEngineReady} onPress={submit}/></View>
      <View style={s.shortcuts}>{([{label: 'Merge', action: 'merge', prompt: 'Merge my PDFs.', icon: Copy, bg: '#fff0f4', color: '#ce4260'}, {label: 'Compress', action: 'compress', prompt: 'Compress the current PDF.', icon: ArrowDownToLine, bg: '#e9faf3', color: '#14866d'}, {label: 'Make searchable', action: 'ocr', prompt: 'Make this PDF searchable.', icon: ScanText, bg: '#f2edff', color: '#7654cd'}] as const).map(item => <Pressable key={item.action} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{disabled: busy || !nativeEngineReady}} disabled={busy || !nativeEngineReady} onPress={() => action(item.action, item.prompt)} style={({pressed}) => [s.shortcut, {backgroundColor: item.bg, opacity: busy || !nativeEngineReady ? .45 : pressed ? .75 : 1}, phone && {flex: 1, paddingHorizontal: 6, gap: 5}]}><item.icon color={item.color} size={phone ? 17 : 21}/><Text style={[s.shortcutText, phone && {fontSize: 11}]}>{item.label}</Text></Pressable>)}</View>
      <Text style={s.mode}>Local commands · hosted AI is not connected</Text><Text style={s.session}>Save before closing. Files and chat stay in this session.</Text>
    </View>
  </KeyboardAvoidingView></DropSurface>
    <Modal visible={privacy} transparent animationType="fade" onRequestClose={() => setPrivacy(false)}><View style={s.overlay}><View accessibilityViewIsModal role="dialog" style={s.sheet}><Text accessibilityRole="header" style={s.sheetTitle}>Processed on your device</Text><Text style={s.paragraph}>PDF files, previews and recognised text stay on this device. The local commands in this build do not contact an AI provider.</Text><Text style={s.paragraph}>Hosted AI is not connected. When enabled after consent, it will receive your instructions and limited file details. Filenames, passwords, paths, checksums and document contents are excluded.</Text><Text style={s.paragraph}>Saving to a cloud folder or sharing through a chosen provider may transfer your file outside the app.</Text><Button kind="primary" onPress={() => setPrivacy(false)}>Got it</Button></View></View></Modal>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#fff'}, scroll: {flexGrow: 1, paddingTop: 14, paddingBottom: 24}, header: {width: '100%', maxWidth: 1060, alignSelf: 'center', paddingHorizontal: 40, paddingVertical: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12}, phoneHeader: {paddingHorizontal: 20, paddingVertical: 14}, brand: {flexDirection: 'row', alignItems: 'center', gap: 7}, mark: {width: 38, height: 48}, wordmark: {width: 107, height: 36}, privacy: {flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: '#caeee2', backgroundColor: '#e9faf3'}, privacyText: {fontSize: 13, color: '#116853'}, workspace: {width: '100%', maxWidth: 944, alignSelf: 'center', paddingHorizontal: 32}, drop: {backgroundColor: '#f4f8ff', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#b5caef', borderRadius: 28, padding: 24, minHeight: 400, alignItems: 'center', justifyContent: 'center'}, title: {color: ink, fontSize: 30, fontWeight: '700', letterSpacing: -.8, marginTop: 4, marginBottom: 8}, subtitle: {color: muted, fontSize: 15, marginBottom: 20}, button: {minHeight: 46, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: '#dfe6f4', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#fff'}, buttonText: {fontSize: 14, fontWeight: '500', color: ink}, primary: {backgroundColor: blue, borderColor: blue, paddingHorizontal: 17}, quiet: {borderColor: 'transparent', backgroundColor: 'transparent'}, focus: {outlineStyle: 'solid', outlineWidth: 3, outlineColor: blue}, hint: {fontSize: 11, color: muted, marginTop: 12}, footer: {width: '100%', maxWidth: 944, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 16, paddingBottom: 16, backgroundColor: '#fff', gap: 10}, shortcuts: {flexDirection: 'row', justifyContent: 'center', gap: 10}, shortcut: {minHeight: 46, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: '#e4e2f2', borderRadius: 18}, shortcutText: {color: ink, fontSize: 13, textAlign: 'center'}, composer: {borderWidth: 1, borderColor: '#d8e2fa', borderRadius: 26, paddingLeft: 16, paddingRight: 8, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', boxShadow: '0 7px 20px #7397da1c'}, prompt: {flex: 1, minWidth: 0, minHeight: 44, maxHeight: 110, fontSize: 16, color: ink, paddingVertical: 11, paddingHorizontal: 0}, mode: {fontSize: 11, color: muted, textAlign: 'center'}, session: {fontSize: 10, color: muted, textAlign: 'center'}, contextRow: {flexDirection: 'row', alignItems: 'center', gap: 4}, row: {flexDirection: 'row', alignItems: 'center', gap: 12}, caption: {fontSize: 12, color: muted, lineHeight: 18}, thread: {gap: 24}, turn: {width: '100%', alignSelf: 'flex-start', marginTop: 6}, userTurn: {maxWidth: '86%', alignSelf: 'flex-end'}, speaker: {fontSize: 11, fontWeight: '600', color: muted, marginBottom: 7, marginLeft: 4}, bubble: {borderWidth: 1, borderColor: '#e4eaf6', borderRadius: 22, padding: 18, backgroundColor: '#fff'}, userBubble: {backgroundColor: '#f1f5ff', borderColor: '#e6ecfa', borderBottomRightRadius: 7}, message: {fontSize: 15, lineHeight: 23, color: ink}, fileCard: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e3eaf8', borderRadius: 14}, filename: {fontSize: 14, fontWeight: '600', color: ink, marginBottom: 3}, result: {marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderColor: '#dfece8'}, check: {padding: 9, backgroundColor: '#e9faf3', borderRadius: 30}, resultTitle: {fontSize: 19, fontWeight: '600', color: ink, marginBottom: 3}, resultNote: {fontSize: 13, color: muted, lineHeight: 21, marginTop: 14}, actions: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16}, receipt: {fontSize: 12, color: '#316f60', marginTop: 10}, followups: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 14}, overlay: {flex: 1, backgroundColor: '#11183f66', justifyContent: 'center', alignItems: 'center', padding: 18}, sheet: {width: '100%', maxWidth: 480, padding: 26, backgroundColor: '#fff', borderRadius: 24, gap: 8}, sheetTitle: {fontSize: 22, fontWeight: '700', color: ink}, paragraph: {fontSize: 14, color: muted, lineHeight: 23, marginVertical: 8}, nativeNotice: {fontSize: 13, lineHeight: 20, color: '#754915', backgroundColor: '#fff3dc', padding: 14, marginBottom: 20, borderRadius: 14}
});
