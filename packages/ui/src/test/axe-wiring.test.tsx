import { axe } from "@loom-loyalty/test-utils/axe";
import { describe, expect, it } from "vitest";

describe("[audit] axe matcher wiring", () => {
  it("registers toHaveNoViolations globally via setup.ts (no per-file matcher import needed)", () => {
    expect(expect("anything").toHaveNoViolations).toBeTypeOf("function");
  });

  it("passes on accessible markup", async () => {
    const root = document.createElement("div");
    const main = document.createElement("main");
    const heading = document.createElement("h1");
    heading.textContent = "Hello";
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", "Close");
    button.textContent = "X";
    main.appendChild(heading);
    main.appendChild(button);
    root.appendChild(main);
    document.body.appendChild(root);

    try {
      const results = await axe(root);
      expect(results).toHaveNoViolations();
    } finally {
      document.body.removeChild(root);
    }
  });

  it("flags violations on a button with no accessible name", async () => {
    const root = document.createElement("div");
    const button = document.createElement("button");
    button.type = "button";
    root.appendChild(button);
    document.body.appendChild(root);

    try {
      const results = await axe(root);
      expect(() => expect(results).toHaveNoViolations()).toThrow();
    } finally {
      document.body.removeChild(root);
    }
  });
});
