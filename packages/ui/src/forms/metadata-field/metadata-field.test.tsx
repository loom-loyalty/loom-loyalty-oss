import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./use-metadata-field", () => ({
  useMetadataField: () => ({
    category: "DATA_TYPE",
    isTypeNotFound: false,
    metadataOptions: [{ code: "USD", name: "US Dollar" }],
    suggestedOptions: [],
    isLoading: false,
    error: null,
    createMetadata: vi.fn(),
    isCreating: false,
    createError: null,
    findOption: () => undefined,
    dataModelTypeOptions: [],
    isLoadingDataModelTypes: false,
  }),
}));

import { MetadataField } from "./metadata-field";

describe("[audit] MetadataField data-widget attrs", () => {
  it("renders data-widget='metadata-select' on the trigger", () => {
    const { container } = render(
      <MetadataField
        typeCode="CURRENCY_TYPE"
        typeLabel="Currency Type"
        value=""
        onValueChange={() => {}}
      />
    );
    expect(container.querySelector('[data-widget="metadata-select"]')).not.toBeNull();
  });

  it("threads typeCode through as data-metadata-type", () => {
    const { container } = render(
      <MetadataField
        typeCode="CURRENCY_TYPE"
        typeLabel="Currency Type"
        value=""
        onValueChange={() => {}}
      />
    );
    const trigger = container.querySelector('[data-widget="metadata-select"]');
    expect(trigger?.getAttribute("data-metadata-type")).toBe("CURRENCY_TYPE");
  });

  it("emits data-metadata-category from the resolved type's category", () => {
    const { container } = render(
      <MetadataField
        typeCode="CURRENCY_TYPE"
        typeLabel="Currency Type"
        value=""
        onValueChange={() => {}}
      />
    );
    const trigger = container.querySelector('[data-widget="metadata-select"]');
    expect(trigger?.getAttribute("data-metadata-category")).toBe("DATA_TYPE");
  });
});
