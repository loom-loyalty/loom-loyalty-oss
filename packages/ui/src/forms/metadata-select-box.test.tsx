import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetIntersectionObservers, triggerIntersection } from "../test/intersection-observer";
import { MetadataSelectBox } from "./metadata-select-box";

describe("[audit] MetadataSelectBox data-widget attrs", () => {
  it("renders data-widget='metadata-select' on the trigger", () => {
    const { container } = render(
      <MetadataSelectBox metadataTypeCode="FIAT_CURRENCY_TYPE" metadataTypeLabel="Currency" />
    );
    expect(container.querySelector('[data-widget="metadata-select"]')).not.toBeNull();
  });

  it("emits data-metadata-type from metadataTypeCode prop", () => {
    const { container } = render(
      <MetadataSelectBox metadataTypeCode="FIAT_CURRENCY_TYPE" metadataTypeLabel="Currency" />
    );
    const trigger = container.querySelector("[data-widget]");
    expect(trigger?.getAttribute("data-metadata-type")).toBe("FIAT_CURRENCY_TYPE");
  });

  it("emits data-metadata-category when category is provided", () => {
    const { container } = render(
      <MetadataSelectBox
        metadataTypeCode="FIAT_CURRENCY_TYPE"
        metadataTypeLabel="Currency"
        category="METADATA"
      />
    );
    const trigger = container.querySelector("[data-widget]");
    expect(trigger?.getAttribute("data-metadata-category")).toBe("METADATA");
  });

  it("omits data-metadata-category when category is not provided", () => {
    const { container } = render(
      <MetadataSelectBox metadataTypeCode="FIAT_CURRENCY_TYPE" metadataTypeLabel="Currency" />
    );
    const trigger = container.querySelector("[data-widget]");
    expect(trigger?.hasAttribute("data-metadata-category")).toBe(false);
  });

  it("emits attrs in the error-state branch too", () => {
    const { container } = render(
      <MetadataSelectBox
        metadataTypeCode="FIAT_CURRENCY_TYPE"
        metadataTypeLabel="Currency"
        error="boom"
      />
    );
    const errorBtn = container.querySelector('[data-widget="metadata-select"]');
    expect(errorBtn).not.toBeNull();
    expect(errorBtn?.getAttribute("data-metadata-type")).toBe("FIAT_CURRENCY_TYPE");
  });
});

describe("[audit] MetadataSelectBox async pagination", () => {
  afterEach(() => {
    resetIntersectionObservers();
  });

  function openPopover(container: HTMLElement) {
    const trigger = container.querySelector('[role="combobox"]');
    if (!trigger) throw new Error("trigger missing");
    fireEvent.click(trigger);
  }

  it("renders the load-more sentinel only when hasNextPage is true", () => {
    const { container, rerender } = render(
      <MetadataSelectBox
        metadataTypeCode="FIAT_CURRENCY_TYPE"
        metadataTypeLabel="Currency"
        hasNextPage
      />
    );
    openPopover(container);

    expect(screen.queryByTestId("metadata-select-sentinel")).not.toBeNull();

    rerender(
      <MetadataSelectBox
        metadataTypeCode="FIAT_CURRENCY_TYPE"
        metadataTypeLabel="Currency"
        hasNextPage={false}
      />
    );
    expect(screen.queryByTestId("metadata-select-sentinel")).toBeNull();
  });

  it("fires onLoadMore when the sentinel intersects", () => {
    const onLoadMore = vi.fn();
    const { container } = render(
      <MetadataSelectBox
        metadataTypeCode="FIAT_CURRENCY_TYPE"
        metadataTypeLabel="Currency"
        hasNextPage
        onLoadMore={onLoadMore}
      />
    );
    openPopover(container);

    triggerIntersection(true);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("suppresses onLoadMore while isFetchingNextPage is true", () => {
    const onLoadMore = vi.fn();
    const { container } = render(
      <MetadataSelectBox
        metadataTypeCode="FIAT_CURRENCY_TYPE"
        metadataTypeLabel="Currency"
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
      <MetadataSelectBox
        metadataTypeCode="FIAT_CURRENCY_TYPE"
        metadataTypeLabel="Currency"
        hasNextPage
        isFetchingNextPage
      />
    );
    openPopover(container);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading more...");
  });

  it("forwards typed text via onSearchChange when controlled", () => {
    const onSearchChange = vi.fn();
    const { container } = render(
      <MetadataSelectBox
        metadataTypeCode="FIAT_CURRENCY_TYPE"
        metadataTypeLabel="Currency"
        searchValue=""
        onSearchChange={onSearchChange}
      />
    );
    openPopover(container);

    const input = screen.getByPlaceholderText(/search currency/i);
    fireEvent.change(input, { target: { value: "usd" } });

    expect(onSearchChange).toHaveBeenCalledWith("usd");
  });

  it("filters suggested options by searchValue when controlled", () => {
    const { container } = render(
      <MetadataSelectBox
        metadataTypeCode="PROGRAM_TYPE"
        metadataTypeLabel="Program Type"
        suggestedOptions={[
          { code: "standard", name: "Standard", isSuggested: true },
          { code: "tiered", name: "Tiered Loyalty", isSuggested: true },
        ]}
        searchValue="tier"
        onSearchChange={() => {}}
      />
    );
    openPopover(container);

    expect(screen.queryByText("Tiered Loyalty")).not.toBeNull();
    expect(screen.queryByText("Standard")).toBeNull();
  });

  it("renders all suggested options when uncontrolled (cmdk owns filtering)", () => {
    const { container } = render(
      <MetadataSelectBox
        metadataTypeCode="PROGRAM_TYPE"
        metadataTypeLabel="Program Type"
        suggestedOptions={[
          { code: "standard", name: "Standard", isSuggested: true },
          { code: "tiered", name: "Tiered Loyalty", isSuggested: true },
        ]}
      />
    );
    openPopover(container);

    expect(screen.queryByText("Tiered Loyalty")).not.toBeNull();
    expect(screen.queryByText("Standard")).not.toBeNull();
  });

  it("trigger keeps the selected label via lastResolved cache when both metadataOptions and lookupOptions lose it", () => {
    // Mirrors the offer-field server-search case: lookupOptions cycles with
    // the search, so when the user picks "US Dollar" then rewrites the
    // query, neither metadataOptions nor lookupOptions contain it. The
    // cache fallback keeps the trigger label stable.
    const { container, rerender } = render(
      <MetadataSelectBox
        metadataTypeCode="FIAT_CURRENCY_TYPE"
        metadataTypeLabel="Currency"
        metadataOptions={[{ code: "USD", name: "US Dollar" }]}
        lookupOptions={[{ code: "USD", name: "US Dollar" }]}
        value="USD"
      />
    );
    expect(container.querySelector('[role="combobox"]')).toHaveTextContent("US Dollar");

    rerender(
      <MetadataSelectBox
        metadataTypeCode="FIAT_CURRENCY_TYPE"
        metadataTypeLabel="Currency"
        metadataOptions={[{ code: "EUR", name: "Euro" }]}
        lookupOptions={[{ code: "EUR", name: "Euro" }]}
        value="USD"
      />
    );
    expect(container.querySelector('[role="combobox"]')).toHaveTextContent("US Dollar");
  });

  it("trigger clears the cached label when value becomes empty", () => {
    const { container, rerender } = render(
      <MetadataSelectBox
        metadataTypeCode="FIAT_CURRENCY_TYPE"
        metadataTypeLabel="Currency"
        metadataOptions={[{ code: "USD", name: "US Dollar" }]}
        value="USD"
        placeholder="Pick a currency"
      />
    );
    expect(container.querySelector('[role="combobox"]')).toHaveTextContent("US Dollar");

    rerender(
      <MetadataSelectBox
        metadataTypeCode="FIAT_CURRENCY_TYPE"
        metadataTypeLabel="Currency"
        metadataOptions={[{ code: "USD", name: "US Dollar" }]}
        value=""
        placeholder="Pick a currency"
      />
    );
    expect(container.querySelector('[role="combobox"]')).toHaveTextContent("Pick a currency");
  });

  it("trigger keeps the selected label when metadataOptions filters it out", () => {
    const all = [
      { code: "USD", name: "US Dollar" },
      { code: "EUR", name: "Euro" },
    ];
    const { container, rerender } = render(
      <MetadataSelectBox
        metadataTypeCode="FIAT_CURRENCY_TYPE"
        metadataTypeLabel="Currency"
        metadataOptions={all}
        lookupOptions={all}
        value="USD"
      />
    );
    expect(container.querySelector('[role="combobox"]')).toHaveTextContent("US Dollar");

    rerender(
      <MetadataSelectBox
        metadataTypeCode="FIAT_CURRENCY_TYPE"
        metadataTypeLabel="Currency"
        metadataOptions={[{ code: "EUR", name: "Euro" }]}
        lookupOptions={all}
        value="USD"
      />
    );
    expect(container.querySelector('[role="combobox"]')).toHaveTextContent("US Dollar");
  });
});
