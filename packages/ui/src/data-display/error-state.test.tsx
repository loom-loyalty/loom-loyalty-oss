import { ApiError } from "@loom-loyalty/sdk";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorState } from "./error-state";

describe("ErrorState", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it("shows a generic message, the reference and Retry for a server fault", () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        title="Couldn't load offers"
        error={new ApiError({ message: "SQL text", status: 500, requestId: "req-500" })}
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
    expect(screen.queryByText(/SQL text/)).not.toBeInTheDocument();
    expect(screen.getByText("req-500")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the API message and no Retry for a 4xx", () => {
    render(
      <ErrorState
        title="Couldn't load offer"
        error={new ApiError({ message: "Offer not found.", status: 404, code: "NOT_FOUND" })}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Offer not found.");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByText(/NOT_FOUND|404/)).not.toBeInTheDocument();
  });

  it("offers Retry for a rate limit", () => {
    render(
      <ErrorState
        title="Couldn't load offers"
        error={new ApiError({ message: "Too many requests.", status: 429, code: "RATE_LIMITED" })}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Too many requests.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("copies the support reference from the keyboard", () => {
    render(
      <ErrorState
        title="Couldn't save"
        error={new ApiError({ message: "x", status: 502, requestId: "req-copy" })}
      />
    );

    const copy = screen.getByRole("button", { name: "Copy support reference" });
    copy.focus();
    expect(copy).toHaveFocus();
    fireEvent.click(copy);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("req-copy");
  });

  it("uses the fallback for values without a message", () => {
    render(<ErrorState title="Couldn't load" error={undefined} fallback="Failed to load tiers." />);

    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load tiers.");
  });
});
