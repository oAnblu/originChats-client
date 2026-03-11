import { signal } from "@preact/signals";
import type { Message } from "../types";

export type BannerKind = "error" | "warning" | "info";

export interface Banner {
  id: string;
  kind: BannerKind;
  message: string;
  /** If set, the banner shows a button that triggers this callback */
  action?: { label: string; fn: () => void };
  /** Auto-dismiss after this many ms. Omit for persistent banners. */
  autoDismissMs?: number;
}

/** Live queue of banners to display. Push to show, filter-out to dismiss. */
export const banners = signal<Banner[]>([]);

let _bannerIdCounter = 0;

export function showBanner(opts: Omit<Banner, "id">): string {
  const id = `banner-${++_bannerIdCounter}`;
  banners.value = [...banners.value, { ...opts, id }];
  if (opts.autoDismissMs && opts.autoDismissMs > 0) {
    setTimeout(() => dismissBanner(id), opts.autoDismissMs);
  }
  return id;
}

export function dismissBanner(id: string): void {
  banners.value = banners.value.filter((b) => b.id !== id);
}

/** Replace an existing banner (same id) or add as new if not found. */
export function upsertBanner(id: string, opts: Omit<Banner, "id">): void {
  const existing = banners.value.find((b) => b.id === id);
  if (existing) {
    banners.value = banners.value.map((b) =>
      b.id === id ? { ...opts, id } : b,
    );
  } else {
    banners.value = [...banners.value, { ...opts, id }];
  }
  if (opts.autoDismissMs && opts.autoDismissMs > 0) {
    setTimeout(() => dismissBanner(id), opts.autoDismissMs);
  }
}

export const renderGuildSidebarSignal = signal(0);
export const renderChannelsSignal = signal(0);
export const renderMessagesSignal = signal(0);
export const renderMembersSignal = signal(0);
export const renderVoiceSignal = signal(0);
export const showSettingsModal = signal(false);
export const showAccountModal = signal<string | null>(null);
export const showDiscoveryModal = signal(false);
export const showServerSettingsModal = signal(false);
export const currentDMTab = signal<
  "friends" | "requests" | "blocked" | "groups"
>("friends");

export const showVoiceCallView = signal(false);

export const rightPanelView = signal<
  "members" | "pinned" | "search" | "inbox" | null
>("members");
export const pinnedMessages = signal<Message[]>([]);
export const searchResults = signal<Message[]>([]);
export const searchLoading = signal(false);
export const pinnedLoading = signal(false);

export const userPopout = signal<{
  username: string;
  x: number;
  y: number;
  anchorRight?: boolean;
  anchorEl?: HTMLElement;
} | null>(null);

/** Mobile navigation state */
export const mobileSidebarOpen = signal(false);
export const mobilePanelOpen = signal(false);

export function closeMobileNav() {
  mobileSidebarOpen.value = false;
  mobilePanelOpen.value = false;
}
