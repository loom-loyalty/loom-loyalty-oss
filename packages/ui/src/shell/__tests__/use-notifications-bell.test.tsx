import {
  NotificationFeedProvider,
  type NotificationFeedAdapter,
} from "@loom-loyalty/core/notifications";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TopHeader } from "../top-header";
import { useNotificationsBell } from "../use-notifications-bell";

function Header({ onOpenLink }: { onOpenLink: (link: unknown) => void }): ReactNode {
  const bell = useNotificationsBell(onOpenLink);
  return <TopHeader {...bell} />;
}

function adapter(overrides: Partial<NotificationFeedAdapter> = {}): NotificationFeedAdapter {
  return {
    status: "ready",
    unreadCount: 1,
    items: [
      {
        id: "msg_1",
        title: "Approval needed: Gold tier",
        createdAt: new Date().toISOString(),
        read: false,
        done: false,
        actionKind: "action",
        link: { app: "hub", path: "/organization/approvals?request=wkrq_1" },
      },
    ],
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    markAllSeen: vi.fn(),
    archive: vi.fn(),
    ...overrides,
  };
}

describe("useNotificationsBell", () => {
  it("hides the bell when the inbox is off", () => {
    render(
      <NotificationFeedProvider>
        <Header onOpenLink={vi.fn()} />
      </NotificationFeedProvider>
    );
    expect(screen.queryByRole("button", { name: /notifications/i })).toBeNull();
  });

  it("marks items seen on open, then reads and follows the chosen item", async () => {
    const feed = adapter();
    const onOpenLink = vi.fn();
    render(
      <NotificationFeedProvider adapter={feed}>
        <Header onOpenLink={onOpenLink} />
      </NotificationFeedProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /notifications, 1 unread/i }));
    expect(feed.markAllSeen).toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: /^approval needed: gold tier/i }));
    expect(feed.markRead).toHaveBeenCalledWith("msg_1");
    expect(onOpenLink).toHaveBeenCalledWith({
      app: "hub",
      path: "/organization/approvals?request=wkrq_1",
    });
    await waitFor(() => expect(screen.queryByText(/approval needed/i)).toBeNull());
  });
});
