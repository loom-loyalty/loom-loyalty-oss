import type { UIFieldConfig } from "@loom-loyalty/schema";
import { describe, expect, it } from "vitest";

import { formatLocalizedFieldValue } from "./format-utils";

const localeField: UIFieldConfig = {
  name: "description",
  label: "Description",
  widget: "locale-tabbed-input",
  displayFormat: "text",
  showInList: true,
  showInDetail: true,
  showInCreate: true,
  showInEdit: true,
};

const textField: UIFieldConfig = { ...localeField, widget: "text" };

describe("[audit] formatLocalizedFieldValue", () => {
  it("extracts en value from a localized record", () => {
    expect(formatLocalizedFieldValue(localeField, { en: "Hello", es: "Hola" })).toBe("Hello");
  });

  it("returns the empty-placeholder when the localized record has no extractable value", () => {
    const result = formatLocalizedFieldValue(localeField, {});
    expect(result).not.toBe(null);
    expect(result).not.toBe("");
  });

  it("returns null for a non-locale-tabbed-input widget (caller falls through)", () => {
    expect(formatLocalizedFieldValue(textField, { en: "Hello" })).toBeNull();
  });

  it("returns null for primitive values (caller falls through)", () => {
    expect(formatLocalizedFieldValue(localeField, "raw string")).toBeNull();
    expect(formatLocalizedFieldValue(localeField, 42)).toBeNull();
    expect(formatLocalizedFieldValue(localeField, null)).toBeNull();
    expect(formatLocalizedFieldValue(localeField, undefined)).toBeNull();
  });

  it("returns null for arrays (caller falls through)", () => {
    expect(formatLocalizedFieldValue(localeField, ["x", "y"])).toBeNull();
  });
});
