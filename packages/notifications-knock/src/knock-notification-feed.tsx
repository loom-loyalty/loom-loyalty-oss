import { NotificationFeedProvider } from "@loom-loyalty/core/notifications";
import {
  authManagementGetMyNotificationFeed,
  useAuthManagementGetMyNotificationFeed,
} from "@loom-loyalty/sdk";
import { useCallback, type ReactNode } from "react";

import type { KnockFeedSettings } from "./types";
import { useKnockNotificationFeed } from "./use-knock-notification-feed";

export interface KnockNotificationFeedProps {
  /**
   * The signed-in organization environment. The inbox flag is evaluated per
   * environment, so a change re-fetches the settings and reconnects.
   */
  organizationEnvironmentId: string | null | undefined;
  /** False until the app holds a token for the Platform API. */
  enabled?: boolean;
  children: ReactNode;
}

/**
 * Provides the signed-in user's Knock in-app feed to `useNotificationFeed()`.
 * When the Platform API says the inbox is off, children render with no feed
 * (the hook reports `disabled`) and no Knock client is created.
 */
export function KnockNotificationFeed({
  organizationEnvironmentId,
  enabled = true,
  children,
}: KnockNotificationFeedProps) {
  const { data: response } = useAuthManagementGetMyNotificationFeed({
    query: {
      queryKey: ["/auth/me/notification-feed", organizationEnvironmentId],
      enabled: enabled && Boolean(organizationEnvironmentId),
      // The user token lasts an hour; refetch before a remount could reuse an expired one.
      staleTime: 45 * 60 * 1000,
      retry: false,
    },
  });
  const settings: KnockFeedSettings | null = response?.status === 200 ? response.data : null;

  const refreshUserToken = useCallback(async () => {
    const fresh = await authManagementGetMyNotificationFeed();
    return fresh.status === 200 ? (fresh.data.userToken ?? undefined) : undefined;
  }, []);

  const adapter = useKnockNotificationFeed(settings, { refreshUserToken });
  return <NotificationFeedProvider adapter={adapter}>{children}</NotificationFeedProvider>;
}
