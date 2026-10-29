import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useDocumentTitle } from "./use-document-title";

describe("useDocumentTitle", () => {
  const originalTitle = document.title;

  afterEach(() => {
    document.title = originalTitle;
  });

  it("should set title with page name only when no options provided", () => {
    renderHook(() => useDocumentTitle("Dashboard"));

    expect(document.title).toBe("Dashboard - Dashboard");
  });

  it("should set title with app name", () => {
    renderHook(() => useDocumentTitle("Dashboard", { appName: "Weave" }));

    expect(document.title).toBe("Dashboard - Weave");
  });

  it("should set title with org name and app name", () => {
    renderHook(() => useDocumentTitle("Settings", { orgName: "Acme Corp", appName: "Weave" }));

    expect(document.title).toBe("Settings | Acme Corp - Weave");
  });

  it("should omit org name when null", () => {
    renderHook(() => useDocumentTitle("Dashboard", { orgName: null, appName: "Weave" }));

    expect(document.title).toBe("Dashboard - Weave");
  });

  it("should update title when page name changes", () => {
    const { rerender } = renderHook(
      ({ pageName }) => useDocumentTitle(pageName, { appName: "Weave" }),
      { initialProps: { pageName: "Dashboard" } }
    );

    expect(document.title).toBe("Dashboard - Weave");

    rerender({ pageName: "Settings" });
    expect(document.title).toBe("Settings - Weave");
  });

  it("should update title when org name changes", () => {
    const { rerender } = renderHook(
      ({ orgName }) => useDocumentTitle("Dashboard", { orgName, appName: "Weave" }),
      { initialProps: { orgName: null as string | null } }
    );

    expect(document.title).toBe("Dashboard - Weave");

    rerender({ orgName: "Acme Corp" });
    expect(document.title).toBe("Dashboard | Acme Corp - Weave");
  });

  it("should restore app name on unmount", () => {
    const { unmount } = renderHook(() => useDocumentTitle("Dashboard", { appName: "Weave" }));

    expect(document.title).toBe("Dashboard - Weave");

    unmount();
    expect(document.title).toBe("Weave");
  });

  it("should restore fallback on unmount when no options", () => {
    const { unmount } = renderHook(() => useDocumentTitle("Dashboard"));

    unmount();
    expect(document.title).toBe("Dashboard");
  });
});
