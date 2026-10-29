import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Select, SelectTrigger, SelectValue } from "./select";

describe("[audit] SelectTrigger data-discriminator opt-in", () => {
  it("does not emit data-discriminator by default", () => {
    const { container } = render(
      <Select defaultValue="a">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
      </Select>
    );
    expect(container.querySelector("[data-discriminator]")).toBeNull();
  });

  it("emits data-discriminator='true' when discriminator prop is set", () => {
    const { container } = render(
      <Select defaultValue="a">
        <SelectTrigger discriminator>
          <SelectValue />
        </SelectTrigger>
      </Select>
    );
    expect(container.querySelector('[data-discriminator="true"]')).not.toBeNull();
  });
});
