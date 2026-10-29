import { describe, expect, it } from "vitest";

import type { ParsedField } from "../types/schema.js";
import { fieldToUIConfig } from "./field-types.js";

const baseField: Omit<ParsedField, "type"> = {
  name: "field",
  label: "Field",
  validation: {},
};

describe("[audit] fieldToUIConfig — typed metadata threading", () => {
  it("threads localized_string → widget=locale-tabbed-input + searchable=true", () => {
    const ui = fieldToUIConfig({ ...baseField, type: "localized_string" });
    expect(ui.widget).toBe("locale-tabbed-input");
    expect(ui.searchable).toBe(true);
  });

  it("threads metadata → widget=metadata-select + metadataType propagated", () => {
    const ui = fieldToUIConfig({
      ...baseField,
      type: "metadata",
      metadataType: "FIAT_CURRENCY_TYPE",
      metadataTypeCategory: "METADATA",
    });
    expect(ui.widget).toBe("metadata-select");
    expect(ui.metadataType).toBe("FIAT_CURRENCY_TYPE");
    expect(ui.metadataTypeCategory).toBe("METADATA");
  });

  it("threads reference → widget=reference + entityCode propagated", () => {
    const ui = fieldToUIConfig({
      ...baseField,
      type: "reference",
      reference: { entityCode: "OFFER", isArray: false },
    });
    expect(ui.widget).toBe("reference");
    expect(ui.entityCode).toBe("OFFER");
  });

  it("ENTITY_ID array: entityCode falls back to items.reference.entityCode", () => {
    const ui = fieldToUIConfig({
      ...baseField,
      type: "array",
      items: {
        type: "reference",
        validation: {},
        reference: { entityCode: "PROGRAM", isArray: false },
      },
    });
    expect(ui.widget).toBe("reference-multi");
    expect(ui.entityCode).toBe("PROGRAM");
  });

  it("METADATA array: widget=metadata-select + metadataType from items", () => {
    const ui = fieldToUIConfig({
      ...baseField,
      type: "array",
      items: {
        type: "metadata",
        validation: {},
        metadataType: "BADGE_TYPE",
        metadataTypeCategory: "DATA_TYPE",
      },
    });
    expect(ui.widget).toBe("metadata-select");
    expect(ui.metadataType).toBe("BADGE_TYPE");
    expect(ui.metadataTypeCategory).toBe("DATA_TYPE");
  });

  it("LOCALIZED_STRING array: widget=locale-tabbed-input from items", () => {
    const ui = fieldToUIConfig({
      ...baseField,
      type: "array",
      items: { type: "localized_string", validation: {} },
    });
    expect(ui.widget).toBe("locale-tabbed-input");
  });

  it("JSON array: renders the full array as JSON instead of object tags", () => {
    const ui = fieldToUIConfig({
      ...baseField,
      type: "array",
      items: { type: "json", validation: {} },
    });
    expect(ui.widget).toBe("json");
    expect(ui.displayFormat).toBe("json");
  });

  it("originalTypeReference is preserved on UIFieldConfig", () => {
    const ui = fieldToUIConfig({
      ...baseField,
      type: "string",
      originalTypeReference: "DATE_TIME_PERIOD",
    });
    expect(ui.originalTypeReference).toBe("DATE_TIME_PERIOD");
  });

  it("long localized_string with maxLength > 255 stays as locale-tabbed-input (not textarea)", () => {
    const ui = fieldToUIConfig({
      ...baseField,
      type: "localized_string",
      validation: { maxLength: 4000 },
    });
    expect(ui.widget).toBe("locale-tabbed-input");
  });
});

describe("[audit] fieldToUIConfig — readonly precedence", () => {
  it("readonly + maxLength>255 string field stays widget=readonly", () => {
    const ui = fieldToUIConfig({
      ...baseField,
      type: "string",
      readonly: true,
      validation: { maxLength: 4000 },
    });
    expect(ui.widget).toBe("readonly");
  });

  it("readonly + maxLength>255 localized_string field stays widget=readonly", () => {
    const ui = fieldToUIConfig({
      ...baseField,
      type: "localized_string",
      readonly: true,
      validation: { maxLength: 4000 },
    });
    expect(ui.widget).toBe("readonly");
  });
});
