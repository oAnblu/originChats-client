import { useReducer, useState } from "preact/hooks";
import { useSignalEffect } from "@preact/signals";

import {
  serverUrl,
  currentChannel,
  channels,
  readTimesByServer,
  unreadByChannel,
  unreadPings,
  currentServer,
  currentUserByServer,
  DM_SERVER_URL,
  roturStatuses,
} from "../state";
import {
  selectChannel,
  selectHomeChannel,
  selectRelationshipsChannel,
  markChannelAsRead,
} from "../lib/actions";
import {
  renderChannelsSignal,
  renderVoiceSignal,
  showSettingsModal,
  showServerSettingsModal,
  showVoiceCallView,
  mobileSidebarOpen,
  closeMobileNav,
} from "../lib/ui-signals";
import { Icon } from "./Icon";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { voiceManager } from "../voice";
import { openUserPopout } from "./UserPopout";
import type { VoiceUser } from "../types";
import { avatarUrl } from "../utils";
import { updateStatus, clearStatus } from "../lib/rotur-api";

function isChannelUnread(
  channel: { name: string; last_message?: number },
  sUrl: string,
): boolean {
  const serverReadTimes = readTimesByServer.value[sUrl];
  if (!serverReadTimes || Object.keys(serverReadTimes).length === 0) {
    return false;
  }
  const readTime = serverReadTimes[channel.name] || 0;
  return (channel.last_message || 0) > readTime;
}

export function ChannelList() {
  const [, forceUpdate] = useReducer((n) => n + 1, 0);
  useSignalEffect(() => {
    renderChannelsSignal.value; // subscribe to channel changes
    renderVoiceSignal.value; // subscribe to voice state changes
    forceUpdate(undefined);
  });
  const [contextMenu, setContextMenu] = useState<{
    items: ContextMenuItem[];
    x: number;
    y: number;
  } | null>(null);

  const isDM = serverUrl.value === DM_SERVER_URL;
  const rawChs = channels.value;
  const chs = isDM
    ? [...rawChs].sort(
        (a, b) =>
          ((b as any).last_message || 0) - ((a as any).last_message || 0),
      )
    : rawChs;
  let separatorIndex = 0;

  const isInVoice = voiceManager.isInChannel();
  const myUsername = currentUserByServer.value[serverUrl.value]?.username;

  const handleChannelClick = (channel: any) => {
    if (channel.type === "voice") {
      voiceManager.joinChannel(channel.name, myUsername);
    } else {
      selectChannel(channel);
    }
    // close nav on mobile after selecting a channel
    closeMobileNav();
  };

  const handleChannelContextMenu = (e: MouseEvent, channel: any) => {
    e.preventDefault();
    setContextMenu({
      items: [
        {
          label: "Mark as Read",
          icon: "CheckCircle",
          fn: () => markChannelAsRead(channel.name),
        },
        { separator: true, label: "", fn: () => {} },
        {
          label: "Copy Channel Name",
          icon: "Copy",
          fn: () => {
            navigator.clipboard.writeText(channel.name);
          },
        },
      ],
      x: e.clientX,
      y: e.clientY,
    });
  };

  return (
    <div
      id="channels"
      className={`channels${mobileSidebarOpen.value ? " open" : ""}`}
    >
      <div className="channel-header">
        <div className="channel-header-info">
          <div className="channel-header-name">
            {isDM ? "Direct Messages" : currentServer.value?.name || "Server"}
          </div>
        </div>
        {!isDM && (
          <button
            className="channel-header-settings"
            onClick={() => (showServerSettingsModal.value = true)}
            title="Server Settings"
          >
            <Icon name="Settings" size={16} />
          </button>
        )}
        <button
          className="channel-header-close"
          onClick={closeMobileNav}
          aria-label="Close"
        >
          <Icon name="X" size={18} />
        </button>
      </div>
      <div className="channels-list">
        {isDM && (
          <>
            <div
              className={`channel-item ${currentChannel.value?.name === "home" ? "active" : ""}`}
              onClick={selectHomeChannel}
            >
              <Icon name="Home" size={18} />
              <span>Home</span>
            </div>
            <div
              className={`channel-item ${currentChannel.value?.name === "relationships" ? "active" : ""}`}
              onClick={selectRelationshipsChannel}
            >
              <Icon name="Users" size={18} />
              <span>Friends</span>
            </div>
            <div
              className={`channel-item ${currentChannel.value?.name === "notes" ? "active" : ""}`}
              onClick={() =>
                selectChannel({
                  name: "notes",
                  type: "text",
                  display_name: "Notes",
                })
              }
            >
              <Icon name="FileText" size={18} />
              <span>Notes</span>
            </div>
            <div
              className={`channel-item ${currentChannel.value?.name === "new_message" ? "active" : ""}`}
              onClick={() =>
                selectChannel({
                  name: "new_message",
                  type: "new_message",
                  display_name: "New Message",
                })
              }
            >
              <Icon name="PenSquare" size={16} />
              <span>New Message</span>
            </div>
            <div className="channel-separator" style={{ height: "8px" }} />
          </>
        )}
        {chs.map((channel) => {
          if (isDM && channel.name === "cmds") return null;
          if (isDM && channel.type === "separator") return null;

          if (channel.type === "separator") {
            separatorIndex++;
            return (
              <div
                key={`separator-${separatorIndex}`}
                className="channel-separator"
                style={{ height: ((channel as any).size || 20) + "px" }}
              />
            );
          }

          const isVoice = channel.type === "voice";
          const displayName = (channel as any).display_name || channel.name;
          const hasUnread =
            isChannelUnread(channel, serverUrl.value) ||
            unreadByChannel.value[`${serverUrl.value}:${channel.name}`] > 0;
          const hasPing = unreadPings.value[channel.name] > 0;

          const voiceUsers: VoiceUser[] = (channel as any).voice_state || [];

          if (isVoice) {
            return (
              <div key={channel.name} className="voice-channel-wrapper">
                <div
                  className={`channel-item ${voiceManager.currentChannel === channel.name ? "active" : ""}`}
                  onClick={() => handleChannelClick(channel)}
                  onContextMenu={(e: any) =>
                    handleChannelContextMenu(e, channel)
                  }
                >
                  <Icon name="Mic" size={18} />
                  {(channel as any).icon && (
                    <img
                      src={(channel as any).icon}
                      className="channel-item-icon"
                    />
                  )}
                  <span>{displayName}</span>
                  {voiceUsers.length > 0 && (
                    <span className="voice-user-count">
                      {voiceUsers.length}
                    </span>
                  )}
                </div>
                {voiceUsers.length > 0 && (
                  <div className="voice-channel-user-list">
                    {voiceUsers.map((vu) => (
                      <div
                        key={vu.username}
                        className={`voice-channel-user${vu.muted ? " muted" : ""}`}
                        onClick={(e: any) => openUserPopout(e, vu.username)}
                      >
                        <div className="voice-channel-user-avatar">
                          <img
                            src={vu.pfp || avatarUrl(vu.username)}
                            alt={vu.username}
                          />
                        </div>
                        <span className="voice-channel-username">
                          {vu.username}
                        </span>
                        {vu.muted && <Icon name="MicOff" size={14} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={channel.name}
              className={`channel-item ${currentChannel.value?.name === channel.name ? "active" : ""} ${hasUnread ? "has-unread" : ""}`}
              onClick={() => handleChannelClick(channel)}
              onContextMenu={(e: any) => handleChannelContextMenu(e, channel)}
            >
              {isDM && channel.icon ? (
                <img
                  src={channel.icon}
                  alt={channel.display_name || channel.name}
                  className="channel-item-dm-avatar"
                />
              ) : (
                <>
                  <Icon name="Hash" size={18} />
                  {channel.icon && (
                    <img src={channel.icon} className="channel-item-icon" />
                  )}
                </>
              )}
              <span>{displayName}</span>
              {hasPing && (
                <span className="ping-badge">
                  {unreadPings.value[channel.name]}
                </span>
              )}
              {hasUnread && !hasPing && (
                <span className="unread-indicator"></span>
              )}
            </div>
          );
        })}
      </div>

      {isInVoice && (
        <div className="voice-panel active">
          <div className="voice-panel-info">
            <div className="voice-panel-status">
              <Icon name="Wifi" size={14} />
              <span>Voice Connected</span>
            </div>
            <div className="voice-panel-channel">
              {voiceManager.currentChannel}
            </div>
          </div>
          <div className="voice-panel-controls">
            <button
              className={`voice-control-btn ${voiceManager.isMuted ? "muted" : ""}`}
              onClick={() => voiceManager.toggleMute()}
              title={voiceManager.isMuted ? "Unmute" : "Mute"}
            >
              <Icon name={voiceManager.isMuted ? "MicOff" : "Mic"} size={18} />
            </button>
            <button
              className={`voice-control-btn ${voiceManager.videoStream ? "active" : ""}`}
              onClick={() => voiceManager.toggleScreenShare()}
              title={voiceManager.videoStream ? "Stop Sharing" : "Share Screen"}
            >
              <Icon
                name={voiceManager.videoStream ? "MonitorOff" : "Monitor"}
                size={18}
              />
            </button>
            <button
              className="voice-control-btn"
              onClick={() => {
                showVoiceCallView.value = !showVoiceCallView.value;
              }}
              title="Open Call View"
            >
              <Icon name="Maximize2" size={18} />
            </button>
            <button
              className="voice-control-btn voice-leave-btn"
              onClick={() => voiceManager.leaveChannel()}
              title="Disconnect"
            >
              <Icon name="PhoneOff" size={18} />
            </button>
          </div>
        </div>
      )}

      <UserPanel />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

// ── User panel ────────────────────────────────────────────────────────────────

function UserPanel() {
  const [showStatusModal, setShowStatusModal] = useState(false);
  const sUrl = serverUrl.value;
  const username = currentUserByServer.value[sUrl]?.username;
  const myStatus = username
    ? (roturStatuses.value[username.toLowerCase()] ?? null)
    : null;

  if (!username) return null;

  return (
    <>
      <div className="channel-user-panel">
        <div
          className="channel-user-panel-identity"
          onClick={() => (showSettingsModal.value = true)}
          title="Open Settings"
        >
          <div className="channel-user-panel-avatar">
            <img src={avatarUrl(username)} alt={username} />
          </div>
          <div className="channel-user-panel-info">
            <div className="channel-user-panel-name">{username}</div>
            {myStatus?.content ? (
              <div className="channel-user-panel-status">
                <span className="channel-user-panel-status-text">
                  {myStatus.content}
                </span>
              </div>
            ) : (
              <div className="channel-user-panel-status muted">
                Set a status…
              </div>
            )}
          </div>
        </div>
        <button
          className="channel-user-panel-btn"
          title="Edit Status"
          onClick={() => setShowStatusModal(true)}
        >
          <Icon name="Smile" size={16} />
        </button>
      </div>

      {showStatusModal && (
        <StatusModal
          username={username}
          current={myStatus}
          onClose={() => setShowStatusModal(false)}
        />
      )}
    </>
  );
}

// ── Status modal ──────────────────────────────────────────────────────────────

function StatusModal({
  username,
  current,
  onClose,
}: {
  username: string;
  current: { content?: string } | null;
  onClose: () => void;
}) {
  const [content, setContent] = useState(current?.content ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    setMsg("");
    try {
      await updateStatus(content.trim());
      roturStatuses.value = {
        ...roturStatuses.value,
        [username.toLowerCase()]: { content: content.trim() },
      };
      onClose();
    } catch (e: any) {
      setMsg(e.message || "Failed to save");
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setMsg("");
    try {
      await clearStatus();
      const updated = { ...roturStatuses.value };
      delete updated[username.toLowerCase()];
      roturStatuses.value = updated;
      onClose();
    } catch (e: any) {
      setMsg(e.message || "Failed to clear");
      setSaving(false);
    }
  };

  return (
    <div
      className="status-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="status-modal">
        <div className="status-modal-header">
          <span>Set Status</span>
          <button className="status-modal-close" onClick={onClose}>
            <Icon name="X" size={16} />
          </button>
        </div>
        <div className="status-modal-body">
          <input
            className="status-modal-text"
            type="text"
            placeholder="What's on your mind? (emoji welcome 😊)"
            value={content}
            onInput={(e) => setContent((e.target as HTMLInputElement).value)}
            maxLength={250}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            autoFocus
          />
          {msg && <div className="status-modal-error">{msg}</div>}
        </div>
        <div className="status-modal-footer">
          <button
            className="status-modal-btn secondary"
            onClick={handleClear}
            disabled={saving}
          >
            Clear
          </button>
          <button
            className="status-modal-btn primary"
            onClick={handleSave}
            disabled={saving || !content.trim()}
          >
            {saving ? "Saving…" : "Set Status"}
          </button>
        </div>
      </div>
    </div>
  );
}
