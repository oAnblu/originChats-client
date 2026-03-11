import { useSignalEffect } from "@preact/signals";
import {
  serverUrl,
  users,
  currentChannel,
  messages,
  rolesByServer,
  DM_SERVER_URL,
} from "../state";
import { renderMembersSignal, mobilePanelOpen } from "../lib/ui-signals";
import { Icon } from "./Icon";
import { UserContextMenu, useUserContextMenu } from "./UserContextMenu";
import { openUserPopout } from "./UserPopout";
import { avatarUrl } from "../utils";

export function MembersList() {
  useSignalEffect(() => {
    renderMembersSignal.value;
  });

  const { showUserMenu, closeUserMenu, userMenu } = useUserContextMenu();

  const isDM = serverUrl.value === DM_SERVER_URL;

  let memberList: Array<{
    username: string;
    status: string | undefined;
    color: string;
    roles: string[];
  }>;

  if (isDM) {
    const channelName = currentChannel.value?.name;
    const channelMessages = channelName
      ? Object.values(messages.value[channelName] || {})
      : [];
    const uniqueUsernames = [
      ...new Set(channelMessages.map((m: any) => m.user).filter(Boolean)),
    ];
    memberList = uniqueUsernames.map((username) => ({
      username,
      status: users.value[username?.toLowerCase()]?.status,
      color: users.value[username?.toLowerCase()]?.color || null,
      roles: users.value[username?.toLowerCase()]?.roles || [],
    }));

    if (memberList.length === 0) return null;
  } else {
    const viewRoles = currentChannel.value?.permissions?.view;
    memberList = Object.values(users.value)
      .filter((u) => {
        if (!viewRoles || viewRoles.length === 0) return true;
        const userRoles = u.roles || [];
        return viewRoles.some((r) => userRoles.includes(r));
      })
      .map((u) => ({
        username: u.username,
        status: u.status,
        color: u.color || null,
        roles: u.roles || [],
      }));
  }

  // Build hoisted role list in server-defined order (only roles with hoisted: true)
  const rolesMap = rolesByServer.value[serverUrl.value] || {};
  const hoistedRoles = Object.entries(rolesMap)
    .filter(([, role]) => role.hoisted === true)
    .map(([name, role]) => ({ name, color: role.color || null }));

  // For each member, find the first hoisted role they have (in server role order)
  const getHoistedRole = (
    member: (typeof memberList)[number],
  ): string | null => {
    for (const hoisted of hoistedRoles) {
      if (member.roles.includes(hoisted.name)) return hoisted.name;
    }
    return null;
  };

  // Build sections: one per hoisted role (members with that role), then online/offline remainder
  const assignedToHoisted = new Set<string>();

  const hoistedSections = hoistedRoles
    .map(({ name, color }) => {
      const members = memberList.filter(
        (m) => m.status === "online" && getHoistedRole(m) === name,
      );
      members.forEach((m) => assignedToHoisted.add(m.username));
      return { roleName: name, color, members };
    })
    .filter((s) => s.members.length > 0);

  const remainder = memberList.filter(
    (m) => !assignedToHoisted.has(m.username),
  );
  const onlineRemainder = remainder.filter((u) => u.status === "online");
  const offlineRemainder = remainder.filter((u) => u.status !== "online");

  return (
    <div id="members-list" className={mobilePanelOpen.value ? "open" : ""}>
      {/* Hoisted role sections */}
      {hoistedSections.map(({ roleName, color, members }) => (
        <div key={roleName}>
          <h2 style={color ? { color } : undefined}>
            {roleName} — {members.length}
          </h2>
          {members.map((user) => (
            <MemberItem
              key={user.username}
              user={user}
              offline={user.status !== "online"}
              onContextMenu={showUserMenu}
            />
          ))}
        </div>
      ))}

      {/* Remaining members grouped by online/offline */}
      {onlineRemainder.length > 0 && (
        <>
          <h2>Online — {onlineRemainder.length}</h2>
          {onlineRemainder.map((user) => (
            <MemberItem
              key={user.username}
              user={user}
              onContextMenu={showUserMenu}
            />
          ))}
        </>
      )}
      {offlineRemainder.length > 0 && (
        <>
          <h2>Offline — {offlineRemainder.length}</h2>
          {offlineRemainder.map((user) => (
            <MemberItem
              key={user.username}
              user={user}
              offline
              onContextMenu={showUserMenu}
            />
          ))}
        </>
      )}

      {userMenu && (
        <UserContextMenu
          username={userMenu.username}
          x={userMenu.x}
          y={userMenu.y}
          onClose={closeUserMenu}
        />
      )}
    </div>
  );
}

function MemberItem({
  user,
  offline,
  onContextMenu,
}: {
  user: any;
  offline?: boolean;
  onContextMenu: (e: MouseEvent, username: string) => void;
}) {
  return (
    <div
      className={`member${offline ? " offline" : ""}`}
      onClick={(e: any) => openUserPopout(e, user.username, true)}
      onContextMenu={(e: any) => onContextMenu(e, user.username)}
    >
      <img src={avatarUrl(user.username)} alt={user.username} />
      <span
        className="name"
        style={user.color ? { color: user.color } : undefined}
      >
        {user.username}
      </span>
    </div>
  );
}
