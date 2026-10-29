import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PathOrValueField } from "./path-or-value-field";

function LiteralInput({ value }: { value?: string }): React.ReactNode {
  return <input aria-label="Fixed amount" value={value ?? ""} readOnly />;
}

describe("PathOrValueField", () => {
  it("defaults to 'value' mode and shows children when only `value` is set", () => {
    render(
      <PathOrValueField path={undefined} value="100" onPathChange={vi.fn()} label="Amount">
        <LiteralInput value="100" />
      </PathOrValueField>
    );

    expect(screen.getByRole("radio", { name: "Fixed value" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByLabelText("Fixed amount")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /select a field|click to change/i })
    ).not.toBeInTheDocument();
  });

  it("defaults to 'field' mode and shows JsonPathInput when `path` is set", () => {
    render(
      <PathOrValueField
        path="$.eventData.total"
        value={undefined}
        onPathChange={vi.fn()}
        label="Amount"
      >
        <LiteralInput />
      </PathOrValueField>
    );

    expect(screen.getByRole("radio", { name: "From field" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.queryByLabelText("Fixed amount")).not.toBeInTheDocument();
  });

  it("switching from 'field' to 'value' does not clear the path (fallback semantics preserved)", async () => {
    const user = userEvent.setup();
    const handlePathChange = vi.fn();
    render(
      <PathOrValueField
        path="$.eventData.total"
        value="100"
        onPathChange={handlePathChange}
        label="Amount"
      >
        <LiteralInput value="100" />
      </PathOrValueField>
    );

    await user.click(screen.getByRole("radio", { name: "Fixed value" }));

    expect(handlePathChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Fixed amount")).toBeInTheDocument();
  });

  it("shows the fallback-value hint only in 'field' mode when a value is also set", () => {
    render(
      <PathOrValueField path="$.eventData.total" value="100" onPathChange={vi.fn()} label="Amount">
        <LiteralInput value="100" />
      </PathOrValueField>
    );

    expect(screen.getByText(/fallback value if the field is empty/i)).toBeInTheDocument();
  });

  it("shows the 'field also set' hint only in 'value' mode when a path is also set", async () => {
    const user = userEvent.setup();
    render(
      <PathOrValueField path="$.eventData.total" value="100" onPathChange={vi.fn()} label="Amount">
        <LiteralInput value="100" />
      </PathOrValueField>
    );

    await user.click(screen.getByRole("radio", { name: "Fixed value" }));

    expect(screen.getByText(/a field is also set and takes priority/i)).toBeInTheDocument();
    expect(screen.queryByText(/fallback value if the field is empty/i)).not.toBeInTheDocument();
  });

  it("shows neither hint when only one of path/value is set", () => {
    render(
      <PathOrValueField path={undefined} value="100" onPathChange={vi.fn()} label="Amount">
        <LiteralInput value="100" />
      </PathOrValueField>
    );

    expect(screen.queryByText(/fallback value if the field is empty/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/a field is also set and takes priority/i)).not.toBeInTheDocument();
  });
});
