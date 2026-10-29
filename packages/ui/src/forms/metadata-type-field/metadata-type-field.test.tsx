import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./use-metadata-type-field", () => ({
  useMetadataTypeField: () => ({
    options: [
      { id: "FIAT_CURRENCY_TYPE", name: "Fiat Currency Type", secondaryText: "FIAT_CURRENCY_TYPE" },
    ],
    metadataTypes: [],
    isLoading: false,
    error: null,
    findMetadataType: () => undefined,
  }),
}));

import { MetadataTypeField } from "./metadata-type-field";

describe("[audit] MetadataTypeField data-widget attrs", () => {
  it("renders data-widget='metadata-type-combobox' (overriding EntitySelectBox default)", () => {
    const { container } = render(<MetadataTypeField value="" onValueChange={() => {}} />);
    expect(container.querySelector('[data-widget="metadata-type-combobox"]')).not.toBeNull();
  });

  it("emits data-metadata-category='DATA_TYPE' (metadata types are inherently DATA_TYPE)", () => {
    const { container } = render(<MetadataTypeField value="" onValueChange={() => {}} />);
    const trigger = container.querySelector('[data-widget="metadata-type-combobox"]');
    expect(trigger?.getAttribute("data-metadata-category")).toBe("DATA_TYPE");
  });

  it("emits data-entity='METADATA_TYPE'", () => {
    const { container } = render(<MetadataTypeField value="" onValueChange={() => {}} />);
    const trigger = container.querySelector('[data-widget="metadata-type-combobox"]');
    expect(trigger?.getAttribute("data-entity")).toBe("METADATA_TYPE");
  });
});
