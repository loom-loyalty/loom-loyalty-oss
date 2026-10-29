import { describe, expect, it } from "vitest";
import type { WidgetType } from "../../types/ui-schema.js";
import { getOpenUIMapping, WIDGET_TO_OPENUI } from "../widget-mapping.js";

const ALL_WIDGET_TYPES: WidgetType[] = [
  "text",
  "textarea",
  "number",
  "currency",
  "percentage",
  "checkbox",
  "switch",
  "select",
  "multi-select",
  "radio",
  "date",
  "datetime",
  "time",
  "email",
  "url",
  "password",
  "color",
  "file",
  "image",
  "json",
  "code",
  "markdown",
  "rich-text",
  "reference",
  "reference-multi",
  "tags",
  "hidden",
  "readonly",
  "custom",
];

describe("widget-mapping", () => {
  it("has a mapping for every WidgetType", () => {
    for (const widgetType of ALL_WIDGET_TYPES) {
      const mapping = WIDGET_TO_OPENUI[widgetType];
      expect(mapping).toBeDefined();
      expect(mapping).toHaveProperty("component");
      expect(mapping).toHaveProperty("defaultProps");
    }
  });

  it("maps hidden to null component", () => {
    const mapping = getOpenUIMapping("hidden");
    expect(mapping.component).toBeNull();
  });

  it("maps text to TextInput", () => {
    const mapping = getOpenUIMapping("text");
    expect(mapping.component).toBe("TextInput");
  });

  it("maps number to NumberInput", () => {
    const mapping = getOpenUIMapping("number");
    expect(mapping.component).toBe("NumberInput");
  });

  it("maps select to Select", () => {
    const mapping = getOpenUIMapping("select");
    expect(mapping.component).toBe("Select");
  });

  it("maps currency to CurrencyInput", () => {
    const mapping = getOpenUIMapping("currency");
    expect(mapping.component).toBe("CurrencyInput");
  });

  it("maps percentage to PercentageInput", () => {
    const mapping = getOpenUIMapping("percentage");
    expect(mapping.component).toBe("PercentageInput");
  });

  it("maps tags to TagsInput", () => {
    const mapping = getOpenUIMapping("tags");
    expect(mapping.component).toBe("TagsInput");
  });

  it("maps readonly to ReadOnlyField", () => {
    const mapping = getOpenUIMapping("readonly");
    expect(mapping.component).toBe("ReadOnlyField");
  });

  it("maps json to JsonInput", () => {
    const mapping = getOpenUIMapping("json");
    expect(mapping.component).toBe("JsonInput");
  });

  it("maps datetime to DateTimeInput", () => {
    const mapping = getOpenUIMapping("datetime");
    expect(mapping.component).toBe("DateTimeInput");
  });

  it("maps reference to EntitySelect", () => {
    const mapping = getOpenUIMapping("reference");
    expect(mapping.component).toBe("EntitySelect");
  });

  it("maps multi-select to MultiSelect", () => {
    const mapping = getOpenUIMapping("multi-select");
    expect(mapping.component).toBe("MultiSelect");
  });

  it("provides type override for email", () => {
    const mapping = getOpenUIMapping("email");
    expect(mapping.component).toBe("TextInput");
    expect(mapping.defaultProps).toEqual({ type: "email" });
  });

  it("provides helpText for time input", () => {
    const mapping = getOpenUIMapping("time");
    expect(mapping.component).toBe("TextInput");
    expect(mapping.defaultProps).toHaveProperty("helpText", "HH:MM format");
  });

  it("has no undefined entries in the mapping", () => {
    for (const [key, value] of Object.entries(WIDGET_TO_OPENUI)) {
      expect(value).not.toBeUndefined();
      expect(value.defaultProps).toBeDefined();
      // component can be null (hidden), but should not be undefined
      if (key !== "hidden") {
        expect(typeof value.component).toBe("string");
      }
    }
  });
});
