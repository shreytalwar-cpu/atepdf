// First-paint conversation surfaces (startup bundle): the empty workspace, inline banners and
// outcome icons. Everything that needs files lives in the lazily loaded conversation views.
import {Platform, ScrollView, View, useWindowDimensions} from 'react-native';
import Ban from 'lucide-react-native/icons/ban';
import CircleX from 'lucide-react-native/icons/circle-x';
import CloudOff from 'lucide-react-native/icons/cloud-off';
import CornerDownLeft from 'lucide-react-native/icons/corner-down-left';
import Square from 'lucide-react-native/icons/square';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import {webLiveRegion} from '../components/assistant-ui/elements/surfaces';
import {nativeEngineReady, ocrAvailable} from '../platform/runtime';
import type {Notice} from '../workspace/useWorkspace';
import {BrandMark} from './BrandMark';
import {useApp} from './context';
import {Appear} from './motion';
import {Button, Glyph, Keycap, Row, Txt, type Tone} from './primitives';
import {radius, shadow, useTheme} from './theme';

/** The OutcomeNotice icon beside a turn that reports an error, refusal, cancellation or unavailability (C11). */
export function NoticeIcon({notice}: {notice?: Notice}) {
  if (!notice) return null;
  const [icon, tone]: [typeof Ban, Tone] = notice === 'error' ? [CircleX, 'danger'] : notice === 'refused' ? [Ban, 'danger'] : notice === 'unavailable' ? [CloudOff, 'secondary'] : [Square, 'secondary'];
  return <View style={{paddingTop: 2}}><Glyph icon={icon} tone={tone}/></View>;
}

/** The mark's folded corner on a surface: the cut shows what is behind, the flap is an Iris tint. */
export function FoldCorner({side, behind}: {side: number; behind: string}) {
  const {c} = useTheme();
  return <View pointerEvents="none" style={{position: 'absolute', top: -1, right: -1, width: 0, height: 0, borderTopWidth: side, borderLeftWidth: side, borderTopColor: behind, borderLeftColor: c.accentBorder}}/>;
}

/** B6 EmptyWorkspace: a blank folio waiting for PDFs. Examples only fill the composer. */
export function EmptyWorkspace() {
  const {workspace: w, composer} = useApp();
  const {c, scheme} = useTheme();
  const {height, width} = useWindowDimensions();
  const examples = ['Merge these into one PDF', 'Remove page 2', ...(ocrAvailable ? ['Make the scanned pages searchable'] : []), 'Make this PDF smaller'].slice(0, 3);
  const tall = height >= 600;
  // Scrolls when the window is short or text is large, so its actions are never under the composer.
  return <ScrollView testID="welcome" style={{flex: 1}} contentContainerStyle={{flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: tall ? 24 : 12, paddingHorizontal: 16, gap: 24}}>
    <Appear id="welcome" from="scale" duration={240} style={{width: '100%', maxWidth: 440}}>
      <View style={[{alignItems: 'center', paddingHorizontal: width < 500 ? 20 : 32, paddingTop: tall ? 32 : 16, paddingBottom: tall ? 24 : 16, borderRadius: radius['2xl'], borderWidth: 1, borderColor: c.hairline, backgroundColor: c.raised, overflow: 'hidden'}, shadow('1', scheme)]}>
        <FoldCorner side={tall ? 26 : 20} behind={c.window}/>
        {tall && <><BrandMark size={48} label="atePDF"/><View style={{height: 16}}/></>}
        <Txt variant={tall ? 'display' : 'title1'} accessibilityRole="header" style={{textAlign: 'center'}}>Drop PDFs here</Txt>
        <View style={{height: 6}}/>
        <Txt variant="ui" tone="secondary" style={{textAlign: 'center', maxWidth: 380}}>Then tell atePDF what you need. It works on copies, here on this Mac, and your originals stay as they are.</Txt>
        <View style={{height: tall ? 20 : 12}}/>
        <View style={{flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center'}}>
          <Button variant="primary" label="Choose Files…" accessibilityLabel="Choose files" disabled={w.busy} onPress={() => void w.pick()} trailing={Platform.OS === 'web' ? <Keycap onAccent>⌘O</Keycap> : undefined}/>
          <Button variant="plain" label="Try with sample PDFs" disabled={w.busy || !nativeEngineReady} onPress={() => void w.pick(true)}/>
        </View>
      </View>
    </Appear>
    {tall && <Appear id="welcome-examples" delay={60} style={{width: '100%', maxWidth: 440, gap: 2}}>
      <Txt variant="section" tone="tertiary" style={{paddingHorizontal: 8, paddingBottom: 4}}>Try asking</Txt>
      {examples.map(example => <Row key={example} accessibilityRole="button" accessibilityLabel={`Use example: ${example}`} accessibilityHint="Puts this request in the message field" onPress={() => composer.fill(example)}>
        <Txt variant="ui" tone="secondary" style={{flex: 1}}>{example}</Txt><Glyph icon={CornerDownLeft} size={14} tone="tertiary"/>
      </Row>)}
    </Appear>}
  </ScrollView>;
}

/** B5 InlineBanner: workspace notices at the top of the conversation column. Copy is unchanged. */
export function InlineBanner({text, variant, action}: {text: string; variant: 'info' | 'warning' | 'danger'; action?: {label: string; onPress: () => void; disabled?: boolean}}) {
  const {c} = useTheme();
  return <Appear>
    <View accessibilityLiveRegion="polite" aria-live={webLiveRegion} style={{flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.raised, borderWidth: 1, borderColor: c.hairline, borderRadius: radius.lg, paddingVertical: 8, paddingHorizontal: 12}}>
      <Glyph icon={variant === 'danger' ? CircleX : TriangleAlert} tone={variant === 'info' ? 'secondary' : variant}/>
      <Txt variant="ui" style={{flex: 1}}>{text}</Txt>
      {action && <Button variant="plain" label={action.label} disabled={action.disabled} onPress={action.onPress}/>}
    </View>
  </Appear>;
}
