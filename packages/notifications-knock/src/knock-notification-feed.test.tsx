import { useNotificationFeed } from "@loom-loyalty/core/notifications";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useFeedSettings, adapterHook } = vi.hoisted(() => ({
  useFeedSettings: vi.fn(),
  adapterHook: vi.fn(),
}));

vi.mock("@loom-loyalty/sdk", () => ({
  useAuthManagementGetMyNotificationFeed: useFeedSettings,
  authManagementGetMyNotificationFeed: vi.fn(),
}));
vi.mock("./use-knock-notification-feed", () => ({ useKnockNotificationFeed: adapterHook }));

import { KnockNotificationFeed } from "./knock-notification-feed";

function Status() {
  return <span>{useNotificationFeed().status}</span>;
}

describe("KnockNotificationFeed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports disabled when the API says the inbox is off", () => {
    useFeedSettings.mockReturnValue({ data: { status: 200, data: { enabled: false } } });
    adapterHook.mockReturnValue(null);
    render(
      <KnockNotificationFeed organizationEnvironmentId="env_1">
        <Status />
      </KnockNotificationFeed>
    );
    expect(screen.getByText("disabled")).toBeTruthy();
    expect(adapterHook).toHaveBeenCalledWith({ enabled: false }, expect.anything());
  });

  it("keys the settings request by environment and waits for one", () => {
    useFeedSettings.mockReturnValue({ data: undefined });
    adapterHook.mockReturnValue(null);
    const { rerender } = render(
      <KnockNotificationFeed organizationEnvironmentId={null}>
        <Status />
      </KnockNotificationFeed>
    );
    expect(useFeedSettings).toHaveBeenLastCalledWith({
      query: expect.objectContaining({ enabled: false }),
    });

    rerender(
      <KnockNotificationFeed organizationEnvironmentId="env_2">
        <Status />
      </KnockNotificationFeed>
    );
    expect(useFeedSettings).toHaveBeenLastCalledWith({
      query: expect.objectContaining({
        enabled: true,
        queryKey: ["/auth/me/notification-feed", "env_2"],
      }),
    });
  });

  it("provides the Knock adapter when the inbox is on", () => {
    useFeedSettings.mockReturnValue({ data: { status: 200, data: { enabled: true } } });
    adapterHook.mockReturnValue({
      status: "ready",
      items: [],
      unreadCount: 0,
      markRead: vi.fn(),
      markAllRead: vi.fn(),
      markAllSeen: vi.fn(),
      archive: vi.fn(),
    });
    render(
      <KnockNotificationFeed organizationEnvironmentId="env_1">
        <Status />
      </KnockNotificationFeed>
    );
    expect(screen.getByText("ready")).toBeTruthy();
  });
});
