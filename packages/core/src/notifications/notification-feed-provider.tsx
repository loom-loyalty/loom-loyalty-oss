import { createContext, useContext } from "react";
import type { NotificationFeedProviderProps, NotificationFeedState } from "./types";

const noop = () => undefined;

/** The feed reported when no provider adapter is mounted: no items, and actions that do nothing. */
export const DISABLED_NOTIFICATION_FEED: NotificationFeedState = Object.freeze({
  status: "disabled",
  items: [],
  unreadCount: 0,
  markRead: noop,
  markAllRead: noop,
  markAllSeen: noop,
  archive: noop,
});

const NotificationFeedContext = createContext<NotificationFeedState>(DISABLED_NOTIFICATION_FEED);

/**
 * Supplies a notification feed to everything below it. The feed comes from a provider adapter
 * (for example `@loom-loyalty/notifications-knock`); without one, `useNotificationFeed` reports
 * `disabled` and apps hide the bell, so core never depends on a notification vendor.
 */
export function NotificationFeedProvider({ adapter, children }: NotificationFeedProviderProps) {
  return (
    <NotificationFeedContext.Provider value={adapter ?? DISABLED_NOTIFICATION_FEED}>
      {children}
    </NotificationFeedContext.Provider>
  );
}

/** The signed-in user's notification feed, or the disabled feed when none is configured. */
export function useNotificationFeed(): NotificationFeedState {
  return useContext(NotificationFeedContext);
}
