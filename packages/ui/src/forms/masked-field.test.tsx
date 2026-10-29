import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MaskedField } from "./masked-field";

describe("MaskedField", () => {
  it("masks a plain-string child by default and exposes the audit data attributes", () => {
    const { container } = render(<MaskedField>private@example.com</MaskedField>);

    const maskedField = container.querySelector('[data-widget="masked-field"]');
    expect(maskedField).toHaveAttribute("data-sensitive", "true");
    expect(screen.queryByText("private@example.com")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reveal value" })).toBeInTheDocument();
  });

  it("reveals children and reports the audit key once", async () => {
    const onReveal = vi.fn();
    const user = userEvent.setup();
    render(
      <MaskedField auditKey="customer:123:email:456" onReveal={onReveal} reason="email address">
        private@example.com
      </MaskedField>
    );

    await user.click(screen.getByRole("button", { name: "Reveal email address" }));

    expect(screen.getByText("private@example.com")).toBeInTheDocument();
    expect(onReveal).toHaveBeenCalledOnce();
    expect(onReveal).toHaveBeenCalledWith("customer:123:email:456");
  });

  it("does not report a second reveal callback when hidden again", async () => {
    const onReveal = vi.fn();
    const user = userEvent.setup();
    render(<MaskedField onReveal={onReveal}>private@example.com</MaskedField>);

    await user.click(screen.getByRole("button", { name: "Reveal value" }));
    await user.click(screen.getByRole("button", { name: "Hide value" }));

    expect(onReveal).toHaveBeenCalledOnce();
    expect(screen.queryByText("private@example.com")).not.toBeInTheDocument();
  });

  it("reveals composed JSX children", async () => {
    const user = userEvent.setup();
    render(
      <MaskedField reason="postal address">
        <div>
          <span>123 Main Street</span>
          <span>Chicago, IL 60601</span>
        </div>
      </MaskedField>
    );

    expect(screen.queryByText("123 Main Street")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reveal postal address" }));

    expect(screen.getByText("123 Main Street")).toBeInTheDocument();
    expect(screen.getByText("Chicago, IL 60601")).toBeInTheDocument();
  });
});
