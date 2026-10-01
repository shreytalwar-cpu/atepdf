// Sheets (COMPONENT_INVENTORY E1, E3–E5, E8). Settings is an in-window sheet (OD-7).
import {useEffect, useMemo, useState} from 'react';
import {Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import ArrowDownToLine from 'lucide-react-native/icons/arrow-down-to-line';
import Cloud from 'lucide-react-native/icons/cloud';
import Info from 'lucide-react-native/icons/info';
import KeyRound from 'lucide-react-native/icons/key-round';
import LaptopMinimal from 'lucide-react-native/icons/laptop-minimal';
import Settings2 from 'lucide-react-native/icons/settings-2';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import X from 'lucide-react-native/icons/x';
import type {LucideIcon} from 'lucide-react-native';
import {createNativePairing, disconnectNativePlanner, pairNativePlanner, plannerAvailable, savePlannerKey} from '../platform/planner';
import {PrivacyStorage} from '../platform/PrivacyStorage';
import Preview from '../platform/Preview';
import {BrandMark} from './BrandMark';
import {facts} from './conversation';
import {useApp, type SettingsTab} from './context';
import {Sheet} from './overlays';
import {Button, Glyph, IconButton, Keycap, Row, Section, SegmentedControl, Separator, Tag, Txt} from './primitives';
import {SHORTCUTS} from './shell';
import {radius, setAppearance, setTextSize, useAppearance, useTextSize, useTheme, type Appearance, type TextSize} from './theme';

const TABS: {id: SettingsTab; label: string; icon: LucideIcon}[] = [
  {id: 'general', label: 'General', icon: Settings2},
  {id: 'privacy', label: 'Privacy & Storage', icon: ShieldCheck},
  {id: 'ai', label: 'AI', icon: Cloud},
  {id: 'about', label: 'About', icon: Info},
];

/** E4 SettingsSheet: General · Privacy & Storage · AI · About. Only settings that exist today. */
export function SettingsSheet() {
  const {workspace: w, shell} = useApp();
  const {c} = useTheme();
  const tab = shell.settings;
  // Privacy & Storage visible: the workspace measures storage while it is showing.
  useEffect(() => {w.setPrivacy(tab === 'privacy');}, [tab]);
  return <Sheet visible={tab !== null} onClose={shell.closeSettings} title="Settings" width={760} height={560} hideTitle scroll={false} bodyPadding={0} testID="settings">
    <View style={{flex: 1}}>
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 12, paddingBottom: 10, paddingHorizontal: 44, borderBottomWidth: 1, borderBottomColor: c.hairline, gap: 4}}>
        <View accessibilityRole="tablist" style={{flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'center'}}>
          {TABS.map(item => {const selected = item.id === tab; return <Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{selected}} aria-selected={selected} onPress={() => shell.openSettings(item.id)}
            style={({pressed}) => ({minWidth: 72, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, alignItems: 'center', gap: 3, backgroundColor: selected ? c.selected : pressed ? c.pressed : 'transparent'})}>
            <Glyph icon={item.icon} size={20} tone={selected ? 'accent' : 'secondary'}/>
            <Txt variant={selected ? 'uiStrong' : 'ui'} tone={selected ? 'accent' : 'secondary'}>{item.label}</Txt>
          </Pressable>;})}
        </View>
        <View style={{position: 'absolute', right: 12, top: 12}}><IconButton icon={X} label="Close settings" onPress={shell.closeSettings}/></View>
      </View>
      <PaneScroll>
        {tab === 'general' && <GeneralPane/>}
        {tab === 'privacy' && <PrivacyStorage visible onClose={shell.closeSettings} capable={w.capable} retention={w.retention} retentionNote={w.retentionNote} busy={w.working} exporting={!!w.saving} ready={!w.restoring}
          storage={w.storage} impact={w.retentionImpact} onRetention={w.changeRetention} onDelete={w.deleteLocalData} deleting={w.deleting} status={w.storageStatus}
          onStartOver={() => {shell.closeSettings(); shell.setStartOver(true);}} canStartOver={!w.state.busy && !w.restoring && (!!w.entries.length || w.loading || w.planning)}/>}
        {tab === 'ai' && <AIPane/>}
        {tab === 'about' && <AboutPane/>}
      </PaneScroll>
    </View>
  </Sheet>;
}
function PaneScroll({children}: {children: React.ReactNode}) {
  return <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 20, gap: 20}} keyboardShouldPersistTaps="handled">{children}</ScrollView>;
}
function SettingRow({label, detail, children}: {label: string; detail?: string; children?: React.ReactNode}) {
  return <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40, paddingVertical: 6, paddingHorizontal: 14, flexWrap: 'wrap'}}>
    <View style={{flex: 1, minWidth: 160}}><Txt variant="ui">{label}</Txt>{detail && <Txt variant="meta" tone="secondary">{detail}</Txt>}</View>
    {children}
  </View>;
}

function GeneralPane() {
  const {shell} = useApp();
  const appearance = useAppearance(), size = useTextSize();
  return <>
    <Section title="Appearance">
      <SettingRow label="Appearance" detail="Follows your Mac unless you choose. Applies for this session.">
        <SegmentedControl<Appearance> label="Appearance" value={appearance} onChange={setAppearance} options={[{value: 'system', label: 'System'}, {value: 'light', label: 'Light'}, {value: 'dark', label: 'Dark'}]}/>
      </SettingRow>
      <Separator inset={14}/>
      <SettingRow label="Conversation text size" detail="Controls stay at the standard size.">
        <SegmentedControl<TextSize> label="Conversation text size" value={size} onChange={setTextSize} options={[{value: 'small', label: 'Small'}, {value: 'default', label: 'Default'}, {value: 'large', label: 'Large'}, {value: 'larger', label: 'Larger'}]}/>
      </SettingRow>
    </Section>
    <Section title="Help">
      <SettingRow label="Introduction" detail="A short tour of how atePDF works."><Button variant="secondary" label="Show Introduction" onPress={() => {shell.closeSettings(); shell.setOnboarding(true);}}/></SettingRow>
      <Separator inset={14}/>
      <SettingRow label="Keyboard shortcuts"><Button variant="secondary" label="View All…" onPress={() => {shell.closeSettings(); shell.setShortcuts(true);}}/></SettingRow>
    </Section>
  </>;
}

/** Settings ▸ AI: what planning sends, and (in development builds) the local planner connection. */
function AIPane() {
  const {workspace: w} = useApp();
  const [check, setCheck] = useState<'checking' | 'ready' | 'unavailable' | null>(null);
  const inspect = () => {setCheck('checking'); void w.inspectConnection().then(result => setCheck(result === 'stale' ? null : result));};
  useEffect(() => {if (plannerAvailable) inspect();}, []);
  const connection = w.connection;
  const status = !plannerAvailable ? 'Not available on this device' : check === 'checking' ? 'Checking…' : check === 'unavailable' ? 'Unavailable' : !connection ? 'Not checked' : connection.enabled ? `Connected · up to ${connection.remaining} approved requests` : connection.connected ? 'Paused' : 'Not connected';
  return <>
    <Section title="atePDF AI">
      <SettingRow label="Status" detail={connection && !connection.enabled && connection.connected ? 'Paid planning is paused until you approve a request limit in the local setup.' : undefined}>
        <Txt variant="ui" tone="secondary" accessibilityLiveRegion="polite">{status}</Txt>
        {plannerAvailable && <Button variant="secondary" label="Check Again" busy={check === 'checking' && 'Checking…'} onPress={inspect}/>}
      </SettingRow>
    </Section>
    <Section title="What’s sent to plan your requests">
      <View style={{padding: 14, gap: 10}}>
        <View style={{flexDirection: 'row', gap: 8}}><Glyph icon={Cloud}/><Txt variant="ui" style={{flex: 1}}>Your typed instruction and anonymous file facts (page counts, sizes and file references). Suggested actions are sent the same way, as requests.</Txt></View>
        <View style={{flexDirection: 'row', gap: 8}}><Glyph icon={LaptopMinimal} tone="local"/><Txt variant="ui" style={{flex: 1}}>Never sent: file contents, file names, paths, checksums, page text, previews or passwords. PDF work itself always runs on this Mac.</Txt></View>
        <View style={{flexDirection: 'row', gap: 8}}><Glyph icon={Info}/><Txt variant="ui" tone="secondary" style={{flex: 1}}>Without an AI connection, simple requests such as “merge”, “compress”, “make searchable”, “remove page 2” or “undo” still run on this Mac.</Txt></View>
      </View>
    </Section>
    {plannerAvailable && <DeveloperConnection/>}
  </>;
}

/** Development builds: the local planner key, browser pairing code and native pairing (moved out of the chat). */
function DeveloperConnection() {
  const {workspace: w} = useApp();
  const token = w.connectionToken.current;
  const connection = w.connection;
  return <Section title="Developer connection">
    <View style={{padding: 14, gap: 12}}>
      <Txt variant="meta" tone="secondary">For development builds that plan through the local atePDF server on this Mac. Keys stay in that server, outside the app.</Txt>
      {Platform.OS !== 'web' ? <NativePairing/> : !connection ? <Txt variant="ui" tone="secondary">Check the connection to set it up.</Txt> : !connection.connected && token ? <KeyEntry token={token}/> : token ? <BrowserPairing token={token}/> : null}
    </View>
  </Section>;
}
function SecureField({label, value, onChange, editable = true, placeholder}: {label: string; value: string; onChange?: (value: string) => void; editable?: boolean; placeholder?: string}) {
  const {c} = useTheme();
  return <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: c.strong, backgroundColor: c.raised}}>
    <Glyph icon={KeyRound} size={14}/>
    <TextInput accessibilityLabel={label} secureTextEntry autoComplete="off" autoCorrect={false} autoCapitalize="none" textContentType="none" value={value} onChangeText={onChange} editable={editable} readOnly={!onChange}
      placeholder={placeholder} placeholderTextColor={c.inkTertiary} style={{flex: 1, color: c.ink, fontSize: 13, outlineStyle: 'none'} as never}/>
  </View>;
}
function KeyEntry({token}: {token: string}) {
  const {workspace: w} = useApp();
  const [key, setKey] = useState(''), [saving, setSaving] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const saveKey = async () => {
    if (saving || !key.trim()) return; const current = w.session.ticket(); setSaving(true); setError(''); setMessage('');
    try {await savePlannerKey(key.trim(), token); if (!current()) return; setKey(''); void w.refreshConnection(current); setMessage('Your key is saved on this computer. Paid planning is paused until you approve a request limit.');}
    catch {setKey(''); if (!current()) return; setError('The key could not be saved. Check its format or your existing local setup.');}
    finally {setSaving(false);}
  };
  return <View style={{gap: 8}}>
    <Txt variant="uiStrong">OpenAI project key</Txt>
    <SecureField label="OpenAI project key" value={key} onChange={setKey} editable={!saving} placeholder="Paste your key here"/>
    <Txt variant="meta" tone="secondary">Private local setup · no API calls are made. The key is not checked with OpenAI yet.</Txt>
    {!!error && <Txt variant="meta" tone="danger" accessibilityLiveRegion="polite">{error}</Txt>}
    {!!message && <Txt variant="meta" tone="success" accessibilityLiveRegion="polite">{message}</Txt>}
    <View style={{flexDirection: 'row'}}><Button variant="primary" label={saving ? 'Saving key…' : 'Save Key on This Computer'} accessibilityLabel="Save key on this computer" disabled={saving || !key.trim()} onPress={() => void saveKey()}/></View>
  </View>;
}
function BrowserPairing({token}: {token: string}) {
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const generate = async () => {setBusy(true); setCode(''); setMessage(''); try {const pairing = await createNativePairing(token); setCode(pairing.code); setMessage('Valid once, for five minutes. Paste it in your app’s AI settings.');} catch {setMessage('A code could not be created. Try again.');} finally {setBusy(false);}};
  return <View style={{gap: 8}}>
    <Txt variant="uiStrong">Connect an Apple device</Txt>
    <Txt variant="meta" tone="secondary">Pair the native app with this local planner. Your OpenAI key stays on this computer.</Txt>
    <View style={{flexDirection: 'row', gap: 8, flexWrap: 'wrap'}}>
      <Button variant="secondary" label="Create Pairing Code" accessibilityLabel="Create pairing code" disabled={busy} onPress={() => void generate()}/>
      {!!code && <Button variant="secondary" label="Copy Pairing Code" accessibilityLabel="Copy pairing code" onPress={() => {void Clipboard.setStringAsync(code); setMessage('Copied. Paste it in the native app’s AI settings.');}}/>}
    </View>
    {!!code && <SecureField label="Native pairing code" value={code}/>}
    {!!message && <Txt variant="meta" tone="secondary" accessibilityLiveRegion="polite">{message}</Txt>}
  </View>;
}
function NativePairing() {
  const {workspace: w} = useApp();
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const pair = async () => {const current = w.session.ticket(); setBusy(true); setError(''); setMessage(''); try {await pairNativePlanner(code); if (!current()) return; setCode(''); await w.refreshConnection(current); if (current()) setMessage('Connected to the local planner.');} catch {if (!current()) return; setCode(''); setError('Pairing did not finish. Create a fresh code in the browser and try again.');} finally {setBusy(false);}};
  const disconnect = async () => {const current = w.session.ticket(); setBusy(true); try {await disconnectNativePlanner(); if (!current()) return; await w.refreshConnection(current); if (current()) setMessage('Disconnected. Simple requests still run on this Mac.');} finally {setBusy(false);}};
  if (w.connection && !w.connection.pairingRequired) return <View style={{gap: 8}}>
    <Txt variant="ui">This app is paired with the planner on your Mac.</Txt>
    <View style={{flexDirection: 'row'}}><Button variant="secondary" label="Disconnect This App" accessibilityLabel="Disconnect this app" disabled={busy} onPress={() => void disconnect()}/></View>
    {!!message && <Txt variant="meta" tone="secondary" accessibilityLiveRegion="polite">{message}</Txt>}
  </View>;
  return <View style={{gap: 8}}>
    <Txt variant="uiStrong">Pairing code</Txt>
    <Txt variant="meta" tone="secondary">Create a pairing code in the atePDF browser setup on this Mac, then paste it here. The connection lasts for this app session.</Txt>
    <SecureField label="Pairing code" value={code} onChange={setCode} editable={!busy} placeholder="Paste pairing code"/>
    <View style={{flexDirection: 'row'}}><Button variant="primary" label="Connect This App" accessibilityLabel="Connect this app" disabled={busy || !code.trim()} onPress={() => void pair()}/></View>
    {!!error && <Txt variant="meta" tone="danger">{error}</Txt>}
    {!!message && <Txt variant="meta" tone="success" accessibilityLiveRegion="polite">{message}</Txt>}
  </View>;
}

function AboutPane() {
  const version = (require('../../package.json') as {version: string}).version;
  return <View style={{alignItems: 'center', gap: 10, paddingTop: 24}}>
    <BrandMark size={64} label="atePDF"/>
    <Txt variant="title1">atePDF</Txt>
    <Txt variant="meta" tone="secondary" tabular>Version {version} · development build</Txt>
    <Txt variant="ui" tone="secondary" style={{textAlign: 'center', maxWidth: 420}}>Tell atePDF what you need. It plans the steps and works on copies of your PDFs on this Mac.</Txt>
  </View>;
}

/** E3 ConfirmSheet — Start Over. Cancel is the default; the destructive action is explicit. */
export function StartOverSheet() {
  const {workspace: w, shell} = useApp();
  const current = w.current !== undefined ? w.entries.find(entry => entry.id === w.current)?.artifact : undefined;
  const close = () => shell.setStartOver(false);
  const body = w.keeping
    ? 'This clears the conversation and atePDF’s saved copies of its PDFs, results and draft on this Mac. Files you added and PDFs you saved elsewhere stay unchanged, and your Keep workspace setting stays as it is.'
    : 'This clears the conversation and its PDFs and results from atePDF. Files you added and PDFs you saved elsewhere stay unchanged.';
  return <Sheet visible={shell.startOver} onClose={close} title="Start over?" icon={TriangleAlert} iconTone="warning" width={420}
    footer={<>
      {current && <View style={{flex: 1, alignItems: 'flex-start'}}><Button variant="plain" icon={ArrowDownToLine} label="Save Current Result…" busy={!!w.saving && 'Saving…'} onPress={() => void w.exportResult(current)}/></View>}
      <Button variant="secondary" label="Cancel" onPress={close}/>
      <Button variant="destructive" label="Start Over" disabled={w.state.busy || w.restoring} onPress={() => {close(); w.startOver();}}/>
    </>}>
    <Txt variant="ui" tone="secondary">{body}</Txt>
    {w.working && <Txt variant="meta" tone="secondary">The current task will be stopped first.</Txt>}
    <Txt variant="meta" tone="secondary">Save any results you want to keep first. This isn’t secure erasure.</Txt>
  </Sheet>;
}

/** E1 Quick Look: the existing local renderers inside a read-only sheet. */
export function QuickLookSheet() {
  const {workspace: w, shell} = useApp();
  const window = useWindowDimensions();
  const look = shell.quickLook;
  const meta = useMemo(() => {if (!look) return null; try {return w.store.get(look.ref);} catch {return null;}}, [look, w.store]);
  const close = () => shell.setQuickLook(null);
  const result = meta && !meta.meta.original;
  const current = look?.ref === w.store.focus;
  return <Sheet visible={!!look} onClose={close} title={look?.title ?? 'Preview'} width={1000} height={Math.min(820, window.height - 48)} hideTitle scroll={false} bodyPadding={0}>
    {look && meta ? <View style={{flex: 1}}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12}}>
        <View style={{flex: 1, minWidth: 0}}>
          <Txt variant="title2" numberOfLines={1} ellipsizeMode="middle" accessibilityRole="header">{look.title}</Txt>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <Txt variant="meta" tone="secondary" tabular>{facts(meta.meta.pageCount, meta.meta.sizeBytes)}</Txt>
            {result ? <><Tag kind={current ? 'current' : 'earlier'}/><Tag kind="verified"/></> : <Txt variant="meta" tone="tertiary">Original · unchanged</Txt>}
          </View>
        </View>
        {result && <Button variant="secondary" icon={ArrowDownToLine} label="Save…" accessibilityLabel="Save PDF" busy={w.saving === look.ref && 'Saving…'} disabled={!!w.saving && w.saving !== look.ref} onPress={() => void w.exportResult({ref: meta.meta.ref, pageCount: meta.meta.pageCount, sizeBytes: meta.meta.sizeBytes, note: meta.meta.note})}/>}
      </View>
      <View style={{flex: 1, minHeight: 0}}><Preview bytes={meta.bytes} count={meta.meta.pageCount} onClose={close} fill/></View>
    </View> : <View style={{padding: 20}}><Txt variant="ui" tone="secondary">This file is no longer available in this workspace.</Txt></View>}
  </Sheet>;
}

/** E5 onboarding shell (content and first-launch behaviour belong to SHR-77). Truthful to this build. */
export function OnboardingSheet() {
  const {shell} = useApp();
  const [pane, setPane] = useState(0);
  const {c} = useTheme();
  const panes = [
    {title: 'Just say what you need.', body: 'Add PDFs, then describe the result: merge, remove pages, compress or make scans searchable. atePDF makes a new file and keeps your originals untouched.', art: <MiniThread/>},
    {title: 'Your files stay on this Mac.', body: 'PDFs are processed on this Mac. When atePDF AI is connected, your instructions go to it to plan the steps. Files and names don’t.', art: <PrivacyPair/>},
  ];
  const close = () => {shell.setOnboarding(false); setPane(0);};
  const last = pane === panes.length - 1;
  return <Sheet visible={shell.onboarding} onClose={close} title={panes[pane].title} width={560} hideTitle
    footer={<>
      <View style={{flex: 1, flexDirection: 'row', gap: 6}}>{panes.map((_, index) => <View key={index} style={{width: 6, height: 6, borderRadius: 3, backgroundColor: index === pane ? c.accent : c.inkTertiary, opacity: index === pane ? 1 : 0.5}}/>)}</View>
      {pane > 0 && <Button variant="plain" label="Back" onPress={() => setPane(pane - 1)}/>}
      <Button variant="primary" label={last ? 'Get Started' : 'Continue'} onPress={() => last ? close() : setPane(pane + 1)}/>
    </>}>
    <View style={{alignItems: 'center', gap: 16, paddingTop: 8}}>
      {pane === 0 && <BrandMark size={64}/>}
      <View style={{height: 150, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: c.sunken, padding: 16}}>{panes[pane].art}</View>
      <Txt variant="display" accessibilityRole="header" style={{textAlign: 'center'}}>{panes[pane].title}</Txt>
      <Txt variant="body" tone="secondary" style={{textAlign: 'center', maxWidth: 440}}>{panes[pane].body}</Txt>
    </View>
  </Sheet>;
}
function PrivacyPair() {
  const {c} = useTheme();
  return <View style={{flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center'}}>
    <View style={{height: 24, paddingHorizontal: 8, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.localBg}}><Glyph icon={LaptopMinimal} size={14} tone="local"/><Txt variant="meta" tone="local">PDFs · on this Mac</Txt></View>
    <View style={{height: 24, paddingHorizontal: 8, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.sunken, borderWidth: 1, borderColor: c.hairline}}><Glyph icon={Cloud} size={14}/><Txt variant="meta" tone="secondary">Instructions · atePDF AI</Txt></View>
  </View>;
}
function MiniThread() {
  const {c} = useTheme();
  return <View style={{width: 300, gap: 8}}>
    <View style={{alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.md, backgroundColor: c.request}}><Txt variant="bodyStrong">Merge these three PDFs</Txt></View>
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: c.hairline, backgroundColor: c.raised}}>
      <View style={{width: 24, height: 32, borderRadius: radius.thumb, backgroundColor: c.paper, borderWidth: 1, borderColor: c.hairline}}/>
      <View style={{flex: 1}}><Txt variant="headline">Merged PDF</Txt><Txt variant="meta" tone="secondary">12 pages</Txt></View>
      <Tag kind="verified"/>
    </View>
  </View>;
}

/** E8 Keyboard shortcuts that work in this build. */
export function ShortcutsSheet() {
  const {shell} = useApp();
  const rows: [string, string][] = SHORTCUTS ? [
    ['Send', 'Return'], ['New line', '⇧Return'], ['Add Files…', '⌘O'], ['Actions palette', '⌘K'], ['Save current result', '⌘S'], ['Undo last change (outside text fields or in an empty message field)', '⌘Z'],
    ['Stop the current task', '⌘.'], ['Files panel', '⌥⌘I'], ['Focus the message field', '⌘L'], ['Start Over…', '⇧⌘⌫'], ['Settings…', '⌘,'], ['Keyboard Shortcuts', '⌘/'], ['Close a sheet or preview', 'Esc'],
  ] : [['Send', 'Return'], ['Close a sheet or preview', 'Esc']];
  return <Sheet visible={shell.shortcuts} onClose={() => shell.setShortcuts(false)} title="Keyboard Shortcuts" width={560}
    footer={<Button variant="primary" label="Done" onPress={() => shell.setShortcuts(false)}/>}>
    {!SHORTCUTS && <Txt variant="meta" tone="secondary">Mac menu-bar commands and more shortcuts are coming. Every command is also in the ⋯ menu.</Txt>}
    <View style={{gap: 2}}>{rows.map(([label, key]) => <Row key={label} disabled><Txt variant="ui" style={{flex: 1}}>{label}</Txt><Keycap>{key}</Keycap></Row>)}</View>
  </Sheet>;
}

/** Every sheet, mounted together; loaded on first use (see Sheets in App.tsx). */
export default function AllSheets() {
  return <><SettingsSheet/><StartOverSheet/><QuickLookSheet/><OnboardingSheet/><ShortcutsSheet/></>;
}
