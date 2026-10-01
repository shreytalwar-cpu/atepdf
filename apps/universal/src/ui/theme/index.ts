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

// The browser's text size (the root font size) scales all text on the web, as rem-based type did.
// Native uses Settings ▸ General ▸ Text size and the system instead.
const readRootScale = () => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return 1;
  const size = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(size) && size > 0 ? size / 16 : 1;
};
let rootScale = readRootScale();
const scaleListeners = new Set<() => void>();
const subscribeScale = (listener: () => void) => {
  scaleListeners.add(listener);
  let observer: MutationObserver | undefined;
  if (scaleListeners.size === 1 && Platform.OS === 'web' && typeof MutationObserver !== 'undefined') {
    const update = () => {const next = readRootScale(); if (next !== rootScale) {rootScale = next; scaleListeners.forEach(fn => fn());}};
    observer = new MutationObserver(update);
    observer.observe(document.documentElement, {attributes: true, attributeFilter: ['style', 'class']});
    window.addEventListener('resize', update);
    stopScale = () => {observer?.disconnect(); window.removeEventListener('resize', update);};
    // A change between module load and this first subscription is picked up here.
    update();
  }
  return () => {scaleListeners.delete(listener); if (!scaleListeners.size) stopScale();};
};
let stopScale = () => {};
const readScale = () => rootScale;
export const useTextScale = () => useSyncExternalStore(subscribeScale, readScale, () => 1);

export const numeric: TextStyle = {fontVariant: ['tabular-nums']};
export const mono = Platform.select({ios: 'Menlo', default: 'ui-monospace, SFMono-Regular, Menlo, monospace'});

export function typeStyle(role: TypeRole, conversationSize?: number, scale = 1): TextStyle {
  const t = typeScale[role];
  if (conversationSize && (role === 'body' || role === 'bodyStrong')) {
    return {fontSize: conversationSize * scale, lineHeight: Math.round(conversationSize * 1.5 * scale), fontWeight: t.fontWeight, letterSpacing: t.letterSpacing};
  }
  return {fontSize: t.fontSize * scale, lineHeight: t.lineHeight * scale, fontWeight: t.fontWeight, letterSpacing: t.letterSpacing};
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
