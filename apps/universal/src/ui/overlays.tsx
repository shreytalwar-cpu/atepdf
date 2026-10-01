// Sheets, popovers and menus (COMPONENT_INVENTORY A5, A9, A10, A11). A sheet is attached to
// the window and modal: focus stays inside and returns to the invoker when it closes.
import React, {useEffect, useRef, useState, type ReactNode, type RefObject} from 'react';
import {Modal, Platform, Pressable, ScrollView, View, useWindowDimensions, type LayoutRectangle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {LucideIcon} from 'lucide-react-native';
import LaptopMinimal from 'lucide-react-native/icons/laptop-minimal';
import {useMotion} from '../components/assistant-ui/elements/surfaces';
import {Glyph, Keycap, Row, Txt} from './primitives';
import {radius, shadow, useTheme} from './theme';

type SheetProps = {
  visible: boolean; onClose: () => void; title: string; children: ReactNode;
  width?: number; height?: number; icon?: LucideIcon; iconTone?: 'warning' | 'danger' | 'secondary' | 'local';
  footer?: ReactNode; dismissible?: boolean; testID?: string; bodyPadding?: number; hideTitle?: boolean; scroll?: boolean;
};
/** A11 Sheet. Esc cancels (except where the flow must not be skipped). */
export function Sheet({visible, onClose, title, children, width = 420, height, icon, iconTone = 'secondary', footer, dismissible = true, testID, bodyPadding = 20, hideTitle = false, scroll = true}: SheetProps) {
  const {c, scheme} = useTheme();
  const motion = useMotion();
  const window = useWindowDimensions();
  // The Mac title bar (traffic lights) sits over the top of a full-window modal.
  const top = useSafeAreaInsets().top;
  const maxWidth = Math.min(width, window.width - 32), maxHeight = Math.min(height ?? window.height - 48 - top, window.height - 48 - top);
  const body = <View style={{padding: bodyPadding, gap: 12, ...(scroll ? {} : {flex: 1, minHeight: 0})}}>
    {!hideTitle && <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
      {icon && <Glyph icon={icon} size={20} tone={iconTone}/>}
      <Txt variant="title1" accessibilityRole="header" style={{flexShrink: 1}}>{title}</Txt>
    </View>}
    {children}
  </View>;
  return <Modal visible={visible} transparent animationType={motion ? 'fade' : 'none'} onRequestClose={() => {if (dismissible) onClose();}}
    accessibilityLabel={Platform.OS === 'web' ? title : undefined} supportedOrientations={['portrait', 'landscape']}>
    <View style={{flex: 1, backgroundColor: c.scrim, alignItems: 'center', justifyContent: 'center', padding: 16, paddingTop: 16 + top}}>
      <View testID={testID} accessibilityViewIsModal role={Platform.OS === 'web' ? undefined : 'dialog'} accessibilityLabel={Platform.OS === 'web' ? undefined : title}
        style={[{width: maxWidth, maxHeight, ...(height ? {height: maxHeight} : {}), backgroundColor: c.elevated, borderRadius: radius['2xl'], borderWidth: 1, borderColor: c.hairline, overflow: 'hidden'}, shadow('3', scheme)]}>
        {scroll ? <ScrollView style={{flexGrow: 0, flexShrink: 1}} contentContainerStyle={{flexGrow: 1}} keyboardShouldPersistTaps="handled">{body}</ScrollView> : <View style={{flex: 1}}>{body}</View>}
        {footer && <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: c.hairline}}>{footer}</View>}
      </View>
    </View>
  </Modal>;
}

/** Measures an anchor so a popover can open beside it. */
export function useAnchor<T extends View>(): [RefObject<T | null>, LayoutRectangle | null, () => Promise<LayoutRectangle>] {
  const ref = useRef<T>(null);
  const [rect, setRect] = useState<LayoutRectangle | null>(null);
  const measure = () => new Promise<LayoutRectangle>(resolve => {
    const node = ref.current;
    if (!node) {const empty = {x: 0, y: 0, width: 0, height: 0}; setRect(empty); resolve(empty); return;}
    node.measureInWindow((x, y, width, height) => {const next = {x, y, width, height}; setRect(next); resolve(next);});
  });
  return [ref, rect, measure];
}

/** A9 Popover: anchored, dismissed by Esc or click-away; focus returns to the anchor. */
export function Popover({visible, anchor, onClose, children, width = 320, align = 'end', label, placement = 'below'}: {visible: boolean; anchor: LayoutRectangle | null; onClose: () => void; children: ReactNode; width?: number; align?: 'start' | 'end' | 'center'; label: string; placement?: 'below' | 'above'}) {
  const {c, scheme} = useTheme();
  const window = useWindowDimensions();
  // The click that opened a popover must not also land on its backdrop and close it.
  const opened = useRef(0);
  useEffect(() => {if (visible) opened.current = Date.now();}, [visible]);
  if (!visible || !anchor) return null;
  const w = Math.min(width, window.width - 16);
  const left = Math.max(8, Math.min(window.width - w - 8, align === 'end' ? anchor.x + anchor.width - w : align === 'center' ? anchor.x + anchor.width / 2 - w / 2 : anchor.x));
  const position = placement === 'below' ? {top: anchor.y + anchor.height + 8} : {bottom: window.height - anchor.y + 8};
  return <Modal visible transparent animationType="none" onRequestClose={onClose} accessibilityLabel={Platform.OS === 'web' ? label : undefined}>
    <Pressable accessibilityLabel="Close" accessible={false} onPress={() => {if (Date.now() - opened.current > 300) onClose();}} style={{position: 'absolute', inset: 0} as never}/>
    <View accessibilityViewIsModal style={[{position: 'absolute', left, width: w, ...position, backgroundColor: c.elevated, borderRadius: radius.xl, borderWidth: 1, borderColor: c.hairline, padding: 6}, shadow('2', scheme)]}>
      {children}
    </View>
  </Modal>;
}

export type MenuItem = {label: string; onPress: () => void; shortcut?: string; disabled?: boolean; destructive?: boolean; hint?: string} | 'separator';
/** A10 Menu (the in-window fallback for the toolbar ⋯ and row menus). */
export function Menu({items, onClose, ...props}: {visible: boolean; anchor: LayoutRectangle | null; onClose: () => void; items: MenuItem[]; label: string; width?: number; align?: 'start' | 'end'}) {
  const {c} = useTheme();
  const first = useRef<View>(null);
  useEffect(() => {if (props.visible && Platform.OS === 'web') setTimeout(() => (first.current as unknown as HTMLElement | null)?.focus?.(), 0);}, [props.visible]);
  let firstEnabled = true;
  return <Popover {...props} onClose={onClose} width={props.width ?? 240}>
    <View accessibilityRole="menu" aria-label={props.label}>
      {items.map((item, index) => {
        if (item === 'separator') return <View key={index} style={{height: 1, backgroundColor: c.hairline, marginVertical: 4, marginHorizontal: 8}}/>;
        const isFirst = firstEnabled && !item.disabled; if (isFirst) firstEnabled = false;
        return <Row key={item.label} ref={isFirst ? first : undefined} height={26} accessibilityRole="menuitem" accessibilityLabel={item.label} accessibilityHint={item.hint} disabled={item.disabled}
          accessibilityState={{disabled: !!item.disabled}} onPress={() => {onClose(); item.onPress();}} style={{borderRadius: radius.sm, paddingHorizontal: 10}}>
          <Txt variant="ui" tone={item.disabled ? 'disabled' : item.destructive ? 'danger' : 'primary'} style={{flex: 1}}>{item.label}</Txt>
          {item.shortcut && <Txt variant="ui" tone="tertiary">{item.shortcut}</Txt>}
        </Row>;
      })}
    </View>
  </Popover>;
}

/** A5 StatusPill "On this Mac". Icon-only in compact windows, with the same accessible name. */
export const StatusPill = React.forwardRef<View, {compact: boolean; onPress: () => void; label: string; accessibilityLabel: string; hint?: string}>(function StatusPill({compact, onPress, label, accessibilityLabel, hint}, ref) {
  const {c} = useTheme();
  return <Pressable ref={ref} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={hint} onPress={onPress}
    style={({pressed}) => ({height: 24, minWidth: 24, paddingHorizontal: compact ? 0 : 8, width: compact ? 24 : undefined, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.localBg, opacity: pressed ? 0.8 : 1})}>
    <Glyph icon={LaptopMinimal} size={14} tone="local"/>
    {!compact && <Txt variant="meta" tone="local">{label}</Txt>}
  </Pressable>;
});

export {Keycap};
