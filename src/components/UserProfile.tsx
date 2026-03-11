import { useEffect, useState } from "preact/hooks";
import {
  friends,
  friendRequests,
  blockedUsers,
  currentUser,
  serverUrl,
  usersByServer,
  servers,
  DM_SERVER_URL,
  roturFollowing,
  roturStatuses,
} from "../state";
import {
  switchServer,
  openDMWith,
  sendFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
} from "../lib/actions";
import { showAccountModal } from "../lib/ui-signals";
import { Icon, ServerIcon } from "./Icon";
import type { RoturAccount, RoturProfile, Server } from "../types";
import { avatarUrl, formatJoinDate } from "../utils";
import {
  getProfile as fetchRoturProfile,
  followUser,
  unfollowUser,
} from "../lib/rotur-api";

function useProfile(username: string) {
  const [profile, setProfile] = useState<RoturProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(() =>
    roturFollowing.value.has(username.toLowerCase()),
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setProfile(null);
    setIsFollowing(roturFollowing.value.has(username.toLowerCase()));

    fetchRoturProfile(username, false, controller.signal)
      .then((profileData) => {
        setProfile(profileData);
        // Sync follow state from authoritative profile response
        if (profileData.followed !== undefined) {
          setIsFollowing(profileData.followed);
          const lower = username.toLowerCase();
          if (profileData.followed) {
            roturFollowing.value = new Set([...roturFollowing.value, lower]);
          } else {
            roturFollowing.value = new Set(
              [...roturFollowing.value].filter((u) => u !== lower),
            );
          }
        }
        // Seed roturStatuses from the profile's embedded customStatus
        if (profileData.customStatus) {
          roturStatuses.value = {
            ...roturStatuses.value,
            [username.toLowerCase()]: profileData.customStatus,
          };
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setLoading(false);
      });

    return () => controller.abort();
  }, [username]);

  const toggleFollow = async () => {
    try {
      if (isFollowing) {
        await unfollowUser(username);
        setIsFollowing(false);
        roturFollowing.value = new Set(
          [...roturFollowing.value].filter((u) => u !== username),
        );
        if (profile) {
          setProfile({
            ...profile,
            followers: Math.max(0, (profile.followers || 1) - 1),
          });
        }
      } else {
        await followUser(username);
        setIsFollowing(true);
        roturFollowing.value = new Set([...roturFollowing.value, username]);
        if (profile) {
          setProfile({
            ...profile,
            followers: (profile.followers || 0) + 1,
          });
        }
      }
    } catch (err) {
      console.error("Failed to toggle follow:", err);
    }
  };

  return { profile, loading, isFollowing, toggleFollow };
}

export function getUserStatus(username: string): string {
  const sUrl = serverUrl.value;
  const usersMap = usersByServer.value[sUrl] || {};
  const lower = username.toLowerCase();
  for (const [key, u] of Object.entries(usersMap)) {
    if (key.toLowerCase() === lower) {
      return u.status || "offline";
    }
  }
  return "offline";
}

export function getUserRoles(username: string): string[] {
  const sUrl = serverUrl.value;
  if (sUrl === DM_SERVER_URL) return [];
  const usersMap = usersByServer.value[sUrl] || {};
  const lower = username.toLowerCase();
  for (const [key, u] of Object.entries(usersMap)) {
    if (key.toLowerCase() === lower) {
      return u.roles || [];
    }
  }
  return [];
}

function getFriendState(
  username: string,
): "self" | "friend" | "pending" | "blocked" | "none" {
  if (username === currentUser.value?.username) return "self";
  if (friends.value.includes(username)) return "friend";
  if (friendRequests.value.includes(username)) return "pending";
  if (blockedUsers.value.includes(username)) return "blocked";
  return "none";
}

function friendStateLabel(state: ReturnType<typeof getFriendState>): string {
  switch (state) {
    case "self":
      return "You";
    case "friend":
      return "Friends";
    case "pending":
      return "Pending Request";
    case "blocked":
      return "Blocked";
    default:
      return "";
  }
}

function getMutualServers(username: string): Server[] {
  const myUsername = currentUser.value?.username;
  if (!myUsername) return [];

  const mutuals: Server[] = [];
  const lower = username.toLowerCase();

  for (const server of servers.value) {
    const sUrl = server.url;
    const usersMap = usersByServer.value[sUrl];
    if (!usersMap) continue;
    if (usersMap[lower]) {
      mutuals.push(server);
    }
  }
  return mutuals;
}

function ProfileActions({
  username,
  onAction,
  compact,
}: {
  username: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  const friendState = getFriendState(username);
  if (friendState === "self") return null;

  const handleMessage = () => {
    openDMWith(username);
    onAction?.();
  };

  const handleFriend = () => {
    if (friendState === "friend") {
      removeFriend(username);
    } else if (friendState === "none") {
      sendFriendRequest(username);
    }
    onAction?.();
  };

  const handleBlock = () => {
    if (friendState === "blocked") {
      unblockUser(username);
    } else {
      blockUser(username);
    }
    onAction?.();
  };

  const handleViewProfile = () => {
    showAccountModal.value = username;
  };

  if (compact) {
    return (
      <div className="profile-actions compact">
        <button
          className="profile-action-btn"
          onClick={handleMessage}
          title="Message"
        >
          <Icon name="MessageCircle" size={16} />
        </button>
        {friendState === "friend" ? (
          <button
            className="profile-action-btn danger"
            onClick={handleFriend}
            title="Remove Friend"
          >
            <Icon name="UserX" size={16} />
          </button>
        ) : friendState === "none" ? (
          <button
            className="profile-action-btn"
            onClick={handleFriend}
            title="Add Friend"
          >
            <Icon name="UserPlus" size={16} />
          </button>
        ) : null}
        {friendState === "blocked" ? (
          <button
            className="profile-action-btn"
            onClick={handleBlock}
            title="Unblock"
          >
            <Icon name="ShieldOff" size={16} />
          </button>
        ) : (
          <button
            className="profile-action-btn danger"
            onClick={handleBlock}
            title="Block"
          >
            <Icon name="ShieldOff" size={16} />
          </button>
        )}
        <button
          className="profile-action-btn"
          onClick={handleViewProfile}
          title="View Full Profile"
        >
          <Icon name="ExternalLink" size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="profile-actions">
      <button className="profile-action-btn-wide" onClick={handleMessage}>
        <Icon name="MessageCircle" size={16} />
        <span>Message</span>
      </button>
      {friendState === "friend" ? (
        <button
          className="profile-action-btn-wide danger"
          onClick={handleFriend}
        >
          <Icon name="UserX" size={16} />
          <span>Remove Friend</span>
        </button>
      ) : friendState === "none" ? (
        <button className="profile-action-btn-wide" onClick={handleFriend}>
          <Icon name="UserPlus" size={16} />
          <span>Add Friend</span>
        </button>
      ) : null}
      {friendState === "blocked" ? (
        <button className="profile-action-btn-wide" onClick={handleBlock}>
          <Icon name="ShieldOff" size={16} />
          <span>Unblock</span>
        </button>
      ) : (
        <button
          className="profile-action-btn-wide danger"
          onClick={handleBlock}
        >
          <Icon name="ShieldOff" size={16} />
          <span>Block</span>
        </button>
      )}
    </div>
  );
}

export function UserProfileCard({
  username,
  onClose,
  compact,
  compactActions,
}: {
  username: string;
  onClose?: () => void;
  compact?: boolean;
  compactActions?: boolean;
}) {
  const { profile, loading, isFollowing, toggleFollow } = useProfile(username);
  const statusClass = getUserStatus(username);
  const userRoles = getUserRoles(username);
  const friendState = getFriendState(username);
  const stateLabel = friendStateLabel(friendState);
  const mutualServers = getMutualServers(username);
  const customStatus = roturStatuses.value[username.toLowerCase()] || null;

  const joinedDate = profile?.created ? formatJoinDate(profile.created) : null;

  // --- Compact (popout) layout ---
  if (compact) {
    if (loading) {
      return (
        <div className="profile-card">
          <div className="profile-card-loading">
            <div className="account-loading-spinner" />
          </div>
        </div>
      );
    }

    if (!profile) {
      return (
        <div className="profile-card">
          <div className="profile-card-error">Could not load profile</div>
        </div>
      );
    }

    return (
      <div className="profile-card">
        <div className="profile-card-banner">
          {profile.banner && <img src={profile.banner} alt="" />}
        </div>
        <div className="profile-card-avatar-row">
          <div className="profile-card-avatar">
            <img
              src={profile.pfp || avatarUrl(profile.username)}
              alt={profile.username}
            />
            <div className={`profile-card-status ${statusClass}`} />
          </div>
          {profile.system && (
            <div className="profile-card-system-pill">
              <Icon name="Monitor" size={11} />
              <span>{profile.system}</span>
            </div>
          )}
        </div>
        <div className="profile-card-body">
          <div
            className="profile-card-username clickable"
            onClick={() => (showAccountModal.value = username)}
          >
            {profile.username}
          </div>
          {profile.pronouns && (
            <div className="profile-card-pronouns">{profile.pronouns}</div>
          )}
          {customStatus?.content && (
            <div className="profile-card-custom-status">
              <span className="profile-card-custom-status-text">
                {customStatus.content}
              </span>
            </div>
          )}
          {stateLabel && (
            <div className={`profile-card-friend-state ${friendState}`}>
              {stateLabel}
            </div>
          )}
          {profile.bio && (
            <div className="profile-card-section">
              <div className="profile-card-section-title">About Me</div>
              <div className="profile-card-bio">{profile.bio}</div>
            </div>
          )}
          {userRoles.length > 0 && (
            <div className="profile-card-section">
              <div className="profile-card-section-title">Roles</div>
              <div className="profile-card-roles">
                {userRoles.map((role) => (
                  <span key={role} className="profile-card-role">
                    {role}
                  </span>
                ))}
              </div>
            </div>
          )}
          {joinedDate && (
            <div className="profile-card-section">
              <div className="profile-card-meta">
                <Icon name="Calendar" size={14} />
                <span>{joinedDate}</span>
              </div>
            </div>
          )}
        </div>
        <ProfileActions username={username} compact onAction={onClose} />
      </div>
    );
  }

  // --- Full (panel) layout ---
  if (loading) {
    return (
      <div className="profile-panel">
        <div className="profile-card-loading">
          <div className="account-loading-spinner" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-panel">
        <div className="profile-card-error">Could not load profile</div>
      </div>
    );
  }

  return (
    <div className="profile-panel">
      <div className="profile-panel-content">
        <div className="profile-panel-banner">
          {profile.banner && <img src={profile.banner} alt="" />}
        </div>
        <div className="profile-panel-avatar-row">
          <div className="profile-panel-avatar">
            <img
              src={profile.pfp || avatarUrl(profile.username)}
              alt={profile.username}
            />
            <div className={`profile-card-status ${statusClass}`} />
          </div>
        </div>
        <div className="profile-panel-info">
          <div
            className="profile-panel-username clickable"
            onClick={() => (showAccountModal.value = username)}
          >
            {profile.username}
          </div>
          {profile.pronouns && (
            <div className="profile-panel-pronouns">{profile.pronouns}</div>
          )}
          {customStatus?.content && (
            <div className="profile-card-custom-status">
              <span className="profile-card-custom-status-text">
                {customStatus.content}
              </span>
            </div>
          )}
          {stateLabel && (
            <div className={`profile-card-friend-state ${friendState}`}>
              {stateLabel}
            </div>
          )}
        </div>

        <div className="profile-panel-stats">
          <div className="profile-panel-stat">
            <div className="profile-panel-stat-value">
              {profile.followers || 0}
            </div>
            <div className="profile-panel-stat-label">Followers</div>
          </div>
          <div className="profile-panel-stat">
            <div className="profile-panel-stat-value">
              {profile.following || 0}
            </div>
            <div className="profile-panel-stat-label">Following</div>
          </div>
          <div className="profile-panel-stat">
            <div className="profile-panel-stat-value">
              {profile.currency?.toLocaleString() || 0}
            </div>
            <div className="profile-panel-stat-label">Credits</div>
          </div>
          <div className="profile-panel-stat">
            <div className="profile-panel-stat-value">
              {profile.subscription || "Free"}
            </div>
            <div className="profile-panel-stat-label">Tier</div>
          </div>
        </div>

        {/* Follow button — only show for other users */}
        {friendState !== "self" && (
          <button
            className={`profile-follow-btn${isFollowing ? " following" : ""}`}
            onClick={toggleFollow}
            title={isFollowing ? "Unfollow" : "Follow on Rotur"}
          >
            <Icon name={isFollowing ? "UserCheck" : "UserPlus"} size={14} />
            <span>{isFollowing ? "Following" : "Follow"}</span>
            {profile.follows_me && (
              <span className="profile-follows-me-pill">Follows you</span>
            )}
          </button>
        )}

        {profile.bio && (
          <div className="profile-panel-section">
            <div className="profile-panel-section-title">About Me</div>
            <div className="profile-panel-bio">{profile.bio}</div>
          </div>
        )}

        {profile.groups && profile.groups.length > 0 && (
          <div className="profile-panel-section">
            <div className="profile-panel-section-title">Groups</div>
            <div className="profile-groups">
              {profile.groups.map((tag) => (
                <span key={tag} className="profile-group-tag">
                  @{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {profile.system && (
          <div className="profile-panel-section">
            <div className="profile-panel-section-title">System</div>
            <div className="profile-card-meta">
              <Icon name="Monitor" size={14} />
              <span>{profile.system}</span>
            </div>
          </div>
        )}

        {userRoles.length > 0 && (
          <div className="profile-panel-section">
            <div className="profile-panel-section-title">Roles</div>
            <div className="profile-card-roles">
              {userRoles.map((role) => (
                <span key={role} className="profile-card-role">
                  {role}
                </span>
              ))}
            </div>
          </div>
        )}

        {mutualServers.length > 0 && (
          <div className="profile-panel-section">
            <div className="profile-panel-section-title">
              Mutual Servers — {mutualServers.length}
            </div>
            <div className="profile-mutual-servers">
              {mutualServers.map((server) => (
                <div
                  key={server.url}
                  className="profile-mutual-server clickable"
                  onClick={() => switchServer(server.url)}
                  title={server.name}
                >
                  <div className="profile-mutual-server-icon">
                    <ServerIcon server={server} />
                  </div>
                  <span className="profile-mutual-server-name">
                    {server.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {joinedDate && (
          <div className="profile-panel-section">
            <div className="profile-panel-section-title">Member Since</div>
            <div className="profile-card-meta">
              <Icon name="Calendar" size={14} />
              <span>{joinedDate}</span>
            </div>
          </div>
        )}

        <ProfileActions username={username} compact={compactActions} />
      </div>
    </div>
  );
}
