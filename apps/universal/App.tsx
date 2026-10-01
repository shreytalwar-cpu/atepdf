import React, {useEffect, useMemo, useState} from 'react';
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
import {ActivityRow, EmptyWorkspace, EntryExtras, InlineBanner, isProposal, NoticeIcon, ProposalCard, SourceGroup} from './src/ui/conversation';
import {ActionPalette, AddFiles, ComposerActions, ComposerTop, FilesPanel, HintRow, Toolbar} from './src/ui/shell';
import {OnboardingSheet, QuickLookSheet, SettingsSheet, ShortcutsSheet, StartOverSheet} from './src/ui/sheets';
import {clearThumbnails} from './src/ui/thumbnails';
import {Glyph, Txt} from './src/ui/primitives';
import {layout, radius, useTheme} from './src/ui/theme';

// atePDF (SHR-106): the approved SHR-105 Mac-first shell around the workspace. All document,
// job, planning, persistence and retention behaviour lives in useWorkspace; this file only
// presents it and routes commands back to it.
const convertEntry = (entry: Entry): ThreadMessageLike => ({id: String(entry.id), role: entry.role, content: [{type: 'text', text: entry.text}], metadata: {custom: {entryId: entry.id, hasArtifact: !!entry.artifact}}, ...(entry.id === -1 ? {status: {type: 'running' as const}} : {})});

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

/** C3 AssistantMessage: text on the window background, an outcome icon when it reports one, then its artifact. */
function AssistantMessage() {
  const entry = useEntry();
  if (!entry) return <MessageText/>;
  if (isProposal(entry)) return <ProposalCard entry={entry}/>;
  return <View style={{gap: 8}}>
    <View style={{flexDirection: 'row', alignItems: 'flex-start', gap: 8}}>
      <NoticeIcon notice={entry.notice}/>
      <View style={{flex: 1, minWidth: 0}}><MessageText/></View>
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

const threadComponents = {Welcome: EmptyWorkspace, UserMessage, AssistantMessage, Activity: ActivityRow, AddAttachment: AddFiles, ComposerTop, ComposerActions, Footer: HintRow, Banner, ComposerInput: Composer};

export default function App() {return <SafeAreaProvider style={{height: '100%'}}><Screen/></SafeAreaProvider>;}
function Screen() {
  const workspace = useWorkspace(), shell = useShellState();
  const {entries, busy, state} = workspace;
  const {c} = useTheme();
  const {width} = useWindowDimensions();
  const announcement = entries.findLast(entry => entry.role === 'assistant')?.text;
  useAnnounce(announcement);
  const messages = useMemo(() => busy ? [...entries, {id: -1, role: 'assistant' as const, text: state.busy ? state.message : workspace.planning ? 'Planning your request…' : 'Checking local setup…'}] : entries, [entries, busy, state.message, state.busy, workspace.planning]);
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
  useEffect(() => {if (workspace.clearCount) {runtime.thread.composer.setText(''); resetComposerInput(); clearThumbnails(); shell.setQuickLook(null); shell.setOverlayPanel(false);}}, [workspace.clearCount]);
  const composer = useMemo(() => ({fill: (text: string) => {runtime.thread.composer.setText(text); fillComposerInput(text);}, focus: focusComposerInput}), [runtime]);
  useKeyboardCommands(workspace, shell, composer);
  useEffect(() => {if (Platform.OS === 'web') document.title = 'atePDF';}, []);
  const hasFiles = workspace.store.list.length > 0;
  const docked = layout.panelDocks(width) && hasFiles && shell.filesPanel !== false;
  const context = useMemo(() => ({workspace, shell, composer}), [workspace, shell, composer]);
  return <WorkspaceContext.Provider value={context}><AssistantRuntimeProvider runtime={runtime}>
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
      <ActionPalette/>
      <SettingsSheet/>
      <StartOverSheet/>
      <QuickLookSheet/>
      <OnboardingSheet/>
      <ShortcutsSheet/>
    </SafeAreaView>
  </AssistantRuntimeProvider></WorkspaceContext.Provider>;
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
