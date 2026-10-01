// Derived from assistant-ui native thread, MIT, commit 5b23b2df762737246990e6a7bccebdbac0ca0959.
// See docs/upstream/assistant-ui.md for local-only slots and omitted transports.
// SHR-106: the scroll-intent logic (follow a new submission, keep the reading position,
// Latest) is unchanged; message, composer and footer rendering follow the atePDF design
// system. Voice, edit, reload, branch and suggestion primitives are not rendered (v1 has
// no regenerate or edit: those would bypass the controller's history).
import {
  AuiIf,
  type AssistantState,
  ActionBarPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  type TextMessagePartComponent,
  type ThreadMessage,
  useAui,
  useAuiState,
} from "@assistant-ui/react-native";
import {safeOrdinaryText} from '@planner/privacy';
import ArrowUpIcon from 'lucide-react-native/icons/arrow-up';
import ArrowDownIcon from 'lucide-react-native/icons/arrow-down';
import CheckIcon from 'lucide-react-native/icons/check';
import CopyIcon from 'lucide-react-native/icons/copy';
import {
  type ComponentRef,
  type ComponentType,
  createContext,
  type FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AccessibilityInfo,
  type FlatList,
  type FlatListProps,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";
import {Glyph, Txt} from '@/ui/primitives';
import {radius, shadow, typeStyle, useTextScale, useTextSize, useTheme, TEXT_SIZES} from '@/ui/theme';

// Uniwind's native resolver treats the scoped @assistant-ui/react-native path as
// React Native internals. Map classes at our template boundary so those
// third-party primitives receive native style props. Keep web output unchanged.
const StyledThreadRoot = Platform.OS === "web" ? ThreadPrimitive.Root : withUniwind(ThreadPrimitive.Root);
const StyledMessagesFlatList = Platform.OS === "web" ? ThreadPrimitive.MessagesFlatList : withUniwind(ThreadPrimitive.MessagesFlatList);
const StyledMessageRoot = Platform.OS === "web" ? MessagePrimitive.Root : withUniwind(MessagePrimitive.Root);
const StyledComposerRoot = Platform.OS === "web" ? ComposerPrimitive.Root : withUniwind(ComposerPrimitive.Root);
const StyledComposerSend = Platform.OS === "web" ? ComposerPrimitive.Send : withUniwind(ComposerPrimitive.Send);
const StyledComposerCancel = Platform.OS === "web" ? ComposerPrimitive.Cancel : withUniwind(ComposerPrimitive.Cancel);
const StyledActionCopy = Platform.OS === "web" ? ActionBarPrimitive.Copy : withUniwind(ActionBarPrimitive.Copy);

const isNewChatView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  (!s.thread.isLoading || s.threads.isLoading);

export type ThreadComponents = {
  /** The assistant turn's body (text, outcome, artifacts); the thread supplies the root and Copy. */
  AssistantMessage?: ComponentType | undefined;
  /** The user turn's body (a request block, or the files an import added). */
  UserMessage?: ComponentType | undefined;
  /** Local job activity, replacing the generic typing state for a running turn. */
  Activity?: ComponentType | undefined;
  AddAttachment?: ComponentType | undefined;
  /** Above the input inside the composer: what the next request applies to. */
  ComposerTop?: ComponentType | undefined;
  /** Beside Send inside the composer: suggestion chips and the actions palette. */
  ComposerActions?: ComponentType | undefined;
  /** Below the composer: the hint row. */
  Footer?: ComponentType | undefined;
  /** Above the conversation: workspace notices. */
  Banner?: ComponentType | undefined;
  Welcome?: ComponentType | undefined;
  /** Replaces the text input of the composer. */
  ComposerInput?: ComponentType | undefined;
  /** Overlays the message list, which keeps a gutter free along its left edge for it; it reads the list through `useThreadViewport`. Mounting or unmounting it remounts the list. */
  Rail?: ComponentType | undefined;
};

export type ThreadHistory = {
  /** Whether messages older than the loaded window exist. */
  readonly hasMore: boolean;
  /** Whether a page of older messages is on its way. */
  readonly isLoadingMore: boolean;
  /** Loads the next page of older messages above the window. */
  readonly loadMore: () => void;
};

export type ThreadProps = {
  components?: ThreadComponents | undefined;
  /** A windowed thread: the list asks for older messages when it reaches its start and shows the loading edge above them. */
  history?: ThreadHistory | undefined;
};

export type ThreadViewportSnapshot = {
  /** The ids of the messages on screen, in list order. */
  readonly visibleMessageIds: readonly string[];
  /**
   * Zero until the list is within one screenful of its end, then the share of
   * that stretch scrolled, so a reading line placed at this fraction of the
   * viewport can still reach the final turns.
   */
  readonly descent: number;
  /** The message list's height. */
  readonly height: number;
  /** The message list's offset from the top of the thread viewport, which grows while the history edge shows. */
  readonly top: number;
};

export type ThreadViewport = ThreadViewportSnapshot & {
  /** Scrolls the message list until the message starts at the top of the viewport. */
  readonly scrollToMessage: (id: string) => void;
  /** Reveals a measured native reading region after the keyboard changes the viewport. */
  readonly revealNativeRegion: (top: number, bottom: number) => void;
};

type ThreadViewportStore = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => ThreadViewportSnapshot;
  readonly scrollToMessage: (id: string) => void;
  readonly revealNativeRegion: (top: number, bottom: number) => void;
};

const EMPTY_COMPONENTS: ThreadComponents = {};
const EMPTY_IDS: readonly string[] = [];
const IDLE_VIEWPORT: ThreadViewportSnapshot = {
  visibleMessageIds: EMPTY_IDS,
  descent: 0,
  height: 0,
  top: 0,
};
const MESSAGE_VIEWABILITY = {
  minimumViewTime: 0,
  viewAreaCoveragePercentThreshold: 0,
};
type ViewabilityInfo = Parameters<
  NonNullable<FlatListProps<ThreadMessage>["onViewableItemsChanged"]>
>[0];
const SCROLL_RETRY_DELAY = 100;

const ThreadComponentsContext =
  createContext<ThreadComponents>(EMPTY_COMPONENTS);

const ThreadViewportContext = createContext<ThreadViewportStore>({
  subscribe: () => () => {},
  getSnapshot: () => IDLE_VIEWPORT,
  scrollToMessage: () => {},
  revealNativeRegion: () => {},
});

// The thread's viewport commands for controls outside the list (the Files panel reveals a turn).
let activeViewport: ThreadViewportStore | null = null;
export const revealMessage = (id: string) => activeViewport?.scrollToMessage(id);

const createViewportStore = () => {
  const listeners = new Set<() => void>();
  let snapshot = IDLE_VIEWPORT;

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    publish: (next: Partial<ThreadViewportSnapshot>) => {
      snapshot = { ...snapshot, ...next };
      for (const listener of listeners) listener();
    },
  };
};

/** What the thread's message list shows right now, for an element that overlays it. */
export const useThreadViewport = (): ThreadViewport => {
  const { subscribe, getSnapshot, scrollToMessage, revealNativeRegion } = useContext(
    ThreadViewportContext,
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(
    () => ({ ...snapshot, scrollToMessage, revealNativeRegion }),
    [snapshot, scrollToMessage, revealNativeRegion],
  );
};

const copyToClipboard = async (text: string) => {
  // Copy is web-only (CopyMessage); the browser clipboard keeps expo-clipboard out of the startup bundle.
  await navigator.clipboard.writeText(safeOrdinaryText(text));
};

export const Thread: FC<ThreadProps> = ({
  components = EMPTY_COMPONENTS,
  history,
}) => {
  const aui = useAui();
  const isEmpty = useAuiState(isNewChatView);
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const latestUserId = useAuiState((s) => s.thread.messages.findLast(message => message.role === 'user')?.id);
  const insets = useSafeAreaInsets();
  const viewportRef = useRef<ComponentRef<typeof View>>(null);
  const [viewportTop, setViewportTop] = useState(0);
  const [awayFromEnd, setAwayFromEnd] = useState(false);
  const [store] = useState(createViewportStore);
  const listRef = useRef<FlatList<ThreadMessage>>(null);
  const followSubmission = useRef(true);
  const metricsRef = useRef({
    contentHeight: 0,
    viewportHeight: 0,
    scrollY: 0,
  });
  const jumpRef = useRef<
    | {
        id: string;
        retried: boolean;
        timer: ReturnType<typeof setTimeout> | undefined;
      }
    | undefined
  >(undefined);
  const { Rail } = components;

  const scrollToLatest = useCallback(() => {
    followSubmission.current = true;
    const {contentHeight, viewportHeight} = metricsRef.current;
    // FlatList.scrollToEnd estimates the last row from measured cell lengths.
    // PDF cards have variable heights; use the actual content measurement.
    listRef.current?.scrollToOffset({offset:Math.max(0,contentHeight-viewportHeight),animated:false});
  }, []);

  useEffect(() => {
    if (!latestUserId) return;
    // Sending opts back into following. Layout changes are not reading intent:
    // a short job can shrink its activity row before the result card appears.
    scrollToLatest();
  }, [latestUserId,scrollToLatest]);

  useEffect(() => {
    if (Platform.OS !== 'web' || isEmpty) return;
    const node = listRef.current?.getNativeScrollRef() as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const reading = () => {followSubmission.current = false;};
    const wheel = (event: WheelEvent) => {if (event.deltaY < 0) reading();};
    const key = (event: KeyboardEvent) => {if (['ArrowUp','PageUp','Home'].includes(event.key)) reading();};
    node.addEventListener('wheel',wheel,{passive:true});
    node.addEventListener('pointerdown',reading);
    node.addEventListener('focusin',reading);
    node.addEventListener('keydown',key);
    return () => {
      node.removeEventListener('wheel',wheel);
      node.removeEventListener('pointerdown',reading);
      node.removeEventListener('focusin',reading);
      node.removeEventListener('keydown',key);
    };
  }, [isEmpty]);

  useEffect(() => () => clearTimeout(jumpRef.current?.timer), []);

  const jumpTo = useCallback(
    (id: string) => {
      const index = aui.thread
        .getState()
        .messages.findIndex((message) => message.id === id);
      if (index === -1) return;
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0,
      });
    },
    [aui],
  );

  const scrollToMessage = useCallback(
    (id: string) => {
      clearTimeout(jumpRef.current?.timer);
      jumpRef.current = { id, retried: false, timer: undefined };
      jumpTo(id);
    },
    [jumpTo],
  );

  // The list cannot scroll to a row it has not laid out yet: an instant jump
  // to the estimated offset gets it rendering near the row, and one retry,
  // resolved by id again so a changed list cannot send it to another turn,
  // lands on the row itself.
  const onScrollToIndexFailed = useCallback(
    ({
      index,
      averageItemLength,
    }: {
      index: number;
      averageItemLength: number;
    }) => {
      listRef.current?.scrollToOffset({
        offset: index * averageItemLength,
        animated: false,
      });
      const jump = jumpRef.current;
      if (!jump || jump.retried) return;
      jump.retried = true;
      jump.timer = setTimeout(() => jumpTo(jump.id), SCROLL_RETRY_DELAY);
    },
    [jumpTo],
  );

  const publishDescent = useCallback(() => {
    const { contentHeight, viewportHeight, scrollY } = metricsRef.current;
    const remaining = contentHeight - viewportHeight - scrollY;
    setAwayFromEnd(viewportHeight > 0 && remaining > 100);
    const descent =
      viewportHeight > 0
        ? Math.round(
            Math.min(
              1,
              Math.max(0, (viewportHeight - remaining) / viewportHeight),
            ) * 100,
          ) / 100
        : 0;
    if (descent !== store.getSnapshot().descent) store.publish({ descent });
  }, [store]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: ViewabilityInfo) => {
      store.publish({
        visibleMessageIds: viewableItems.map((token) => token.item.id),
      });
    },
    [store],
  );

  const onListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      if (contentSize.height - layoutMeasurement.height - contentOffset.y <= 2) followSubmission.current = true;
      metricsRef.current = {
        contentHeight: contentSize.height,
        viewportHeight: layoutMeasurement.height,
        scrollY: contentOffset.y,
      };
      publishDescent();
    },
    [publishDescent],
  );

  const onListContentSizeChange = useCallback(
    (_width: number, height: number) => {
      metricsRef.current.contentHeight = height;
      if (followSubmission.current) scrollToLatest();
      publishDescent();
    },
    [publishDescent,scrollToLatest],
  );

  const onListLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height, y } = event.nativeEvent.layout;
      metricsRef.current.viewportHeight = height;
      if (followSubmission.current) scrollToLatest();
      const snapshot = store.getSnapshot();
      if (height !== snapshot.height || y !== snapshot.top) {
        store.publish({ height, top: y });
      }
      publishDescent();
    },
    [publishDescent, store, scrollToLatest],
  );

  const revealNativeRegion = useCallback((top: number, bottom: number) => {
    if (Platform.OS === 'web' || !Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return;
    // Opening/reading a preview is explicit reading intent. A keyboard resize
    // must not replace that anchor with the end of its enclosing result card.
    followSubmission.current = false;
    viewportRef.current?.measureInWindow((_x, y) => {
      const {contentHeight, viewportHeight, scrollY} = metricsRef.current;
      if (viewportHeight <= 0) return;
      const visibleTop = y + store.getSnapshot().top + 2;
      const visibleBottom = visibleTop + viewportHeight - 4;
      const above = top - visibleTop, below = bottom - visibleBottom;
      // If a region is taller than the available area, preserve its leading
      // controls. Never scroll beyond measured content or change keyboard focus.
      const delta = above < 0 ? above : below > 0 ? Math.min(below, above) : 0;
      if (Math.abs(delta) < 1) return;
      listRef.current?.scrollToOffset({
        offset: Math.max(0, Math.min(Math.max(0, contentHeight - viewportHeight), scrollY + delta)),
        animated: false,
      });
    });
  }, [store]);

  const viewport = useMemo(
    () => ({
      subscribe: store.subscribe,
      getSnapshot: store.getSnapshot,
      scrollToMessage,
      revealNativeRegion,
    }),
    [store, scrollToMessage, revealNativeRegion],
  );

  useEffect(() => {
    if (isRunning && !components.Activity) {
      AccessibilityInfo.announceForAccessibility("Assistant is working");
    }
  }, [isRunning, components.Activity]);

  // KeyboardAvoidingView measures its frame against its parent, so a navigation
  // header above the thread would leave the composer covered by the header's
  // height; the viewport's window position supplies that offset, minus the
  // bottom inset the footer already pads.
  const measureViewport = () => {
    viewportRef.current?.measureInWindow((_x, y) => setViewportTop(y));
  };

  const { width } = useWindowDimensions();
  const gutter = width < 760 ? 16 : 24;
  // One centred column (at most 720 wide) for the thread, composer and hint row.
  const column = { width: "100%" as const, maxWidth: 720 + gutter * 2, alignSelf: "center" as const, paddingHorizontal: gutter };
  useEffect(() => {activeViewport = viewport; return () => {if (activeViewport === viewport) activeViewport = null;};}, [viewport]);

  return (
    <ThreadComponentsContext.Provider value={components}>
      <ThreadViewportContext.Provider value={viewport}>
        <StyledThreadRoot className="aui-root aui-thread-root flex-1">
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === "ios" && !Platform.isMacCatalyst ? "padding" : undefined}
            keyboardVerticalOffset={viewportTop - insets.bottom}
          >
            <View
              ref={viewportRef}
              onLayout={measureViewport}
              className="aui-thread-viewport min-h-0 w-full flex-1"
            >
              <View style={[column, { paddingTop: 12 }]}><HostSlot name="Banner" /></View>
              <AuiIf condition={isNewChatView}>
                <WelcomeSlot />
              </AuiIf>
              <AuiIf condition={(s) => s.thread.messages.length > 0}>
                <StyledMessagesFlatList
                  // Viewability props cannot change once a FlatList is mounted.
                  key={Rail ? "tracked" : "plain"}
                  ref={listRef}
                  className="aui-message-group flex-1"
                  contentContainerStyle={[column, { paddingTop: 12, paddingBottom: 20 }]}
                  testID="conversation"
                  accessibilityLabel="Conversation"
                  // One owner follows measured content/keyboard changes. The
                  // default handler can mistake a shrinking job row for a
                  // deliberate upward scroll, leaving a fast result hidden.
                  autoScroll={false}
                  scrollToBottomOnRunStart={false}
                  scrollToBottomOnInitialize={false}
                  scrollToBottomOnThreadSwitch={false}
                  showsVerticalScrollIndicator={Platform.OS !== "web"}
                  keyboardDismissMode="interactive"
                  keyboardShouldPersistTaps="handled"
                  onContentSizeChange={onListContentSizeChange}
                  onLayout={onListLayout}
                  onScroll={onListScroll}
                  onScrollBeginDrag={()=>{followSubmission.current=false;}}
                  onTouchStart={()=>{followSubmission.current=false;}}
                  onScrollToIndexFailed={onScrollToIndexFailed}
                  {...(Rail
                    ? {
                        onViewableItemsChanged,
                        viewabilityConfig: MESSAGE_VIEWABILITY,
                      }
                    : {})}
                  {...(history
                    ? {
                        history,
                      }
                    : {})}
                >
                  {() => <ThreadMessage />}
                </StyledMessagesFlatList>
              </AuiIf>
              <View
                className="aui-thread-viewport-footer"
                style={[column, { gap: 6, paddingBottom: insets.bottom + 12 }]}
              >
                {awayFromEnd && !isEmpty && <LatestButton onPress={scrollToLatest} />}
                <Composer />
                <HostSlot name="Footer" />
              </View>
              {Rail && (
                <View
                  pointerEvents="box-none"
                  className="aui-thread-rail absolute inset-0"
                >
                  <Rail />
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </StyledThreadRoot>
      </ThreadViewportContext.Provider>
    </ThreadComponentsContext.Provider>
  );
};

/** C16 LatestButton: appears when the newest content is out of view. */
const LatestButton: FC<{ onPress: () => void }> = ({ onPress }) => {
  const { c, scheme } = useTheme();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: -40, left: 0, right: 0, alignItems: "center", zIndex: 10 }}>
      <Pressable
        accessibilityRole="button" accessibilityLabel="Latest message"
        onPress={onPress}
        style={({ pressed }) => [{ height: 28, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.full, borderWidth: 1, borderColor: c.hairline, backgroundColor: pressed ? c.elevated : c.raised }, shadow("2", scheme)]}
      >
        <Glyph icon={ArrowDownIcon} size={14} tone="primary" />
        <Txt variant="uiStrong">Latest</Txt>
      </Pressable>
    </View>
  );
};

const WelcomeSlot: FC = () => {
  const { Welcome } = useContext(ThreadComponentsContext);
  return Welcome ? <Welcome /> : null;
};

// Spacing: 16 between turns in a task and 28 between tasks (a request starts a task).
// A tight reply (an import's summary) sits 6 below its turn, so the two read as one.
const ThreadMessage: FC = () => {
  const role = useAuiState((s) => s.message.role);
  const index = useAuiState((s) => s.message.index);
  const tight = useAuiState((s) => !!s.message.metadata.custom?.tight);
  const top = index === 0 ? 0 : role === "user" ? 28 : tight ? 6 : 16;
  return role === "user" ? <UserMessage top={top} /> : <AssistantMessage top={top} />;
};

/** The text of a turn in the conversation text size. Assistant text is a polite live region on web. */
export const MessageText: FC<{ strong?: boolean; muted?: boolean }> = ({ strong = false, muted = false }) => {
  const Part: TextMessagePartComponent = ({ text }) => {
    const { c } = useTheme();
    const textSize = useTextSize(), scale = useTextScale();
    const isAssistant = useAuiState((s) => s.message.role === "assistant");
    return (
      <Text
        className="aui-message-text"
        style={[typeStyle(strong ? "bodyStrong" : "body", TEXT_SIZES[textSize], scale), { color: muted ? c.inkSecondary : c.ink }]}
        selectable
        aria-live={Platform.OS === "web" && isAssistant ? "polite" : undefined}
        aria-atomic={isAssistant ? true : undefined}
      >
        {text}
      </Text>
    );
  };
  return <MessagePrimitive.Parts components={{ Text: Part }} />;
};


/** Copies a turn's text to the local clipboard only. Revealed on hover on the web (and to keyboard
 * focus). Native message text is selectable, so the always-visible icon is omitted there. */
export const CopyMessage: FC = () => Platform.OS !== "web" ? null : (
  <AuiIf condition={(s) => !(s.message.role === "assistant" && s.message.status?.type === "running")}>
    <StyledActionCopy
      copyToClipboard={copyToClipboard}
      className="atepdf-hover-reveal"
      style={{ width: 24, height: 24, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" }}
      accessibilityLabel="Copy"
    >
      {({ isCopied }) => <Glyph icon={isCopied ? CheckIcon : CopyIcon} size={14} tone="tertiary" />}
    </StyledActionCopy>
  </AuiIf>
);

const AssistantMessage: FC<{ top: number }> = ({ top }) => {
  const { Activity, AssistantMessage: Body } = useContext(ThreadComponentsContext);
  const running = useAuiState((s) => s.message.status?.type === "running");
  return (
    <StyledMessageRoot testID="assistant-message" className="aui-assistant-message-root atepdf-hover-group" style={{ marginTop: top }}>
      {running && Activity ? <Activity /> : Body ? <Body /> : <MessageText />}
    </StyledMessageRoot>
  );
};

const UserMessage: FC<{ top: number }> = ({ top }) => {
  const { UserMessage: Body } = useContext(ThreadComponentsContext);
  return (
    <StyledMessageRoot testID="user-message" className="aui-user-message-root atepdf-hover-group" style={{ marginTop: top }}>
      {Body ? <Body /> : <MessageText strong />}
    </StyledMessageRoot>
  );
};

const HostSlot: FC<{name: "AddAttachment" | "Footer" | "ComposerTop" | "ComposerActions" | "Banner"}> = ({name}) => {
  const Component = useContext(ThreadComponentsContext)[name];
  return Component ? <Component /> : null;
};

/** D1 Composer: context row, input, action row. The input stays uncontrolled on native. */
const Composer: FC = () => {
  const { ComposerInput } = useContext(ThreadComponentsContext);
  const { c, scheme } = useTheme();
  return (
    <StyledComposerRoot className="aui-composer-root w-full">
      <View
        className="aui-composer-shell"
        style={[{ backgroundColor: c.raised, borderWidth: 1, borderColor: c.hairline, borderRadius: radius.xl, paddingBottom: 8 }, shadow("2", scheme)]}
      >
        <HostSlot name="ComposerTop" />
        {ComposerInput ? <ComposerInput /> : null}
        <ComposerAction />
      </View>
    </StyledComposerRoot>
  );
};

const ComposerAction: FC = () => {
  const { c } = useTheme();
  const canSend = useAuiState((s) => s.composer.canSend);
  // The stop control only cancels the send while no run it could stop is going.
  const isSending = useAuiState(
    (s) =>
      s.composer.submission !== undefined &&
      !(s.thread.isRunning && s.thread.capabilities.cancel),
  );

  return (
    <View className="aui-composer-action-wrapper" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, minHeight: 28 }}>
      <HostSlot name="AddAttachment" />
      <View style={{ flex: 1, minWidth: 0 }}><HostSlot name="ComposerActions" /></View>
      <AuiIf
        condition={(s) =>
          s.composer.submission === undefined &&
          (!s.thread.isRunning || s.thread.voice !== undefined)
        }
      >
        <StyledComposerSend
          className="aui-composer-send"
          style={{ width: 28, height: 28, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: canSend ? c.accent : c.hover }}
          accessibilityLabel="Send message"
        >
          <Glyph icon={ArrowUpIcon} tone={canSend ? "onAccent" : "disabled"} />
        </StyledComposerSend>
      </AuiIf>
      <AuiIf
        condition={(s) =>
          s.composer.submission !== undefined ||
          (s.thread.isRunning && s.thread.voice === undefined)
        }
      >
        <StyledComposerCancel
          className="aui-composer-cancel"
          style={{ width: 28, height: 28, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: c.raised, borderWidth: 1, borderColor: c.strong }}
          accessibilityLabel={
            isSending ? "Cancel sending" : "Cancel"
          }
        >
          <View style={{ width: 8, height: 8, borderRadius: 1.5, backgroundColor: c.ink }} />
        </StyledComposerCancel>
      </AuiIf>
    </View>
  );
};
