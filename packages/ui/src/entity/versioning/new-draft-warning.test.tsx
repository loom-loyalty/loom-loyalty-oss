import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NewDraftWarning } from "./new-draft-warning";

describe("NewDraftWarning (W1)", () => {
  it("says saving a live version starts the next draft version", () => {
    render(<NewDraftWarning version={3} versionStatus="PUBLISHED" noun="rule" />);
    const status = screen.getByRole("note");
    expect(status).toHaveTextContent("This is the live version (v3).");
    expect(status).toHaveTextContent("Saving your changes starts a new draft version (v4).");
    expect(status).toHaveTextContent("until you publish the draft");
  });

  it("names a paused version's status", () => {
    render(<NewDraftWarning version={2} versionStatus="PAUSED" />);
    expect(screen.getByRole("note")).toHaveTextContent("Version v2 is paused.");
  });

  it("takes an entity-specific consequence", () => {
    render(<NewDraftWarning version={1} consequence="Members stay as last computed." />);
    expect(screen.getByRole("note")).toHaveTextContent("(v2). Members stay as last computed.");
  });

  it("names what starts the draft", () => {
    render(<NewDraftWarning version={3} versionStatus="PUBLISHED" trigger="Edit" />);
    expect(screen.getByRole("note")).toHaveTextContent("Edit starts a new draft version (v4).");
  });

  it("works without a version number", () => {
    render(<NewDraftWarning noun="feed" />);
    expect(screen.getByRole("note")).toHaveTextContent("This feed is live.");
  });
});
