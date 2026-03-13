import { useEffect, useRef, useState, useCallback } from "preact/hooks";

const NEAR_BOTTOM_THRESHOLD = 80;

interface UseScrollLockOptions {
  /** Called when the user scrolls to near the top and older messages should load. */
  onLoadOlder: () => void;
  /** Whether an older-messages load is already in flight. */
  isLoadingOlder: boolean;
  /** Called after older messages have been prepended and scroll position compensated. */
  onOlderLoaded: () => void;
}

/** Wraps a callback in a stable ref so effects don't need to re-run when the callback changes. */
function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef<T>(fn);
  ref.current = fn;
  return useCallback((...args: any[]) => ref.current(...args), []) as T;
}

interface UseScrollLockResult {
  containerRef: ReturnType<typeof useRef<HTMLDivElement | null>>;
  showScrollBtn: boolean;
  scrollToBottom: () => void;
  /** Call when the channel changes so the lock resets and view snaps to bottom. */
  resetForChannel: () => void;
  /** Call before prepending older messages so height compensation is applied. */
  beginLoadOlder: () => void;
}

/**
 * Manages auto-scroll-lock for a messages container.
 *
 * Behaviour:
 * - While the user is within NEAR_BOTTOM_THRESHOLD px of the bottom, new
 *   content (detected by a MutationObserver) automatically snaps to bottom.
 * - When the user scrolls up, auto-scroll is disabled and a "scroll to bottom"
 *   button is shown.
 * - When older messages are prepended the viewport position is preserved by
 *   compensating for the added height.
 * - Channel switches reset the lock to enabled; the next DOM mutation
 *   (the incoming messages render) snaps to bottom automatically.
 */
export function useScrollLock({
  onLoadOlder,
  isLoadingOlder,
  onOlderLoaded,
}: UseScrollLockOptions): UseScrollLockResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const autoScroll = useRef(true);
  const pendingOlderLoad = useRef(false);
  const loadOlderDebounce = useRef<number | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Stable wrappers — effects can depend on these without re-running when the
  // caller re-renders and passes a new inline function.
  const stableOnLoadOlder = useStableCallback(onLoadOlder);
  const stableOnOlderLoaded = useStableCallback(onOlderLoaded);
  // Stable ref for isLoadingOlder so the scroll handler always reads the latest value.
  const isLoadingOlderRef = useRef(isLoadingOlder);
  isLoadingOlderRef.current = isLoadingOlder;

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    autoScroll.current = true;
    setShowScrollBtn(false);
  }, []);

  const resetForChannel = useCallback(() => {
    autoScroll.current = true;
    pendingOlderLoad.current = false;
    setShowScrollBtn(false);
    if (loadOlderDebounce.current !== null) {
      clearTimeout(loadOlderDebounce.current);
      loadOlderDebounce.current = null;
    }
    // No manual scroll needed — the MutationObserver will snap when the
    // channel's messages are rendered into the DOM.
  }, []);

  const beginLoadOlder = useCallback(() => {
    pendingOlderLoad.current = true;
  }, []);

  // Scroll handler: update lock state + trigger infinite scroll near top
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      const nearBottom = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;

      autoScroll.current = nearBottom;
      setShowScrollBtn(!nearBottom);

      // Load older messages when scrolled to the top
      if (
        el.scrollTop <= 10 &&
        !isLoadingOlderRef.current &&
        !pendingOlderLoad.current
      ) {
        if (loadOlderDebounce.current !== null) return;
        loadOlderDebounce.current = window.setTimeout(() => {
          loadOlderDebounce.current = null;
          const container = containerRef.current;
          if (
            !container ||
            container.scrollTop > 10 ||
            pendingOlderLoad.current
          )
            return;
          stableOnLoadOlder();
        }, 300);
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (loadOlderDebounce.current !== null) {
        clearTimeout(loadOlderDebounce.current);
        loadOlderDebounce.current = null;
      }
    };
    // Only re-attach the listener if the container element itself changes.
    // isLoadingOlderRef and stableOnLoadOlder are always up-to-date via refs.
  }, [stableOnLoadOlder]);

  // MutationObserver: snap to bottom on new content, or compensate scroll
  // position when older messages are prepended.
  // Only childList changes matter here — attribute mutations (twemoji, syntax
  // highlight class changes, etc.) do not affect layout and are ignored.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let prevScrollHeight = el.scrollHeight;

    const observer = new MutationObserver(() => {
      const newScrollHeight = el.scrollHeight;
      const heightAdded = newScrollHeight - prevScrollHeight;
      prevScrollHeight = newScrollHeight;

      if (pendingOlderLoad.current && heightAdded > 0) {
        // Older messages were prepended — hold the user's visual position
        el.scrollTop += heightAdded;
        pendingOlderLoad.current = false;
        // If the compensated scroll position is still near the top, arm the
        // debounce so the scroll event fired by the scrollTop adjustment above
        // doesn't immediately re-trigger another load.
        if (el.scrollTop <= 10 && loadOlderDebounce.current === null) {
          loadOlderDebounce.current = window.setTimeout(() => {
            loadOlderDebounce.current = null;
          }, 300);
        }
        stableOnOlderLoaded();
        return;
      }

      if (autoScroll.current) {
        el.scrollTop = newScrollHeight;
      }
    });

    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
    // stableOnOlderLoaded is a stable ref-backed callback — no need to re-run.
  }, [stableOnOlderLoaded]);

  return {
    containerRef,
    showScrollBtn,
    scrollToBottom,
    resetForChannel,
    beginLoadOlder,
  };
}
