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
