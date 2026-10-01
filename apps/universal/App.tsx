import React, {Suspense, lazy, useEffect, useMemo, useState, useSyncExternalStore, type ComponentType} from 'react';
import {Platform, View, useWindowDimensions} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import {AssistantRuntimeProvider, useExternalStoreRuntime, useAuiState, type ThreadMessageLike} from '@assistant-ui/react-native';
import {Thread, MessageText, CopyMessage} from './src/components/assistant-ui/elements/thread.aui';
import {useAnnounce} from './src/components/assistant-ui/elements/surfaces';
import {nativeEngineReady} from './src/platform/runtime';
import DropSurface from './src/platform/DropSurface';
import {ComposerInput, fillComposerInput, focusComposerInput, resetComposerInput} from './src/platform/ComposerInput';
import {useWorkspace, type Entry} from './src/workspace/useWorkspace';
import {WorkspaceContext, useApp, useShellState} from './src/ui/context';
import {EmptyWorkspace, InlineBanner, NoticeIcon} from './src/ui/empty';
import {isProposal, isStopAcknowledgement} from './src/ui/facts';
import {ActivityPresenceContext, markRestored, useActivityPresence} from './src/ui/motion';
import {AddFiles, ComposerActions, ComposerTop, HintRow, Toolbar} from './src/ui/shell';
import {Glyph, Txt} from './src/ui/primitives';
import {layout, radius, useTheme} from './src/ui/theme';

// atePDF (SHR-106): the approved SHR-105 Mac-first shell around the workspace. All document,
// job, planning, persistence and retention behaviour lives in useWorkspace; this file only
// presents it and routes commands back to it.
type ShownEntry = Entry & {tight?: boolean; running?: true};
const convertEntry = (entry: ShownEntry): ThreadMessageLike => ({id: String(entry.id), role: entry.role, content: [{type: 'text', text: entry.text}], metadata: {custom: {entryId: entry.id, hasArtifact: !!entry.artifact, tight: !!entry.tight}}, ...(entry.running ? {status: {type: 'running' as const}} : {})});

// Everything that needs files (sources, results, proposals, activity, the Files panel) loads
// right after first paint, outside the startup bundle (web budget). Once loaded, the views render
// synchronously (no Suspense frame), so a reply and its card always appear in the same commit.
type Views = typeof import('./src/ui/conversation');
let views: Views | null = null;
const viewListeners = new Set<() => void>();
const loadViews = () => import('./src/ui/conversation').then(module => {if (!views) {views = module; viewListeners.forEach(listener => listener());} return module;});
const subscribeViews = (listener: () => void) => {viewListeners.add(listener); return () => {viewListeners.delete(listener);};};
const readViews = () => views;
function lazyView<P extends object>(pick: (loaded: Views) => ComponentType<P>) {
  return function LazyView(props: P) {
    const loaded = useSyncExternalStore(subscribeViews, readViews, readViews);
    useEffect(() => {if (!loaded) void loadViews();}, [loaded]);
    return loaded ? React.createElement(pick(loaded), props) : null;
  };
}
const SourceGroup = lazyView(loaded => loaded.SourceGroup), EntryExtras = lazyView(loaded => loaded.EntryExtras), ProposalCard = lazyView(loaded => loaded.ProposalCard);
const ActivityRow = lazyView(loaded => loaded.ActivityRow), FilesPanel = lazyView(loaded => loaded.FilesPanel);

function useEntry() {
  const id = useAuiState(s => s.message.metadata.custom.entryId);
  const {workspace} = useApp();
  return workspace.entries.find(entry => entry.id === id);
}

/** C2 RequestBlock: the user's request, left-aligned; an import turn shows its files instead (C4). */
function UserMessage() {
  const entry = useEntry();
  const {c} = useTheme();
  if (entry?.files) return <SourceGroup entry={entry}/>;
  return <View style={{flexDirection: 'row', alignItems: 'flex-start', gap: 6}}>
    <View style={{flexShrink: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: c.request, borderRadius: radius.md, paddingVertical: 8, paddingLeft: 8, paddingRight: 12}}>
      <View style={{paddingTop: 3}}><Glyph icon={ChevronRight} size={14} tone="tertiary"/></View>
      <View style={{flexShrink: 1}}><MessageText strong/></View>
    </View>
    <CopyMessage/>
  </View>;
}

/** C3 AssistantMessage: text on the window background, an outcome icon when it reports one, then its artifact.
 * A reply that only follows up an import is quieter, so the import and its summary read as one turn. */
function AssistantMessage() {
  const entry = useEntry();
  const tight = useAuiState(s => !!s.message.metadata.custom.tight);
  if (!entry) return <MessageText/>;
  if (isProposal(entry)) return <ProposalCard entry={entry}/>;
  return <View style={{gap: 8}}>
    <View style={{flexDirection: 'row', alignItems: 'flex-start', gap: 8}}>
      <NoticeIcon notice={entry.notice}/>
      <View style={{flex: 1, minWidth: 0}}><MessageText muted={tight}/></View>
      {!entry.artifact && <CopyMessage/>}
    </View>
    <EntryExtras entry={entry}/>
  </View>;
}

/** B5 notices: workspace restore, save and cleanup states (copy unchanged), and a development-build note. */
function Banner() {
  const {workspace: w} = useApp();
  const notice = w.notice;
  return <View style={{gap: 8}}>
    {!nativeEngineReady && <InlineBanner variant="info" text="Development preview · local PDF processing isn’t connected in this build."/>}
    {notice && <InlineBanner text={notice.text} variant={notice.retry ? 'danger' : notice.cleanup || /couldn’t|can’t|paused|cancelled/i.test(notice.text) ? 'warning' : 'info'}
      action={w.canRetryRestore ? {label: 'Try Again', onPress: w.retryRestore, disabled: w.busy} : undefined}/>}
  </View>;
}

function Composer() {
  const {workspace: w} = useApp();
  const count = w.store.originals.length;
  const placeholder = w.question !== null ? 'Answer, or ask for something else…'
    : w.focus ? `What next for ${w.currentTitle ?? 'this PDF'}?`
    : count ? `What should I do with ${count === 1 ? 'this PDF' : `these ${count} PDFs`}?`
    : 'Describe what you need…';
  return <ComposerInput placeholder={placeholder}/>;
}

// Sheets load on first use, so their code stays out of the startup bundle (web budget).
const AllSheets = lazy(() => import('./src/ui/sheets'));
const ActionPalette = lazy(() => import('./src/ui/palette'));
function Palette() {const {shell} = useApp(); return shell.palette ? <Suspense fallback={null}><ActionPalette/></Suspense> : null;}
function Sheets() {
  const {shell} = useApp();
  const [needed, setNeeded] = useState(false);
  const open = shell.settings !== null || shell.startOver || shell.quickLook !== null || shell.onboarding || shell.shortcuts;
  useEffect(() => {if (open) setNeeded(true);}, [open]);
  return needed || open ? <Suspense fallback={null}><AllSheets/></Suspense> : null;
}

const threadComponents = {Welcome: EmptyWorkspace, UserMessage, AssistantMessage, Activity: ActivityRow, AddAttachment: AddFiles, ComposerTop, ComposerActions, Footer: HintRow, Banner, ComposerInput: Composer};

export default function App() {return <SafeAreaProvider style={{height: '100%'}}><Screen/></SafeAreaProvider>;}
function Screen() {
  const workspace = useWorkspace(), shell = useShellState();
  const {entries, busy, state} = workspace;
  const {c} = useTheme();
  const {width} = useWindowDimensions();
  const announcement = entries.findLast(entry => entry.role === 'assistant')?.text;
  useAnnounce(announcement);
  // Presence: after very fast work the activity row stays a moment and the reply is held only
  // for that remainder, so a turn reads request → working → result (never longer; see progress.ts).
  const presence = useActivityPresence(entries, workspace.working);
  const settling = presence.phase === 'settling';
  const messages = useMemo(() => {
    const visible = settling ? entries.slice(0, presence.cut) : entries;
    // A Stop acknowledgement is replaced by the row's “Stopping…” and then by the outcome.
    const shown: ShownEntry[] = visible.filter((entry, index) => !(isStopAcknowledgement(entry) && (index < visible.length - 1 || state.busy)))
      .map((entry, index, list) => entry.role === 'assistant' && list[index - 1]?.files && !entry.artifact && !entry.notice ? {...entry, tight: true} : entry);
    // The activity row carries the id its reply will have, so the reply replaces it in the same
    // list cell (no frame in which a new cell is still empty).
    const id = settling ? entries[presence.cut]?.id ?? workspace.nextEntryId : workspace.nextEntryId;
    return busy || settling ? [...shown, {id, role: 'assistant' as const, text: state.busy ? state.message : 'Working…', running: true as const}] : shown;
  }, [entries, busy, settling, presence.cut, state.message, state.busy, workspace.nextEntryId]);
  // While a reply is held, the result on screen stays the current one.
  const shownCurrent = settling ? entries.slice(0, presence.cut).findLast(entry => entry.artifact)?.id : workspace.current;
  const runtime = useExternalStoreRuntime({messages, convertMessage: convertEntry, isRunning: busy, isSendDisabled: busy || !nativeEngineReady,
    onNew: async message => {workspace.submit(message.content.filter(p => p.type === 'text').map(p => p.text).join('\n'));},
    onCancel: async () => {workspace.cancel();},
  });
  // Restore the inert draft before the composer mounts; the native input reads it once.
  const [composerReady, setComposerReady] = useState(!workspace.restoring);
  useEffect(() => {if (workspace.restoring) return; if (workspace.restoredDraft) runtime.thread.composer.setText(workspace.restoredDraft); setComposerReady(true);}, [workspace.restoring]);
  useEffect(() => runtime.thread.composer.subscribe(() => workspace.noteDraft(runtime.thread.composer.getState().text)), [runtime, workspace.clearCount]);
  // Start over, expiry and Delete Local Data: remove the unsent draft, content-derived
  // thumbnails and any open preview of the old workspace.
  useEffect(() => {if (workspace.clearCount) {runtime.thread.composer.setText(''); resetComposerInput(); void loadViews().then(views => views.clearThumbnails()); shell.setQuickLook(null); shell.setOverlayPanel(false);}}, [workspace.clearCount]);
  // A restored conversation is already there: its turns don't animate in.
  useEffect(() => {if (!workspace.restoring) markRestored(entries.map(entry => entry.id));}, [workspace.restoring]);
  useEffect(() => {const timer = setTimeout(() => void loadViews(), 0); return () => clearTimeout(timer);}, []);
  const composer = useMemo(() => ({fill: (text: string) => {runtime.thread.composer.setText(text); fillComposerInput(text);}, focus: focusComposerInput}), [runtime]);
  useKeyboardCommands(workspace, shell, composer);
  useEffect(() => {if (Platform.OS === 'web') document.title = 'atePDF';}, []);
  const hasFiles = workspace.store.list.length > 0;
  const docked = layout.panelDocks(width) && hasFiles && shell.filesPanel !== false;
  const context = useMemo(() => ({workspace, shell, composer}), [workspace, shell, composer]);
  const activity = useMemo(() => ({phase: presence.phase, outcome: presence.outcome, current: shownCurrent}), [presence.phase, presence.outcome, shownCurrent]);
  return <WorkspaceContext.Provider value={context}><ActivityPresenceContext.Provider value={activity}><AssistantRuntimeProvider runtime={runtime}>
    <SafeAreaView style={{flex: 1, backgroundColor: c.window}} edges={['top', 'left', 'right']}>
      <DropSurface disabled={busy} onFiles={files => void workspace.importFiles(files)}>
        <Toolbar/>
        <View style={{flex: 1, flexDirection: 'row', minHeight: 0}}>
          <View style={{flex: 1, minWidth: 0}}>
            {composerReady ? <Thread components={threadComponents}/>
              : <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}><Txt variant="meta" tone="secondary" accessibilityLiveRegion="polite">Restoring your workspace…</Txt></View>}
          </View>
          {docked && <FilesPanel/>}
        </View>
        {!layout.panelDocks(width) && shell.overlayPanel && hasFiles && <FilesPanel overlay onClose={() => shell.setOverlayPanel(false)}/>}
      </DropSurface>
      <Palette/>
      <Sheets/>
    </SafeAreaView>
  </AssistantRuntimeProvider></ActivityPresenceContext.Provider></WorkspaceContext.Provider>;
}

/** In-window keyboard commands (UX_SPEC 15) for the web host. Text-editing keys are never taken
 * while the user is editing; ⌘Z undoes a result only outside text fields or in an empty composer.
 * Native Mac menu-bar commands belong to SHR-75; every command is also in the ⋯ menu. */
function useKeyboardCommands(w: ReturnType<typeof useWorkspace>, shell: ReturnType<typeof useShellState>, composer: {focus: () => void}) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      const editing = !!target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT');
      const composerEmpty = target?.getAttribute('aria-label') === 'Tell atePDF what to do' && !(target as HTMLTextAreaElement).value;
      const sheet = shell.settings !== null || shell.startOver || shell.quickLook !== null || shell.onboarding || shell.shortcuts;
      const run = (action: () => void) => {event.preventDefault(); action();};
      const key = event.key.toLowerCase();
      if (key === ',') return run(() => shell.openSettings('general'));
      if (sheet) return;
      if (key === 'o' && !event.shiftKey) return run(() => {if (!w.busy) void w.pick();});
      if (key === 'k') return run(() => shell.setPalette(!shell.palette));
      if (event.code === 'KeyI' && event.altKey) return run(() => {const hasFiles = w.store.list.length > 0; if (!hasFiles) return; if (window.innerWidth >= 1120) shell.setFilesPanel(shell.filesPanel === false); else shell.setOverlayPanel(!shell.overlayPanel);});
      if (key === '.') return run(() => {if (w.working) w.cancel();});
      if (key === '/') return run(() => shell.setShortcuts(true));
      if (key === 'l') return run(composer.focus);
      if (key === 'backspace' && event.shiftKey) return run(() => {if (!w.state.busy && !w.restoring && w.entries.length) shell.setStartOver(true);});
      if (key === 's' && !event.shiftKey) return run(() => {const entry = w.entries.find(item => item.id === w.current); if (entry?.artifact && !w.saving) void w.exportResult(entry.artifact);});
      if (key === 'z' && !event.shiftKey && (!editing || composerEmpty) && w.store.canUndo && !w.busy) return run(w.undo);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [w, shell, composer]);
}
