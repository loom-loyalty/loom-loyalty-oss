import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dropzone } from "./dropzone";

describe("Dropzone", () => {
  it("renders the label and description in idle state", () => {
    render(<Dropzone label="Drop markdown" description="Or click to browse" onDrop={vi.fn()} />);
    expect(screen.getByText("Drop markdown")).toBeInTheDocument();
    expect(screen.getByText("Or click to browse")).toBeInTheDocument();
  });

  it("uses role=button and exposes the label to assistive tech", () => {
    render(<Dropzone label="Drop markdown" onDrop={vi.fn()} />);
    const zone = screen.getByRole("button", { name: "Drop markdown" });
    expect(zone).toBeInTheDocument();
  });

  it("reports aria-busy and swaps to the processing stage label while processing", () => {
    render(
      <Dropzone
        label="Drop markdown"
        stageLabel="Parsing template..."
        processing
        onDrop={vi.fn()}
      />
    );
    const zone = screen.getByRole("button", { name: "Drop markdown" });
    expect(zone).toHaveAttribute("aria-busy", "true");
    const stage = screen.getByText("Parsing template...");
    expect(stage).toHaveAttribute("aria-live", "polite");
  });

  it("marks itself aria-disabled and stops click interaction when disabled", () => {
    render(<Dropzone label="Drop markdown" disabled onDrop={vi.fn()} />);
    const zone = screen.getByRole("button", { name: "Drop markdown" });
    expect(zone).toHaveAttribute("aria-disabled", "true");
  });

  it("renders the children region for additional controls", () => {
    render(
      <Dropzone label="Drop markdown" onDrop={vi.fn()}>
        <button type="button">Choose a starter</button>
      </Dropzone>
    );
    expect(screen.getByRole("button", { name: "Choose a starter" })).toBeInTheDocument();
  });
});
