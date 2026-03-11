import { h } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";
import { Icon } from "./Icon";

export interface ContextMenuItem {
  label: string;
  icon?: string;
  danger?: boolean;
  separator?: boolean;
  fn: (event?: Event) => void;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (menuRef.current) {
      let finalX = x;
      let finalY = y;
      const rect = menuRef.current.getBoundingClientRect();
      const padding = 6;
      const isMobile = window.innerWidth <= 768 || "ontouchstart" in window;

      if (!isMobile) {
        if (x + rect.width > window.innerWidth - padding) {
          finalX = window.innerWidth - rect.width - padding;
        }

        if (y + rect.height > window.innerHeight - padding) {
          finalY = window.innerHeight - rect.height - padding;
        }
      }

      menuRef.current.style.left = `${finalX}px`;
      menuRef.current.style.top = `${finalY}px`;
    }
  }, [x, y]);

  const handleClickOutside = (e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ position: "fixed", display: "block" }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, idx) => {
        if (item.separator) {
          return <div key={idx} className="context-menu-separator" />;
        }

        return (
          <div
            key={idx}
            className={`context-menu-item${item.danger ? " danger" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              item.fn(e);
              onClose();
            }}
          >
            {item.icon && <Icon name={item.icon} size={16} />}
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export interface UseContextMenuResult {
  showContextMenu: (event: MouseEvent, items: ContextMenuItem[]) => void;
  closeContextMenu: () => void;
  contextMenu: ContextMenuItem[] | null;
  position: { x: number; y: number } | null;
}

export function useContextMenu() {
  const [items, setItems] = useState<ContextMenuItem[] | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );

  const showContextMenu = (event: MouseEvent, menuItems: ContextMenuItem[]) => {
    event.preventDefault();
    event.stopPropagation();
    setItems(menuItems);
    setPosition({ x: event.clientX, y: event.clientY });
  };

  const closeContextMenu = () => {
    setItems(null);
    setPosition(null);
  };

  return {
    showContextMenu,
    closeContextMenu,
    contextMenu: items,
    position,
  };
}
