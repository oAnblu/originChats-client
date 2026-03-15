import { useState, useRef, useEffect } from "preact/hooks";
import { Icon } from "./Icon";
import type { Message } from "../types";
import { showContextMenu } from "../lib/ui-signals";

const QUICK_REACTIONS = ["👍", "👎", "😄", "❤️"];

interface MessageActionButtonsProps {
  message: Message;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onOpenEmojiPicker: () => void;
  onContextMenu: (e: MouseEvent) => void;
  canReact: boolean;
  canReply: boolean;
  isOwn: boolean;
}

export function MessageActionButtons({
  message,
  onReply,
  onReact,
  onOpenEmojiPicker,
  onContextMenu,
  canReact,
  canReply,
  isOwn,
}: MessageActionButtonsProps) {
  const [showQuickReactions, setShowQuickReactions] = useState(false);
  const reactBtnRef = useRef<HTMLButtonElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showQuickReactions) return;
    const onClick = (e: MouseEvent) => {
      if (quickRef.current && !quickRef.current.contains(e.target as Node)) {
        setShowQuickReactions(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [showQuickReactions]);

  const handleMoreClick = (e: MouseEvent) => {
    e.stopPropagation();
    onContextMenu(e);
  };

  return (
    <div className="message-action-buttons">
      {canReact && (
        <div className="quick-reactions-wrapper" ref={quickRef}>
          <button
            ref={reactBtnRef}
            className="action-btn"
            title="React"
            onClick={(e) => {
              e.stopPropagation();
              setShowQuickReactions((v) => !v);
            }}
          >
            <Icon name="Smile" size={16} />
          </button>
          {showQuickReactions && (
            <div className="quick-reactions-popup">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  className="quick-reaction-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReact(emoji);
                    setShowQuickReactions(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
              <button
                className="quick-reaction-more"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowQuickReactions(false);
                  onOpenEmojiPicker();
                }}
                title="More reactions"
              >
                <Icon name="SmilePlus" size={16} />
              </button>
            </div>
          )}
        </div>
      )}
      {canReply && (
        <button
          className="action-btn"
          title="Reply"
          onClick={(e) => {
            e.stopPropagation();
            onReply();
          }}
        >
          <Icon name="MessageCircle" size={16} />
        </button>
      )}
      <button className="action-btn" title="More" onClick={handleMoreClick}>
        <Icon name="MoreHorizontal" size={16} />
      </button>
    </div>
  );
}
