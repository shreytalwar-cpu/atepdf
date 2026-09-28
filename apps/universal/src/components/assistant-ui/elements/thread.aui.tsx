// Derived from assistant-ui native thread, MIT, commit 5b23b2df762737246990e6a7bccebdbac0ca0959.
// See docs/upstream/assistant-ui.md for local-only slots and omitted transports.
import {
  groupedIconButtonHitSlop,
  iconButtonClassName,
  iconButtonHitSlop,
} from "@/components/assistant-ui/elements/icon-button";
import {
  ShimmerLabel,
  useAnnounce,
  useHydrated,
  webLiveRegion,
} from "@/components/assistant-ui/elements/surfaces";
import { TypingIndicator } from "@/components/assistant-ui/elements/typing-indicator";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
  ActionBarPrimitive,
  AuiIf,
  type AssistantState,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  SuggestionPrimitive,
  ThreadPrimitive,
  type TextMessagePartComponent,
  type ThreadMessage,
  type ToolCallMessagePartComponent,
  type GroupByContext,
  groupPartByType,
  useAui,
  useAuiState,
} from "@assistant-ui/react-native";
import * as Clipboard from "expo-clipboard";
import ArrowUpIcon from 'lucide-react-native/icons/arrow-up';
import ArrowDownIcon from 'lucide-react-native/icons/arrow-down';
import AudioLinesIcon from 'lucide-react-native/icons/audio-lines';
import CheckIcon from 'lucide-react-native/icons/check';
import ChevronLeftIcon from 'lucide-react-native/icons/chevron-left';
import ChevronRightIcon from 'lucide-react-native/icons/chevron-right';
import CopyIcon from 'lucide-react-native/icons/copy';
import PencilIcon from 'lucide-react-native/icons/pencil';
import MicIcon from 'lucide-react-native/icons/mic';
import PhoneIcon from 'lucide-react-native/icons/phone';
import RefreshCwIcon from 'lucide-react-native/icons/refresh-cw';
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
  type ViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";


// Uniwind's native resolver treats the scoped @assistant-ui/react-native path as
// React Native internals. Map classes at our template boundary so those
// third-party primitives receive native style props. Keep web output unchanged.
const StyledThreadRoot = Platform.OS === "web" ? ThreadPrimitive.Root : withUniwind(ThreadPrimitive.Root);
const StyledMessagesFlatList = Platform.OS === "web" ? ThreadPrimitive.MessagesFlatList : withUniwind(ThreadPrimitive.MessagesFlatList);
const StyledMessageRoot = Platform.OS === "web" ? MessagePrimitive.Root : withUniwind(MessagePrimitive.Root);
const StyledComposerRoot = Platform.OS === "web" ? ComposerPrimitive.Root : withUniwind(ComposerPrimitive.Root);
const StyledComposerInput = Platform.OS === "web" ? ComposerPrimitive.Input : withUniwind(ComposerPrimitive.Input);
const StyledComposerSend = Platform.OS === "web" ? ComposerPrimitive.Send : withUniwind(ComposerPrimitive.Send);
const StyledComposerCancel = Platform.OS === "web" ? ComposerPrimitive.Cancel : withUniwind(ComposerPrimitive.Cancel);
const StyledActionCopy = Platform.OS === "web" ? ActionBarPrimitive.Copy : withUniwind(ActionBarPrimitive.Copy);
const StyledActionReload = Platform.OS === "web" ? ActionBarPrimitive.Reload : withUniwind(ActionBarPrimitive.Reload);
const StyledActionEdit = Platform.OS === "web" ? ActionBarPrimitive.Edit : withUniwind(ActionBarPrimitive.Edit);
const StyledErrorRoot = Platform.OS === "web" ? ErrorPrimitive.Root : withUniwind(ErrorPrimitive.Root);
const StyledErrorMessage = Platform.OS === "web" ? ErrorPrimitive.Message : withUniwind(ErrorPrimitive.Message);
const StyledSuggestionTrigger = Platform.OS === "web" ? SuggestionPrimitive.Trigger : withUniwind(SuggestionPrimitive.Trigger);
const StyledSuggestionTitle = Platform.OS === "web" ? SuggestionPrimitive.Title : withUniwind(SuggestionPrimitive.Title);
const StyledSuggestionDescription = Platform.OS === "web" ? SuggestionPrimitive.Description : withUniwind(SuggestionPrimitive.Description);
const StyledBranchPrevious = Platform.OS === "web" ? BranchPickerPrimitive.Previous : withUniwind(BranchPickerPrimitive.Previous);
const StyledBranchNext = Platform.OS === "web" ? BranchPickerPrimitive.Next : withUniwind(BranchPickerPrimitive.Next);

const isNewChatView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  (!s.thread.isLoading || s.threads.isLoading);

const isHistoryLoadingView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  s.thread.isLoading &&
  !s.thread.isDisabled &&
  !s.threads.isLoading;

export type ThreadGroupPart = MessagePrimitive.GroupedParts.GroupPart;

export type ThreadComponents = {
  AssistantMessage?: ComponentType | undefined;
  MessageExtras?: ComponentType | undefined;
  /** Local job activity, replacing the generic typing state for a running turn. */
  Activity?: ComponentType | undefined;
  AddAttachment?: ComponentType | undefined;
  Footer?: ComponentType | undefined;
  Welcome?: ComponentType | undefined;
  ToolFallback?: ToolCallMessagePartComponent | undefined;
  /** Renders tool calls that carry a nested conversation and have no registered UI; without it they render like any other tool call. */
  TaskGroup?: ComponentType<{ group: ThreadGroupPart }> | undefined;
  /** Replaces the text input of both the new message composer and the edit composer; read `composer.type` to tell them apart. */
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
  await Clipboard.setStringAsync(text);
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

  return (
    <ThreadComponentsContext.Provider value={components}>
      <ThreadViewportContext.Provider value={viewport}>
        <StyledThreadRoot className="aui-root aui-thread-root bg-background flex-1">
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={viewportTop - insets.bottom}
          >
            <View
              ref={viewportRef}
              onLayout={measureViewport}
              className={cn(
                "aui-thread-viewport mx-auto w-full max-w-[48rem] min-h-0 flex-1",
                isEmpty && "justify-center",
              )}
            >
              <AuiIf condition={isNewChatView}>
                <WelcomeSlot />
              </AuiIf>
              <AuiIf condition={isHistoryLoadingView}>
                <ThreadHistorySkeleton />
              </AuiIf>
              <AuiIf condition={(s) => s.thread.messages.length > 0}>
                {history?.isLoadingMore && <HistoryEdge />}
                <StyledMessagesFlatList
                  // Viewability props cannot change once a FlatList is mounted.
                  key={Rail ? "tracked" : "plain"}
                  ref={listRef}
                  className="aui-message-group flex-1"
                  contentContainerClassName={cn(
                    "gap-6 px-4 pt-6 pb-6",
                    Rail && "pl-10",
                  )}
                  testID="conversation"
                  // One owner follows measured content/keyboard changes. The
                  // default handler can mistake a shrinking job row for a
                  // deliberate upward scroll, leaving a fast result hidden.
                  autoScroll={false}
                  scrollToBottomOnRunStart={false}
                  scrollToBottomOnInitialize={false}
                  scrollToBottomOnThreadSwitch={false}
                  showsVerticalScrollIndicator={false}
                  keyboardDismissMode="interactive"
                  keyboardShouldPersistTaps="handled"
                  onContentSizeChange={onListContentSizeChange}
                  onLayout={onListLayout}
                  onScroll={onListScroll}
                  onScrollBeginDrag={()=>{followSubmission.current=false;}}
                  onTouchStart={()=>{followSubmission.current=false;}}
                  {...(Rail
                    ? {
                        onScrollToIndexFailed,
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
                className="aui-thread-viewport-footer gap-3 px-4"
                style={{ paddingBottom: insets.bottom + 8 }}
              >
                {awayFromEnd&&!isEmpty&&<Pressable
                  accessibilityRole="button" accessibilityLabel="Latest message"
                  onPress={scrollToLatest}
                  className="atepdf-button absolute -top-14 right-5 z-10 size-11 items-center justify-center rounded-full border border-border bg-background"
                  style={{boxShadow:'0 3px 12px #18213b12'}}
                ><Icon as={ArrowDownIcon} className="size-4 text-foreground"/></Pressable>}
                <Composer />
                <HostSlot name="Footer" />
                <AuiIf
                  condition={(s) => isNewChatView(s) && s.composer.isEmpty}
                >
                  <ThreadSuggestions />
                </AuiIf>
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

const WelcomeSlot: FC = () => {
  const { Welcome = ThreadWelcome } = useContext(ThreadComponentsContext);
  return <Welcome />;
};

const ThreadMessage: FC = () => {
  const role = useAuiState((s) => s.message.role);
  const isEditing = useAuiState((s) => s.message.composer.isEditing);
  const isSpoken = useAuiState((s) => s.message.metadata.modality === "voice");
  const { AssistantMessage: CustomAssistantMessage } = useContext(
    ThreadComponentsContext,
  );

  if (isEditing) return <EditComposer />;
  if (isSpoken) return <SpokenMessage />;
  if (role === "user") return <UserMessage />;
  const Assistant = CustomAssistantMessage ?? AssistantMessage;
  return <Assistant />;
};

type VoiceRunPosition = "single" | "start" | "middle" | "end";

const useVoiceRunPosition = (): VoiceRunPosition =>
  useAuiState((s) => {
    const before =
      s.thread.messages[s.message.index - 1]?.metadata.modality === "voice";
    const after =
      s.thread.messages[s.message.index + 1]?.metadata.modality === "voice";
    if (before) return after ? "middle" : "end";
    return after ? "start" : "single";
  });

const SpokenText: TextMessagePartComponent = ({ text }) => (
  <Text
    className="aui-spoken-message-text text-foreground text-sm leading-relaxed"
    selectable
  >
    {text}
  </Text>
);

const SpokenMessage: FC = () => {
  const role = useAuiState((s) => s.message.role);
  const position = useVoiceRunPosition();
  const isSpeaking = useAuiState(
    (s) =>
      s.message.role === "assistant" && s.message.status?.type === "running",
  );
  const opensExchange = position === "start" || position === "single";

  return (
    <StyledMessageRoot
      className={cn(
        "aui-spoken-message bg-muted/40 mx-2 px-3 py-1.5",
        `aui-spoken-message-${position}`,
        position === "single" && "rounded-xl py-2",
        position === "start" && "rounded-t-xl pt-2",
        position === "middle" && "-mt-6",
        position === "end" && "-mt-6 rounded-b-xl pb-2",
      )}
    >
      {opensExchange && (
        <View className="aui-spoken-exchange-header mb-1.5 flex-row items-center gap-1.5">
          <Icon as={PhoneIcon} className="text-muted-foreground size-3" />
          <Text className="text-muted-foreground text-xs">
            Voice conversation
          </Text>
        </View>
      )}
      <View className="aui-spoken-message-content flex-row items-start gap-2">
        <View
          className="mt-1 shrink-0"
          accessible
          accessibilityLabel={role === "user" ? "You said" : "Assistant said"}
        >
          <Icon
            as={role === "user" ? MicIcon : AudioLinesIcon}
            className="text-muted-foreground size-3.5"
          />
        </View>
        <View className="min-w-0 flex-1 flex-row items-center">
          <View className="min-w-0 flex-1">
            <MessagePrimitive.Parts components={{ Text: SpokenText }} />
            {isSpeaking && (
              <TypingIndicator
                variant="bare"
                announce={false}
                className="aui-spoken-message-indicator ms-1"
                accessibilityLabel="Assistant is speaking"
              />
            )}
          </View>
          <SpokenActionBar />
        </View>
      </View>
    </StyledMessageRoot>
  );
};

const SpokenActionBar: FC = () => (
  <AuiIf
    condition={(s) =>
      !(s.message.role === "assistant" && s.message.status?.type === "running")
    }
  >
    <View className="aui-spoken-action-bar flex-row gap-1">
      <StyledActionCopy
        copyToClipboard={copyToClipboard}
        className={cn(iconButtonClassName, "size-6")}
        hitSlop={groupedIconButtonHitSlop}
        accessibilityLabel="Copy"
      >
        {({ isCopied }) => (
          <Icon
            as={isCopied ? CheckIcon : CopyIcon}
            className="text-muted-foreground size-3.5"
          />
        )}
      </StyledActionCopy>
    </View>
  </AuiIf>
);

// The edge sits above the list rather than inside it as a header: the list
// keeps its first visible row anchored, so a header inserted above that row
// would land outside the viewport instead of pushing into it.
const HistoryEdge: FC = () => {
  useAnnounce("Loading earlier messages");

  return (
    <View
      className="aui-thread-history-edge items-center pb-4"
      accessibilityLiveRegion={webLiveRegion}
    >
      <ShimmerLabel className="text-muted-foreground text-[13px]">
        Loading earlier messages
      </ShimmerLabel>
    </View>
  );
};

const ThreadHistorySkeleton: FC = () => (
  <View
    className="aui-thread-history-skeleton gap-6 px-4 pt-4"
    accessible
    accessibilityRole="progressbar"
    accessibilityLabel="Loading conversation"
  >
    <View className="bg-muted ml-auto h-9 w-2/5 rounded-xl" />
    <View className="gap-2">
      <View className="bg-muted h-4 w-11/12 rounded" />
      <View className="bg-muted h-4 w-4/5 rounded" />
      <View className="bg-muted h-4 w-3/5 rounded" />
    </View>
    <View className="bg-muted ml-auto h-9 w-1/3 rounded-xl" />
    <View className="gap-2">
      <View className="bg-muted h-4 w-10/12 rounded" />
      <View className="bg-muted h-4 w-2/3 rounded" />
    </View>
  </View>
);

const ThreadWelcome: FC = () => (
  <View className="aui-thread-welcome-root mb-6 items-center px-4">
    <Text className="aui-thread-welcome-message text-foreground text-center text-2xl font-medium tracking-tight">
      How can I help you today?
    </Text>
  </View>
);

const ThreadSuggestions: FC = () => (
  <View className="aui-thread-welcome-suggestions w-full flex-row flex-wrap items-center justify-center gap-2">
    <ThreadPrimitive.Suggestions>
      {() => <ThreadSuggestionItem />}
    </ThreadPrimitive.Suggestions>
  </View>
);

const ThreadSuggestionItem: FC = () => (
  <StyledSuggestionTrigger
    send
    className="aui-thread-welcome-suggestion border-border/60 active:bg-muted flex-row items-center gap-1.5 rounded-full border px-3.5 py-1.5"
  >
    <StyledSuggestionTitle className="aui-thread-welcome-suggestion-text-1 text-foreground text-sm" />
    <AuiIf condition={(s) => !!s.suggestion.label}>
      <StyledSuggestionDescription className="aui-thread-welcome-suggestion-text-2 text-muted-foreground text-sm" />
    </AuiIf>
  </StyledSuggestionTrigger>
);

// The placeholder color is a class to prop mapping that reads the CSSOM, so it applies from the first render after hydration.
const DefaultComposerInput: FC = () => {
  const hydrated = useHydrated();

  return (
    <StyledComposerInput
      placeholder="Tell atepdf what to do…"
      placeholderTextColorClassName={
        hydrated ? "accent-muted-foreground" : undefined
      }
      className="aui-composer-input text-foreground web:resize-none web:outline-none max-h-40 min-h-12 px-3 py-2 text-base leading-6"
      multiline
      accessibilityLabel="Tell atepdf what to do"
    />
  );
};

const Composer: FC = () => {
  const { ComposerInput = DefaultComposerInput } = useContext(
    ThreadComponentsContext,
  );

  return (
    <StyledComposerRoot className="aui-composer-root w-full">
      <View className="aui-composer-shell border-border dark:border-muted-foreground/15 bg-card gap-1 rounded-[28px] border p-2">

        <ComposerInput />
        <ComposerAction />
      </View>
    </StyledComposerRoot>
  );
};

const ComposerAction: FC = () => {
  const canSend = useAuiState((s) => s.composer.canSend);
  // The stop control only cancels the send while no run it could stop is going.
  const isSending = useAuiState(
    (s) =>
      s.composer.submission !== undefined &&
      !(s.thread.isRunning && s.thread.capabilities.cancel),
  );

  return (
    <View className="aui-composer-action-wrapper flex-row items-center justify-between">
      <HostSlot name="AddAttachment" />
      <View className="flex-row items-center gap-1.5">
        <AuiIf
          condition={(s) =>
            s.composer.submission === undefined &&
            (!s.thread.isRunning || s.thread.voice !== undefined)
          }
        >
          <StyledComposerSend
            className="aui-composer-send bg-primary active:bg-primary/90 size-11 items-center justify-center rounded-full disabled:opacity-40"
            style={Platform.OS === "web" ? undefined : { opacity: canSend ? 1 : 0.4 }}
            hitSlop={iconButtonHitSlop}
            accessibilityLabel="Send message"
          >
            <Icon
              as={ArrowUpIcon}
              className="aui-composer-send-icon text-primary-foreground size-4"
            />
          </StyledComposerSend>
        </AuiIf>
        <AuiIf
          condition={(s) =>
            s.composer.submission !== undefined ||
            (s.thread.isRunning && s.thread.voice === undefined)
          }
        >
          <StyledComposerCancel
            className="aui-composer-cancel bg-foreground active:opacity-80 size-11 items-center justify-center rounded-full"
            hitSlop={iconButtonHitSlop}
            accessibilityLabel={
              isSending ? "Cancel sending" : "Cancel"
            }
          >
            <View className="aui-composer-cancel-icon bg-primary-foreground size-3 rounded-[2px]" />
          </StyledComposerCancel>
        </AuiIf>
      </View>
    </View>
  );
};

const MessageError: FC = () => (
  <StyledErrorRoot className="aui-message-error-root border-destructive bg-destructive/10 dark:bg-destructive/5 mt-2 rounded-md border p-3">
    <StyledErrorMessage
      className="aui-message-error-message text-destructive text-sm"
      numberOfLines={2}
    />
  </StyledErrorRoot>
);

const UserText: TextMessagePartComponent = ({ text }) => {
  const isAssistant=useAuiState(s=>s.message.role==='assistant');
  return (
  <Text
    className="aui-user-message-text text-foreground text-base leading-6"
    selectable
    aria-live={Platform.OS==='web'&&isAssistant?'polite':undefined}
    aria-atomic={isAssistant?true:undefined}
  >
    {text}
  </Text>
);};

const AssistantIndicator: FC = () => {
  const isRunning = useAuiState((s) => s.message.status?.type === "running");
  if (!isRunning) return null;

  return (
    <TypingIndicator
      variant="bare"
      announce={false}
      className="aui-assistant-message-indicator py-2"
      accessibilityLabel="Assistant is working"
    />
  );
};

const AssistantMessage: FC = () => {
  const {Activity}=useContext(ThreadComponentsContext);
  const running=useAuiState(s=>s.message.status?.type==='running');
  const hasArtifact=useAuiState(s=>s.message.metadata.custom.hasArtifact===true);
  return (
  <StyledMessageRoot testID="assistant-message" className="aui-assistant-message-root">
    <View className="aui-assistant-message-content px-2 gap-3">
      {running&&Activity?<Activity/>:<><MessagePrimitive.Parts components={{ Text: UserText }} /><HostSlot name="MessageExtras" /><AssistantIndicator /></>}
      <MessageError />
    </View>
    {!running&&!hasArtifact&&<View className="aui-assistant-message-footer ms-2 flex-row items-center pt-1.5">
      <AssistantActionBar />
    </View>}
  </StyledMessageRoot>
);};

const HostSlot: FC<{name: "MessageExtras" | "AddAttachment" | "Footer"}> = ({name}) => {
  const Component = useContext(ThreadComponentsContext)[name];
  return Component ? <Component /> : null;
};

const AssistantActionBar: FC = () => (
  <AuiIf
    condition={(s) =>
      !(s.message.role === "assistant" && s.message.status?.type === "running")
    }
  >
    <View className="aui-assistant-action-bar-root -ms-1 flex-row gap-1">
      <StyledActionCopy
        copyToClipboard={copyToClipboard}
        className={iconButtonClassName}
        hitSlop={groupedIconButtonHitSlop}
        accessibilityLabel="Copy"
      >
        {({ isCopied }) => (
          <Icon
            as={isCopied ? CheckIcon : CopyIcon}
            className="text-muted-foreground size-4"
          />
        )}
      </StyledActionCopy>
      <AuiIf condition={(s) => s.thread.capabilities.reload}>
      <StyledActionReload
        className={iconButtonClassName}
        hitSlop={groupedIconButtonHitSlop}
        accessibilityLabel="Refresh"
      >
        <Icon as={RefreshCwIcon} className="text-muted-foreground size-4" />
      </StyledActionReload>
      </AuiIf>
    </View>
  </AuiIf>
);

const UserMessage: FC = () => (
  <StyledMessageRoot testID="user-message" className="aui-user-message-root items-end gap-y-2 px-2">
    <HostSlot name="MessageExtras" />
    <View className="aui-user-message-content bg-muted max-w-[85%] rounded-xl px-4 py-2">
      <MessagePrimitive.Parts components={{ Text: UserText }} />
    </View>
    <View className="aui-user-message-footer -me-1 flex-row items-center justify-end">
      <BranchPicker />
      <UserActionBar />
    </View>
  </StyledMessageRoot>
);

const UserActionBar: FC = () => (
  <AuiIf condition={(s) => !s.thread.isRunning && s.thread.capabilities.edit}>
    <StyledActionEdit
      className={cn(iconButtonClassName, "aui-user-action-edit")}
      hitSlop={groupedIconButtonHitSlop}
      accessibilityLabel="Edit"
    >
      <Icon as={PencilIcon} className="text-muted-foreground size-4" />
    </StyledActionEdit>
  </AuiIf>
);

const DefaultEditComposerInput: FC = () => (
  <StyledComposerInput
    className="aui-edit-composer-input text-foreground web:resize-none web:outline-none min-h-14 px-4 pt-3 pb-1 text-base"
    multiline
    autoFocus
  />
);

const EditComposer: FC = () => {
  const { ComposerInput = DefaultEditComposerInput } = useContext(
    ThreadComponentsContext,
  );

  return (
    <StyledMessageRoot className="aui-edit-composer-wrapper px-2">
      <StyledComposerRoot className="aui-edit-composer-root border-border/60 dark:border-muted-foreground/15 bg-card ms-auto w-full max-w-[85%] rounded-3xl border">
        <ComposerInput />
        <View className="aui-edit-composer-footer mx-2.5 mb-2.5 flex-row items-center gap-1.5 self-end">
          <StyledComposerCancel className="active:bg-accent h-8 justify-center rounded-full px-3.5">
            <Text className="text-foreground text-sm font-medium">Cancel</Text>
          </StyledComposerCancel>
          <StyledComposerSend className="bg-primary active:bg-primary/90 h-8 justify-center rounded-full px-3.5">
            <Text className="text-primary-foreground text-sm font-medium">
              Update
            </Text>
          </StyledComposerSend>
        </View>
      </StyledComposerRoot>
    </StyledMessageRoot>
  );
};

const BranchPicker: FC<ViewProps> = ({ className, ...rest }) => {
  const branchCount = useAuiState((s) => s.message.branchCount);
  if (branchCount <= 1) return null;

  return (
    <View
      className={cn(
        "aui-branch-picker-root -ms-2 me-2 flex-row items-center",
        className,
      )}
      {...rest}
    >
      <StyledBranchPrevious
        className={cn(iconButtonClassName, "disabled:opacity-35")}
        hitSlop={groupedIconButtonHitSlop}
        accessibilityLabel="Previous"
      >
        <Icon as={ChevronLeftIcon} className="text-muted-foreground size-4" />
      </StyledBranchPrevious>
      <Text className="aui-branch-picker-state text-muted-foreground text-xs font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </Text>
      <StyledBranchNext
        className={cn(iconButtonClassName, "disabled:opacity-35")}
        hitSlop={groupedIconButtonHitSlop}
        accessibilityLabel="Next"
      >
        <Icon as={ChevronRightIcon} className="text-muted-foreground size-4" />
      </StyledBranchNext>
    </View>
  );
};
