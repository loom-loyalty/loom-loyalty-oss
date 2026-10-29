import type { ReactNode } from "react";

/** What a notification asks of its recipient: something to do, or something to know. */
export type NotificationActionKind = "action" | "info";

/** One item in the signed-in user's notification feed, independent of the provider behind it. */
export interface NotificationFeedItem {
  id: string;
  title: string;
  body?: string;
  /** ISO-8601 timestamp of when the notification was created. */
  createdAt: string;
  read: boolean;
  /** Someone acted on it (for an approval request: it was decided), so it shows as done. */
  done: boolean;
  actionKind: NotificationActionKind;
  /** Where the item opens, or absent when there is nothing to open. */
  link?: NotificationLink;
}

/** Where an item leads: a path in one of the apps. */
export interface NotificationLink {
  app: "hub" | "dashboard";
  path: string;
}

export type NotificationFeedStatus = "disabled" | "loading" | "ready" | "error";

/** The feed a provider adapter exposes to the app. */
export interface NotificationFeedAdapter {
  status: Exclude<NotificationFeedStatus, "disabled">;
  items: NotificationFeedItem[];
  unreadCount: number;
  markRead: (id: string) => void | Promise<void>;
  markAllRead: () => void | Promise<void>;
  /** Marks every item seen, for example when the panel opens. */
  markAllSeen: () => void | Promise<void>;
  archive: (id: string) => void | Promise<void>;
}

export interface NotificationFeedState extends Omit<NotificationFeedAdapter, "status"> {
  status: NotificationFeedStatus;
}

export interface NotificationFeedProviderProps {
  /** The provider's feed; omit it to turn the inbox off (the hook then reports `disabled`). */
  adapter?: NotificationFeedAdapter | null;
  children: ReactNode;
}
