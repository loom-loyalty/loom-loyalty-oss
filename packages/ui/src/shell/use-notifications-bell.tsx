import {
  useNotificationFeed,
  type NotificationFeedItem,
  type NotificationLink,
} from "@loom-loyalty/core/notifications";
import * as React from "react";

import { NotificationsPanel } from "./notifications-panel";
import type { TopHeaderProps } from "./top-header";

export type NotificationsBellProps = Pick<
  TopHeaderProps,
  "showNotifications" | "notificationCount" | "notificationsPanel" | "onNotificationsOpenChange"
>;

/**
 * TopHeader props for the bell, from the feed in `NotificationFeedProvider`.
 * With no feed (the inbox is off) the bell is hidden. Opening the panel marks
 * everything seen; choosing an item marks it read, closes the panel and hands
 * its link to `onOpenLink`, which routes it within or across apps.
 */
export function useNotificationsBell(
  onOpenLink: (link: NotificationLink) => void
): NotificationsBellProps {
  const feed = useNotificationFeed();
  const { status, items, unreadCount, markRead, markAllRead, markAllSeen, archive } = feed;

  return React.useMemo(() => {
    if (status === "disabled") return { showNotifications: false };
    const open = (item: NotificationFeedItem, close: () => void) => {
      void markRead(item.id);
      close();
      if (item.link) onOpenLink(item.link);
    };
    return {
      showNotifications: true,
      notificationCount: unreadCount,
      onNotificationsOpenChange: (isOpen: boolean) => {
        if (isOpen) void markAllSeen();
      },
      notificationsPanel: (close: () => void) => (
        <NotificationsPanel
          status={status}
          items={items}
          unreadCount={unreadCount}
          onOpenItem={(item) => open(item, close)}
          onMarkAllRead={() => void markAllRead()}
          onArchive={(id) => void archive(id)}
        />
      ),
    };
  }, [status, items, unreadCount, markRead, markAllRead, markAllSeen, archive, onOpenLink]);
}
