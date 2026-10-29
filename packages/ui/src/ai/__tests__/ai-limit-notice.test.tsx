import "@testing-library/jest-dom/vitest";

import { formatUpcomingTime } from "@loom-loyalty/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AiLimitProvider } from "../ai-limit-context";
import { AiLimitNotice } from "../ai-limit-notice";

const resetsAt = new Date("2026-10-15T00:00:00.000Z");

describe("AiLimitNotice", () => {
  it("shows the title and the local reset time", () => {
    render(<AiLimitNotice limit={{ resetsAt, upgrade: false }} />);
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByText("Daily AI limit reached")).toBeVisible();
    expect(
      screen.getByText(`AI features are paused until ${formatUpcomingTime(resetsAt)}.`)
    ).toBeVisible();
  });

  it("hides the upgrade copy and link when upgrade is false", () => {
    render(<AiLimitNotice limit={{ resetsAt, upgrade: false }} upgradeHref="/plans" />);
    expect(screen.queryByText(/trial includes/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the upgrade copy and a See plans link when upgrade is true", () => {
    render(
      <AiLimitNotice limit={{ resetsAt, upgrade: true }} upgradeHref="/organization/features" />
    );
    expect(
      screen.getByText(
        "Your trial includes a small daily AI allowance. Upgrade your plan for more."
      )
    ).toBeVisible();
    const link = screen.getByRole("link", { name: "See plans" });
    expect(link).toHaveAttribute("href", "/organization/features");
    expect(link.className).toContain("min-h-11");
  });

  it("reads the href and link renderer from AiLimitProvider", () => {
    render(
      <AiLimitProvider
        upgradeHref="https://dash.example.com/organization/features"
        renderLink={({ href, className, children }) => (
          <a href={href} className={className} data-router-link>
            {children}
          </a>
        )}
      >
        <AiLimitNotice limit={{ resetsAt: null, upgrade: true }} />
      </AiLimitProvider>
    );
    const link = screen.getByRole("link", { name: "See plans" });
    expect(link).toHaveAttribute("href", "https://dash.example.com/organization/features");
    expect(link).toHaveAttribute("data-router-link");
    expect(
      screen.getByText("AI features are paused until your daily allowance resets.")
    ).toBeVisible();
  });

  it("never shows a price", () => {
    const { container } = render(
      <AiLimitNotice limit={{ resetsAt, upgrade: true }} upgradeHref="/organization/features" />
    );
    expect(container.textContent).not.toMatch(/[$€£]|\bper month\b|\/mo\b/i);
  });
});
