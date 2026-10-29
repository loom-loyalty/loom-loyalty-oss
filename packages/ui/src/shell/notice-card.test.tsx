import { render, screen } from "@testing-library/react";
import { ShieldX } from "lucide-react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { NotFoundScreen } from "./not-found-screen";
import { NoticeCard } from "./notice-card";

describe("NoticeCard", () => {
  it("renders the title as an h2 with its description and no action by default", () => {
    render(<NoticeCard icon={ShieldX} title="SSO isn't enabled" description="Contact us." />);

    expect(
      screen.getByRole("heading", { level: 2, name: "SSO isn't enabled" })
    ).toBeInTheDocument();
    expect(screen.getByText("Contact us.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders an action below the copy", () => {
    render(
      <NoticeCard
        icon={ShieldX}
        title="Add-on required"
        description="Enable it."
        headingLevel="h3"
        action={<button type="button">Enable</button>}
      />
    );

    expect(screen.getByRole("heading", { level: 3, name: "Add-on required" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enable" })).toBeInTheDocument();
  });
});

describe("NoticeCard headingRef", () => {
  it("leaves the title out of the focus order without a ref", () => {
    render(<NoticeCard icon={ShieldX} title="Notice" description="Copy." />);

    expect(screen.getByRole("heading", { name: "Notice" })).not.toHaveAttribute("tabindex");
  });

  it("makes the title programmatically focusable when given a ref", () => {
    const ref = createRef<HTMLHeadingElement>();
    render(<NoticeCard icon={ShieldX} title="Notice" description="Copy." headingRef={ref} />);

    const heading = screen.getByRole("heading", { name: "Notice" });
    expect(ref.current).toBe(heading);
    expect(heading).toHaveAttribute("tabindex", "-1");
    ref.current?.focus();
    expect(heading).toHaveFocus();
  });
});

describe("NotFoundScreen", () => {
  it("renders the page heading, notice, and default home link", () => {
    render(<NotFoundScreen />);

    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "We couldn't find that page" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/");
  });
});
