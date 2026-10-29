import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingSplash } from "./loading-splash";

describe("LoadingSplash logo", () => {
  it("animates the Loom Loyalty icon by default", () => {
    const { container } = render(<LoadingSplash />);
    expect(container.querySelector(".loom-icon-container svg")).not.toBeNull();
  });

  it("shows a white-label brand's mark in its place", () => {
    const { container } = render(<LoadingSplash logo={<img alt="" data-testid="brand-mark" />} />);
    expect(screen.getByTestId("brand-mark")).toBeInTheDocument();
    expect(container.querySelector(".loom-icon-container")).toBeNull();
  });

  it("shows no mark at all for null", () => {
    const { container } = render(<LoadingSplash logo={null} />);
    expect(container.querySelector(".loom-icon-container")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
