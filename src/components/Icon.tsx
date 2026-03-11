import * as lucide from "lucide-react";
import { useState } from "preact/hooks";
import { serverIconBust } from "../utils";

export function Icon({
  name,
  size = 20,
  color,
  fill,
}: {
  name: string;
  size?: number;
  color?: string;
  fill?: string | boolean;
}) {
  const IconComponent = (lucide as any)[name];
  if (!IconComponent) return null;
  return (
    <IconComponent
      size={size}
      color={color}
      fill={
        fill === true || fill === "currentColor" ? "currentColor" : undefined
      }
    />
  );
}

export function ServerIcon({
  server,
  className,
}: {
  server: { name: string; url?: string; icon?: string | null };
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const bust = server.url ? (serverIconBust.value[server.url] ?? 0) : 0;
  const key = `${bust}-${failed ? "f" : "ok"}`;

  const initials = server.name.substring(0, 2).toUpperCase();

  if (!server.icon || failed) {
    return (
      <span
        className={className}
        onClick={() => {
          if (failed) {
            setFailed(false);
          }
        }}
      >
        {initials}
      </span>
    );
  }

  const bustSuffix = bust ? `?v=${bust}` : "";
  return (
    <img
      key={key}
      src={`${server.icon}${bustSuffix}`}
      alt={server.name}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
