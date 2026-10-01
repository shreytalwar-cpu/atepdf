// Conversation artifacts (COMPONENT_INVENTORY C4–C12): what a turn shows beside its text.
// Everything is read from the workspace; no component decides an outcome itself.
import {useEffect, useState} from 'react';
import {Platform, Pressable, View, useWindowDimensions} from 'react-native';
import ArrowDownToLine from 'lucide-react-native/icons/arrow-down-to-line';
import Ban from 'lucide-react-native/icons/ban';
import Check from 'lucide-react-native/icons/check';
import CircleX from 'lucide-react-native/icons/circle-x';
import Cloud from 'lucide-react-native/icons/cloud';
import CloudOff from 'lucide-react-native/icons/cloud-off';
import CornerDownLeft from 'lucide-react-native/icons/corner-down-left';
import Eye from 'lucide-react-native/icons/eye';
import LaptopMinimal from 'lucide-react-native/icons/laptop-minimal';
import Settings2 from 'lucide-react-native/icons/settings-2';
import Square from 'lucide-react-native/icons/square';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Undo2 from 'lucide-react-native/icons/undo-2';
import Circle from 'lucide-react-native/icons/circle';
import X from 'lucide-react-native/icons/x';
import type {Operation} from '@contracts/protocol';
import type {JobStepStatus} from '@core/job-controller';
import {useAnnounce, webLiveRegion} from '../components/assistant-ui/elements/surfaces';
import {nativeEngineReady, ocrAvailable} from '../platform/runtime';
import {formatSize, pageCount, type DisplayArtifact, type Entry, type Notice} from '../workspace/useWorkspace';
import {BrandMark} from './BrandMark';
import {useApp} from './context';
import {ActivityGlyph, Button, Card, Disclosure, Glyph, IconButton, Keycap, Row, Tag, Txt, type Tone} from './primitives';
import {PageThumbnail} from './thumbnails';
import {radius, size, useTheme} from './theme';

export const facts = (pages: number, bytes: number) => `${pageCount(pages)} · ${formatSize(bytes)}`;

/** The assistant text of a turn, with the OutcomeNotice icon when it reports an outcome (C11). */
export function NoticeIcon({notice}: {notice?: Notice}) {
  if (!notice) return null;
  const [icon, tone]: [typeof Ban, Tone] = notice === 'error' ? [CircleX, 'danger'] : notice === 'refused' ? [Ban, 'danger'] : notice === 'unavailable' ? [CloudOff, 'secondary'] : [Square, 'secondary'];
  return <View style={{paddingTop: 2}}><Glyph icon={icon} tone={tone}/></View>;
}

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
  return <View style={{gap: 8}}>
    <View style={{flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 2}}>
      <Txt variant="meta" tone="secondary" tabular>{settled ? `Added ${files.length === 1 ? 'a PDF' : noun} · ${pageCount(pages)}` : importing ? `Checking ${noun}…` : `${noun} not added`}</Txt>
      {settled && <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}><Glyph icon={LaptopMinimal} size={12} tone="local"/><Txt variant="meta" tone="local">Checked on this Mac</Txt></View>}
    </View>
    <View style={{backgroundColor: c.raised, borderWidth: 1, borderColor: c.hairline, borderRadius: radius.lg, padding: 4, gap: 2}}>
      {visible.map((file, index) => {
        const meta = metas[index], order = file.ref ? w.store.originals.indexOf(file.ref) : -1;
        return <FileRow key={index} name={file.name} order={order >= 0 ? order + 1 : undefined} total={w.store.originals.length}
          detail={meta ? facts(meta.pageCount, meta.sizeBytes) : importing ? 'Checking…' : `${formatSize(file.size)} · Not added`}
          fileRef={meta?.ref} checksum={meta?.checksum} busy={importing && !meta}
          onPreview={meta ? () => shell.setQuickLook({ref: meta.ref, title: file.name}) : undefined}/>;
      })}
      {files.length > 5 && !expanded && <Row onPress={() => setExpanded(true)} accessibilityRole="button" accessibilityLabel={`Show ${files.length - 4} more`}><Txt variant="meta" tone="accent">Show {files.length - 4} more</Txt></Row>}
    </View>
  </View>;
}

/** C5 FileRow: order number, real thumbnail, middle-truncated name, facts, tags and row actions. */
export function FileRow({name, order, total, detail, fileRef, checksum, tag, busy = false, selected = false, onPress, onPreview, onSave, heading = false, saving = false}: {
  name: string; order?: number; total?: number; detail: string; fileRef?: string; checksum?: string; tag?: 'current' | 'earlier'; busy?: boolean; selected?: boolean;
  onPress?: () => void; onPreview?: () => void; onSave?: () => void; heading?: boolean; saving?: boolean;
}) {
  const {workspace: w} = useApp();
  const label = [name, order ? `source ${order} of ${total}` : tag === 'current' ? 'current result' : tag === 'earlier' ? 'earlier result' : null, detail].filter(Boolean).join(', ');
  return <Row className="atepdf-hover-group" height={44} selected={selected} onPress={onPress} disabled={!onPress} accessible={!!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? label : undefined}>
    {order !== undefined && <Txt variant="meta" tone="tertiary" tabular style={{width: 14, textAlign: 'right'}}>{order}</Txt>}
    {busy ? <View style={{width: size['thumb.row'].width, height: size['thumb.row'].height, alignItems: 'center', justifyContent: 'center'}}><ActivityGlyph/></View>
      : <PageThumbnail store={w.store} fileRef={fileRef} checksum={checksum} width={size['thumb.row'].width} height={size['thumb.row'].height}/>}
    <View style={{flex: 1, minWidth: 0}} accessible={!onPress} accessibilityLabel={!onPress ? label : undefined}>
      <Txt variant="ui" numberOfLines={1} ellipsizeMode="middle" accessibilityRole={heading ? 'header' : undefined}>{name}</Txt>
      <Txt variant="meta" tone="secondary" tabular numberOfLines={1}>{detail}</Txt>
    </View>
    {tag && <Tag kind={tag}/>}
    {(onPreview || onSave) && <View className="atepdf-hover-reveal" style={{flexDirection: 'row', gap: 2}}>
      {onPreview && <IconButton size="inline" icon={Eye} label="Preview" accessibilityHint={`Opens a read-only preview of ${name}`} onPress={onPreview}/>}
      {onSave && <IconButton size="inline" icon={ArrowDownToLine} label="Save PDF" disabled={saving} accessibilityHint={`Saves a copy of ${name}`} onPress={onSave}/>}
    </View>}
  </Row>;
}

/** C12 ResultCard. Current: full card with the one Iris Save. Earlier: a single row. */
export function ResultCard({entry, artifact}: {entry: Entry; artifact: DisplayArtifact}) {
  const {workspace: w, shell} = useApp();
  const {width} = useWindowDimensions();
  const current = entry.id === w.current;
  const title = entry.resultTitle ?? 'Your PDF';
  const receipt = w.receipts[artifact.ref];
  const checksum = (() => {try {return w.store.get(artifact.ref).meta.checksum;} catch {return undefined;}})();
  const saving = w.saving === artifact.ref;
  const openPreview = () => shell.setQuickLook({ref: artifact.ref, title});
  if (!current) {
    return <View testID="previous-result" style={{gap: 4}}>
      <FileRow heading name={title} tag="earlier" detail={facts(artifact.pageCount, artifact.sizeBytes)} fileRef={artifact.ref} checksum={checksum}
        onPreview={openPreview} onSave={() => void w.exportResult(artifact)} saving={!!w.saving}/>
      {!!receipt && <Receipt text={receipt}/>}
    </View>;
  }
  const wide = width >= 900;
  return <Card testID="current-result" style={{paddingVertical: 12, paddingHorizontal: 14, gap: 10}}>
    <View style={{flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', gap: 12}}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, flex: wide ? 1 : undefined, minWidth: 0}}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Preview ${title}`} onPress={openPreview}>
          <PageThumbnail store={w.store} fileRef={artifact.ref} checksum={checksum} width={size['thumb.card'].width} height={size['thumb.card'].height}/>
        </Pressable>
        <View style={{flex: 1, minWidth: 0, gap: 2}}>
          <Txt variant="headline" accessibilityRole="header" numberOfLines={2}>{title}</Txt>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 2}}>
            <Txt testID="result-facts" variant="meta" tone="secondary" tabular>{facts(artifact.pageCount, artifact.sizeBytes)}</Txt>
            <Tag kind="current"/>
            {/* Only committed results reach the card, after independent verification (SHR-47). */}
            <Tag kind="verified"/>
            {entry.restored && <Tag kind="restored"/>}
          </View>
        </View>
      </View>
      <View style={{flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, justifyContent: wide ? 'flex-end' : 'flex-start'}}>
        <Button variant={w.choice === null ? 'primary' : 'secondary'} icon={ArrowDownToLine} label="Save…" accessibilityLabel="Save PDF" busy={saving && 'Saving…'} disabled={!!w.saving && !saving} onPress={() => void w.exportResult(artifact)}/>
        <Button variant="secondary" icon={Eye} label="Quick Look" accessibilityLabel="Preview" onPress={openPreview}/>
      </View>
    </View>
    {!!artifact.note && <Txt variant="meta" tone="secondary">{artifact.note}</Txt>}
    {(w.store.canUndo || !!receipt) && <View style={{flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: 'transparent'}}>
      {receipt ? <Receipt text={receipt}/> : <View/>}
      {w.store.canUndo && <Button variant="plain" icon={Undo2} label="Undo" disabled={w.busy} onPress={w.undo} trailing={Platform.OS === 'web' ? <Keycap>⌘Z</Keycap> : undefined}/>}
    </View>}
  </Card>;
}

/** Save receipt: belongs to this exact result, stays with it after it becomes Earlier. */
function Receipt({text}: {text: string}) {
  const saved = /^Saved\b/.test(text), failed = /could not|couldn’t|failed/i.test(text);
  return <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1}}>
    {saved && <Glyph icon={Check} size={14} tone="success"/>}
    {failed && <Glyph icon={CircleX} size={14} tone="danger"/>}
    <Txt variant="meta" tone={failed ? 'danger' : 'secondary'} accessibilityLiveRegion="polite" aria-live={webLiveRegion} style={{flexShrink: 1}}>{text}</Txt>
  </View>;
}

/** C9 ProposalCard (quality caveat): the only confirmation ordinary copy-making needs. */
export function ProposalCard({entry}: {entry: Entry}) {
  const {workspace: w} = useApp();
  const open = w.choice === entry.id;
  return <Card style={{paddingVertical: 12, paddingHorizontal: 14, gap: 8, opacity: open ? 1 : 0.6}}>
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
  </Card>;
}

/** C8 ChoiceList: a clarification's options. Choosing one answers through the normal request path. */
export function ChoiceList({entry}: {entry: Entry}) {
  const {workspace: w, composer} = useApp();
  const {c} = useTheme();
  const open = w.question === entry.id && !w.busy;
  const choices = entry.choices ?? [];
  return <View accessibilityRole="radiogroup" accessibilityLabel={entry.text} style={{gap: 4, opacity: open ? 1 : 0.6}}>
    <View style={{backgroundColor: c.raised, borderWidth: 1, borderColor: c.hairline, borderRadius: radius.lg, padding: 4, gap: 2}}>
      {choices.slice(0, 9).map((choice, index) => <Row key={choice} disabled={!open} accessibilityRole="button" accessibilityLabel={choice} onPress={() => w.submit(choice)}>
        <Keycap>{String(index + 1)}</Keycap><Txt variant="ui" style={{flex: 1}}>{choice}</Txt>
        {open && <Glyph icon={CornerDownLeft} size={14} tone="tertiary"/>}
      </Row>)}
      {open && <Row accessibilityRole="button" accessibilityLabel="Something else…" onPress={composer.focus}><View style={{width: 16}}/><Txt variant="ui" tone="secondary">Something else…</Txt></Row>}
    </View>
    {!open && w.question !== entry.id && <Txt variant="meta" tone="tertiary">This question is closed.</Txt>}
  </View>;
}

/** Actions that follow an assistant turn: result, proposal, clarification, or AI settings. */
export function EntryExtras({entry}: {entry: Entry}) {
  const {workspace: w, shell} = useApp();
  if (entry.artifact) return <ResultCard entry={entry} artifact={entry.artifact}/>;
  if (entry.choices?.length) return <ChoiceList entry={entry}/>;
  if (entry.choice === 'connection-help' && w.choice === entry.id) return <View style={{alignItems: 'flex-start'}}>
    <Button variant="secondary" icon={Settings2} label="AI Settings…" accessibilityLabel="AI connection" disabled={w.busy} onPress={() => shell.openSettings('ai')}/>
  </View>;
  if (entry.choice && ['clear', 'connect', 'native-link', 'native-pair'].includes(entry.choice)) return <Txt variant="meta" tone="tertiary">This question is closed.</Txt>;
  return null;
}
export const isProposal = (entry: Entry) => !!entry.choice && ['compress', 'chain', 'execute'].includes(entry.choice);

const operationTitles: Record<Operation, string> = {merge_pdf: 'Merging PDFs', select_pages: 'Removing pages', ocr_pdf: 'Making text searchable', compress_pdf: 'Compressing images'};
const stepWords: Record<JobStepStatus, string> = {pending: 'Waiting', active: 'Working', validating: 'Verifying', complete: 'Done', cancelled: 'Stopped', failed: 'Couldn’t finish'};

/** C7 ActivityRow. Stages come only from controller and planner state; no invented progress. */
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
  const active = state.busy || planning || loading;
  const progress = state.busy ? state.progress : undefined;
  const step = progress?.currentStep == null ? undefined : progress.steps[progress.currentStep];
  const multiple = (progress?.steps.length ?? 0) > 1;
  const count = multiple && progress?.currentStep != null ? `${progress.kind === 'import' ? 'PDF' : 'Step'} ${progress.currentStep + 1} of ${progress.steps.length}` : undefined;
  const local = state.busy;
  const title = stopping ? 'Stopping…'
    : state.busy ? state.stage === 'complete' ? 'Finishing' : state.stage === 'validating' ? 'Verifying the result' : progress?.kind === 'import' ? `Checking ${progress.steps.length === 1 ? 'your PDF' : `${progress.steps.length} PDFs`}` : step?.operation ? operationTitles[step.operation] : 'Working on this Mac'
    : planning ? slow ? 'Still waiting for atePDF AI' : 'Planning'
    : 'Getting ready';
  const detail = stopping ? 'Waiting for the current step to stop safely.'
    : state.busy ? state.stage === 'validating' ? 'Checking pages, order and text with an independent reader.' : state.message
    : planning ? slow ? 'You can stop; nothing has changed.' : 'Sending your instruction to atePDF AI.'
    : 'Preparing local tools.';
  const announcement = active ? `${title}${count ? `. ${count}` : ''}` : undefined;
  useAnnounce(announcement);
  if (!active) return null;
  return <View testID="progress-message" style={{gap: 6}}>
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
      <ActivityGlyph testID="activity-pulse" active={!(state.busy && state.stage === 'complete')}/>
      <View style={{flex: 1, minWidth: 0}}>
        <Txt variant="uiStrong" accessibilityLabel={announcement} aria-live={webLiveRegion}>{title}</Txt>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8}}>
          {!!detail && <Txt variant="meta" tone="secondary" style={{flexShrink: 1}}>{detail}</Txt>}
          {count && <Txt variant="meta" tone="tertiary" tabular>{count}</Txt>}
          {local ? <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}><Glyph icon={LaptopMinimal} size={12} tone="local"/><Txt variant="meta" tone="local">On this Mac</Txt></View>
            : planning ? <View accessibilityLabel="atePDF AI: your instruction and anonymous file facts are sent to plan this. Files and names aren’t." style={{flexDirection: 'row', alignItems: 'center', gap: 4}}><Glyph icon={Cloud} size={12} tone="secondary"/><Txt variant="meta" tone="secondary">atePDF AI</Txt></View> : null}
        </View>
      </View>
      {!stopping && <Button variant="plain" label="Stop" accessibilityHint="Stops the current task" onPress={w.cancel} trailing={Platform.OS === 'web' ? <Keycap>⌘.</Keycap> : undefined}/>}
    </View>
    {multiple && <View style={{paddingLeft: 24}}>
      <Disclosure label={expanded ? 'Hide steps' : `Steps · ${(progress!.currentStep ?? 0) + 1} of ${progress!.steps.length}`} expanded={expanded} onToggle={() => setExpanded(value => !value)}>
        <View style={{gap: 6, paddingLeft: 4}}>
          {progress!.steps.map((item, index) => <View key={index} accessible accessibilityLabel={`${item.label}. ${stepWords[item.status]}`} style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            {item.status === 'active' || item.status === 'validating' ? <ActivityGlyph/> : <Glyph icon={item.status === 'complete' ? Check : item.status === 'cancelled' || item.status === 'failed' ? X : Circle} size={14} tone={item.status === 'complete' ? 'success' : 'tertiary'}/>}
            <Txt variant="ui" style={{flex: 1}}>{item.label}</Txt>
            <Txt variant="meta" tone="secondary">{stepWords[item.status]}</Txt>
          </View>)}
        </View>
      </Disclosure>
    </View>}
  </View>;
}

/** B6 EmptyWorkspace: drop or choose PDFs, then say what you need. Examples only fill the composer. */
export function EmptyWorkspace() {
  const {workspace: w, composer} = useApp();
  const {height} = useWindowDimensions();
  const examples = ['Merge these into one PDF', 'Remove page 2', ...(ocrAvailable ? ['Make the scanned pages searchable'] : []), 'Make this PDF smaller'].slice(0, 3);
  return <View testID="welcome" style={{flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 0}}>
    <BrandMark size={32} tone="mono"/>
    <View style={{height: 16}}/>
    <Txt variant="title1" accessibilityRole="header" style={{textAlign: 'center'}}>Drop PDFs here</Txt>
    <View style={{height: 6}}/>
    <Txt variant="ui" tone="secondary" style={{textAlign: 'center', maxWidth: 420}}>Then tell atePDF what you need. It plans the steps and does the PDF work on this Mac, on copies. Your originals stay as they are.</Txt>
    <View style={{height: 20}}/>
    <View style={{flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center'}}>
      <Button variant="secondary" label="Choose Files…" accessibilityLabel="Choose files" disabled={w.busy} onPress={() => void w.pick()} trailing={Platform.OS === 'web' ? <Keycap>⌘O</Keycap> : undefined}/>
      <Button variant="plain" label="Try with sample PDFs" disabled={w.busy || !nativeEngineReady} onPress={() => void w.pick(true)}/>
    </View>
    {height >= 600 && <View style={{marginTop: 24, width: '100%', maxWidth: 360, gap: 2}}>
      <Txt variant="section" tone="tertiary" style={{paddingHorizontal: 8, paddingBottom: 4}}>Things you can ask</Txt>
      {examples.map(example => <Row key={example} accessibilityRole="button" accessibilityLabel={`Use example: ${example}`} accessibilityHint="Puts this request in the message field" onPress={() => composer.fill(example)}>
        <Txt variant="ui" tone="secondary" style={{flex: 1}}>{example}</Txt><Glyph icon={CornerDownLeft} size={14} tone="tertiary"/>
      </Row>)}
    </View>}
  </View>;
}

/** B5 InlineBanner: workspace notices at the top of the conversation column. Copy is unchanged. */
export function InlineBanner({text, variant, action}: {text: string; variant: 'info' | 'warning' | 'danger'; action?: {label: string; onPress: () => void; disabled?: boolean}}) {
  const {c} = useTheme();
  const icon = variant === 'info' ? TriangleAlert : variant === 'warning' ? TriangleAlert : CircleX;
  return <View accessibilityLiveRegion="polite" aria-live={webLiveRegion} style={{flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.raised, borderWidth: 1, borderColor: c.hairline, borderRadius: radius.lg, paddingVertical: 8, paddingHorizontal: 12}}>
    <Glyph icon={icon} tone={variant === 'info' ? 'secondary' : variant}/>
    <Txt variant="ui" style={{flex: 1}}>{text}</Txt>
    {action && <Button variant="plain" label={action.label} disabled={action.disabled} onPress={action.onPress}/>}
  </View>;
}
