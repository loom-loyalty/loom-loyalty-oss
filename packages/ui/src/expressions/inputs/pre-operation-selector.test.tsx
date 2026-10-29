import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PreOperation } from "../types";
import { PreOperationSelector } from "./pre-operation-selector";

// Radix Select relies on pointer-capture + scrollIntoView, which jsdom lacks.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

describe("PreOperationSelector round-trip (backend field names)", () => {
  it("numeric pre-op reads and emits `operand` (not `value`)", () => {
    const onChange = vi.fn();
    const value = { multiply: { operand: 2 } } as PreOperation;
    render(<PreOperationSelector value={value} onChange={onChange} />);

    const operand = screen.getByLabelText("Operation operand");
    expect(operand).toHaveValue(2);

    fireEvent.change(operand, { target: { value: "5" } });
    expect(onChange).toHaveBeenCalledWith({ multiply: { operand: 5 } });
  });

  it("subString reads/emits `beginIndex`/`endIndex` under the `subString` key", () => {
    const onChange = vi.fn();
    const value = { subString: { beginIndex: 1, endIndex: 4 } } as PreOperation;
    render(<PreOperationSelector value={value} onChange={onChange} />);

    const begin = screen.getByLabelText("Substring begin index");
    const end = screen.getByLabelText("Substring end index");
    expect(begin).toHaveValue(1);
    expect(end).toHaveValue(4);

    fireEvent.change(begin, { target: { value: "2" } });
    expect(onChange).toHaveBeenCalledWith({ subString: { beginIndex: 2, endIndex: 4 } });
  });

  it("datetime reads/emits `pattern` under the `datetime` key (lowercase)", () => {
    const onChange = vi.fn();
    const value = { datetime: { pattern: "yyyy" } } as PreOperation;
    render(<PreOperationSelector value={value} onChange={onChange} />);

    const pattern = screen.getByPlaceholderText("yyyy-MM-dd'T'HH:mm:ss");
    expect(pattern).toHaveValue("yyyy");

    fireEvent.change(pattern, { target: { value: "yyyy-MM" } });
    expect(onChange).toHaveBeenCalledWith({ datetime: { pattern: "yyyy-MM" } });
  });

  it("matchesCurrentDate reads/emits both `pattern` and `timeZone`", () => {
    const onChange = vi.fn();
    const value = { matchesCurrentDate: { pattern: "yyyy", timeZone: "UTC" } } as PreOperation;
    render(<PreOperationSelector value={value} onChange={onChange} />);

    expect(screen.getByLabelText("Date pattern")).toHaveValue("yyyy");
    const timeZone = screen.getByLabelText("Time zone");
    expect(timeZone).toHaveValue("UTC");

    fireEvent.change(timeZone, { target: { value: "America/New_York" } });
    expect(onChange).toHaveBeenCalledWith({
      matchesCurrentDate: { pattern: "yyyy", timeZone: "America/New_York" },
    });
  });

  it("length renders a read-only chip with no operand input", () => {
    render(<PreOperationSelector value={{ length: {} } as PreOperation} onChange={vi.fn()} />);

    expect(screen.getByText("→ length")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("size renders a read-only chip with no operand input", () => {
    render(<PreOperationSelector value={{ size: {} } as PreOperation} onChange={vi.fn()} />);

    expect(screen.getByText("→ size")).toBeInTheDocument();
  });

  it("epoch renders a read-only chip", () => {
    render(<PreOperationSelector value={{ epoch: {} } as PreOperation} onChange={vi.fn()} />);

    expect(screen.getByText("→ epoch")).toBeInTheDocument();
  });

  it("diffFromCurrentEpoch renders a read-only chip", () => {
    render(
      <PreOperationSelector
        value={{ diffFromCurrentEpoch: {} } as PreOperation}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("→ epoch diff")).toBeInTheDocument();
  });

  it("matchesCurrentDate renders a read-only chip alongside its pattern/timezone inputs", () => {
    render(
      <PreOperationSelector value={{ matchesCurrentDate: {} } as PreOperation} onChange={vi.fn()} />
    );

    expect(screen.getByText("→ current date")).toBeInTheDocument();
    expect(screen.getByLabelText("Date pattern")).toBeInTheDocument();
    expect(screen.getByLabelText("Time zone")).toBeInTheDocument();
  });
});

describe("PreOperationSelector type switch (emptyOps mapping)", () => {
  it("selecting 'Length' from 'None' emits the correct empty shape for that type", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PreOperationSelector value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: /adjust value/i }));
    await user.click(screen.getByRole("option", { name: "Length" }));

    expect(onChange).toHaveBeenCalledWith({ length: {} });
  });

  it("selecting 'Size' emits the correct empty shape", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PreOperationSelector value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: /adjust value/i }));
    await user.click(screen.getByRole("option", { name: "Size" }));

    expect(onChange).toHaveBeenCalledWith({ size: {} });
  });

  it("selecting 'No operation' from an existing value clears it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PreOperationSelector
        value={{ multiply: { operand: 2 } } as PreOperation}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("combobox", { name: /adjust value/i }));
    await user.click(screen.getByRole("option", { name: "No operation" }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
