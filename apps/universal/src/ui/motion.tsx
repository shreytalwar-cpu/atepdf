// Motion system (DESIGN_SYSTEM 10, SHR-106 polish). React Native's own Animated only: no
// animation library. Motion confirms a change of state, is fast (120–280 ms) and never delays
// input. With Reduce Motion every movement becomes a short fade and loops stop.
import React, {createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {Animated, Easing, Platform, type StyleProp, type ViewStyle} from 'react-native';
import {useMotion} from '../components/assistant-ui/elements/surfaces';
import {IDLE, outcomeOf, stepPresence, type Outcome, type Presence} from './progress';
import {motion} from './theme';

export const easing = {standard: Easing.bezier(0.2, 0, 0, 1), enter: Easing.bezier(0, 0, 0, 1), exit: Easing.bezier(0.3, 0, 1, 1)};
export const nativeDriver = Platform.OS !== 'web';
/** Reduce Motion: a fade of at most 120 ms replaces movement. */
export const REDUCED_FADE = 120;

// Finite transitions in flight (never loops), published on the web so tests and evidence
// captures can wait for the UI to be still instead of sleeping.
let running = 0;
const publish = () => {if (Platform.OS === 'web' && typeof window !== 'undefined') (window as unknown as {__atepdfAnimations: number}).__atepdfAnimations = running;};
publish();
export function track(animation: Animated.CompositeAnimation, done?: () => void) {
  running++; publish();
  animation.start(() => {running--; publish(); done?.();});
  return () => animation.stop();
}

// Entries that have already appeared stay still when a list re-mounts them (scrolling,
// re-render). A key ("kind:entryId[:part]") appears once per session; a restored
// conversation is already there, so its entries never animate in.
const appeared = new Set<string>(), restored = new Set<number>();
export function markRestored(entryIds: Iterable<number>) {for (const id of entryIds) restored.add(id);}
const seen = (key: string) => appeared.has(key) || restored.has(Number(key.split(':')[1]));
/** True on the first render of something that has not appeared before. */
export function useFresh(key: string) {
  const fresh = useRef(!seen(key));
  useEffect(() => {appeared.add(key);}, []);
  return fresh.current;
}

type AppearProps = {
  children: ReactNode; id?: string; delay?: number; duration?: number;
  /** Movement while fading in: a 4 pt rise (default), a slide from the right, or a slight scale. */
  from?: 'below' | 'right' | 'scale' | 'none'; style?: StyleProp<ViewStyle>; testID?: string;
};
/** A11/C-series enter transition: opacity with a small rise, slide or scale. */
export function Appear({children, id, delay = 0, duration = motion['duration.base'], from = 'below', style, testID}: AppearProps) {
  const moving = useMotion();
  const fresh = useRef(id === undefined || !seen(id));
  const [progress] = useState(() => new Animated.Value(fresh.current ? 0 : 1));
  useEffect(() => {
    if (id !== undefined) appeared.add(id);
    if (!fresh.current) return;
    return track(Animated.timing(progress, {toValue: 1, duration: moving ? duration : REDUCED_FADE, delay: moving ? delay : 0, easing: easing.enter, useNativeDriver: nativeDriver, isInteraction: false}));
  }, []);
  const transform = !moving || from === 'none' ? undefined
    : from === 'right' ? [{translateX: progress.interpolate({inputRange: [0, 1], outputRange: [12, 0]})}]
    : from === 'scale' ? [{scale: progress.interpolate({inputRange: [0, 1], outputRange: [0.98, 1]})}]
    : [{translateY: progress.interpolate({inputRange: [0, 1], outputRange: [4, 0]})}];
  return <Animated.View testID={testID} style={[style, {opacity: progress, ...(transform ? {transform} : {})}]}>{children}</Animated.View>;
}

/** A one-shot 0 → 1 value for a state change (e.g. the verified moment), still with Reduce Motion. */
export function useMoment(trigger: boolean, duration: number, delay = 0) {
  const moving = useMotion();
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!trigger) return;
    if (!moving) {value.setValue(1); return;}
    value.setValue(0);
    return track(Animated.timing(value, {toValue: 1, duration, delay, easing: easing.standard, useNativeDriver: nativeDriver, isInteraction: false}));
  }, [trigger]);
  return value;
}

// Activity presence for the conversation: the activity row stays a moment after very fast
// work so it reads as request → working → result; the reply is held only for that remainder.
/** current: the result shown as current (the held reply's result is not on screen yet). */
export type ActivityPresence = {phase: Presence['phase']; outcome: Outcome | null; current?: number};
export const ActivityPresenceContext = createContext<ActivityPresence>({phase: 'idle', outcome: null});
export const useActivityPresenceState = () => useContext(ActivityPresenceContext);

type PresenceEntry = {role: string; artifact?: unknown; notice?: string};
export function useActivityPresence(entries: PresenceEntry[], working: boolean): Presence {
  const moving = useMotion();
  const state = useRef<Presence>(IDLE);
  const [, rerender] = useState(0);
  const base = state.current.phase === 'settling' ? state.current.cut : state.current.phase === 'active' ? state.current.lastCount : entries.length;
  const after = entries.slice(base);
  const next = stepPresence(state.current, {working, count: entries.length, now: Date.now(), reduced: !moving,
    newest: outcomeOf(after.findLast(entry => entry.role === 'assistant')), userAfter: after.some(entry => entry.role === 'user')});
  state.current = next;
  useEffect(() => {
    if (next.phase !== 'settling') return;
    const timer = setTimeout(() => rerender(n => n + 1), Math.max(0, next.until - Date.now()));
    return () => clearTimeout(timer);
  }, [next.phase, next.until]);
  return next;
}
