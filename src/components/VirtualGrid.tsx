import { useEffect, useRef, useState, useCallback } from "preact/hooks";

interface VirtualGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => preact.VNode;
  itemHeight: number;
  columns: number;
  overscan: number;
  className?: string;
}

export function VirtualGrid<T>({
  items,
  renderItem,
  itemHeight,
  columns,
  overscan = 3,
  className,
}: VirtualGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  const rowsPerScreen = Math.ceil(containerHeight / itemHeight);
  const totalRows = Math.ceil(items.length / columns);
  const totalHeight = totalRows * itemHeight;

  const startRow = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endRow = Math.min(
    totalRows,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan,
  );

  const visibleItems = [];
  for (let row = startRow; row < endRow; row++) {
    for (let col = 0; col < columns; col++) {
      const idx = row * columns + col;
      if (idx < items.length) {
        visibleItems.push({ item: items[idx], index: idx });
      }
    }
  }

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      onScroll={handleScroll}
      style={{
        overflowY: "auto",
        position: "relative",
        height: "100%",
      }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: startRow * itemHeight,
            left: 0,
            right: 0,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: "2px",
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              margin: "0 8px",
            }}
          >
            {visibleItems.map(({ item, index }) => renderItem(item, index))}
          </div>
        </div>
      </div>
    </div>
  );
}
