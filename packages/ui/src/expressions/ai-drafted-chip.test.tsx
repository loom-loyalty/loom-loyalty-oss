import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AiDraftedChip } from "./ai-drafted-chip";

describe("AiDraftedChip", () => {
  it("is a labeled image (role=img), not a live region", () => {
    render(<AiDraftedChip />);
    // role="img" + aria-label carries the accessible name. This must NOT be a
    // role="status": the surfaces that mount it already announce the proposal via
    // the builder's always-mounted LiveRegion, so a live-region chip would
    // double-announce.
    expect(screen.getByRole("img", { name: /AI-drafted — review before saving/i })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
