import { useState, useRef } from "preact/hooks";
import { useSignalEffect } from "@preact/signals";
import {
  serverUrl,
  currentChannel,
  servers,
  dmServers,
  currentUser,
  wsStatus,
  readTimesByServer,
  unreadCountsByServer,
  serverPingsByServer,
  unreadByChannel,
  DM_SERVER_URL,
} from "../state";
import { wsSend } from "../lib/websocket";
import {
  switchServer,
  markServerAsRead,
  removeServer,
  openDMWith,
} from "../lib/actions";
import { showDiscoveryModal, mobileSidebarOpen } from "../lib/ui-signals";
import { renderGuildSidebarSignal } from "../lib/ui-signals";
import { Icon, ServerIcon } from "./Icon";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { avatarUrl, reloadServerIcon } from "../utils";

export function GuildSidebar() {
  useSignalEffect(() => {
    renderGuildSidebarSignal.value;
  });
  const [contextMenu, setContextMenu] = useState<{
    items: ContextMenuItem[];
    x: number;
    y: number;
  } | null>(null);

  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const didDragRef = useRef(false);

  const handleHomeClick = async () => {
    if (serverUrl.value !== DM_SERVER_URL) {
      await switchServer(DM_SERVER_URL);
    }
  };

  const getConnectionClass = (url: string) => {
    const status = wsStatus[url];
    switch (status) {
      case "connecting":
        return "server-connecting";
      case "connected":
        return "";
      case "disconnected":
      case "error":
        return "server-disconnected";
      default:
        return "";
    }
  };

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
    didDragRef.current = false;
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    didDragRef.current = true;
    setDragOverIndex(index);
  };

  const handleDrop = async (index: number) => {
    const from = dragIndexRef.current;
    if (from === null || from === index) {
      setDragOverIndex(null);
      return;
    }
    const reordered = [...servers.value];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(index, 0, moved);
    servers.value = reordered;
    dragIndexRef.current = null;
    setDragOverIndex(null);
    try {
      const { saveServers } = await import("../lib/persistence");
      await saveServers();
    } catch {}
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  const handleServerContextMenu = (
    e: MouseEvent,
    server: { url: string; name: string },
  ) => {
    e.preventDefault();
    setContextMenu({
      items: [
        {
          label: "Mark as Read",
          icon: "CheckCircle",
          fn: () => markServerAsRead(server.url),
        },
        { separator: true, label: "", fn: () => {} },
        {
          label: "Reload Icon",
          icon: "RefreshCw",
          fn: () => reloadServerIcon(server.url),
        },
        { separator: true, label: "", fn: () => {} },
        {
          label: "Copy URL",
          icon: "Copy",
          fn: () => {
            navigator.clipboard.writeText(server.url);
          },
        },
        { separator: true, label: "", fn: () => {} },
        {
          label: "Leave Server",
          icon: "LogOut",
          danger: true,
          fn: () => {
            wsSend({ cmd: "user_leave" }, server.url);
            if (confirm("Leave this server?")) {
              removeServer(server.url);
            }
          },
        },
      ],
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleDMContextMenu = (
    e: MouseEvent,
    dmServer: { channel: string; username: string; name: string },
  ) => {
    e.preventDefault();
    setContextMenu({
      items: [
        {
          label: "Mark as Read",
          icon: "CheckCircle",
          fn: () => markServerAsRead(DM_SERVER_URL),
        },
        { separator: true, label: "", fn: () => {} },
        {
          label: "Copy Username",
          icon: "Copy",
          fn: () => {
            navigator.clipboard.writeText(dmServer.username);
          },
        },
      ],
      x: e.clientX,
      y: e.clientY,
    });
  };

  return (
    <div className={`guild-sidebar${mobileSidebarOpen.value ? " open" : ""}`}>
      <div className="guild-list">
        <div
          className={`guild-item home-guild ${serverUrl.value === DM_SERVER_URL ? "active" : ""} ${getConnectionClass(DM_SERVER_URL)}`}
          onClick={handleHomeClick}
        >
          <div className="guild-icon">
            <Icon name="MessageCircle" size={24} />
          </div>
          <div className="guild-pill"></div>
          {(() => {
            const totalDMUnread = dmServers.value.reduce(
              (sum, dm) =>
                sum +
                (unreadByChannel.value[`${DM_SERVER_URL}:${dm.channel}`] || 0),
              0,
            );
            return totalDMUnread > 0 ? (
              <div className="guild-ping-badge">{totalDMUnread}</div>
            ) : null;
          })()}
        </div>
        {dmServers.value
          .filter((dm) => {
            const readTime =
              readTimesByServer.value[DM_SERVER_URL]?.[dm.channel] || 0;
            const lastMsg = dm.last_message || 0;
            return lastMsg > readTime;
          })
          .map((dmServer) => {
            return (
              <div
                key={dmServer.channel}
                className={`guild-item dm-server`}
                onClick={() => openDMWith(dmServer.username)}
                onContextMenu={(e: any) => handleDMContextMenu(e, dmServer)}
              >
                <div className="guild-icon">
                  <img src={avatarUrl(dmServer.username)} alt={dmServer.name} />
                </div>
                <div className="guild-pill"></div>
                <div className="guild-unread-dot"></div>
              </div>
            );
          })}
        <div className="guild-divider"></div>
        {servers.value.map((server, index) => {
          const hasUnread = (unreadCountsByServer.value[server.url] || 0) > 0;
          const pingCount = serverPingsByServer.value[server.url] || 0;
          const isDragOver = dragOverIndex === index;
          return (
            <div
              key={server.url}
              draggable
              className={`guild-item ${serverUrl.value === server.url ? "active" : ""} ${getConnectionClass(server.url)}${isDragOver ? " drag-over" : ""}`}
              onClick={() => {
                if (!didDragRef.current) switchServer(server.url);
                didDragRef.current = false;
              }}
              onContextMenu={(e: any) => handleServerContextMenu(e, server)}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e: any) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
            >
              <div className="guild-icon">
                <ServerIcon server={server} />
              </div>
              <div className="guild-pill"></div>
              {hasUnread && !pingCount && (
                <div className="guild-unread-dot"></div>
              )}
              {pingCount > 0 && (
                <div className="guild-ping-badge">{pingCount}</div>
              )}
            </div>
          );
        })}
        <div className="guild-divider"></div>
        <div
          className="guild-item add-guild"
          onClick={() => (showDiscoveryModal.value = true)}
        >
          <div className="guild-icon">
            <Icon name="Plus" size={24} />
          </div>
        </div>
      </div>

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
