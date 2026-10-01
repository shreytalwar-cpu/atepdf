import {useSyncExternalStore} from 'react';
import {Platform, useColorScheme, type TextStyle, type ViewStyle} from 'react-native';
import {Uniwind} from 'uniwind';
import {colors, elevation, typeScale, type TypeRole} from './tokens';

export * from './tokens';

export type Scheme = 'light' | 'dark';
export type Appearance = 'system' | Scheme;
export type Palette = {readonly [K in keyof typeof colors.light]: string};

// Settings ▸ General ▸ Appearance. Follows the system by default. The choice lasts for
// this session: v1 has no approved preferences store outside the workspace vault.
let appearance: Appearance = 'system';
const listeners = new Set<() => void>();
export function setAppearance(next: Appearance) {
  if (next === appearance) return;
  appearance = next;
  Uniwind.setTheme(next);
  listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => {listeners.add(listener); return () => {listeners.delete(listener);};};
const read = () => appearance;
export const useAppearance = () => useSyncExternalStore(subscribe, read, read);

/** The resolved light/dark scheme and its palette. Every themed style reads this. */
export function useTheme() {
  const system = useColorScheme();
  const chosen = useAppearance();
  const scheme: Scheme = chosen === 'system' ? (system === 'dark' ? 'dark' : 'light') : chosen;
  return {scheme, c: colors[scheme] as Palette};
}

// Conversation text size (Settings ▸ General). Chrome stays at the ui sizes.
export type TextSize = 'small' | 'default' | 'large' | 'larger';
export const TEXT_SIZES: Record<TextSize, number> = {small: 13, default: 14, large: 16, larger: 18};
let textSize: TextSize = 'default';
const sizeListeners = new Set<() => void>();
export function setTextSize(next: TextSize) {if (next === textSize) return; textSize = next; sizeListeners.forEach(listener => listener());}
const subscribeSize = (listener: () => void) => {sizeListeners.add(listener); return () => {sizeListeners.delete(listener);};};
const readSize = () => textSize;
export const useTextSize = () => useSyncExternalStore(subscribeSize, readSize, readSize);

export const numeric: TextStyle = {fontVariant: ['tabular-nums']};
export const mono = Platform.select({ios: 'Menlo', default: 'ui-monospace, SFMono-Regular, Menlo, monospace'});

export function typeStyle(role: TypeRole, conversationSize?: number): TextStyle {
  const t = typeScale[role];
  if (conversationSize && (role === 'body' || role === 'bodyStrong')) {
    return {fontSize: conversationSize, lineHeight: Math.round(conversationSize * 1.5), fontWeight: t.fontWeight, letterSpacing: t.letterSpacing};
  }
  return {fontSize: t.fontSize, lineHeight: t.lineHeight, fontWeight: t.fontWeight, letterSpacing: t.letterSpacing};
}

/** Elevation per DESIGN_SYSTEM 7. Dark cards rely on the hairline and surface step, not shadow. */
export function shadow(level: '1' | '2' | '3' | 'page', scheme: Scheme): ViewStyle {
  const value = elevation[scheme][level];
  return value === 'none' ? {} : {boxShadow: value} as ViewStyle;
}

// Window layout breakpoints (DESIGN_SYSTEM 5, UX_SPEC S2.1).
export const layout = {
  compact: (width: number) => width < 760,
  panelDocks: (width: number) => width >= 1120,
  gutter: (width: number) => width < 760 ? 16 : 24,
};
