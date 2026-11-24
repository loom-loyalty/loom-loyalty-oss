import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetIntersectionObservers, triggerIntersection } from "../test/intersection-observer";
import { EntitySelectBox } from "./entity-select-box";

describe("[audit] EntitySelectBox data-widget attrs", () => {
  it("renders data-widget='entity-combobox' on the trigger", () => {
    const { container } = render(<EntitySelectBox entityLabel="Partner" />);
    expect(container.querySelector('[data-widget="entity-combobox"]')).not.toBeNull();
  });

  it("derives data-entity from entityLabel by default", () => {
    const { container } = render(<EntitySelectBox entityLabel="Metadata Type" />);
    const trigger = container.querySelector("[data-widget]");
    expect(trigger?.getAttribute("data-entity")).toBe("METADATA_TYPE");
  });

  it("uppercases single-word entityLabel for data-entity", () => {
    const { container } = render(<EntitySelectBox entityLabel="Partner" />);
    const trigger = container.querySelector("[data-widget]");
    expect(trigger?.getAttribute("data-entity")).toBe("PARTNER");
  });

  it("respects explicit entityType override", () => {
    const { container } = render(
      <EntitySelectBox entityLabel="Partner" entityType="PARTNER_LEGACY" />
    );
    const trigger = container.querySelector("[data-widget]");
    expect(trigger?.getAttribute("data-entity")).toBe("PARTNER_LEGACY");
  });

  it("respects widgetType override (used by MetadataTypeField)", () => {
    const { container } = render(
      <EntitySelectBox entityLabel="Metadata Type" widgetType="metadata-type-combobox" />
    );
    expect(container.querySelector('[data-widget="metadata-type-combobox"]')).not.toBeNull();
  });

  it("emits attrs in the error-state branch too", () => {
    const { container } = render(<EntitySelectBox entityLabel="Partner" error="Failed to load" />);
    const errorBtn = container.querySelector('[data-widget="entity-combobox"]');
    expect(errorBtn).not.toBeNull();
    expect(errorBtn?.getAttribute("data-entity")).toBe("PARTNER");
  });

  it("passes through data-metadata-category when provided", () => {
    const { container } = render(
      <EntitySelectBox
        entityLabel="Metadata Type"
        widgetType="metadata-type-combobox"
        metadataCategory="DATA_TYPE"
      />
    );
    const trigger = container.querySelector("[data-widget]");
    expect(trigger?.getAttribute("data-metadata-category")).toBe("DATA_TYPE");
  });

  it("omits data-metadata-category when not provided", () => {
    const { container } = render(<EntitySelectBox entityLabel="Partner" />);
    const trigger = container.querySelector("[data-widget]");
    expect(trigger?.hasAttribute("data-metadata-category")).toBe(false);
  });
});

describe("[audit] EntitySelectBox async pagination", () => {
  afterEach(() => {
    resetIntersectionObservers();
  });

  function openPopover(container: HTMLElement) {
    const trigger = container.querySelector('[role="combobox"]');
    if (!trigger) throw new Error("trigger missing");
    fireEvent.click(trigger);
  }

  it("renders the load-more sentinel only when hasNextPage is true", () => {
    const { container, rerender } = render(<EntitySelectBox entityLabel="Partner" hasNextPage />);
    openPopover(container);

    expect(screen.queryByTestId("entity-select-sentinel")).not.toBeNull();

    rerender(<EntitySelectBox entityLabel="Partner" hasNextPage={false} />);
    expect(screen.queryByTestId("entity-select-sentinel")).toBeNull();
  });

  it("fires onLoadMore when the sentinel intersects", () => {
    const onLoadMore = vi.fn();
    const { container } = render(
      <EntitySelectBox entityLabel="Partner" hasNextPage onLoadMore={onLoadMore} />
    );
    openPopover(container);

    triggerIntersection(true);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("suppresses onLoadMore while isFetchingNextPage is true", () => {
    const onLoadMore = vi.fn();
    const { container } = render(
      <EntitySelectBox
        entityLabel="Partner"
        hasNextPage
        isFetchingNextPage
        onLoadMore={onLoadMore}
      />
    );
    openPopover(container);

    triggerIntersection(true);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("renders the 'Loading more...' status when isFetchingNextPage is true", () => {
    const { container } = render(
      <EntitySelectBox entityLabel="Partner" hasNextPage isFetchingNextPage />
    );
    openPopover(container);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading more...");
  });

  it("forwards typed text via onSearchChange when controlled", () => {
    const onSearchChange = vi.fn();
    const { container } = render(
      <EntitySelectBox entityLabel="Partner" searchValue="" onSearchChange={onSearchChange} />
    );
    openPopover(container);

    const input = screen.getByPlaceholderText("Search partners...");
    fireEvent.change(input, { target: { value: "abc" } });

    expect(onSearchChange).toHaveBeenCalledWith("abc");
  });

  it("keeps the static-options API working when no pagination props are supplied (regression)", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <EntitySelectBox
        entityLabel="Partner"
        options={[{ id: "p1", name: "Acme" }]}
        onValueChange={onValueChange}
      />
    );
    openPopover(container);

    const acme = screen.getByText("Acme");
    fireEvent.click(acme);

    expect(onValueChange).toHaveBeenCalledWith("p1");
  });

  it("resolves the trigger label via lookupOptions when the value is filtered out of options", () => {
    const { container } = render(
      <EntitySelectBox
        entityLabel="Partner"
        options={[{ id: "match", name: "Matching", secondaryText: "MATCH" }]}
        lookupOptions={[
          { id: "match", name: "Matching", secondaryText: "MATCH" },
          { id: "other", name: "Out of search", secondaryText: "OUT" },
        ]}
        value="other"
      />
    );

    const trigger = container.querySelector('[role="combobox"]');
    expect(trigger).toHaveTextContent("Out of search");
  });

  it("falls back to options for trigger lookup when lookupOptions is not provided", () => {
    const { container } = render(
      <EntitySelectBox
        entityLabel="Partner"
        options={[{ id: "match", name: "Matching" }]}
        value="match"
      />
    );

    const trigger = container.querySelector('[role="combobox"]');
    expect(trigger).toHaveTextContent("Matching");
  });

  it("retains the previously-resolved trigger label when server-driven search wipes options", () => {
    const initial = [{ id: "offer-5", name: "Special Offer" }];
    const { container, rerender } = render(
      <EntitySelectBox entityLabel="Offer" options={initial} value="offer-5" />
    );

    expect(container.querySelector('[role="combobox"]')).toHaveTextContent("Special Offer");

    // Server search rewrites options to a set that no longer contains "offer-5".
    // Trigger should still show "Special Offer" because we cached the resolution.
    rerender(
      <EntitySelectBox
        entityLabel="Offer"
        options={[{ id: "offer-1", name: "Standard Offer 1" }]}
        value="offer-5"
      />
    );
    expect(container.querySelector('[role="combobox"]')).toHaveTextContent("Special Offer");
  });

  it("clears the cached label when value changes to an id not in any haystack", () => {
    const { container, rerender } = render(
      <EntitySelectBox
        entityLabel="Offer"
        options={[{ id: "offer-5", name: "Special Offer" }]}
        value="offer-5"
      />
    );
    expect(container.querySelector('[role="combobox"]')).toHaveTextContent("Special Offer");

    rerender(<EntitySelectBox entityLabel="Offer" options={[]} value="offer-99" />);
    expect(container.querySelector('[role="combobox"]')).not.toHaveTextContent("Special Offer");
  });

  it("keeps the cached label when isLoading flips true mid-search (server-search refetch)", () => {
    const { container, rerender } = render(
      <EntitySelectBox
        entityLabel="Offer"
        options={[{ id: "offer-5", name: "Special Offer" }]}
        value="offer-5"
      />
    );
    expect(container.querySelector('[role="combobox"]')).toHaveTextContent("Special Offer");

    rerender(<EntitySelectBox entityLabel="Offer" options={[]} value="offer-5" isLoading />);

    const trigger = container.querySelector('[role="combobox"]');
    expect(trigger).toHaveTextContent("Special Offer");
    expect(trigger).not.toHaveTextContent("Loading...");
  });

  it("falls back to a Loading... state only when no cached selection exists", () => {
    const { container } = render(
      <EntitySelectBox entityLabel="Offer" options={[]} value="offer-5" isLoading />
    );
    expect(container.querySelector('[role="combobox"]')).toHaveTextContent("Loading...");
  });

  it("leaves the trigger interactive when a cached selection is showing under isLoading", () => {
    const { container, rerender } = render(
      <EntitySelectBox
        entityLabel="Offer"
        options={[{ id: "offer-5", name: "Special Offer" }]}
        value="offer-5"
      />
    );
    rerender(<EntitySelectBox entityLabel="Offer" options={[]} value="offer-5" isLoading />);
    const trigger = container.querySelector('[role="combobox"]') as HTMLButtonElement;
    expect(trigger.disabled).toBe(false);
  });

  it("disables the trigger when isLoading is true and no cached selection exists", () => {
    const { container } = render(
      <EntitySelectBox entityLabel="Offer" options={[]} value="offer-5" isLoading />
    );
    const trigger = container.querySelector('[role="combobox"]') as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
  });
});

describe("EntitySelectBox accessible name", () => {
  it("falls back to an aria-label when no label is associated", () => {
    render(<EntitySelectBox entityLabel="Partner" options={[]} />);
    expect(screen.getByRole("combobox", { name: "Select partner" })).toBeTruthy();
  });

  it("takes its name from an associated <label htmlFor>", () => {
    render(
      <>
        <label htmlFor="partner-field">Owning partner</label>
        <EntitySelectBox id="partner-field" entityLabel="Partner" options={[]} />
      </>
    );
    const trigger = screen.getByRole("combobox", { name: "Owning partner" });
    expect(trigger.hasAttribute("aria-label")).toBe(false);
  });

  it("takes its name from aria-labelledby", () => {
    render(
      <>
        <span id="partner-heading">Partner of record</span>
        <EntitySelectBox aria-labelledby="partner-heading" entityLabel="Partner" options={[]} />
      </>
    );
    const trigger = screen.getByRole("combobox", { name: "Partner of record" });
    expect(trigger.hasAttribute("aria-label")).toBe(false);
  });
});

describe("EntitySelectBox create options and suggestions (pickers brief S1, S3, S4)", () => {
  const options = [
    { id: "t1", name: "Visits this year" },
    { id: "t2", name: "Visits today" },
  ];

  it("S1: lists existing records and every '+ New …' choice, and reports which one was picked", () => {
    const onCreateOption = vi.fn();
    render(
      <EntitySelectBox
        entityLabel="Target"
        options={options}
        createOptions={[
          { key: "counter", label: "New counter" },
          { key: "daily-limit", label: "New limit: Daily limit" },
        ]}
        onCreateOption={onCreateOption}
      />
    );
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("Visits this year")).toBeTruthy();
    expect(screen.getByText("New counter")).toBeTruthy();
    fireEvent.click(screen.getByText("New limit: Daily limit"));
    expect(onCreateOption).toHaveBeenCalledWith("daily-limit");
  });

  it("'+ New …' stays on screen below a long list: pinned to the bottom of the open list (Nate 11-22)", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `a${i}`, name: `Audience ${i}` }));
    render(
      <EntitySelectBox
        entityLabel="Customer Audience"
        options={many}
        createOptions={[{ key: "audience", label: "New audience" }]}
        onCreateOption={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("combobox"));
    const pinned = screen.getByTestId("entity-select-create-options");
    expect(pinned.className).toMatch(/\bsticky\b/);
    expect(pinned.className).toMatch(/\bbottom-0\b/);
    expect(pinned.textContent).toContain("New audience");
  });

  it("shows a record just created from '+ New …' when the loaded list doesn't hold it (Codex fe#1960)", () => {
    render(
      <EntitySelectBox
        entityLabel="Target"
        options={[{ id: "t1", name: "Visits" }]}
        lookupOptions={[{ id: "t1", name: "Visits" }]}
        value="t-new"
        createdOption={{ id: "t-new", name: "Punch card", secondaryText: "punch-card" }}
      />
    );
    expect(screen.getByRole("combobox").textContent).toContain("Punch card");
  });

  it("pinned '+ New …' choices keep a 44px touch target (Codex fe#1960)", () => {
    render(
      <EntitySelectBox
        entityLabel="Target"
        options={[]}
        createOptions={[{ key: "counter", label: "New counter" }]}
        onCreateOption={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("combobox"));
    const item = screen.getByRole("option", { name: /new counter/i });
    expect(item.className).toContain("min-h-11");
  });

  it("'+ New …' stays offered when a search matches no records (Nate 11-22)", () => {
    render(
      <EntitySelectBox
        entityLabel="Target"
        options={options}
        createOptions={[{ key: "counter", label: "New counter" }]}
        onCreateOption={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByPlaceholderText("Search targets..."), {
      target: { value: "zzz no such target" },
    });
    expect(screen.getByText("New counter")).toBeTruthy();
  });

  it("S4: with no records it opens on the '+ New …' choices, not an empty-list message", () => {
    render(
      <EntitySelectBox
        entityLabel="Target"
        options={[]}
        createOptions={[{ key: "counter", label: "New counter" }]}
        onCreateOption={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("New counter")).toBeTruthy();
    expect(screen.queryByText("No target found.")).toBeNull();
    expect(screen.getByText("Nothing here yet. Create one:")).toBeTruthy();
  });

  it("S3: marks a suggested selection on the trigger", () => {
    render(<EntitySelectBox entityLabel="Target" options={options} value="t2" suggested />);
    const trigger = screen.getByRole("combobox");
    expect(trigger.textContent).toContain("Visits today");
    expect(trigger.textContent).toContain("Suggested");
  });

  it("S3: shows no mark when the selection is not a suggestion", () => {
    render(<EntitySelectBox entityLabel="Target" options={options} value="t2" />);
    expect(screen.getByRole("combobox").textContent).not.toContain("Suggested");
  });

  it("keeps the single 'Add New' row when only onCreateNew is given (regression)", () => {
    const onCreateNew = vi.fn();
    render(<EntitySelectBox entityLabel="Target" options={options} onCreateNew={onCreateNew} />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Add New Target"));
    expect(onCreateNew).toHaveBeenCalledOnce();
  });
});
