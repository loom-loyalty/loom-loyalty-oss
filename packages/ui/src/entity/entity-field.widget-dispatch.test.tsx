import type { UIFieldConfig } from "@loom-loyalty/schema";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../forms/metadata-field/use-metadata-field", () => ({
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

import { EntityField } from "./entity-field";

const baseField: Omit<UIFieldConfig, "widget"> = {
  name: "field",
  label: "Field",
  displayFormat: "text",
  showInList: true,
  showInDetail: true,
  showInCreate: true,
  showInEdit: true,
};

describe("[audit] EntityField widget dispatch", () => {
  it("widget='locale-tabbed-input' renders LocalizedStringInput", () => {
    const onChange = vi.fn();
    const field: UIFieldConfig = { ...baseField, widget: "locale-tabbed-input" };
    const { container } = render(
      <EntityField field={field} value={{ en: "hi" }} mode="edit" onChange={onChange} />
    );
    expect(container.querySelector('[data-widget="locale-tabbed-input"]')).not.toBeNull();
  });

  it("widget='metadata-select' renders MetadataField with typeCode from field.metadataType", () => {
    const onChange = vi.fn();
    const field: UIFieldConfig = {
      ...baseField,
      widget: "metadata-select",
      metadataType: "FIAT_CURRENCY_TYPE",
    };
    const { container } = render(
      <EntityField field={field} value="USD" mode="edit" onChange={onChange} />
    );
    const trigger = container.querySelector('[data-widget="metadata-select"]');
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute("data-metadata-type")).toBe("FIAT_CURRENCY_TYPE");
  });

  it("widget='metadata-select' without metadataType falls back to text input (no crash)", () => {
    const onChange = vi.fn();
    const field: UIFieldConfig = { ...baseField, widget: "metadata-select" };
    const { container } = render(
      <EntityField field={field} value="" mode="edit" onChange={onChange} />
    );
    expect(container.querySelector('[data-widget="metadata-select"]')).toBeNull();
    expect(container.querySelector("input")).not.toBeNull();
  });

  it("widget='metadata-select' with array value renders read-only list (no String([...]) corruption)", () => {
    const onChange = vi.fn();
    const field: UIFieldConfig = {
      ...baseField,
      widget: "metadata-select",
      metadataType: "FIAT_CURRENCY_TYPE",
    };
    const { container } = render(
      <EntityField field={field} value={["USD", "EUR"]} mode="edit" onChange={onChange} />
    );
    expect(container.textContent).toContain("USD");
    expect(container.textContent).toContain("EUR");
    expect(container.textContent).not.toContain("USD,EUR");
    expect(container.querySelector('[data-widget="metadata-select"]')).toBeNull();
  });

  it("widget='reference' falls back to text input (per-entity wrapper deferred to 0.10b)", () => {
    const onChange = vi.fn();
    const field: UIFieldConfig = {
      ...baseField,
      widget: "reference",
      entityCode: "PARTNER",
    };
    const { container } = render(
      <EntityField field={field} value="prtnr_abc" mode="edit" onChange={onChange} />
    );
    expect(container.querySelector("input")).not.toBeNull();
    expect(container.querySelector('[data-widget="entity-combobox"]')).toBeNull();
  });

  it("widget='locale-tabbed-input' in view mode renders the en value (not [object Object])", () => {
    const field: UIFieldConfig = {
      ...baseField,
      widget: "locale-tabbed-input",
      displayFormat: "text",
    };
    const { container } = render(
      <EntityField field={field} value={{ en: "Hello", es: "Hola" }} mode="view" />
    );
    expect(container.textContent).toContain("Hello");
    expect(container.textContent).not.toContain("[object Object]");
  });
});

describe("[audit] EntityField locale-tabbed-input label association", () => {
  it("renders an element with id=field-{name} so the wrapping <Label htmlFor> resolves", () => {
    const onChange = vi.fn();
    const field: UIFieldConfig = { ...baseField, widget: "locale-tabbed-input" };
    const { container } = render(
      <EntityField field={field} value={{ en: "hi" }} mode="edit" onChange={onChange} />
    );
    const label = container.querySelector('label[for="field-field"]');
    expect(label).not.toBeNull();
    const target = container.querySelector("#field-field");
    expect(target).not.toBeNull();
    expect((target as HTMLElement).tagName.toLowerCase()).toMatch(/^(input|textarea)$/);
  });
});

describe("[audit] EntityField fallback <div> ARIA label association", () => {
  it("metadata-select array branch: <div> uses aria-labelledby pointing at <Label> id (WCAG 1.3.1)", async () => {
    const { EntityField: Fresh, __resetWarnedMetadataMultiFields } = await import("./entity-field");
    __resetWarnedMetadataMultiFields();
    const onChange = vi.fn();
    const field: UIFieldConfig = {
      ...baseField,
      widget: "metadata-select",
      metadataType: "FIAT_CURRENCY_TYPE",
    };
    const { container } = render(
      <Fresh field={field} value={["USD", "EUR"]} mode="edit" onChange={onChange} />
    );
    const label = container.querySelector("label#field-field-label");
    expect(label).not.toBeNull();
    const target = container.querySelector('[aria-labelledby="field-field-label"]');
    expect(target).not.toBeNull();
    expect((target as HTMLElement).tagName.toLowerCase()).toBe("div");
  });

  it("readonly widget branch: <div> uses aria-labelledby pointing at <Label> id (WCAG 1.3.1)", () => {
    const onChange = vi.fn();
    const field: UIFieldConfig = { ...baseField, widget: "readonly" };
    const { container } = render(
      <EntityField field={field} value="ro-value" mode="edit" onChange={onChange} />
    );
    const label = container.querySelector("label#field-field-label");
    expect(label).not.toBeNull();
    const target = container.querySelector('[aria-labelledby="field-field-label"]');
    expect(target).not.toBeNull();
    expect((target as HTMLElement).tagName.toLowerCase()).toBe("div");
  });
});

describe("[audit] EntityField warn-once Sets reset helpers", () => {
  it("__resetWarnedReferenceFields lets the warning fire again for the same field name", async () => {
    const { EntityField: Fresh, __resetWarnedReferenceFields } = await import("./entity-field");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    __resetWarnedReferenceFields();

    const field: UIFieldConfig = {
      ...baseField,
      widget: "reference",
      entityCode: "PARTNER",
    };
    const onChange = vi.fn();
    render(<Fresh field={field} value="prtnr_x" mode="edit" onChange={onChange} />);
    const callsAfterFirst = warn.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    render(<Fresh field={field} value="prtnr_y" mode="edit" onChange={onChange} />);
    expect(warn.mock.calls.length).toBe(callsAfterFirst);

    __resetWarnedReferenceFields();
    render(<Fresh field={field} value="prtnr_z" mode="edit" onChange={onChange} />);
    expect(warn.mock.calls.length).toBeGreaterThan(callsAfterFirst);

    warn.mockRestore();
  });

  it("__resetWarnedMetadataMultiFields lets the warning fire again for the same field name", async () => {
    const { EntityField: Fresh, __resetWarnedMetadataMultiFields } = await import("./entity-field");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    __resetWarnedMetadataMultiFields();

    const field: UIFieldConfig = {
      ...baseField,
      widget: "metadata-select",
      metadataType: "FIAT_CURRENCY_TYPE",
    };
    const onChange = vi.fn();
    render(<Fresh field={field} value={["USD", "EUR"]} mode="edit" onChange={onChange} />);
    const callsAfterFirst = warn.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    render(<Fresh field={field} value={["GBP"]} mode="edit" onChange={onChange} />);
    expect(warn.mock.calls.length).toBe(callsAfterFirst);

    __resetWarnedMetadataMultiFields();
    render(<Fresh field={field} value={["JPY"]} mode="edit" onChange={onChange} />);
    expect(warn.mock.calls.length).toBeGreaterThan(callsAfterFirst);

    warn.mockRestore();
  });
});

describe("[security] EntityField view-mode href sanitization", () => {
  const linkField: UIFieldConfig = { ...baseField, widget: "url", displayFormat: "link" };
  const emailField: UIFieldConfig = { ...baseField, widget: "email", displayFormat: "email" };

  it("displayFormat='link' renders a javascript: value as plain text, not an anchor", () => {
    const { container } = render(
      <EntityField field={linkField} value="javascript:alert(1)" mode="view" />
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("javascript:alert(1)");
  });

  it("displayFormat='link' rejects a data: URL", () => {
    const { container } = render(
      <EntityField field={linkField} value="data:text/html,<script>alert(1)</script>" mode="view" />
    );
    expect(container.querySelector("a")).toBeNull();
  });

  it("displayFormat='link' preserves an https URL as an external anchor", () => {
    const { container } = render(
      <EntityField field={linkField} value="https://example.com" mode="view" />
    );
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("https://example.com");
    expect(anchor?.getAttribute("target")).toBe("_blank");
    expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("displayFormat='email' renders a javascript: value as plain text, not an anchor", () => {
    const { container } = render(
      <EntityField field={emailField} value="javascript:alert(1)" mode="view" />
    );
    expect(container.querySelector("a")).toBeNull();
  });

  it("displayFormat='email' preserves a valid address as a mailto anchor", () => {
    const { container } = render(<EntityField field={emailField} value="a@b.com" mode="view" />);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("mailto:a@b.com");
  });
});
