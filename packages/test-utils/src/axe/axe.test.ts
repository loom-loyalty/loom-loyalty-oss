/**
 * @vitest-environment jsdom
 *
 * axe-core requires a DOM at runtime. The rest of test-utils runs under the
 * node environment; this file overrides to jsdom so we can run real axe
 * checks against test markup.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { axe, installAxeMatchers, toHaveNoViolations } from "./index.js";

function buildAccessibleFragment(): HTMLElement {
  const container = document.createElement("div");
  const main = document.createElement("main");
  const h1 = document.createElement("h1");
  h1.textContent = "Hello";
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Close");
  button.textContent = "×";
  main.appendChild(h1);
  main.appendChild(button);
  container.appendChild(main);
  return container;
}

function buildButtonWithoutAccessibleName(): HTMLElement {
  const container = document.createElement("div");
  const button = document.createElement("button");
  button.type = "button";
  container.appendChild(button);
  return container;
}

describe("axe surface re-exports", () => {
  it("exports axe as a callable function", () => {
    expect(typeof axe).toBe("function");
  });

  it("exports toHaveNoViolations as a matcher implementation", () => {
    expect(typeof toHaveNoViolations).toBe("function");
  });

  it("exports installAxeMatchers as a callable", () => {
    expect(typeof installAxeMatchers).toBe("function");
  });
});

describe("installAxeMatchers + axe end-to-end", () => {
  beforeAll(() => {
    installAxeMatchers();
  });

  it("registers toHaveNoViolations on expect", () => {
    expect(expect("anything").toHaveNoViolations).toBeTypeOf("function");
  });

  it("passes toHaveNoViolations on accessible markup", async () => {
    const container = buildAccessibleFragment();
    document.body.appendChild(container);

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    document.body.removeChild(container);
  });

  it("fails toHaveNoViolations on a button without an accessible name", async () => {
    const container = buildButtonWithoutAccessibleName();
    document.body.appendChild(container);

    const results = await axe(container);
    expect(() => expect(results).toHaveNoViolations()).toThrow();

    document.body.removeChild(container);
  });

  afterAll(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });
});
