// atePDF component primitives (COMPONENT_INVENTORY A1–A16). Every visual value comes from
// the generated SHR-105 tokens through useTheme(); nothing here hard-codes a colour.
import React, {useEffect, useRef, useState, type ReactNode} from 'react';
import {Animated, Platform, Pressable, Text, View, type AccessibilityState, type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle} from 'react-native';
import type {LucideIcon} from 'lucide-react-native';
import Check from 'lucide-react-native/icons/check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import LockKeyhole from 'lucide-react-native/icons/lock-keyhole';
import {useMotion} from '../components/assistant-ui/elements/surfaces';
import {motion, numeric, radius, shadow, type Palette, typeStyle, useTextScale, useTextSize, useTheme, TEXT_SIZES, type TypeRole} from './theme';

export type Tone = 'primary' | 'secondary' | 'tertiary' | 'disabled' | 'onAccent' | 'accent' | 'success' | 'warning' | 'danger' | 'local' | 'outbound';
export const toneColor = (c: Palette, tone: Tone) => ({
  primary: c.ink, secondary: c.inkSecondary, tertiary: c.inkTertiary, disabled: c.inkDisabled, onAccent: c.onAccent,
  accent: c.accentText, success: c.success, warning: c.warning, danger: c.danger, local: c.local, outbound: c.outbound,
})[tone];

type TxtProps = TextProps & {variant?: TypeRole; tone?: Tone; tabular?: boolean; style?: StyleProp<TextStyle>; children?: ReactNode};
/** Text in one of the type roles. Conversation roles follow Settings ▸ General ▸ Text size. */
export function Txt({variant = 'ui', tone = 'primary', tabular = false, style, ...props}: TxtProps) {
  const {c} = useTheme();
  const size = useTextSize(), scale = useTextScale();
  return <Text {...props} style={[typeStyle(variant, TEXT_SIZES[size], scale), {color: toneColor(c, tone)}, tabular && numeric, style]}/>;
}

/** A Lucide icon in the single approved style: 1.75 stroke, 14/16/20 pt. Decorative by default. */
export function Glyph({icon: Icon, size = 16, tone = 'secondary', color}: {icon: LucideIcon; size?: 14 | 16 | 20 | 12 | 13; tone?: Tone; color?: string}) {
  const {c} = useTheme();
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{width: size, height: size}} pointerEvents="none">
    <Icon size={size} strokeWidth={1.75} color={color ?? toneColor(c, tone)}/>
  </View>;
}

// Hover is pointer-only; the web renderer reports it, native Catalyst uses pointer hover events.
type Interaction = {hovered: boolean; pressed: boolean};
function useHover() {
  const [hovered, setHovered] = useState(false);
  return {hovered, hoverProps: {onHoverIn: () => setHovered(true), onHoverOut: () => setHovered(false)}};
}

export type ButtonVariant = 'primary' | 'secondary' | 'plain' | 'destructive' | 'destructivePlain';
type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string; variant?: ButtonVariant; size?: 'md' | 'lg'; icon?: LucideIcon; busy?: string | false;
  accessibilityLabel?: string; trailing?: ReactNode; style?: StyleProp<ViewStyle>; testID?: string;
};
/** A1 Button. Verbs that describe the outcome; one primary (Iris) per region. */
export const Button = React.forwardRef<View, ButtonProps>(function Button({label, variant = 'secondary', size = 'md', icon, busy = false, disabled = false, accessibilityLabel, trailing, style, ...props}, ref) {
  const {c, scheme} = useTheme();
  const {hovered, hoverProps} = useHover();
  const inactive = !!disabled || !!busy;
  const paint = ({pressed, hovered: webHovered}: Interaction & {hovered?: boolean}): ViewStyle => {
    const hover = (webHovered || hovered) && !inactive;
    const base: ViewStyle = {minHeight: size === 'lg' ? 32 : 28, paddingHorizontal: size === 'lg' ? 12 : 10, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6};
    if (disabled && !busy) return {...base, backgroundColor: variant === 'plain' || variant === 'destructivePlain' ? 'transparent' : c.hover};
    switch (variant) {
      case 'primary': return {...base, backgroundColor: pressed ? c.accentPressed : hover ? c.accentHover : c.accent};
      case 'destructive': return {...base, backgroundColor: c.dangerFill, opacity: pressed ? 0.85 : 1};
      case 'secondary': return {...base, backgroundColor: pressed ? c.pressed : hover ? c.elevated : c.raised, borderWidth: 1, borderColor: c.hairline, ...shadow('1', scheme)};
      default: return {...base, backgroundColor: pressed ? c.pressed : hover ? c.hover : 'transparent'};
    }
  };
  const tone: Tone = disabled && !busy ? 'disabled' : variant === 'primary' || variant === 'destructive' ? 'onAccent' : variant === 'destructivePlain' ? 'danger' : variant === 'plain' ? 'secondary' : 'primary';
  return <Pressable ref={ref} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{disabled: inactive, busy: !!busy}} aria-disabled={inactive}
    disabled={inactive} {...hoverProps} {...props} style={state => [paint(state as Interaction), style]}>
    {busy ? <ActivityGlyph active/> : icon ? <Glyph icon={icon} tone={tone}/> : null}
    <Txt variant="uiStrong" tone={tone} numberOfLines={1}>{busy || label}</Txt>
    {trailing}
  </Pressable>;
});

type IconButtonProps = Omit<PressableProps, 'children' | 'style'> & {icon: LucideIcon; label: string; toggled?: boolean; size?: 'toolbar' | 'inline'; tone?: Tone; style?: StyleProp<ViewStyle>; accessibilityState?: AccessibilityState};
/** A2 IconButton. Icon-only, so it always carries an accessibility label (and a hint for its shortcut). */
export const IconButton = React.forwardRef<View, IconButtonProps>(function IconButton({icon, label, toggled = false, size = 'toolbar', tone, disabled, style, accessibilityState, ...props}, ref) {
  const {c} = useTheme();
  const {hovered, hoverProps} = useHover();
  const dimension = size === 'toolbar' ? 28 : 24;
  return <Pressable ref={ref} accessibilityRole="button" accessibilityLabel={label} aria-disabled={!!disabled} disabled={disabled}
    accessibilityState={{...accessibilityState, disabled: !!disabled, ...(toggled ? {selected: true} : {})}} hitSlop={Platform.OS === 'web' ? undefined : 4}
    {...hoverProps} {...props}
    style={state => {const hover = ((state as Interaction).hovered || hovered) && !disabled; return [{width: dimension, height: dimension, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
      backgroundColor: state.pressed ? c.pressed : toggled ? c.pressed : hover ? c.hover : 'transparent', opacity: disabled ? 0.4 : 1}, style];}}>
    <Glyph icon={icon} tone={tone ?? (toggled ? 'primary' : 'secondary')}/>
  </Pressable>;
});

/** A3 Keycap: an inline shortcut hint. Decorative; the control's own label carries the shortcut. */
export function Keycap({children}: {children: string}) {
  const {c} = useTheme();
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{minWidth: 16, paddingHorizontal: 4, height: 16, borderRadius: radius.xs, borderWidth: 1, borderColor: c.hairline, alignItems: 'center', justifyContent: 'center'}}>
    <Txt variant="kbd" tone="tertiary">{children}</Txt>
  </View>;
}

export type TagKind = 'current' | 'earlier' | 'verified' | 'locked' | 'unsupported' | 'quality' | 'undone' | 'restored';
const TAG_TEXT: Record<TagKind, string> = {current: 'Current', earlier: 'Earlier', verified: 'Verified', locked: 'Locked', unsupported: 'Unsupported', quality: 'Quality changed', undone: 'Undone', restored: 'Restored'};
/** A4 Tag. Status words from DESIGN_SYSTEM 13; colour is never the only signal. */
export function Tag({kind, label}: {kind: TagKind; label?: string}) {
  const {c} = useTheme();
  const fill = kind === 'current' ? c.accentSubtle : kind === 'earlier' || kind === 'undone' || kind === 'restored' ? c.sunken : kind === 'unsupported' ? c.dangerBg : kind === 'quality' ? c.warningBg : 'transparent';
  const tone: Tone = kind === 'current' ? 'accent' : kind === 'verified' ? 'success' : kind === 'unsupported' ? 'danger' : kind === 'quality' ? 'warning' : 'secondary';
  return <View style={{height: 18, paddingHorizontal: fill === 'transparent' ? 0 : 6, borderRadius: radius.xs, backgroundColor: fill, flexDirection: 'row', alignItems: 'center', gap: 3}}>
    {kind === 'verified' && <Glyph icon={Check} size={12} tone="success"/>}
    {kind === 'locked' && <Glyph icon={LockKeyhole} size={12} tone="secondary"/>}
    <Txt variant="caption" tone={tone}>{label ?? TAG_TEXT[kind]}</Txt>
  </View>;
}

/** A14 ActivityGlyph: the mark's two counters alternating. Static with Reduce Motion. Replaces spinners and typing dots. */
export function ActivityGlyph({active = true, testID}: {active?: boolean; testID?: string}) {
  const {c} = useTheme();
  const moving = useMotion() && active;
  const [phase] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!moving) {phase.setValue(0); return;}
    const half = motion['duration.activityCycle'] / 2, useNativeDriver = Platform.OS !== 'web';
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(phase, {toValue: 1, duration: half, useNativeDriver, isInteraction: false}),
      Animated.timing(phase, {toValue: 0, duration: half, useNativeDriver, isInteraction: false}),
    ]));
    loop.start(); return () => loop.stop();
  }, [moving, phase]);
  const top = moving ? phase.interpolate({inputRange: [0, 1], outputRange: [1, 0.35]}) : 1;
  const bottom = moving ? phase.interpolate({inputRange: [0, 1], outputRange: [0.35, 1]}) : 1;
  const bar: ViewStyle = {width: 10, height: 5, borderRadius: 1.5, backgroundColor: c.accentText};
  return <View testID={testID} accessible={false} importantForAccessibility="no-hide-descendants" style={{width: 14, height: 14, alignItems: 'center', justifyContent: 'center', gap: 2}}>
    <Animated.View style={[bar, {opacity: top}]}/>
    <Animated.View style={[bar, {opacity: bottom}]}/>
  </View>;
}

/** A15 Disclosure. */
export function Disclosure({label, expanded, onToggle, children}: {label: string; expanded: boolean; onToggle: () => void; children?: ReactNode}) {
  const {c} = useTheme();
  return <View style={{gap: 6}}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{expanded}} aria-expanded={expanded} onPress={onToggle}
      style={({pressed}) => ({flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 2, paddingRight: 6, borderRadius: radius.xs, backgroundColor: pressed ? c.pressed : 'transparent'})}>
      <View style={{transform: [{rotate: expanded ? '90deg' : '0deg'}]}}><Glyph icon={ChevronRight} size={12} tone="secondary"/></View>
      <Txt variant="meta" tone="secondary">{label}</Txt>
    </Pressable>
    {expanded && children}
  </View>;
}

/** A7 SegmentedControl. */
export function SegmentedControl<T extends string>({value, options, onChange, label, disabled = false}: {value: T; options: {value: T; label: string}[]; onChange: (value: T) => void; label: string; disabled?: boolean}) {
  const {c, scheme} = useTheme();
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} aria-label={label} style={{flexDirection: 'row', height: 28, padding: 2, gap: 2, borderRadius: radius.sm, backgroundColor: c.sunken, opacity: disabled ? 0.5 : 1}}>
    {options.map(option => {const selected = option.value === value; return <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{checked: selected, disabled}} aria-checked={selected}
      disabled={disabled} onPress={() => onChange(option.value)}
      style={({pressed}) => ({paddingHorizontal: 10, borderRadius: radius.sm - 2, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? c.raised : pressed ? c.pressed : 'transparent', ...(selected ? shadow('1', scheme) : {})})}>
      <Txt variant={selected ? 'uiStrong' : 'ui'} tone={selected ? 'primary' : 'secondary'}>{option.label}</Txt>
    </Pressable>;})}
  </View>;
}

/** A13 Meter (determinate). A stacked bar when given several segments. Renders the known value; never animated from 0. */
export function Meter({segments, label}: {segments: {value: number; color: string}[]; label: string}) {
  const {c} = useTheme();
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  return <View accessible accessibilityLabel={label} style={{height: 4, borderRadius: radius.full, backgroundColor: c.sunken, flexDirection: 'row', overflow: 'hidden'}}>
    {segments.filter(segment => segment.value > 0).map((segment, index) => <View key={index} style={{flexGrow: segment.value / total, backgroundColor: segment.color}}/>)}
  </View>;
}

/** A hairline separator, inset to the content edge in lists. */
export function Separator({inset = 0, vertical = false}: {inset?: number; vertical?: boolean}) {
  const {c} = useTheme();
  return vertical ? <View style={{width: 1, alignSelf: 'stretch', backgroundColor: c.hairline}}/> : <View style={{height: 1, marginLeft: inset, backgroundColor: c.hairline}}/>;
}

/** A card surface (level 1): result, proposal and file-group containers. */
export function Card({children, style, testID, accessibilityLabel, selected = false}: {children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string; accessibilityLabel?: string; selected?: boolean}) {
  const {c, scheme} = useTheme();
  return <View testID={testID} accessibilityLabel={accessibilityLabel} style={[{backgroundColor: c.raised, borderWidth: 1, borderColor: selected ? c.accentBorder : c.hairline, borderRadius: radius.lg}, shadow('1', scheme), style]}>{children}</View>;
}

/** A pointer-and-keyboard row (lists, menus, palette, files panel). Row focus uses the selected fill. */
export const Row = React.forwardRef<View, Omit<PressableProps, 'style' | 'children'> & {children: ReactNode; selected?: boolean; height?: number; style?: StyleProp<ViewStyle>}>(function Row({children, selected = false, height = 32, disabled, style, ...props}, ref) {
  const {c} = useTheme();
  const {hovered, hoverProps} = useHover();
  return <Pressable ref={ref} disabled={disabled} {...hoverProps} {...props}
    style={state => [{minHeight: height, borderRadius: radius.md, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: selected ? c.selected : state.pressed ? c.pressed : ((state as Interaction).hovered || hovered) && !disabled ? c.hover : 'transparent'}, style]}>
    {children}
  </Pressable>;
});

/** E4 SettingsSection: a section label and a grouped container. */
export function Section({title, children, labelId}: {title: string; children: ReactNode; labelId?: string}) {
  const {c} = useTheme();
  return <View style={{gap: 6}}>
    <Txt variant="section" tone="secondary" accessibilityRole="header" nativeID={labelId}>{title}</Txt>
    <View style={{backgroundColor: c.raised, borderWidth: 1, borderColor: c.hairline, borderRadius: radius.lg, paddingVertical: 4}}>{children}</View>
  </View>;
}

