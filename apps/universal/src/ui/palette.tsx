// D3 ActionPalette, loaded the first time ⌘K or Actions is used.
import {useRef, useState} from 'react';
import {ScrollView, TextInput, View, useWindowDimensions} from 'react-native';
import Search from 'lucide-react-native/icons/search';
import {nativeEngineReady} from '../platform/runtime';
import {useApp} from './context';
import {Popover} from './overlays';
import {Glyph, Keycap, Row, Txt} from './primitives';
import {allActions, SHORTCUTS, suggestions, type Suggestion} from './shell';
import {useTheme} from './theme';

/** D3 ActionPalette (⌘K). Capability rows become sentences in the conversation; workspace rows run locally. */
export default function ActionPalette() {
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
