// Derived from assistant-ui native surfaces, MIT, commit 5b23b2df762737246990e6a7bccebdbac0ca0959.
// SHR-106 keeps only the announcement and reduce-motion helpers; shimmer, pulse and the
// template surface classes are replaced by the atePDF design system (no shimmer, principle 5).
import { useEffect, useRef, useSyncExternalStore } from "react";
import { AccessibilityInfo, Platform } from "react-native";

// Live regions only exist on Android and the web; announceForAccessibility covers iOS and Android and is a no-op on the web.
export const webLiveRegion =
  Platform.OS === "web" ? ("polite" as const) : undefined;

export const useAnnounce = (
  message: string | undefined,
  { onMount = true }: { onMount?: boolean } = {},
) => {
  const announced = useRef(onMount ? undefined : message);

  useEffect(() => {
    if (message !== undefined && message !== announced.current) {
      AccessibilityInfo.announceForAccessibility(message);
    }
    announced.current = message;
  }, [message]);
};

let reduceMotion: boolean | undefined;
let reduceMotionQuery = 0;
let reduceMotionSubscription: { remove(): void } | undefined;
const motionListeners = new Set<() => void>();

const setReduceMotion = (reduced: boolean) => {
  reduceMotion = reduced;
  for (const listener of motionListeners) listener();
};

const subscribeMotion = (listener: () => void) => {
  if (motionListeners.size === 0) {
    const query = ++reduceMotionQuery;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (reduced) => {
        if (query === reduceMotionQuery) setReduceMotion(reduced);
      },
      () => {},
    );
    reduceMotionSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
  }
  motionListeners.add(listener);
  return () => {
    motionListeners.delete(listener);
    if (motionListeners.size === 0) {
      reduceMotionQuery++;
      // react-native-web returns nothing when the environment has no matchMedia.
      reduceMotionSubscription?.remove();
      reduceMotionSubscription = undefined;
      reduceMotion = undefined;
    }
  };
};

const getMotion = () => reduceMotion === false;

export const useMotion = () =>
  useSyncExternalStore(subscribeMotion, getMotion, getMotion);
