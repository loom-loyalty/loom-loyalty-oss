import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppBanner } from "../app-banner";

describe("AppBanner", () => {
  it("announces a destructive banner assertively", () => {
    render(<AppBanner variant="destructive" title="Lapsed" description="Fix it" />);
    expect(screen.getByRole("alert")).toHaveTextContent("LapsedFix it");
  });

  it("announces other variants politely and renders the action", () => {
    render(<AppBanner variant="accent" title="Trial ending" action={<button>Go</button>} />);
    expect(screen.getByRole("status")).toHaveTextContent("Trial ending");
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });
});
