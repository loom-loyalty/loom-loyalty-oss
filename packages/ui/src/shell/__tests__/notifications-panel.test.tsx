import type { NotificationFeedItem } from "@loom-loyalty/core/notifications";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NotificationsPanel } from "../notifications-panel";
import { TopHeader } from "../top-header";

const approval: NotificationFeedItem = {
  id: "msg_1",
  title: "Approval needed: publish Gold tier",
  body: "Ada Lovelace asked you to approve a change in Production.",
  createdAt: new Date().toISOString(),
  read: false,
  done: false,
  actionKind: "action",
  link: { app: "hub", path: "/organization/approvals?request=wkrq_1&step=wksa_1" },
};

const decided: NotificationFeedItem = {
  id: "msg_2",
  title: "API key created",
  createdAt: new Date().toISOString(),
  read: true,
  done: true,
  actionKind: "action",
};

describe("NotificationsPanel", () => {
  it("lists items with their state and opens one when chosen", () => {
    const onOpenItem = vi.fn();
    render(
      <NotificationsPanel
        status="ready"
        items={[approval, decided]}
        unreadCount={1}
        onOpenItem={onOpenItem}
      />
    );

    expect(screen.getByText("Action needed")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /approval needed: publish gold tier/i }));
    expect(onOpenItem).toHaveBeenCalledWith(approval);
  });

  it("marks everything read and archives one item", () => {
    const onMarkAllRead = vi.fn();
    const onArchive = vi.fn();
    render(
      <NotificationsPanel
        status="ready"
        items={[approval]}
        unreadCount={1}
        onMarkAllRead={onMarkAllRead}
        onArchive={onArchive}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    fireEvent.click(screen.getByRole("button", { name: `Archive "${approval.title}"` }));
    expect(onMarkAllRead).toHaveBeenCalled();
    expect(onArchive).toHaveBeenCalledWith("msg_1");
  });

  it("marks mark all as read unavailable, but focusable, when nothing is unread", () => {
    const onMarkAllRead = vi.fn();
    render(
      <NotificationsPanel
        status="ready"
        items={[decided]}
        unreadCount={0}
        onMarkAllRead={onMarkAllRead}
      />
    );
    const button = screen.getByRole("button", { name: "Mark all as read" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onMarkAllRead).not.toHaveBeenCalled();
  });

  it("keeps focus on mark all as read and announces it", () => {
    const { rerender } = render(
      <NotificationsPanel
        status="ready"
        items={[approval]}
        unreadCount={1}
        onMarkAllRead={vi.fn()}
      />
    );
    const button = screen.getByRole("button", { name: "Mark all as read" });
    button.focus();
    fireEvent.click(button);
    rerender(
      <NotificationsPanel
        status="ready"
        items={[{ ...approval, read: true }]}
        unreadCount={0}
        onMarkAllRead={vi.fn()}
      />
    );
    expect(button).toHaveFocus();
    expect(screen.getByText("All notifications marked as read.")).toBeInTheDocument();
  });

  it("moves focus to the next item after archiving, then to the heading", () => {
    const onArchive = vi.fn();
    const { rerender } = render(
      <NotificationsPanel
        status="ready"
        items={[approval, decided]}
        unreadCount={1}
        onOpenItem={vi.fn()}
        onArchive={onArchive}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: `Archive "${approval.title}"` }));
    rerender(
      <NotificationsPanel
        status="ready"
        items={[decided]}
        unreadCount={0}
        onOpenItem={vi.fn()}
        onArchive={onArchive}
      />
    );
    expect(screen.getByRole("button", { name: /^api key created/i })).toHaveFocus();
    expect(screen.getByText("Notification archived.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: `Archive "${decided.title}"` }));
    rerender(
      <NotificationsPanel
        status="ready"
        items={[]}
        unreadCount={0}
        onOpenItem={vi.fn()}
        onArchive={onArchive}
      />
    );
    expect(screen.getByRole("heading", { name: "Notifications" })).toHaveFocus();
  });

  it("shows skeleton rows while loading, an inline error, and an empty state", () => {
    const { rerender } = render(<NotificationsPanel status="loading" items={[]} unreadCount={0} />);
    expect(screen.getByText("Loading notifications").closest('[role="status"]')).toHaveAttribute(
      "aria-busy",
      "true"
    );

    rerender(<NotificationsPanel status="error" items={[]} unreadCount={0} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't load your notifications/i);

    rerender(<NotificationsPanel status="ready" items={[]} unreadCount={0} />);
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });
});

describe("TopHeader notifications popover", () => {
  it("opens the panel from the bell, reports the change, and closes from inside", async () => {
    const onOpenChange = vi.fn();
    render(
      <TopHeader
        notificationCount={1}
        onNotificationsOpenChange={onOpenChange}
        notificationsPanel={(close) => (
          <button type="button" onClick={close}>
            Inside panel
          </button>
        )}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /notifications, 1 unread/i }));
    const inside = await screen.findByRole("button", { name: "Inside panel" });
    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull();

    fireEvent.click(inside);
    await waitFor(() => expect(screen.queryByText("Inside panel")).toBeNull());
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
