import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { OneTimeCodeInput } from "./one-time-code-input";

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <OneTimeCodeInput label="Code" value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}

const box = (n: number) => screen.getByLabelText(`Digit ${n} of 6`);
const value = () => screen.getByTestId("value").textContent;

describe("OneTimeCodeInput", () => {
  it("renders six labelled boxes in a named group", () => {
    render(<Harness />);
    expect(screen.getByRole("group", { name: "Code" })).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
    expect(box(1)).toHaveAttribute("autocomplete", "one-time-code");
  });

  it("moves to the next box as digits are typed and ignores letters", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(box(1));
    await user.keyboard("1a2");

    expect(value()).toBe("12");
    expect(box(3)).toHaveFocus();
  });

  it("fills every box from the first when a full code is pasted into any box", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(box(4));
    await user.paste("123-456");

    expect(value()).toBe("123456");
    expect(box(6)).toHaveFocus();
  });

  it("fills every box from an autofilled code", () => {
    render(<Harness />);

    fireEvent.change(box(1), { target: { value: "987654" } });

    expect(value()).toBe("987654");
  });

  it("clears the previous box on Backspace in an empty box", async () => {
    const user = userEvent.setup();
    render(<Harness initial="123" />);

    await user.click(box(4));
    await user.keyboard("{Backspace}");

    expect(value()).toBe("12");
    expect(box(3)).toHaveFocus();
  });

  it("focuses the next box to fill when the row between boxes is tapped", () => {
    render(<Harness initial="12" />);

    fireEvent.pointerDown(screen.getByRole("group", { name: "Code" }));

    expect(box(3)).toHaveFocus();
  });
});
