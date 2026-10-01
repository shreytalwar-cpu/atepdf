// Window shell (COMPONENT_INVENTORY B1–B3, D1–D3): toolbar, Files panel and the composer's
// context row, suggestion chips, hint row and actions palette.
import {useMemo, useRef, useState} from 'react';
import {Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions} from 'react-native';
import {useAuiState} from '@assistant-ui/react-native';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import Cloud from 'lucide-react-native/icons/cloud';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import FileText from 'lucide-react-native/icons/file-text';
import Files from 'lucide-react-native/icons/files';
import LaptopMinimal from 'lucide-react-native/icons/laptop-minimal';
import PanelRight from 'lucide-react-native/icons/panel-right';
import Plus from 'lucide-react-native/icons/plus';
import Search from 'lucide-react-native/icons/search';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import X from 'lucide-react-native/icons/x';
import {SENSITIVE_DRAFT_MARKER, SECRET_CHAT_WARNING} from '@planner/privacy';
import {revealMessage} from '../components/assistant-ui/elements/thread.aui';
import {nativeEngineReady, ocrAvailable} from '../platform/runtime';
import {formatSize, pageCount} from '../workspace/useWorkspace';
import {facts, FileRow} from './conversation';
import {useApp, type Workspace} from './context';
import {Menu, Popover, StatusPill, useAnchor} from './overlays';
import {ActivityGlyph, Glyph, IconButton, Keycap, Row, Txt} from './primitives';
import {layout, radius, shadow, size, useTheme} from './theme';

export const isMac = Platform.OS === 'web' || (Platform.OS === 'ios' && Platform.isMacCatalyst);
export const SHORTCUTS = Platform.OS === 'web';

/** The request the next message applies to (UX_STATE_CONTRACT: one current result, else the sources). */
export function target(w: Workspace) {
  if (w.focus) return {kind: 'result' as const, title: w.currentTitle ?? 'Your PDF', detail: pageCount(w.focus.pageCount)};
  const originals = w.store.originals.map(ref => {try {return w.store.get(ref).meta;} catch {return null;}}).filter(meta => meta !== null);
  if (!originals.length) return null;
  const pages = originals.reduce((sum, meta) => sum + meta!.pageCount, 0);
  return {kind: 'sources' as const, title: originals.length === 1 ? originals[0]!.name : `${originals.length} PDFs`, detail: pageCount(pages)};
}

/** B1 WindowToolbar: context leading; privacy, Files panel and More trailing. No logo, no title text. */
export function Toolbar() {
  const {workspace: w, shell} = useApp();
  const {c} = useTheme();
  const {width} = useWindowDimensions();
  const compact = layout.compact(width);
  const [privacyRef, privacyRect, measurePrivacy] = useAnchor<View>();
  const [moreRef, moreRect, measureMore] = useAnchor<View>();
  const [privacyOpen, setPrivacyOpen] = useState(false), [moreOpen, setMoreOpen] = useState(false);
  const hasFiles = w.store.list.length > 0;
  const docked = layout.panelDocks(width);
  const panelShown = docked ? hasFiles && shell.filesPanel !== false : shell.overlayPanel;
  const togglePanel = () => {if (docked) shell.setFilesPanel(!panelShown); else shell.setOverlayPanel(!shell.overlayPanel);};
  return <View accessibilityRole="toolbar" aria-label="Toolbar" style={{height: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: TOOLBAR_LEADING, paddingRight: 12, borderBottomWidth: 1, borderBottomColor: c.hairline, backgroundColor: c.window}}>
    <WorkspaceContextButton onPress={togglePanel}/>
    <View style={{flex: 1}}/>
    <StatusPill ref={privacyRef} compact={compact} label="On this Mac" accessibilityLabel="Processed on your device" hint="How atePDF handles your files" onPress={() => void measurePrivacy().then(() => setPrivacyOpen(true))}/>
    <IconButton icon={PanelRight} label="Files panel" accessibilityHint={hasFiles ? 'Shows or hides your files and results' : 'Add files to see them here'} toggled={panelShown} disabled={!hasFiles} onPress={togglePanel}/>
    <IconButton ref={moreRef} icon={Ellipsis} label="More" onPress={() => void measureMore().then(() => setMoreOpen(true))}/>
    <Popover visible={privacyOpen} anchor={privacyRect} onClose={() => setPrivacyOpen(false)} label="How atePDF handles your files" width={320}>
      <PrivacySummary onSettings={() => {setPrivacyOpen(false); shell.openSettings('privacy');}}/>
    </Popover>
    <Menu visible={moreOpen} anchor={moreRect} onClose={() => setMoreOpen(false)} label="More" items={[
      {label: 'Add Files…', shortcut: SHORTCUTS ? '⌘O' : undefined, disabled: w.busy, onPress: () => void w.pick()},
      {label: 'Actions…', shortcut: SHORTCUTS ? '⌘K' : undefined, onPress: () => shell.setPalette(true)},
      {label: 'Start Over…', shortcut: SHORTCUTS ? '⇧⌘⌫' : undefined, disabled: w.state.busy || w.restoring || (!w.entries.length && !w.loading && !w.planning), destructive: true, onPress: () => shell.setStartOver(true)},
      'separator',
      {label: 'Settings…', shortcut: SHORTCUTS ? '⌘,' : undefined, onPress: () => shell.openSettings('general')},
      {label: 'Keyboard Shortcuts', shortcut: SHORTCUTS ? '⌘/' : undefined, onPress: () => shell.setShortcuts(true)},
      {label: 'What can atePDF do?', disabled: w.busy, onPress: w.showHelp},
      {label: 'Introduction', onPress: () => shell.setOnboarding(true)},
    ]}/>
  </View>;
}
// The toolbar sits below the Catalyst title bar (which holds the traffic lights), so it needs no inset.
export const TOOLBAR_LEADING = 16;

/** E7 PrivacyPopover content. States only what the current build does. */
export function PrivacySummary({onSettings, heading = true}: {onSettings?: () => void; heading?: boolean}) {
  return <View style={{gap: 10, padding: heading ? 8 : 14}}>
    {heading && <Txt variant="headline">How atePDF handles your files</Txt>}
    {[
      {icon: LaptopMinimal, tone: 'local' as const, text: 'Your PDFs, previews and recognised text are processed on this Mac.'},
      {icon: Cloud, tone: 'secondary' as const, text: 'When atePDF AI is connected, your typed instruction and anonymous file facts (page counts, sizes) are sent to plan the steps. File contents, names, paths and passwords are not.'},
      {icon: ArrowUpRight, tone: 'outbound' as const, text: 'Saving to a cloud folder or sharing through another app may transfer the saved file outside atePDF.'},
    ].map(item => <View key={item.text} style={{flexDirection: 'row', gap: 8}}>
      <View style={{paddingTop: 1}}><Glyph icon={item.icon} tone={item.tone}/></View>
      <Txt variant="ui" tone={item.tone === 'local' ? 'primary' : 'secondary'} style={{flex: 1}}>{item.text}</Txt>
    </View>)}
    {onSettings && <Pressable accessibilityRole="link" onPress={onSettings} style={{alignSelf: 'flex-start'}}><Txt variant="ui" tone="accent">Privacy & Storage settings</Txt></Pressable>}
  </View>;
}

/** B2 WorkspaceContext: what the next instruction applies to; busy shows the stage. */
function WorkspaceContextButton({onPress}: {onPress: () => void}) {
  const {workspace: w} = useApp();
  const {c} = useTheme();
  const current = target(w);
  const label = w.restoring ? 'Restoring…' : w.working ? w.planning ? 'Planning…' : w.state.busy ? 'Working…' : 'Getting ready…' : current ? current.title : 'No files yet';
  const detail = !w.working && current ? current.detail : undefined;
  const disabled = !current;
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    accessibilityLabel={current ? `Working on: ${current.title}${current.kind === 'result' ? ', current result' : ''}, ${current.detail}. Show files.` : 'No files yet'}
    style={({pressed}) => ({flexShrink: 1, minWidth: 0, height: 28, paddingHorizontal: 8, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: pressed ? c.pressed : 'transparent'})}>
    {w.working ? <ActivityGlyph/> : <Glyph icon={current?.kind === 'result' ? FileText : Files} tone={current ? 'secondary' : 'tertiary'}/>}
    <Txt variant="uiStrong" tone={current || w.working ? 'primary' : 'tertiary'} numberOfLines={1} ellipsizeMode="middle" style={{flexShrink: 1}}>{label}</Txt>
    {detail && <Txt variant="meta" tone="secondary" tabular numberOfLines={1}>{detail}</Txt>}
    {!disabled && <Glyph icon={ChevronDown} size={14} tone="tertiary"/>}
  </Pressable>;
}

/** B3 FilesPanel: results (current first) and sources in merge order. Not a file manager. */
export function FilesPanel({overlay = false, onClose}: {overlay?: boolean; onClose?: () => void}) {
  const {workspace: w, shell} = useApp();
  const {c, scheme} = useTheme();
  const results = useMemo(() => {
    const seen = new Set<string>(), list: {ref: string; title: string; entry: number}[] = [];
    for (const entry of [...w.entries].reverse()) {
      const ref = entry.artifact?.ref;
      if (!ref || seen.has(ref) || !w.store.list.some(file => file.ref === ref)) continue;
      seen.add(ref); list.push({ref, title: entry.resultTitle ?? 'Your PDF', entry: entry.id});
    }
    return list.sort((a, b) => (b.ref === w.store.focus ? 1 : 0) - (a.ref === w.store.focus ? 1 : 0));
  }, [w.entries, w.store, w.store.focus, w.state]);
  const sources = w.store.originals.map(ref => {try {return w.store.get(ref).meta;} catch {return null;}}).filter(meta => meta !== null);
  const importEntry = (ref: string) => w.entries.find(entry => entry.files?.some(file => file.ref === ref))?.id;
  const usage = w.storage.workspace;
  return <View accessibilityRole="summary" aria-label="Files" style={[{width: size['panel.files.default'], backgroundColor: overlay ? c.elevated : c.panel, borderLeftWidth: 1, borderLeftColor: c.hairline},
    overlay && {position: 'absolute', top: 60, right: 8, bottom: 8, borderRadius: radius.xl, borderWidth: 1, borderColor: c.hairline, overflow: 'hidden', zIndex: 20, ...shadow('3', scheme)}]}>
    <View style={{height: 36, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14}}>
      <Txt variant="section" tone="secondary" accessibilityRole="header" style={{flex: 1}}>Files</Txt>
      {overlay && onClose && <IconButton size="inline" icon={X} label="Close Files panel" onPress={onClose}/>}
    </View>
    <ScrollView style={{flex: 1}} contentContainerStyle={{paddingHorizontal: 6, paddingBottom: 12, gap: 12}}>
      {results.length > 0 && <View style={{gap: 2}}>
        <Txt variant="section" tone="tertiary" accessibilityRole="header" style={{paddingHorizontal: 8, paddingVertical: 4}}>Results</Txt>
        {results.map(result => {const meta = w.store.get(result.ref).meta, current = result.ref === w.store.focus; return <FileRow key={result.ref} name={result.title}
          tag={current ? 'current' : 'earlier'} detail={facts(meta.pageCount, meta.sizeBytes)} fileRef={result.ref} checksum={meta.checksum}
          onPress={() => {revealMessage(String(result.entry)); onClose?.();}}
          onPreview={() => shell.setQuickLook({ref: result.ref, title: result.title})}
          onSave={() => void w.exportResult({ref: meta.ref, pageCount: meta.pageCount, sizeBytes: meta.sizeBytes, note: meta.note})} saving={!!w.saving}/>;})}
      </View>}
      {sources.length > 0 && <View style={{gap: 2}}>
        <Txt variant="section" tone="tertiary" accessibilityRole="header" style={{paddingHorizontal: 8, paddingVertical: 4}}>Sources · merge order</Txt>
        {sources.map((meta, index) => <FileRow key={meta!.ref} name={meta!.name} order={index + 1} total={sources.length} detail={facts(meta!.pageCount, meta!.sizeBytes)}
          fileRef={meta!.ref} checksum={meta!.checksum} onPress={() => {const id = importEntry(meta!.ref); if (id !== undefined) revealMessage(String(id)); onClose?.();}}
          onPreview={() => shell.setQuickLook({ref: meta!.ref, title: meta!.name})}/>)}
      </View>}
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel="Privacy & Storage settings" onPress={() => shell.openSettings('privacy')}
      style={({pressed}) => ({flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.hairline, backgroundColor: pressed ? c.pressed : 'transparent'})}>
      <Glyph icon={LaptopMinimal} size={14} tone="local"/>
      <Txt variant="meta" tone="secondary" tabular>{w.durable ? w.keeping ? 'Kept on this Mac' : 'Until atePDF quits' : 'This session only'}{usage && !usage.unopened ? ` · ${formatSize(usage.total)}` : ''}</Txt>
    </Pressable>
  </View>;
}

/** D1 context row: what the next request applies to, or the open question. */
export function ComposerTop() {
  const {workspace: w} = useApp();
  const {c} = useTheme();
  const current = target(w);
  const question = w.question !== null ? w.entries.find(entry => entry.id === w.question)?.text : undefined;
  if (!current && !question) return null;
  return <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 8, flexWrap: 'wrap'}}>
    {question ? <Txt variant="meta" tone="secondary" numberOfLines={1} style={{flexShrink: 1}}>Answering: {question}</Txt> : current && <View
      accessible accessibilityLabel={`Your next request applies to ${current.title}, ${current.detail}`}
      style={{height: 22, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, borderRadius: radius.sm, backgroundColor: c.sunken, maxWidth: '100%'}}>
      <Glyph icon={current.kind === 'result' ? FileText : Files} size={12} tone="secondary"/>
      <Txt testID="current-context" variant="meta" tone="primary" numberOfLines={1} ellipsizeMode="middle" style={{flexShrink: 1}}>{current.kind === 'result' ? `${current.title} · ${current.detail}` : `${current.title} · ${current.detail}`}</Txt>
    </View>}
  </View>;
}

export type Suggestion = {name: string; label: string; request?: string; fill?: string; disabled?: string};
/** Context-aware quick actions from the runtime capabilities. Each becomes a conversational request. */
export function suggestions(w: Workspace): Suggestion[] {
  const originals = w.store.originals.length, current = !!w.focus;
  if (!originals && !current) return [];
  const list: Suggestion[] = [];
  if (originals >= 2 && !current) list.push({name: 'Merge', label: `Merge ${originals} PDFs in this order`, request: 'Merge these PDFs'});
  if (current || originals === 1) {
    list.push({name: 'Compress', label: 'Compress', request: 'Compress'});
    if (ocrAvailable) list.push({name: 'Make searchable', label: 'Make searchable', request: 'Make searchable'});
    list.push({name: 'Remove pages…', label: 'Remove pages…', fill: 'Remove page '});
  }
  return list.slice(0, 3);
}
export function allActions(w: Workspace): Suggestion[] {
  const originals = w.store.originals.length, current = !!w.focus;
  const single = current || originals === 1;
  return [
    {name: 'Merge', label: 'Merge PDFs in order', request: 'Merge these PDFs', disabled: originals < 2 ? 'Needs 2 or more PDFs' : undefined},
    {name: 'Remove pages…', label: 'Remove pages…', fill: 'Remove page ', disabled: !single ? 'Needs one PDF or a current result' : undefined},
    {name: 'Compress', label: 'Compress images', request: 'Compress', disabled: !single ? 'Needs one PDF or a current result' : undefined},
    {name: 'Make searchable', label: 'Make scanned pages searchable', request: 'Make searchable', disabled: !ocrAvailable ? 'Not available in this build' : !single ? 'Needs one PDF or a current result' : undefined},
  ];
}

/** D2 SuggestionChips. Sent through the same path as typed text (D-04, CONV-01): never a direct engine call. */
export function ComposerActions() {
  const {workspace: w, shell, composer} = useApp();
  const {c} = useTheme();
  const empty = useAuiState(s => s.composer.isEmpty);
  const {width} = useWindowDimensions();
  const chips = suggestions(w).slice(0, layout.compact(width) ? 2 : 3);
  const disabled = w.busy || !nativeEngineReady;
  const run = (item: Suggestion) => {if (item.request) w.submit(item.request); else if (item.fill) composer.fill(item.fill);};
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 6, alignItems: 'center'}} style={{flexGrow: 0}}>
    {empty && chips.map(item => <Pressable key={item.name} accessibilityRole="button" accessibilityLabel={item.name} accessibilityHint={item.fill ? 'Starts the request in the message field' : 'Sends this request'}
      disabled={disabled} aria-disabled={disabled} onPress={() => run(item)}
      style={({pressed}) => ({height: 24, paddingHorizontal: 8, borderRadius: radius.sm, justifyContent: 'center', backgroundColor: pressed ? c.pressed : c.sunken, opacity: disabled ? 0.5 : 1})}>
      <Txt variant="meta" tone={disabled ? 'disabled' : 'primary'} numberOfLines={1}>{item.label}</Txt>
    </Pressable>)}
    <Pressable accessibilityRole="button" accessibilityLabel="More actions" accessibilityHint="Opens the actions palette" onPress={() => shell.setPalette(true)}
      style={({pressed}) => ({height: 24, paddingHorizontal: 6, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: pressed ? c.pressed : 'transparent'})}>
      {SHORTCUTS ? <Keycap>⌘K</Keycap> : <Glyph icon={Search} size={14} tone="tertiary"/>}
      <Txt variant="meta" tone="tertiary">Actions</Txt>
    </Pressable>
  </ScrollView>;
}

/** D1 attach control. */
export function AddFiles() {
  const {workspace: w} = useApp();
  return <IconButton icon={Plus} label="Add files" accessibilityHint={SHORTCUTS ? 'Choose PDFs, ⌘O' : 'Choose PDFs'} disabled={w.busy} onPress={() => void w.pick()}/>;
}

/** Below the composer: keyboard hints, or why sending is paused, or the secret warning. */
export function HintRow() {
  const {workspace: w} = useApp();
  const text = useAuiState(s => s.composer.text);
  const secret = text.includes(SENSITIVE_DRAFT_MARKER);
  if (secret) return <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12}}><Glyph icon={TriangleAlert} size={14} tone="warning"/><Txt variant="meta" tone="warning">{SECRET_CHAT_WARNING}</Txt></View>;
  const message = w.working ? 'Finish or stop the current task first. You can keep typing.' : text ? null : Platform.OS === 'web' ? 'Return to send · ⇧Return for a new line · ⌘K for actions' : 'Return to send';
  return <View style={{minHeight: 16, paddingHorizontal: 12}}>{message && <Txt variant="meta" tone="tertiary">{message}</Txt>}</View>;
}

/** D3 ActionPalette (⌘K). Capability rows become sentences in the conversation; workspace rows run locally. */
export function ActionPalette() {
  const {workspace: w, shell, composer} = useApp();
  const {c, scheme} = useTheme();
  const window = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<TextInput>(null);
  if (!shell.palette) return null;
  const close = () => {shell.setPalette(false); setQuery(''); setActive(0);};
  const busy = w.busy || !nativeEngineReady;
  type Item = {section: string; label: string; detail?: string; shortcut?: string; disabled?: string; run: () => void};
  const run = (item: Suggestion) => () => {if (item.request) w.submit(item.request); else if (item.fill) composer.fill(item.fill);};
  const items: Item[] = [
    ...suggestions(w).map(item => ({section: 'Suggested', label: item.label, detail: w.focus ? 'current result' : `${w.store.originals.length} PDFs`, disabled: busy ? 'Finish the current task first' : undefined, run: run(item)})),
    ...allActions(w).map(item => ({section: 'All actions', label: item.label, disabled: item.disabled ?? (busy ? 'Finish the current task first' : undefined), run: run(item)})),
    {section: 'Workspace', label: 'Add Files…', shortcut: SHORTCUTS ? '⌘O' : undefined, disabled: w.busy ? 'Finish the current task first' : undefined, run: () => void w.pick()},
    ...(w.focus && w.current !== undefined ? [{section: 'Workspace', label: 'Save Result…', shortcut: SHORTCUTS ? '⌘S' : undefined, run: () => {const entry = w.entries.find(e => e.id === w.current); if (entry?.artifact) void w.exportResult(entry.artifact);}}] : []),
    {section: 'Workspace', label: 'What can atePDF do?', disabled: w.busy ? 'Finish the current task first' : undefined, run: w.showHelp},
    {section: 'Workspace', label: 'Privacy & Storage…', run: () => shell.openSettings('privacy')},
    {section: 'Workspace', label: 'Settings…', shortcut: SHORTCUTS ? '⌘,' : undefined, run: () => shell.openSettings('general')},
    {section: 'Workspace', label: 'Start Over…', disabled: w.state.busy || w.restoring || !w.entries.length ? 'Nothing to clear' : undefined, run: () => shell.setStartOver(true)},
  ];
  const needle = query.trim().toLowerCase();
  const visible = items.filter(item => !needle || item.label.toLowerCase().includes(needle));
  const enabled = visible.filter(item => !item.disabled);
  const choose = (item: Item | undefined) => {if (!item || item.disabled) return; close(); item.run();};
  const width = Math.min(560, window.width - 32);
  let section = '';
  return <Popover visible anchor={{x: (window.width - width) / 2, y: window.height - 150, width, height: 0}} align="start" placement="above" width={width} onClose={close} label="Actions">
    <View style={{gap: 6}}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, height: 32, borderBottomWidth: 1, borderBottomColor: c.hairline}}>
        <Glyph icon={Search} tone="tertiary"/>
        <TextInput ref={input} autoFocus value={query} onChangeText={text => {setQuery(text); setActive(0);}} placeholder="Search actions…" placeholderTextColor={c.inkTertiary}
          accessibilityLabel="Search actions" style={{flex: 1, color: c.ink, fontSize: 13, height: 32, outlineStyle: 'none'} as never}
          onKeyPress={event => {
            const key = event.nativeEvent.key;
            if (key === 'ArrowDown') {event.preventDefault?.(); setActive(index => Math.min(enabled.length - 1, index + 1));}
            else if (key === 'ArrowUp') {event.preventDefault?.(); setActive(index => Math.max(0, index - 1));}
            else if (key === 'Enter') {event.preventDefault?.(); choose(enabled[active]);}
            else if (key === 'Escape') close();
          }}/>
      </View>
      <ScrollView style={{maxHeight: 8 * 32 + 60}} keyboardShouldPersistTaps="handled">
        {visible.map(item => {
          const header = item.section !== section ? (section = item.section) : null;
          const selected = !item.disabled && enabled[active] === item;
          return <View key={`${item.section}:${item.label}`}>
            {header && <Txt variant="section" tone="tertiary" style={{paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4}}>{header}</Txt>}
            <Row selected={selected} disabled={!!item.disabled} accessibilityRole="button" accessibilityLabel={item.label} accessibilityHint={item.disabled} accessibilityState={{disabled: !!item.disabled}} onPress={() => choose(item)}>
              <Txt variant="ui" tone={item.disabled ? 'disabled' : 'primary'} style={{flex: 1}}>{item.label}</Txt>
              {item.disabled ? <Txt variant="meta" tone="tertiary">{item.disabled}</Txt> : item.detail ? <Txt variant="meta" tone="tertiary">{item.detail}</Txt> : null}
              {item.shortcut && <Keycap>{item.shortcut}</Keycap>}
            </Row>
          </View>;
        })}
        {!visible.length && <Txt variant="ui" tone="secondary" style={{padding: 8}}>No matching actions.</Txt>}
      </ScrollView>
    </View>
  </Popover>;
}
