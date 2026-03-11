import { useState, useEffect, useRef } from "preact/hooks";
import { recentEmojis } from "../state";

export interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  anchorRef?: React.RefObject<HTMLElement>;
  mode?: "emoji" | "reaction";
}

const QUICK_REACTIONS = [
  "😭",
  "😔",
  "💀",
  "👍",
  "👎",
  "❤️",
  "😂",
  "😮",
  "😢",
  "🔥",
];

export function EmojiPicker({
  isOpen,
  onClose,
  onSelect,
  anchorRef,
  mode = "emoji",
}: EmojiPickerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<
    "recent" | "search" | "categories"
  >("recent");
  const [focusedCategory, setFocusedCategory] = useState<
    keyof typeof EMOJI_CATEGORIES | null
  >(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && anchorRef?.current && pickerRef.current) {
      positionPicker();
    }
  }, [isOpen, anchorRef]);

  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        !anchorRef?.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("resize", positionPicker);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("resize", positionPicker);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, anchorRef, onClose]);

  const positionPicker = () => {
    if (!anchorRef?.current || !pickerRef.current) return;

    const rect = anchorRef.current.getBoundingClientRect();
    const pickerRect = pickerRef.current.getBoundingClientRect();

    const isMobile = window.innerWidth <= 768;
    let x = rect.left;
    let y = rect.bottom + 5;

    if (isMobile) {
      x = 0;
      y = window.innerHeight - pickerRect.height;
    } else {
      if (x + pickerRect.width > window.innerWidth - 10) {
        x = window.innerWidth - pickerRect.width - 10;
      }
      if (y + pickerRect.height > window.innerHeight - 10) {
        y = rect.top - pickerRect.height - 5;
      }
    }

    pickerRef.current.style.left = `${x}px`;
    pickerRef.current.style.top = `${y}px`;
  };

  const addRecent = (emoji: string) => {
    const currentRecent = recentEmojis.value;
    const updated = currentRecent.includes(emoji)
      ? currentRecent.filter((e) => e !== emoji)
      : [emoji, ...currentRecent.slice(0, 49)];
    recentEmojis.value = updated;
    onSelect(emoji);
    onClose();
  };

  const getEmojis = (): string[] => {
    switch (activeTab) {
      case "recent":
        const recent =
          recentEmojis.value.length > 0 ? recentEmojis.value : QUICK_REACTIONS;
        return recent.filter(
          (emoji) => !searchTerm || emoji.includes(searchTerm),
        );

      case "search":
        const allEmojis = Object.values(EMOJI_CATEGORIES).flat();
        return allEmojis
          .filter((emoji) => emoji.includes(searchTerm))
          .slice(0, 100);

      case "categories":
        if (!focusedCategory) return [];
        return EMOJI_CATEGORIES[focusedCategory].filter(
          (emoji) => !searchTerm || emoji.includes(searchTerm),
        );

      default:
        return [];
    }
  };

  if (!isOpen) return null;

  return (
    <div ref={pickerRef} className={`emoji-picker emoji-picker-${mode}`}>
      <div className="emoji-picker-tabs">
        <button
          className={`emoji-tab ${activeTab === "recent" ? "active" : ""}`}
          onClick={() => setActiveTab("recent")}
        >
          Recent
        </button>
        <button
          className={`emoji-tab ${activeTab === "categories" ? "active" : ""}`}
          onClick={() => setActiveTab("categories")}
        >
          Categories
        </button>
      </div>

      {activeTab === "recent" && (
        <div className="emoji-picker-content">
          {(() => {
            const recent =
              recentEmojis.value.length > 0
                ? recentEmojis.value
                : QUICK_REACTIONS;
            return recent
              .filter((emoji) => !searchTerm || emoji.includes(searchTerm))
              .map((emoji) => (
                <button
                  key={emoji}
                  className="emoji-button"
                  onClick={() => addRecent(emoji)}
                >
                  {emoji}
                </button>
              ));
          })()}
        </div>
      )}

      {activeTab === "search" && (
        <>
          <div className="emoji-picker-search">
            <input
              type="text"
              placeholder="Search emoji..."
              value={searchTerm}
              onInput={(e) =>
                setSearchTerm((e.target as HTMLInputElement).value)
              }
              autoFocus
            />
          </div>
          <div className="emoji-picker-content">
            {getEmojis().map((emoji) => (
              <button
                key={emoji}
                className="emoji-button"
                onClick={() => addRecent(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}

      {activeTab === "categories" && (
        <div className="emoji-picker-content">
          <div className="emoji-categories">
            {Object.keys(EMOJI_CATEGORIES).map((cat) => (
              <button
                key={cat}
                className={`emoji-category-tab ${focusedCategory === cat ? "active" : ""}`}
                onClick={() =>
                  setFocusedCategory(cat as keyof typeof EMOJI_CATEGORIES)
                }
              >
                {EMOJI_CATEGORIES[cat as keyof typeof EMOJI_CATEGORIES]?.[0]}{" "}
                {cat}
              </button>
            ))}
          </div>
          {focusedCategory && (
            <div className="emoji-picker-content">
              {EMOJI_CATEGORIES[focusedCategory].map((emoji) => (
                <button
                  key={emoji}
                  className="emoji-button"
                  onClick={() => addRecent(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const EMOJI_CATEGORIES: Record<string, string[]> = {
  Smileys: [
    "😀",
    "😃",
    "😄",
    "😁",
    "😆",
    "😊",
    "😇",
    "🥰",
    "😍",
    "😘",
    "🥲",
    "🥵",
    "😋",
    "🤩",
    "🤔",
    "🤯",
    "😎",
    "🤓",
    "🥸",
    "😶",
    "🤐",
  ],
  Hearts: [
    "❤️",
    "🧡",
    "💛",
    "💚",
    "💙",
    "💜",
    "🖤",
    "🤍",
    "💔",
    "🧡",
    "💯",
    "❤️‍🔥",
    "❣️",
    "💕",
    "💞",
    "💓",
    "💗",
    "💖",
  ],
  Animals: [
    "🐶",
    "🐱",
    "🐭",
    "🐹",
    "🐰",
    "🦊",
    "🐻",
    "🐼",
    "🦨",
    "🦁",
    "🐸",
    "🐵",
    "🐔",
    "🐧",
    "🦆",
    "🦅",
    "🦉",
    "🐺",
    "🦋",
    "🐌",
    "🐛",
    "🐟",
  ],
  Food: [
    "🍎",
    "🍏",
    "🍐",
    "🍊",
    "🍋",
    "🍌",
    "🍉",
    "🍇",
    "🍓",
    "🍒",
    "🍑",
    "🥭",
    "🥝",
    "🍅",
    "🥒",
    "🥬",
    "🥦",
    "🥑",
    "🧄",
    "🧅",
    "🥕",
    "🧀",
    "🍆",
    "🌶",
  ],
  Symbols: [
    "✅",
    "❌",
    "⭐",
    "⬆️",
    "⬇️",
    "▶️",
    "⏸",
    "⏯",
    "⏹",
    "⏭",
    "↩",
    "↪",
    "⏩",
    "⏪",
    "🔈",
    "🔇",
    "🔉",
    "🔊",
    "✉️",
    "🏠",
    "🏢",
    "🏰",
  ],
};
