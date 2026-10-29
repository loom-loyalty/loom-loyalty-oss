/**
 * EntityLinkButton — Unit Tests
 *
 * Extracted from target-detail-sheet.tsx's inline EventLinkButton so the
 * truncated-ID link pattern can be reused for other entity types (e.g.
 * linking a ledger entry back to its originating event). Covers the
 * interactive/non-interactive degrade and the parameterized accessible name.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EntityLinkButton } from "./entity-link-button.js";

const FULL_ID = "abcdef1234567890";

describe("EntityLinkButton", () => {
  it("renders a truncated id", () => {
    render(<EntityLinkButton id={FULL_ID} entityLabel="event" onClick={vi.fn()} />);
    expect(screen.getByText("abcdef12…")).toBeInTheDocument();
    expect(screen.queryByText(FULL_ID)).not.toBeInTheDocument();
  });

  it("renders as plain, non-focusable text when onClick is absent", () => {
    render(<EntityLinkButton id={FULL_ID} entityLabel="event" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    const text = screen.getByText("abcdef12…");
    expect(text.tagName).toBe("SPAN");
    expect(text).not.toHaveAttribute("tabindex");
  });

  it("renders as a clickable element with an external-link icon when onClick is provided", () => {
    render(<EntityLinkButton id={FULL_ID} entityLabel="event" onClick={vi.fn()} />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button.querySelector("svg")).toBeInTheDocument();
  });

  it("fires onClick with the full, untruncated id when clicked", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<EntityLinkButton id={FULL_ID} entityLabel="event" onClick={handleClick} />);

    await user.click(screen.getByRole("button"));

    expect(handleClick).toHaveBeenCalledWith(FULL_ID);
  });

  it("uses entityLabel in title and aria-label instead of a hardcoded noun", () => {
    render(<EntityLinkButton id={FULL_ID} entityLabel="ledger entry" onClick={vi.fn()} />);

    const button = screen.getByRole("button", { name: `View ledger entry ${FULL_ID}` });
    expect(button).toHaveAttribute("title", FULL_ID);
  });

  it("defaults to the original 'event' copy when entityLabel is 'event'", () => {
    render(<EntityLinkButton id={FULL_ID} entityLabel="event" onClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: `View event ${FULL_ID}` })).toBeInTheDocument();
  });
});
