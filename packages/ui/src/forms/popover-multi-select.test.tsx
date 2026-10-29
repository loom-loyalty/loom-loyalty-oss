import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetIntersectionObservers, triggerIntersection } from "../test/intersection-observer";
import { PopoverMultiSelect } from "./popover-multi-select";

describe("[audit] PopoverMultiSelect data-widget attrs", () => {
  it("renders data-widget='entity-multi-combobox' on the trigger", () => {
    const { container } = render(
      <PopoverMultiSelect options={[]} value={[]} onChange={() => {}} />
    );
    expect(container.querySelector('[data-widget="entity-multi-combobox"]')).not.toBeNull();
  });

  it("emits data-entity when entityType prop is provided", () => {
    const { container } = render(
      <PopoverMultiSelect options={[]} value={[]} onChange={() => {}} entityType="PROGRAM" />
    );
    const trigger = container.querySelector("[data-widget]");
    expect(trigger?.getAttribute("data-entity")).toBe("PROGRAM");
  });

  it("omits data-entity when entityType is not provided", () => {
    const { container } = render(
      <PopoverMultiSelect options={[]} value={[]} onChange={() => {}} />
    );
    const trigger = container.querySelector("[data-widget]");
    expect(trigger?.hasAttribute("data-entity")).toBe(false);
  });

  it("respects widgetType override", () => {
    const { container } = render(
      <PopoverMultiSelect
        options={[]}
        value={[]}
        onChange={() => {}}
        widgetType="program-multi-combobox"
      />
    );
    expect(container.querySelector('[data-widget="program-multi-combobox"]')).not.toBeNull();
  });
});

describe("[audit] PopoverMultiSelect async pagination", () => {
  afterEach(() => {
    resetIntersectionObservers();
  });

  function openPopover(container: HTMLElement) {
    const trigger = container.querySelector('[role="combobox"]');
    if (!trigger) throw new Error("trigger missing");
    fireEvent.click(trigger);
  }

  it("renders the sentinel only when hasNextPage is true", () => {
    const { container, rerender } = render(
      <PopoverMultiSelect options={[]} value={[]} onChange={() => {}} hasNextPage />
    );
    openPopover(container);
    expect(screen.queryByTestId("popover-multi-select-sentinel")).not.toBeNull();

    rerender(
      <PopoverMultiSelect options={[]} value={[]} onChange={() => {}} hasNextPage={false} />
    );
    expect(screen.queryByTestId("popover-multi-select-sentinel")).toBeNull();
  });

  it("fires onLoadMore when the sentinel intersects", () => {
    const onLoadMore = vi.fn();
    const { container } = render(
      <PopoverMultiSelect
        options={[]}
        value={[]}
        onChange={() => {}}
        hasNextPage
        onLoadMore={onLoadMore}
      />
    );
    openPopover(container);

    triggerIntersection(true);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("forwards typed text via onSearchChange when controlled", () => {
    const onSearchChange = vi.fn();
    const { container } = render(
      <PopoverMultiSelect
        options={[]}
        value={[]}
        onChange={() => {}}
        searchValue=""
        onSearchChange={onSearchChange}
      />
    );
    openPopover(container);

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "abc" } });

    expect(onSearchChange).toHaveBeenCalledWith("abc");
  });

  it("renders 'Loading more...' status when isFetchingNextPage is true", () => {
    const { container } = render(
      <PopoverMultiSelect
        options={[]}
        value={[]}
        onChange={() => {}}
        hasNextPage
        isFetchingNextPage
      />
    );
    openPopover(container);

    expect(screen.getByRole("status")).toHaveTextContent("Loading more...");
  });

  it("keeps badges visible when value's option is in lookupOptions but filtered out of options", () => {
    const { container } = render(
      <PopoverMultiSelect
        options={[{ value: "match", label: "Matching" }]}
        lookupOptions={[
          { value: "match", label: "Matching" },
          { value: "out", label: "Filtered Out" },
        ]}
        value={["out"]}
        onChange={() => {}}
      />
    );

    const trigger = container.querySelector('[role="combobox"]');
    expect(trigger).toHaveTextContent("Filtered Out");
  });

  it("retains badge labels when server-driven search wipes the option set", () => {
    const { container, rerender } = render(
      <PopoverMultiSelect
        options={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ]}
        value={["a", "b"]}
        onChange={() => {}}
      />
    );

    const trigger = container.querySelector('[role="combobox"]');
    expect(trigger).toHaveTextContent("Alpha");
    expect(trigger).toHaveTextContent("Beta");

    // Server search rewrites options — neither selected value present.
    rerender(
      <PopoverMultiSelect
        options={[{ value: "z", label: "Zulu" }]}
        value={["a", "b"]}
        onChange={() => {}}
      />
    );

    expect(trigger).toHaveTextContent("Alpha");
    expect(trigger).toHaveTextContent("Beta");
  });
});
