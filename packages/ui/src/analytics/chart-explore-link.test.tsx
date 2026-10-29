import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { LinkComponentProps } from "../shell/sidebar";
import { ChartExploreLink } from "./chart-explore-link";

describe("ChartExploreLink", () => {
  it("renders a plain anchor by default", () => {
    render(<ChartExploreLink href="/analytics/explorer?pipe=customers" chartTitle="Customers" />);

    expect(screen.getByRole("link", { name: "Explore Customers in Spindle" })).toHaveAttribute(
      "href",
      "/analytics/explorer?pipe=customers"
    );
  });

  it("renders the supplied LinkComponent with the drill-down link props", () => {
    function TestLink({ href, "aria-label": ariaLabel, children }: LinkComponentProps) {
      return (
        <a data-testid="router-link" href={href} aria-label={ariaLabel}>
          {children}
        </a>
      );
    }

    render(
      <ChartExploreLink
        href="/analytics/explorer?pipe=customers"
        chartTitle="Customers"
        LinkComponent={TestLink}
      />
    );

    expect(screen.getByTestId("router-link")).toHaveAttribute(
      "href",
      "/analytics/explorer?pipe=customers"
    );
    expect(screen.getByTestId("router-link")).toHaveAccessibleName("Explore Customers in Spindle");
    expect(screen.getByTestId("router-link").querySelector("svg")).not.toBeNull();
  });
});
