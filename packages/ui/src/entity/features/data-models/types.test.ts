import type { DataModelElement } from "@loom-loyalty/sdk";
import { describe, expect, it } from "vitest";

import { hasUnresolvedRows, type BuilderFieldRow } from "./builder/types.js";
import {
  elementToFormData,
  formDataToElement,
  isMetricRoleEligibleType,
  nameToInputAttribute,
  newElementRowKey,
} from "./types.js";

describe("nameToInputAttribute", () => {
  it("returns an empty string for empty input", () => {
    expect(nameToInputAttribute("")).toBe("");
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(nameToInputAttribute("   ")).toBe("");
  });

  it("leaves single lowercase words unchanged", () => {
    expect(nameToInputAttribute("email")).toBe("email");
  });

  it("lowercases a single uppercase word", () => {
    expect(nameToInputAttribute("EMAIL")).toBe("email");
  });

  it("camelCases space-separated words", () => {
    expect(nameToInputAttribute("Email Address")).toBe("emailAddress");
    expect(nameToInputAttribute("First Name")).toBe("firstName");
    expect(nameToInputAttribute("customer id")).toBe("customerId");
  });

  it("handles hyphen-separated input", () => {
    expect(nameToInputAttribute("Customer-id")).toBe("customerId");
    expect(nameToInputAttribute("first-name")).toBe("firstName");
  });

  it("handles underscore-separated input", () => {
    expect(nameToInputAttribute("first_name")).toBe("firstName");
    expect(nameToInputAttribute("CUSTOMER_ID")).toBe("customerId");
  });

  it("collapses multiple consecutive separators", () => {
    expect(nameToInputAttribute("Email   Address")).toBe("emailAddress");
    expect(nameToInputAttribute("email__address")).toBe("emailAddress");
    expect(nameToInputAttribute("first - name")).toBe("firstName");
  });

  it("handles mixed separators", () => {
    expect(nameToInputAttribute("Customer-ID_Number Field")).toBe("customerIdNumberField");
  });

  it("preserves word boundaries across 3+ words", () => {
    expect(nameToInputAttribute("this is a field")).toBe("thisIsAField");
  });

  it("trims leading and trailing whitespace", () => {
    expect(nameToInputAttribute("  Email Address  ")).toBe("emailAddress");
  });

  it("handles strings that start with a separator", () => {
    expect(nameToInputAttribute("_email_address")).toBe("emailAddress");
    expect(nameToInputAttribute("-customer-id")).toBe("customerId");
  });

  it("lowercases the first character even when input starts uppercase", () => {
    expect(nameToInputAttribute("Email")).toBe("email");
  });

  it("returns an empty string when only separators are present", () => {
    expect(nameToInputAttribute("___")).toBe("");
    expect(nameToInputAttribute("- - -")).toBe("");
  });

  it("handles single-character words", () => {
    expect(nameToInputAttribute("a b c")).toBe("aBC");
  });
});

describe("newElementRowKey", () => {
  it("returns a non-empty string", () => {
    const key = newElementRowKey();
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
  });

  it("returns a unique value per call", () => {
    const keys = new Set(Array.from({ length: 100 }, () => newElementRowKey()));
    expect(keys.size).toBe(100);
  });
});

describe("elementToFormData", () => {
  const baseElement: DataModelElement = {
    dataModelElementId: "dme_test_email_element_for_unit_t",
    name: "Email",
    inputAttribute: "email",
    typeReference: "STRING",
    required: true,
    sensitive: false,
    array: false,
    inputOnly: false,
    outputOnly: false,
    createOnly: false,
  };

  it("assigns a stable _rowKey so duplicate-named elements don't collide on React key", () => {
    // Regression: previously the form-sheet keyed rows by `inputAttribute ?? name`,
    // which collided when two draft elements both had name "Email" and no
    // inputAttribute. Rows would share keys and React would mis-key edits.
    const a = elementToFormData({ ...baseElement, inputAttribute: undefined });
    const b = elementToFormData({ ...baseElement, inputAttribute: undefined });
    expect(a._rowKey).toBeDefined();
    expect(b._rowKey).toBeDefined();
    expect(a._rowKey).not.toBe(b._rowKey);
  });

  it("preserves all non-key fields from the source element", () => {
    const result = elementToFormData(baseElement);
    expect(result.name).toBe("Email");
    expect(result.inputAttribute).toBe("email");
    expect(result.typeCode).toBe("STRING");
    expect(result.required).toBe(true);
    expect(result.sensitive).toBe(false);
  });

  it("preserves metricRole from the source element", () => {
    const result = elementToFormData({
      ...baseElement,
      typeReference: "NUMBER",
      metricRole: "REVENUE",
    });
    expect(result.metricRole).toBe("REVENUE");
  });

  it("leaves metricRole undefined when the source element has none", () => {
    const result = elementToFormData(baseElement);
    expect(result.metricRole).toBeUndefined();
  });
});

describe("isMetricRoleEligibleType", () => {
  it("returns true for INTEGER and NUMBER", () => {
    expect(isMetricRoleEligibleType("INTEGER")).toBe(true);
    expect(isMetricRoleEligibleType("NUMBER")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isMetricRoleEligibleType("number")).toBe(true);
  });

  it("returns false for non-numeric types", () => {
    expect(isMetricRoleEligibleType("STRING")).toBe(false);
    expect(isMetricRoleEligibleType("BOOLEAN")).toBe(false);
    expect(isMetricRoleEligibleType("METADATA")).toBe(false);
  });
});

describe("formDataToElement", () => {
  it("strips the client-only _rowKey before sending to the API", () => {
    // _rowKey is a React-keying artifact and must never leak into the API payload.
    const result = formDataToElement({
      _rowKey: "should-not-leak",
      name: "Email",
      inputAttribute: "email",
      typeCode: "STRING",
    });
    expect(result).not.toHaveProperty("_rowKey");
    expect(result.name).toBe("Email");
    expect(result.inputAttribute).toBe("email");
    expect(result.typeCode).toBe("STRING");
  });

  it("forwards a custom DataModelType reference verbatim", () => {
    // An element's typeCode is either a primitive palette entry (STRING, ...) or
    // a reference to another DataModelType. Those codes are lowercase-hyphenated
    // under the resource-code convention, so re-casing
    // here sent `ORDER-LINE-ITEM` for a type that is really `order-line-item`,
    // and the reference resolved to nothing.
    const result = formDataToElement({
      name: "Line Items",
      typeCode: "order-line-item",
      isArray: true,
    });

    expect(result.typeCode).toBe("order-line-item");
  });

  it("does not re-case a primitive typeCode either", () => {
    // Callers supply the code from a select, so there is nothing to normalize.
    // Element type resolution is case-insensitive server-side regardless.
    expect(formDataToElement({ name: "Email", typeCode: "STRING" }).typeCode).toBe("STRING");
    expect(formDataToElement({ name: "Email", typeCode: "string" }).typeCode).toBe("string");
  });

  it("forwards metricRole when typeCode is numeric", () => {
    const result = formDataToElement({
      name: "Order Total",
      typeCode: "NUMBER",
      metricRole: "REVENUE",
    });
    expect(result.metricRole).toBe("REVENUE");
  });

  it("drops metricRole when typeCode is not numeric, even if set", () => {
    // Guards against a stale metricRole surviving a type change to a
    // non-numeric type before submit (e.g. user picks NUMBER, sets Revenue,
    // then switches the type back to STRING).
    const result = formDataToElement({
      name: "Order Total",
      typeCode: "STRING",
      metricRole: "REVENUE",
    });
    expect(result.metricRole).toBeUndefined();
  });

  it("omits metricRole when unset", () => {
    const result = formDataToElement({ name: "Order Total", typeCode: "NUMBER" });
    expect(result.metricRole).toBeUndefined();
  });
});

describe("hasUnresolvedRows", () => {
  const nestedRow = (overrides: Partial<BuilderFieldRow> = {}): BuilderFieldRow => ({
    field: { _rowKey: "line-items", name: "Line Items", typeCode: "ANY", isArray: true },
    state: "needs-review-nested",
    source: "manual",
    ...overrides,
  });

  it.each([
    [
      "the type name is missing",
      nestedRow({
        nested: [
          { field: { name: "SKU", typeCode: "STRING" }, state: "editable", source: "manual" },
        ],
      }),
    ],
    ["nested fields are missing", nestedRow({ nestedTypeName: "Line Item", nested: [] })],
    ["both the type name and nested fields are missing", nestedRow({ nested: [] })],
  ])("blocks submission when %s", (_case, row) => {
    expect(hasUnresolvedRows([row])).toBe(true);
  });

  it("does not block a nested row with a type name and at least one nested field", () => {
    expect(
      hasUnresolvedRows([
        nestedRow({
          nestedTypeName: "Line Item",
          nested: [
            { field: { name: "SKU", typeCode: "STRING" }, state: "editable", source: "manual" },
          ],
        }),
      ])
    ).toBe(false);
  });
});
