import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "preact/hooks";
import { memo } from "preact/compat";
import type { ComponentChildren } from "preact";

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number | ((index: number) => number);
  overscan?: number;
  children: (item: T, index: number) => ComponentChildren;
  className?: string;
  onScroll?: (scrollTop: number) => void;
}

interface VirtualMessageListProps<T> extends VirtualListProps<T> {
  scrollToBottom?: boolean;
  onNearTop?: () => void;
  nearTopThreshold?: number;
}

export function VirtualMessageList<T>({
  items,
  itemHeight,
  overscan = 5,
  children,
  className,
  onScroll,
  scrollToBottom,
  onNearTop,
  nearTopThreshold = 200,
}: VirtualMessageListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const lastScrollHeight = useRef(0);
  const stickToBottom = useRef(true);

  const getItemHeight = useCallback(
    (index: number) =>
      typeof itemHeight === "function" ? itemHeight(index) : itemHeight,
    [itemHeight],
  );

  const { positions, totalHeight } = useMemo(() => {
    const positions: number[] = [];
    let currentPos = 0;
    for (let i = 0; i < items.length; i++) {
      positions.push(currentPos);
      currentPos += getItemHeight(i);
    }
    return { positions, totalHeight: currentPos };
  }, [items, getItemHeight]);

  const startIndex = useMemo(() => {
    let low = 0;
    let high = items.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (positions[mid] < scrollTop) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return Math.max(0, low - overscan);
  }, [positions, scrollTop, overscan, items.length]);

  const endIndex = useMemo(() => {
    const bottom = scrollTop + viewportHeight;
    let idx = startIndex;
    while (
      idx < items.length &&
      positions[idx] < bottom + overscan * getItemHeight(idx)
    ) {
      idx++;
    }
    return Math.min(items.length - 1, idx);
  }, [
    positions,
    scrollTop,
    viewportHeight,
    startIndex,
    overscan,
    items.length,
    getItemHeight,
  ]);

  const visibleItems = useMemo(() => {
    const result: { item: T; index: number; style: string }[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const item = items[i];
      if (item !== undefined) {
        result.push({
          item,
          index: i,
          style: `position:absolute;top:${positions[i]}px;left:0;right:0;`,
        });
      }
    }
    return result;
  }, [items, startIndex, endIndex, positions]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (scrollToBottom && stickToBottom.current) {
      const scrollHeight = container.scrollHeight;
      if (scrollHeight !== lastScrollHeight.current) {
        lastScrollHeight.current = scrollHeight;
        container.scrollTop = scrollHeight;
      }
    }
  }, [items, scrollToBottom]);

  const handleScroll = useCallback(
    (e: Event) => {
      const target = e.currentTarget as HTMLDivElement;
      const newScrollTop = target.scrollTop;
      const scrollHeight = target.scrollHeight;
      const clientHeight = target.clientHeight;

      stickToBottom.current = scrollHeight - newScrollTop - clientHeight < 50;

      setScrollTop(newScrollTop);
      onScroll?.(newScrollTop);

      if (newScrollTop < nearTopThreshold && onNearTop) {
        onNearTop();
      }
    },
    [onScroll, nearTopThreshold, onNearTop],
  );

  return (
    <div
      ref={containerRef}
      className={className}
      onScroll={handleScroll}
      style={{
        overflowY: "auto",
        position: "relative",
        height: "100%",
        contain: "strict",
      }}
    >
      <div
        style={{
          height: totalHeight,
          position: "relative",
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          {visibleItems.map(({ item, index, style }) => (
            <div key={(item as any).id || index} style={style}>
              {children(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const MemoVirtualMessageList = memo(
  VirtualMessageList,
) as typeof VirtualMessageList;
