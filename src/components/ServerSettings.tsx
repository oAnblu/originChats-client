import { useState, useEffect } from "preact/hooks";
import {
  serverUrl,
  currentServer,
  users,
  channels,
  rolesByServer,
  currentUser,
} from "../state";
import { showServerSettingsModal } from "../lib/ui-signals";
import { wsSend } from "../lib/websocket";
import { Icon } from "./Icon";
import type { Role, Channel, ServerUser } from "../types";
import { avatarUrl } from "../utils";

type Section = "overview" | "channels" | "roles" | "members";

export function ServerSettingsModal() {
  const [section, setSection] = useState<Section>("overview");
  const [serverRoles, setServerRoles] = useState<Role[]>([]);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [roleColor, setRoleColor] = useState("#5865F2");
  const [memberFilter, setMemberFilter] = useState("");
  const [memberRolesModal, setMemberRolesModal] = useState<string | null>(null);

  useEffect(() => {
    wsSend({ cmd: "roles_list" }, serverUrl.value);
  }, []);

  useEffect(() => {
    const roles = rolesByServer.value[serverUrl.value];
    if (roles) {
      setServerRoles(Object.values(roles));
    }
  }, [rolesByServer.value]);

  const close = () => {
    showServerSettingsModal.value = false;
  };

  const getRoleColor = (roleName: string): string => {
    const role = serverRoles.find((r) => r.name === roleName);
    return role?.color || "#5865F2";
  };

  const myServerUser =
    users.value[currentUser.value?.username?.toLowerCase() || ""];
  const isOwner = myServerUser?.roles?.includes("owner");

  const server = currentServer.value;
  const usersList = Object.values(users.value);
  const channelsList = channels.value;

  const filteredMembers = usersList
    .filter(
      (m) =>
        !memberFilter ||
        m.username.toLowerCase().includes(memberFilter.toLowerCase()),
    )
    .sort((a, b) => {
      const ar = a.roles || [];
      const br = b.roles || [];
      if (ar.includes("owner") && !br.includes("owner")) return -1;
      if (!ar.includes("owner") && br.includes("owner")) return 1;
      if (ar.includes("admin") && !br.includes("admin")) return -1;
      if (!ar.includes("admin") && br.includes("admin")) return 1;
      return a.username.localeCompare(b.username);
    });

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleName("");
    setRoleDesc("");
    setRoleColor("#5865F2");
    setRoleModalOpen(true);
  };

  const openEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description || "");
    setRoleColor(role.color || "#5865F2");
    setRoleModalOpen(true);
  };

  const handleRoleSubmit = () => {
    if (!roleName.trim()) return;
    if (editingRole) {
      wsSend(
        {
          cmd: "role_update",
          name: roleName,
          description: roleDesc,
          color: roleColor,
        },
        serverUrl.value,
      );
    } else {
      wsSend(
        {
          cmd: "role_create",
          name: roleName,
          description: roleDesc,
          color: roleColor,
        },
        serverUrl.value,
      );
    }
    setRoleModalOpen(false);
  };

  const deleteRole = (name: string) => {
    if (["owner", "admin", "user"].includes(name)) return;
    if (confirm(`Delete role "${name}"?`)) {
      wsSend({ cmd: "role_delete", name }, serverUrl.value);
    }
  };

  const toggleMemberRole = (
    username: string,
    roleName: string,
    hasRole: boolean,
  ) => {
    wsSend(
      {
        cmd: hasRole ? "role_remove" : "role_assign",
        username,
        role: roleName,
      },
      serverUrl.value,
    );
  };

  return (
    <div
      className="server-settings-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="server-settings-modal">
        <div className="server-settings-sidebar">
          <div className="server-settings-header">
            <div className="server-settings-icon">
              {server?.icon ? (
                <img src={server.icon} alt={server.name} />
              ) : (
                <span>{(server?.name || "S").charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="server-settings-title">
              <div className="server-settings-name">
                {server?.name || "Server"}
              </div>
              <div className="server-settings-url">{serverUrl.value}</div>
            </div>
          </div>
          <nav className="server-settings-nav">
            {(["overview", "channels", "roles", "members"] as Section[]).map(
              (s) => (
                <button
                  key={s}
                  className={`server-nav-item ${section === s ? "active" : ""}`}
                  onClick={() => setSection(s)}
                >
                  <Icon
                    name={
                      s === "overview"
                        ? "Info"
                        : s === "channels"
                          ? "Hash"
                          : s === "roles"
                            ? "Shield"
                            : "Users"
                    }
                    size={16}
                  />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ),
            )}
          </nav>
        </div>
        <div className="server-settings-content">
          <div className="server-settings-content-header">
            <h2>{section.charAt(0).toUpperCase() + section.slice(1)}</h2>
            <button className="server-settings-close" onClick={close}>
              <Icon name="X" size={20} />
            </button>
          </div>

          {section === "overview" && (
            <div className="server-section-body">
              <div className="settings-field">
                <label>Server Name</label>
                <div className="settings-value">{server?.name || "-"}</div>
              </div>
              <div className="settings-field">
                <label>Server URL</label>
                <div className="settings-value">{serverUrl.value}</div>
              </div>
              <div className="settings-field">
                <label>Your Role</label>
                <div
                  className="settings-value"
                  style={{
                    color: myServerUser?.roles?.[0]
                      ? getRoleColor(myServerUser.roles[0])
                      : "var(--text-dim)",
                  }}
                >
                  {myServerUser?.roles?.join(", ") || "None"}
                </div>
              </div>
              <div className="settings-field">
                <label>Members</label>
                <div className="settings-value">{usersList.length}</div>
              </div>
              <div className="settings-field">
                <label>Channels</label>
                <div className="settings-value">
                  {channelsList.filter((c) => c.type !== "separator").length}
                </div>
              </div>
            </div>
          )}

          {section === "channels" && (
            <div className="server-section-body">
              {channelsList.length === 0 ? (
                <div className="settings-empty">No channels found</div>
              ) : (
                <div className="settings-list">
                  {channelsList.map((channel, idx) => {
                    const iconName =
                      channel.type === "voice"
                        ? "Mic"
                        : channel.type === "separator"
                          ? "Minus"
                          : "Hash";
                    return (
                      <div key={channel.name} className="settings-list-item">
                        <div className="settings-item-icon">
                          <Icon name={iconName} size={16} />
                        </div>
                        <div className="settings-item-info">
                          <div className="settings-item-name">
                            {(channel as any).display_name || channel.name}
                          </div>
                          <div className="settings-item-meta">
                            {channel.type}
                            {channel.type === "separator"
                              ? ""
                              : ` - ${channel.name}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {section === "roles" && (
            <div className="server-section-body">
              <div className="settings-section-actions">
                <button
                  className="settings-action-btn"
                  onClick={openCreateRole}
                >
                  <Icon name="Plus" size={16} /> Create Role
                </button>
              </div>
              {serverRoles.length === 0 ? (
                <div className="settings-empty">No roles found</div>
              ) : (
                <div className="settings-list">
                  {serverRoles.map((role) => {
                    const isSystem = ["owner", "admin", "user"].includes(
                      role.name,
                    );
                    return (
                      <div key={role.name} className="settings-list-item">
                        <div
                          className="role-color-dot"
                          style={{ background: role.color || "#5865F2" }}
                        ></div>
                        <div className="settings-item-info">
                          <div
                            className="settings-item-name"
                            style={{ color: role.color || "#5865F2" }}
                          >
                            {role.name}
                          </div>
                          <div className="settings-item-meta">
                            {role.description || "No description"}
                          </div>
                        </div>
                        <div className="settings-item-actions">
                          {isSystem ? (
                            <span className="settings-system-badge">
                              System
                            </span>
                          ) : (
                            <>
                              <button
                                className="settings-icon-btn"
                                onClick={() => openEditRole(role)}
                                title="Edit"
                              >
                                <Icon name="Edit3" size={14} />
                              </button>
                              <button
                                className="settings-icon-btn danger"
                                onClick={() => deleteRole(role.name)}
                                title="Delete"
                              >
                                <Icon name="Trash2" size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {section === "members" && (
            <div className="server-section-body">
              <div className="settings-search">
                <Icon name="Search" size={14} />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={memberFilter}
                  onInput={(e) =>
                    setMemberFilter((e.target as HTMLInputElement).value)
                  }
                />
              </div>
              <div className="settings-list">
                {filteredMembers.map((member) => (
                  <div
                    key={member.username}
                    className="settings-list-item member-row"
                  >
                    <img
                      src={avatarUrl(member.username)}
                      className="settings-member-avatar"
                      alt=""
                    />
                    <div className="settings-item-info">
                      <div
                        className="settings-item-name"
                        style={{ color: member.color || "#fff" }}
                      >
                        {member.username}
                      </div>
                      <div className="settings-item-roles">
                        {(member.roles || []).slice(0, 3).map((role) => (
                          <span
                            key={role}
                            className="member-role-badge"
                            style={{ background: getRoleColor(role) }}
                          >
                            {role}
                          </span>
                        ))}
                        {(member.roles || []).length > 3 && (
                          <span className="member-role-badge">
                            +{(member.roles || []).length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="settings-icon-btn"
                      onClick={() => setMemberRolesModal(member.username)}
                      title="Manage Roles"
                    >
                      <Icon name="Settings" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {roleModalOpen && (
          <div
            className="settings-inner-modal"
            onClick={(e) => {
              if (e.target === e.currentTarget) setRoleModalOpen(false);
            }}
          >
            <div className="settings-inner-dialog">
              <h3>{editingRole ? "Edit Role" : "Create Role"}</h3>
              <div className="settings-field">
                <label>Name</label>
                <input
                  type="text"
                  value={roleName}
                  onInput={(e) =>
                    setRoleName((e.target as HTMLInputElement).value)
                  }
                  disabled={!!editingRole}
                  placeholder="Role name"
                />
              </div>
              <div className="settings-field">
                <label>Description</label>
                <input
                  type="text"
                  value={roleDesc}
                  onInput={(e) =>
                    setRoleDesc((e.target as HTMLInputElement).value)
                  }
                  placeholder="Role description"
                />
              </div>
              <div className="settings-field">
                <label>Color</label>
                <div className="settings-color-field">
                  <input
                    type="color"
                    value={roleColor}
                    onInput={(e) =>
                      setRoleColor((e.target as HTMLInputElement).value)
                    }
                  />
                  <input
                    type="text"
                    value={roleColor}
                    onInput={(e) =>
                      setRoleColor((e.target as HTMLInputElement).value)
                    }
                    className="settings-color-text"
                  />
                </div>
              </div>
              <div className="settings-dialog-actions">
                <button
                  className="settings-btn-cancel"
                  onClick={() => setRoleModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="settings-btn-confirm"
                  onClick={handleRoleSubmit}
                >
                  {editingRole ? "Save" : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {memberRolesModal && (
          <div
            className="settings-inner-modal"
            onClick={(e) => {
              if (e.target === e.currentTarget) setMemberRolesModal(null);
            }}
          >
            <div className="settings-inner-dialog">
              <h3>Manage Roles - {memberRolesModal}</h3>
              <div className="settings-roles-list">
                {serverRoles
                  .filter((r) => !["owner"].includes(r.name))
                  .map((role) => {
                    const member = usersList.find(
                      (u) => u.username === memberRolesModal,
                    );
                    const hasRole = member?.roles?.includes(role.name) || false;
                    return (
                      <label key={role.name} className="settings-role-toggle">
                        <input
                          type="checkbox"
                          checked={hasRole}
                          onChange={() =>
                            toggleMemberRole(
                              memberRolesModal,
                              role.name,
                              hasRole,
                            )
                          }
                        />
                        <span
                          className="role-color-dot"
                          style={{ background: role.color || "#5865F2" }}
                        ></span>
                        <span>{role.name}</span>
                      </label>
                    );
                  })}
              </div>
              <div className="settings-dialog-actions">
                <button
                  className="settings-btn-confirm"
                  onClick={() => setMemberRolesModal(null)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
