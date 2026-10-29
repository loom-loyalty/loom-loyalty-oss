import Knock, { type Feed, type FeedStoreState, NetworkStatus } from "@knocklabs/client";
import type { NotificationFeedAdapter } from "@loom-loyalty/core/notifications";
import { useEffect, useMemo, useRef, useState } from "react";

import { mapFeedItem } from "./map-feed-item";
import type { KnockFeedSettings, UseKnockNotificationFeedOptions } from "./types";

/**
 * Connects to the signed-in user's Knock in-app feed and exposes it as a
 * provider-neutral adapter for `NotificationFeedProvider`. Returns `null`
 * while the settings are missing or the inbox is off, so the bell shows the
 * disabled state. The feed is scoped to the settings' tenant (the
 * organization), and it reconnects when the user, tenant, or channel changes.
 */
export function useKnockNotificationFeed(
  settings: KnockFeedSettings | null | undefined,
  options: UseKnockNotificationFeedOptions = {}
): NotificationFeedAdapter | null {
  const { publicApiKey, feedChannelId, recipientId, tenantId, userToken } = settings ?? {};
  const active = Boolean(
    settings?.enabled &&
    settings.provider === "knock" &&
    publicApiKey &&
    feedChannelId &&
    recipientId &&
    tenantId &&
    userToken
  );
  const pageSize = options.pageSize ?? 50;

  const tokenRef = useRef(userToken);
  tokenRef.current = userToken;
  const refreshRef = useRef(options.refreshUserToken);
  refreshRef.current = options.refreshUserToken;

  const [feed, setFeed] = useState<Feed | null>(null);
  const [state, setState] = useState<FeedStoreState | null>(null);

  useEffect(() => {
    if (!active || !publicApiKey || !feedChannelId || !recipientId || !tenantId) {
      return undefined;
    }
    const knock = new Knock(publicApiKey);
    knock.authenticate(recipientId, tokenRef.current ?? undefined, {
      onUserTokenExpiring: async () => (await refreshRef.current?.()) ?? undefined,
    });
    const instance = knock.feeds.initialize(feedChannelId, {
      tenant: tenantId,
      archived: "exclude",
      page_size: pageSize,
    });
    const unsubscribe = instance.store.subscribe(setState);
    setState(instance.store.getState());
    setFeed(instance);
    instance.listenForUpdates();
    void instance.fetch();

    return () => {
      unsubscribe();
      instance.dispose();
      knock.teardown();
      setFeed(null);
      setState(null);
    };
  }, [active, publicApiKey, feedChannelId, recipientId, tenantId, pageSize]);

  return useMemo(() => {
    if (!active || !feed || !state) return null;
    const byId = (id: string) => state.items.find((item) => item.id === id);
    const status: NotificationFeedAdapter["status"] =
      state.networkStatus === NetworkStatus.error
        ? "error"
        : state.loading && state.items.length === 0
          ? "loading"
          : "ready";
    return {
      status,
      items: state.items.map(mapFeedItem),
      unreadCount: state.metadata.unread_count,
      markRead: async (id) => {
        const item = byId(id);
        if (item && item.read_at === null) await feed.markAsRead(item);
      },
      markAllRead: async () => {
        await feed.markAllAsRead();
      },
      markAllSeen: async () => {
        if (state.metadata.unseen_count > 0) await feed.markAllAsSeen();
      },
      archive: async (id) => {
        const item = byId(id);
        if (item) await feed.markAsArchived(item);
      },
    };
  }, [active, feed, state]);
}
