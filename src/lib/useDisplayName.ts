import { useEffect, useState } from "preact/hooks";
import { friendNicknames } from "../state";

export function useDisplayName(username: string): string {
  const [displayName, setDisplayName] = useState(
    friendNicknames.value[username] || username,
  );

  useEffect(() => {
    const unsubscribe = friendNicknames.subscribe((nicknames) => {
      setDisplayName(nicknames[username] || username);
    });
    return unsubscribe;
  }, [username]);

  return displayName;
}

export function getDisplayNameWithServerNick(
  username: string,
  serverNick?: string,
): string {
  const friendNick = friendNicknames.value[username];
  if (friendNick) return friendNick;
  return serverNick || username;
}
