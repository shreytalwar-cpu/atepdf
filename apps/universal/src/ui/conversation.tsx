// Conversation views (COMPONENT_INVENTORY B3, C4–C12): what a turn shows beside its text, the
// activity row and the Files panel. Loaded after first paint (App.tsx), so the startup bundle
// stays within budget. Everything is read from the workspace; no component decides an outcome.
import {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Platform, Pressable, ScrollView, View, useWindowDimensions, type LayoutChangeEvent} from 'react-native';
import ArrowDownToLine from 'lucide-react-native/icons/arrow-down-to-line';
import Check from 'lucide-react-native/icons/check';
import Circle from 'lucide-react-native/icons/circle';
import CircleX from 'lucide-react-native/icons/circle-x';
import Cloud from 'lucide-react-native/icons/cloud';
import CornerDownLeft from 'lucide-react-native/icons/corner-down-left';
import Eye from 'lucide-react-native/icons/eye';
import LaptopMinimal from 'lucide-react-native/icons/laptop-minimal';
import Settings2 from 'lucide-react-native/icons/settings-2';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Undo2 from 'lucide-react-native/icons/undo-2';
import X from 'lucide-react-native/icons/x';
import type {JobStepStatus} from '@core/job-controller';
import {useAnnounce, useMotion, webLiveRegion} from '../components/assistant-ui/elements/surfaces';
import {revealMessage} from '../components/assistant-ui/elements/thread.aui';
import {formatSize, pageCount, type DisplayArtifact, type Entry} from '../workspace/useWorkspace';
import {useApp} from './context';
import {facts, resultNumber} from './facts';
import {Appear, easing, nativeDriver, track, useActivityPresenceState, useFresh, useMoment} from './motion';
import {ActivityGlyph, Button, Card, Disclosure, Glyph, IconButton, Keycap, Row, Tag, Txt} from './primitives';
import {describeActivity, SHOW_AFTER, type Activity} from './progress';
import {PageThumbnail} from './thumbnails';
import {motion, radius, shadow, size, useTheme} from './theme';

export {clearThumbnails} from './thumbnails';

/** C4 SourceGroup: a local import shown as its own turn, with each file in its visible (merge) order. */
export function SourceGroup({entry}: {entry: Entry}) {
  const {workspace: w, shell} = useApp();
  const {c} = useTheme();
  const files = entry.files ?? [];
  const [expanded, setExpanded] = useState(false);
  const metas = files.map(file => {try {return file.ref ? w.store.get(file.ref).meta : null;} catch {return null;}});
  const settled = metas.every(Boolean);
  const pages = metas.reduce((sum, meta) => sum + (meta?.pageCount ?? 0), 0);
  const importing = !settled && w.loading && entry.id === Math.max(...w.entries.filter(e => e.files).map(e => e.id));
  const visible = files.length > 5 && !expanded ? files.slice(0, 4) : files;
  const noun = files.length === 1 ? 'PDF' : `${files.length} PDFs`;
  return <View style={{gap: 6}}>
    <View style={{flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 2}}>
      <Txt variant="meta" tone="secondary" tabular>{settled ? `Added ${files.length === 1 ? 'a PDF' : noun} · ${pageCount(pages)}` : importing ? `Checking ${noun}…` : `${noun} not added`}</Txt>
      {settled && <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}><Glyph icon={LaptopMinimal} size={12} tone="local"/><Txt variant="meta" tone="local">Checked on this Mac</Txt></View>}
    </View>
    <View style={{backgroundColor: c.raised, borderWidth: 1, borderColor: c.hairline, borderRadius: radius.lg, padding: 4, gap: 2}}>
      {visible.map((file, index) => {
        const meta = metas[index], order = file.ref ? w.store.originals.indexOf(file.ref) : -1;
        return <Appear key={index} id={`source:${entry.id}:${index}`} delay={Math.min(index, 4) * 30}>
          <FileRow name={file.name} order={order >= 0 ? order + 1 : undefined} total={w.store.originals.length}
            detail={meta ? facts(meta.pageCount, meta.sizeBytes) : importing ? 'Checking…' : `${formatSize(file.size)} · Not added`}
            fileRef={meta?.ref} checksum={meta?.checksum} busy={importing && !meta} fold="source" surface={c.raised}
            onPreview={meta ? () => shell.setQuickLook({ref: meta.ref, title: file.name}) : undefined}/>
        </Appear>;
      })}
      {files.length > 5 && !expanded && <Row onPress={() => setExpanded(true)} accessibilityRole="button" accessibilityLabel={`Show ${files.length - 4} more`}><Txt variant="meta" tone="accent">Show {files.length - 4} more</Txt></Row>}
    </View>
  </View>;
}

/** C5 FileRow: order number, real thumbnail, middle-truncated name, facts, tags and row actions. */
export function FileRow({name, order, total, detail, fileRef, checksum, tag, showTag = true, number, busy = false, selected = false, onPress, onPreview, onSave, heading = false, saving = false, fold, surface}: {
  name: string; order?: number; total?: number; detail: string; number?: number; fileRef?: string; checksum?: string; tag?: 'current' | 'earlier'; busy?: boolean; selected?: boolean;
  /** The tag is always in the row's accessible name; the Files panel shows current by its rail instead. */
  showTag?: boolean;
  onPress?: () => void; onPreview?: () => void; onSave?: () => void; heading?: boolean; saving?: boolean; fold?: 'result' | 'source'; surface?: string;
}) {
  const {workspace: w} = useApp();
  const label = [name, order ? `source ${order} of ${total}` : tag === 'current' ? 'current result' : tag === 'earlier' ? 'earlier result' : null, detail].filter(Boolean).join(', ');
  return <Row className="atepdf-hover-group" height={44} selected={selected} onPress={onPress} disabled={!onPress} accessible={!!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? label : undefined}>
    {order !== undefined && <Txt testID="source-order" variant="meta" tone="tertiary" tabular style={{width: 14, textAlign: 'right'}}>{order}</Txt>}
    {busy ? <View style={{width: size['thumb.row'].width, height: size['thumb.row'].height, alignItems: 'center', justifyContent: 'center'}}><ActivityGlyph/></View>
      : <PageThumbnail store={w.store} fileRef={fileRef} checksum={checksum} width={size['thumb.row'].width} height={size['thumb.row'].height} fold={fold} surface={surface}/>}
    <View style={{flex: 1, minWidth: 0}} accessible={!onPress} accessibilityLabel={!onPress ? label : undefined}>
      <Txt variant={tag === 'current' ? 'uiStrong' : 'ui'} numberOfLines={1} ellipsizeMode="middle" accessibilityRole={heading ? 'header' : undefined}>{name}</Txt>
      <Txt variant="meta" tone="secondary" tabular numberOfLines={1}>{number ? <Txt variant="meta" tone="tertiary">{`Result ${number}`}</Txt> : null}{number ? ' · ' : ''}{detail}</Txt>
    </View>
    {tag && showTag && <Tag kind={tag}/>}
    {(onPreview || onSave) && <View className="atepdf-hover-reveal" style={{flexDirection: 'row', gap: 2}}>
      {onPreview && <IconButton size="inline" icon={Eye} label="Preview" accessibilityHint={`Opens a read-only preview of ${name}`} onPress={onPreview}/>}
      {onSave && <IconButton size="inline" icon={ArrowDownToLine} label="Save PDF" disabled={saving} accessibilityHint={`Saves a copy of ${name}`} onPress={onSave}/>}
    </View>}
  </Row>;
}

// The result card's page preview: larger than a row, the same paper and fold.
const RESULT_THUMB = {width: 52, height: 68};

/** C12 ResultCard. Current: the full card with the one Iris Save. Earlier: a single row. */
export function ResultCard({entry, artifact}: {entry: Entry; artifact: DisplayArtifact}) {
  const {workspace: w, shell} = useApp();
  const {c} = useTheme();
  const {width} = useWindowDimensions();
  const presentation = useActivityPresenceState();
  const current = entry.id === presentation.current;
  // While the next reply is held for a moment, its Undo isn't offered on the card before it.
  const canUndo = w.store.canUndo && presentation.phase !== 'settling';
  const title = entry.resultTitle ?? 'Your PDF';
  const receipt = w.receipts[artifact.ref];
  const checksum = (() => {try {return w.store.get(artifact.ref).meta.checksum;} catch {return undefined;}})();
  const saving = w.saving === artifact.ref;
  const saved = !!receipt && /^Saved\b/.test(receipt);
  const openPreview = () => shell.setQuickLook({ref: artifact.ref, title});
  // The verified moment: an Iris edge that settles into the card's resting border, once.
  const glint = useMoment(useFresh(`glint:${entry.id}`) && current, 900, 120);
  if (!current) {
    return <Appear id={`earlier:${entry.id}`} testID="previous-result" style={{gap: 4}}>
      <FileRow heading name={title} tag="earlier" number={resultNumber(w, artifact.ref)} detail={facts(artifact.pageCount, artifact.sizeBytes)} fileRef={artifact.ref} checksum={checksum} fold="result" surface={c.window}
        onPreview={openPreview} onSave={() => void w.exportResult(artifact)} saving={!!w.saving}/>
      {!!receipt && <View style={{paddingLeft: 8}}><Receipt text={receipt}/></View>}
    </Appear>;
  }
  const wide = width >= 900;
  const number = resultNumber(w, artifact.ref);
  return <Appear id={`result:${entry.id}`} from="scale">
    <Card testID="current-result" selected style={{paddingVertical: 12, paddingHorizontal: 14, gap: 10}}>
      <Animated.View pointerEvents="none" style={{position: 'absolute', inset: -1, borderRadius: radius.lg + 1, borderWidth: 1.5, borderColor: c.accent, opacity: glint.interpolate({inputRange: [0, 0.15, 1], outputRange: [0, 1, 0]})} as never}/>
      <View style={{flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', gap: 12}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, flex: wide ? 1 : undefined, minWidth: 0}}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Preview ${title}`} onPress={openPreview}>
            <PageThumbnail store={w.store} fileRef={artifact.ref} checksum={checksum} width={RESULT_THUMB.width} height={RESULT_THUMB.height} fold="result" surface={c.raised}/>
          </Pressable>
          <View style={{flex: 1, minWidth: 0, gap: 3}}>
            <Txt variant="title2" accessibilityRole="header" numberOfLines={2}>{title}</Txt>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4}}>
              <Txt testID="result-facts" variant="meta" tone="secondary" tabular>{facts(artifact.pageCount, artifact.sizeBytes)}</Txt>
              {number > 0 && <Txt variant="meta" tone="tertiary" tabular>{`Result ${number}`}</Txt>}
              <Tag kind="current"/>
              {/* Only committed results reach the card, after independent verification (SHR-47). */}
              <Tag kind="verified"/>
              {entry.restored && <Tag kind="restored"/>}
            </View>
          </View>
        </View>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, justifyContent: wide ? 'flex-end' : 'flex-start'}}>
          <Button variant={w.choice === null && !saved ? 'primary' : 'secondary'} icon={ArrowDownToLine} label="Save…" accessibilityLabel="Save PDF" busy={saving && 'Saving…'} disabled={!!w.saving && !saving} onPress={() => void w.exportResult(artifact)}/>
          <Button variant="secondary" icon={Eye} label="Quick Look" accessibilityLabel="Preview" onPress={openPreview}/>
        </View>
      </View>
      {!!artifact.note && <Txt variant="meta" tone="secondary">{artifact.note}</Txt>}
      {(canUndo || !!receipt) && <View style={{flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: c.hairline, marginHorizontal: -14, paddingHorizontal: 14, paddingTop: 8, marginBottom: -4}}>
        {receipt ? <Receipt text={receipt}/> : <View/>}
        {canUndo && <Button variant="plain" icon={Undo2} label="Undo" disabled={w.busy} onPress={w.undo} trailing={Platform.OS === 'web' ? <Keycap>⌘Z</Keycap> : undefined}/>}
      </View>}
    </Card>
  </Appear>;
}

/** Save receipt: belongs to this exact result, stays with it after it becomes Earlier. */
function Receipt({text}: {text: string}) {
  const saved = /^Saved\b/.test(text), failed = /could not|couldn’t|failed/i.test(text);
  return <Appear style={{flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1}}>
    {saved && <Glyph icon={Check} size={14} tone="accent"/>}
    {failed && <Glyph icon={CircleX} size={14} tone="danger"/>}
    <Txt variant="meta" tone={failed ? 'danger' : saved ? 'primary' : 'secondary'} accessibilityLiveRegion="polite" aria-live={webLiveRegion} style={{flexShrink: 1}}>{text}</Txt>
  </Appear>;
}

/** C9 ProposalCard (quality caveat): the only confirmation ordinary copy-making needs. */
export function ProposalCard({entry}: {entry: Entry}) {
  const {workspace: w} = useApp();
  const open = w.choice === entry.id;
  return <Appear id={`proposal:${entry.id}`}>
    <Card style={{paddingVertical: 12, paddingHorizontal: 14, gap: 8, opacity: open ? 1 : 0.6}}>
      <View style={{flexDirection: 'row', gap: 10, alignItems: 'flex-start'}}>
        <View style={{paddingTop: 1}}><Glyph icon={TriangleAlert} tone="warning"/></View>
        <View style={{flex: 1, gap: 4}}>
          <Txt variant="headline" accessibilityRole="header">Image quality may change</Txt>
          <Txt variant="ui" tone="secondary" selectable>{entry.text}</Txt>
        </View>
      </View>
      {open ? <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8}}>
        <Button variant="secondary" label="Keep Current Result" disabled={w.busy} onPress={() => w.keepCurrent(entry)}/>
        <Button variant="primary" label="Create Copy" disabled={w.busy} onPress={() => w.confirm(entry)}/>
      </View> : <Txt variant="meta" tone="tertiary">This question is closed.</Txt>}
    </Card>
  </Appear>;
}

/** C8 ChoiceList: a clarification's options. Choosing one answers through the normal request path. */
export function ChoiceList({entry}: {entry: Entry}) {
  const {workspace: w, composer} = useApp();
  const {c} = useTheme();
  const open = w.question === entry.id && !w.busy;
  const choices = entry.choices ?? [];
  return <Appear id={`choices:${entry.id}`} style={{gap: 4, opacity: open ? 1 : 0.6}}>
    <View accessibilityRole="radiogroup" accessibilityLabel={entry.text} style={{backgroundColor: c.raised, borderWidth: 1, borderColor: c.hairline, borderRadius: radius.lg, padding: 4, gap: 2}}>
      {choices.slice(0, 9).map((choice, index) => <Row key={choice} disabled={!open} accessibilityRole="button" accessibilityLabel={choice} onPress={() => w.submit(choice)}>
        <Keycap>{String(index + 1)}</Keycap><Txt variant="ui" style={{flex: 1}}>{choice}</Txt>
        {open && <Glyph icon={CornerDownLeft} size={14} tone="tertiary"/>}
      </Row>)}
      {open && <Row accessibilityRole="button" accessibilityLabel="Something else…" onPress={composer.focus}><View style={{width: 16}}/><Txt variant="ui" tone="secondary">Something else…</Txt></Row>}
    </View>
    {!open && w.question !== entry.id && <Txt variant="meta" tone="tertiary">This question is closed.</Txt>}
  </Appear>;
}

/** Actions that follow an assistant turn: result, proposal, clarification, or AI settings. */
export function EntryExtras({entry}: {entry: Entry}) {
  const {workspace: w, shell, composer} = useApp();
  if (entry.artifact) return <ResultCard entry={entry} artifact={entry.artifact}/>;
  // Recovery for a request that failed: put it back in the message field to change and resend.
  // Nothing is resent automatically (the files or permission may have changed since).
  if (entry.notice === 'error' && w.entries.at(-1)?.id === entry.id) {
    const index = w.entries.findIndex(item => item.id === entry.id), request = w.entries[index - 1];
    if (request?.role === 'user' && !request.files) return <View style={{alignItems: 'flex-start'}}>
      <Button variant="secondary" label="Edit Request" accessibilityHint="Puts your request back in the message field" disabled={w.busy} onPress={() => composer.fill(request.text)}/>
    </View>;
  }
  if (entry.choices?.length) return <ChoiceList entry={entry}/>;
  if (entry.choice === 'connection-help' && w.choice === entry.id) return <View style={{alignItems: 'flex-start'}}>
    <Button variant="secondary" icon={Settings2} label="AI Settings…" accessibilityLabel="AI connection" disabled={w.busy} onPress={() => shell.openSettings('ai')}/>
  </View>;
  if (entry.choice && ['clear', 'connect', 'native-link', 'native-pair'].includes(entry.choice)) return <Txt variant="meta" tone="tertiary">This question is closed.</Txt>;
  return null;
}

export type BarState = Activity['mode'] | 'complete' | 'failed';
/** A17 ProgressBar: determinate (a real count), indeterminate, verifying, cancelling, failed and
 * complete. Compact (3 pt). Completion fills and then gives way to the result. */
export function ProgressBar({state, value}: {state: BarState; value?: number}) {
  const {c} = useTheme();
  const moving = useMotion();
  const [track_, setTrack] = useState(0);
  const [fill] = useState(() => new Animated.Value(value ?? 0));
  const [sweep] = useState(() => new Animated.Value(0));
  const target = state === 'complete' || state === 'failed' ? 1 : state === 'determinate' ? Math.max(0, Math.min(1, value ?? 0)) : null;
  const sweeping = (state === 'indeterminate' || state === 'verifying') && moving && track_ > 0;
  useEffect(() => {
    if (target === null) return;
    if (!moving) {fill.setValue(target); return;}
    return track(Animated.timing(fill, {toValue: target, duration: state === 'complete' ? motion['duration.base'] : motion['duration.slow'], easing: easing.standard, useNativeDriver: nativeDriver, isInteraction: false}));
  }, [target, moving]);
  useEffect(() => {
    if (!sweeping) return;
    sweep.setValue(0);
    const loop = Animated.loop(Animated.timing(sweep, {toValue: 1, duration: 1100, easing: easing.standard, useNativeDriver: nativeDriver, isInteraction: false}));
    loop.start(); return () => loop.stop();
  }, [sweeping]);
  const color = state === 'failed' ? c.danger : state === 'cancelling' ? c.inkTertiary : c.accent;
  const segment = Math.max(24, track_ * 0.32);
  const percent = target === null ? undefined : Math.round(target * 100);
  return <View accessibilityRole="progressbar" accessibilityValue={percent === undefined ? undefined : {min: 0, max: 100, now: percent}} aria-busy={target === null}
    onLayout={(event: LayoutChangeEvent) => setTrack(event.nativeEvent.layout.width)}
    style={{height: 3, borderRadius: radius.full, backgroundColor: c.pressed, overflow: 'hidden'}}>
    {target !== null ? <Animated.View style={{height: 3, width: '100%', backgroundColor: color, borderRadius: radius.full, transformOrigin: 'left', transform: [{scaleX: fill}]} as never}/>
      : sweeping ? <Animated.View style={{height: 3, width: segment, backgroundColor: color, borderRadius: radius.full, transform: [{translateX: sweep.interpolate({inputRange: [0, 1], outputRange: [-segment, track_]})}]}}/>
      // Reduce Motion, cancelling, or before layout: a still, quiet track says “in progress” with the label.
      : <View style={{height: 3, width: '100%', backgroundColor: color, opacity: state === 'cancelling' ? 0.35 : 0.25}}/>}
  </View>;
}

const stepWords: Record<JobStepStatus, string> = {pending: 'Waiting', active: 'Working', validating: 'Checking', complete: 'Done', cancelled: 'Stopped', failed: 'Couldn’t finish'};

/** C7 ActivityRow. One evolving line and a progress bar, from controller and request state only. */
export function ActivityRow() {
  const {workspace: w} = useApp();
  const {state, planning, loading, stopping} = w;
  const [expanded, setExpanded] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!planning) {setSlow(false); return;}
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [planning]);
  const live = describeActivity({state, planning, loading, stopping, slow});
  // Near-instant work resolves straight into its artifact: the row appears only once work has
  // run for SHOW_AFTER (presentation only; nothing waits for it).
  const [shown, setShown] = useState(false);
  useEffect(() => {const timer = setTimeout(() => setShown(true), SHOW_AFTER); return () => clearTimeout(timer);}, []);
  // Once work ends, the row keeps its last state for the moment until its reply takes this place.
  const last = useRef<Activity | null>(null);
  if (live) last.current = live;
  const settling = !live;
  const activity = live ?? last.current;
  const announcement = live && shown ? `${live.label}${live.count ? `. ${live.count}` : ''}` : undefined;
  useAnnounce(announcement);
  if (!activity || !shown) return null;
  const bar: BarState = activity.mode;
  const progress = state.busy ? state.progress : undefined;
  const multiple = live && progress?.kind === 'transform' && progress.steps.length > 1;
  return <View testID={settling ? 'progress-settling' : 'progress-message'} style={{gap: 8}}>
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28}}>
      <ActivityGlyph testID="activity-pulse" active={!settling}/>
      <View style={{flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8}}>
        <Txt variant="uiStrong" accessibilityLabel={announcement} aria-live={webLiveRegion}>{activity.label}</Txt>
        {activity.count && <Txt variant="meta" tone="tertiary" tabular>{activity.count}</Txt>}
        {activity.detail && <Txt variant="meta" tone="secondary" style={{flexShrink: 1}}>{activity.detail}</Txt>}
      </View>
      {activity.where === 'local' ? <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}><Glyph icon={LaptopMinimal} size={12} tone="local"/><Txt variant="meta" tone="local">On this Mac</Txt></View>
        : activity.where === 'ai' ? <View accessibilityLabel="atePDF AI: your instruction and anonymous file facts are sent to work out the steps. Files and names aren’t." style={{flexDirection: 'row', alignItems: 'center', gap: 4}}><Glyph icon={Cloud} size={12} tone="secondary"/><Txt variant="meta" tone="secondary">atePDF AI</Txt></View> : null}
      {!stopping && !settling && <Button variant="plain" label="Stop" accessibilityHint="Stops the current task" onPress={w.cancel} trailing={Platform.OS === 'web' ? <Keycap>⌘.</Keycap> : undefined}/>}
    </View>
    <View style={{paddingLeft: 24}}><ProgressBar state={bar} value={activity.value}/></View>
    {multiple && <View style={{paddingLeft: 24}}>
      <Disclosure label={expanded ? 'Hide steps' : 'Show steps'} expanded={expanded} onToggle={() => setExpanded(value => !value)}>
        <View style={{gap: 6, paddingLeft: 4}}>
          {progress!.steps.map((item, index) => <View key={index} accessible accessibilityLabel={`${item.label}. ${stepWords[item.status]}`} style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            {item.status === 'active' || item.status === 'validating' ? <ActivityGlyph/> : <Glyph icon={item.status === 'complete' ? Check : item.status === 'cancelled' || item.status === 'failed' ? X : Circle} size={14} tone={item.status === 'complete' ? 'accent' : 'tertiary'}/>}
            <Txt variant="ui" style={{flex: 1}}>{item.label}</Txt>
            <Txt variant="meta" tone="secondary">{stepWords[item.status]}</Txt>
          </View>)}
        </View>
      </Disclosure>
    </View>}
  </View>;
}

/** B3 FilesPanel: results (current first) and sources in merge order. Secondary to the conversation. */
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
    // Current first, then newest first by stable result number (Undo does not reorder them).
    return list.sort((a, b) => (b.ref === w.store.focus ? 1 : 0) - (a.ref === w.store.focus ? 1 : 0) || resultNumber(w, b.ref) - resultNumber(w, a.ref));
  }, [w.entries, w.store, w.store.focus, w.state]);
  const sources = w.store.originals.map(ref => {try {return w.store.get(ref).meta;} catch {return null;}}).filter(meta => meta !== null);
  const importEntry = (ref: string) => w.entries.find(entry => entry.files?.some(file => file.ref === ref))?.id;
  const usage = w.storage.workspace;
  const surface = overlay ? c.elevated : c.panel;
  const heading = (label: string, count: number) => <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4}}>
    <Txt variant="section" tone="tertiary" accessibilityRole="header">{label}</Txt>
    <Txt variant="caption" tone="tertiary" tabular>{count}</Txt>
  </View>;
  return <Appear from="right" duration={motion['duration.slow']} style={[{width: size['panel.files.default'], backgroundColor: surface, borderLeftWidth: 1, borderLeftColor: c.hairline},
    overlay && {position: 'absolute', top: 60, right: 8, bottom: 8, borderRadius: radius.xl, borderWidth: 1, borderColor: c.hairline, overflow: 'hidden', zIndex: 20, ...shadow('3', scheme)}]}>
    <View accessibilityRole="summary" aria-label="Files" style={{flex: 1}}>
      <View style={{height: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14}}>
        <Txt variant="headline" accessibilityRole="header" style={{flex: 1}}>Files</Txt>
        {overlay && onClose && <IconButton size="inline" icon={X} label="Close Files panel" onPress={onClose}/>}
      </View>
      <ScrollView style={{flex: 1}} contentContainerStyle={{paddingHorizontal: 6, paddingBottom: 12, gap: 14}}>
        {results.length > 0 && <View style={{gap: 2}}>
          {heading('Results', results.length)}
          {results.map(result => {const meta = w.store.get(result.ref).meta, current = result.ref === w.store.focus; return <View key={result.ref}>
            <FileRow name={result.title} tag={current ? 'current' : 'earlier'} showTag={false} number={resultNumber(w, result.ref)} detail={facts(meta.pageCount, meta.sizeBytes)} fileRef={result.ref} checksum={meta.checksum}
              selected={current} fold="result" surface={current ? c.selected : surface}
              onPress={() => {revealMessage(String(result.entry)); onClose?.();}}
              onPreview={() => shell.setQuickLook({ref: result.ref, title: result.title})}
              // Without pointer hover (native), the row keeps one action so its facts stay readable; Save is on the card.
              onSave={Platform.OS === 'web' ? () => void w.exportResult({ref: meta.ref, pageCount: meta.pageCount, sizeBytes: meta.sizeBytes, note: meta.note}) : undefined} saving={!!w.saving}/>
            {/* The current result carries the Iris rail (drawn over its row): the one the next request applies to. */}
            {current && <View pointerEvents="none" style={{position: 'absolute', left: 0, top: 10, bottom: 10, width: 2, borderRadius: 1, backgroundColor: c.accent, zIndex: 1}}/>}
          </View>;})}
        </View>}
        {sources.length > 0 && <View style={{gap: 2}}>
          {heading('Sources · merge order', sources.length)}
          {sources.map((meta, index) => <FileRow key={meta!.ref} name={meta!.name} order={index + 1} total={sources.length} detail={facts(meta!.pageCount, meta!.sizeBytes)}
            fileRef={meta!.ref} checksum={meta!.checksum} fold="source" surface={surface} onPress={() => {const id = importEntry(meta!.ref); if (id !== undefined) revealMessage(String(id)); onClose?.();}}
            onPreview={() => shell.setQuickLook({ref: meta!.ref, title: meta!.name})}/>)}
        </View>}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="Privacy & Storage settings" onPress={() => shell.openSettings('privacy')}
        style={({pressed}) => ({flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.hairline, backgroundColor: pressed ? c.pressed : 'transparent'})}>
        <Glyph icon={LaptopMinimal} size={14} tone="local"/>
        <Txt variant="meta" tone="secondary" tabular>{w.durable ? w.keeping ? 'Kept on this Mac' : 'Until atePDF quits' : 'This session only'}{w.durable && usage && !usage.unopened ? ` · ${formatSize(usage.total)}` : ''}</Txt>
      </Pressable>
    </View>
  </Appear>;
}
