import { Icon } from "./Icon";
import type { Message } from "../types";

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
  const handleMoreClick = (e: MouseEvent) => {
    e.stopPropagation();
    onContextMenu(e);
  };

  return (
    <div className="message-action-buttons">
      {canReact &&
        QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            className="action-btn quick-reaction"
            onClick={(e) => {
              e.stopPropagation();
              onReact(emoji);
            }}
          >
            {emoji}
          </button>
        ))}
      {canReact && (
        <button
          className="action-btn"
          title="React"
          onClick={(e) => {
            e.stopPropagation();
            onOpenEmojiPicker();
          }}
        >
          <Icon name="SmilePlus" size={16} />
        </button>
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
