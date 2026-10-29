import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelpCircle, Home, Settings } from "lucide-react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import type { LinkComponentProps } from "../sidebar";
import { Sidebar } from "../sidebar";
import type { PrimaryNavSection, QuickAction, SecondaryNavGetter } from "../types";

const sections: PrimaryNavSection[] = [{ id: "home", icon: Home, label: "Home", href: "/" }];
const getSecondaryNav: SecondaryNavGetter = () => [];

describe("[WV010] Sidebar logo links to dashboard", () => {
  it("wraps the logo in an anchor pointing to '/' with an accessible label (default LinkComponent)", () => {
    render(<Sidebar sections={sections} getSecondaryNav={getSecondaryNav} pathname="/programs" />);

    const logoLink = screen.getByRole("link", { name: "Return to dashboard" });
    expect(logoLink).toHaveAttribute("href", "/");
    // Logo (SVG) is rendered inside the link
    expect(logoLink.querySelector("svg")).not.toBeNull();
  });

  it("shows a white-label brand's mark in place of the Loom Loyalty icon", () => {
    render(
      <Sidebar
        sections={sections}
        getSecondaryNav={getSecondaryNav}
        pathname="/programs"
        logo={<img src="https://cdn.acme.example/mark.png" alt="" data-testid="brand-mark" />}
      />
    );

    const logoLink = screen.getByRole("link", { name: "Return to dashboard" });
    expect(logoLink.querySelector("[data-testid='brand-mark']")).not.toBeNull();
    expect(logoLink.querySelector("svg")).toBeNull();
  });

  it("uses the injected LinkComponent for the logo link", () => {
    const StubLink = vi.fn((props: LinkComponentProps) => (
      <a
        data-stub="true"
        href={props.href}
        aria-label={(props as { "aria-label"?: string })["aria-label"]}
        className={props.className}
      >
        {props.children}
      </a>
    ));

    render(
      <Sidebar
        sections={sections}
        getSecondaryNav={getSecondaryNav}
        pathname="/programs"
        LinkComponent={StubLink as unknown as React.ComponentType<LinkComponentProps>}
      />
    );

    const logoLink = screen.getByRole("link", { name: "Return to dashboard" });
    expect(logoLink).toHaveAttribute("href", "/");
    expect(logoLink).toHaveAttribute("data-stub", "true");
    expect(StubLink).toHaveBeenCalled();
  });
});

describe("[WV017] Sidebar quick-action buttons have hover/focus tooltips", () => {
  it("shows a tooltip matching aria-label when an onClick quick-action receives focus", async () => {
    const quickActions: QuickAction[] = [
      { icon: HelpCircle, label: "Open help", onClick: vi.fn() },
    ];
    render(
      <Sidebar
        sections={sections}
        getSecondaryNav={getSecondaryNav}
        pathname="/"
        quickActions={quickActions}
      />
    );
    const trigger = screen.getByRole("button", { name: "Open help" });
    fireEvent.focus(trigger);
    await waitFor(() => {
      const tooltip = document.querySelector('[data-slot="tooltip-content"]');
      expect(tooltip).not.toBeNull();
      expect(tooltip?.textContent).toMatch(/open help/i);
    });
  });

  it("shows a tooltip matching aria-label when an href quick-action link receives focus", async () => {
    const quickActions: QuickAction[] = [
      { icon: Settings, label: "Open settings", href: "/settings" },
    ];
    render(
      <Sidebar
        sections={sections}
        getSecondaryNav={getSecondaryNav}
        pathname="/"
        quickActions={quickActions}
      />
    );
    const trigger = screen.getByRole("link", { name: "Open settings" });
    fireEvent.focus(trigger);
    await waitFor(() => {
      const tooltip = document.querySelector('[data-slot="tooltip-content"]');
      expect(tooltip).not.toBeNull();
      expect(tooltip?.textContent).toMatch(/open settings/i);
    });
  });

  it("renders an external quick-action as a native anchor with a new-tab affordance", () => {
    const quickActions: QuickAction[] = [
      { icon: HelpCircle, label: "Docs", href: "https://docs.example.com", external: true },
    ];
    render(
      <Sidebar
        sections={sections}
        getSecondaryNav={getSecondaryNav}
        pathname="/"
        quickActions={quickActions}
      />
    );
    const link = screen.getByRole("link", { name: /docs \(opens in new tab\)/i });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "https://docs.example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("Sidebar footer slot", () => {
  const orgInfo = { planName: "Acme", usageLabel: "ACME", usagePercent: 40 };

  it("shows the org info card when no footer is given", () => {
    render(
      <Sidebar
        sections={sections}
        getSecondaryNav={getSecondaryNav}
        pathname="/"
        orgInfo={orgInfo}
      />
    );
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Plan usage" })).toHaveAttribute(
      "aria-valuenow",
      "40"
    );
  });

  it("renders the footer in place of the org info card", () => {
    render(
      <Sidebar
        sections={sections}
        getSecondaryNav={getSecondaryNav}
        pathname="/"
        orgInfo={orgInfo}
        footer={<button type="button">Setup status</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Setup status" })).toBeInTheDocument();
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
  });

  it("leaves the foot empty when the footer renders nothing", () => {
    function NoStatus() {
      return null;
    }
    const { container } = render(
      <Sidebar
        sections={sections}
        getSecondaryNav={getSecondaryNav}
        pathname="/"
        orgInfo={orgInfo}
        footer={<NoStatus />}
      />
    );
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: "Plan usage" })).not.toBeInTheDocument();
    // No empty bordered strip is left behind.
    expect(container.querySelectorAll("aside > div.border-t")).toHaveLength(0);
  });
});

describe("Sidebar active section", () => {
  const navSections: PrimaryNavSection[] = [
    { id: "home", icon: Home, label: "Home", href: "/" },
    { id: "program", icon: Home, label: "Program", href: "/programs" },
    { id: "engage", icon: Home, label: "Engage", href: "/programs/event-rules" },
    { id: "data", icon: Home, label: "Data", href: "/organization/data-models" },
  ];
  const navGetter: SecondaryNavGetter = (sectionId) => {
    const items: Record<string, { label: string; href: string }[]> = {
      // Home's shortcuts point into other sections and must not claim their pages.
      home: [
        { label: "Offers shortcut", href: "/programs/offers" },
        { label: "Ledgers shortcut", href: "/programs/ledgers" },
      ],
      program: [{ label: "Currencies", href: "/programs/currencies" }],
      engage: [
        { label: "Event Rules", href: "/programs/event-rules" },
        { label: "Offers", href: "/programs/offers" },
      ],
      data: [{ label: "Event Types", href: "/programs/event-types" }],
    };
    return [{ items: items[sectionId] ?? [] }];
  };

  function activeLabel(pathname: string) {
    render(<Sidebar sections={navSections} getSecondaryNav={navGetter} pathname={pathname} />);
    return screen.getByRole("complementary", { name: "Secondary navigation" }).querySelector("span")
      ?.textContent;
  }

  it.each([
    ["/", "Home"],
    ["/programs", "Program"],
    ["/programs/currencies", "Program"],
    ["/programs/ledgers", "Program"],
    ["/programs/offers", "Engage"],
    ["/programs/offers/abc", "Engage"],
    ["/programs/event-rules/abc", "Engage"],
    ["/programs/event-types", "Data"],
    ["/organization/data-models/abc", "Data"],
  ])("marks %s as part of %s", (pathname, label) => {
    expect(activeLabel(pathname)).toBe(label);
  });

  function activeLabelWith(getter: SecondaryNavGetter, pathname: string) {
    render(<Sidebar sections={navSections} getSecondaryNav={getter} pathname={pathname} />);
    return screen.getByRole("complementary", { name: "Secondary navigation" }).querySelector("span")
      ?.textContent;
  }

  it("lets a root shortcut claim a page no other section owns", () => {
    const getter: SecondaryNavGetter = (sectionId) =>
      sectionId === "home" ? [{ items: [{ label: "Audit", href: "/audit-log" }] }] : [];
    expect(activeLabelWith(getter, "/audit-log")).toBe("Home");
  });

  it("prefers a section's own href over another section's equally specific item", () => {
    const getter: SecondaryNavGetter = (sectionId) =>
      sectionId === "program"
        ? [{ items: [{ label: "Rules elsewhere", href: "/programs/event-rules" }] }]
        : [];
    expect(activeLabelWith(getter, "/programs/event-rules/abc")).toBe("Engage");
  });

  it("gives an equally specific item to the earlier section", () => {
    const getter: SecondaryNavGetter = (sectionId) =>
      sectionId === "program" || sectionId === "data"
        ? [{ items: [{ label: "Shared", href: "/shared" }] }]
        : [];
    expect(activeLabelWith(getter, "/shared")).toBe("Program");
  });

  it("ignores external items", () => {
    const getter: SecondaryNavGetter = (sectionId) =>
      sectionId === "data"
        ? [{ items: [{ label: "Offers", href: "/programs/offers", external: true }] }]
        : [];
    expect(activeLabelWith(getter, "/programs/offers")).toBe("Program");
  });

  it("does not treat a shared string prefix as a path prefix", () => {
    expect(activeLabelWith(() => [], "/programs-archive")).toBe("Home");
  });

  it("falls back to the first section when nothing matches", () => {
    expect(activeLabelWith(() => [], "/unknown/page")).toBe("Home");
  });
});
