import type { UIEntitySchema } from "@loom-loyalty/schema";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExtendedFieldsInline, ExtendedFieldsSection } from "./extended-fields-section.js";

/**
 * One INPUT field (writable) and one OUTPUT-only field. generateUISchema sets
 * showInCreate/showInEdit=false for readonly/output data-model fields, so the
 * write side must hide them while the read side shows them — guarding the
 * regression where output/reference fields leaked into create/edit forms as raw
 * extension inputs (the BE then 400s on the non-editable value).
 */
const SCHEMA = {
  fields: {
    tenantInput: {
      name: "tenantInput",
      label: "Tenant Input",
      widget: "text",
      showInCreate: true,
      showInEdit: true,
    },
    // create-only + edit-only pin the OR: each has the two flags diverging, so an
    // `&&` (or single-flag) refactor of the write-side filter would drop one and
    // fail here.
    createOnly: {
      name: "createOnly",
      label: "Create Only",
      widget: "text",
      showInCreate: true,
      showInEdit: false,
    },
    editOnly: {
      name: "editOnly",
      label: "Edit Only",
      widget: "text",
      showInCreate: false,
      showInEdit: true,
    },
    computedOutput: {
      name: "computedOutput",
      label: "Computed Output",
      widget: "readonly",
      showInCreate: false,
      showInEdit: false,
    },
  },
} as unknown as UIEntitySchema;

const FIELDS = ["tenantInput", "createOnly", "editOnly", "computedOutput"];

describe("ExtendedFieldsSection input/output filtering", () => {
  it("edit (write) mode renders input fields (incl. create-only + edit-only), hides output-only", () => {
    render(<ExtendedFieldsSection schema={SCHEMA} fields={FIELDS} data={{}} mode="edit" />);
    expect(screen.getByText("Tenant Input")).toBeInTheDocument();
    expect(screen.getByText("Create Only")).toBeInTheDocument();
    expect(screen.getByText("Edit Only")).toBeInTheDocument();
    expect(screen.queryByText("Computed Output")).not.toBeInTheDocument();
  });

  it("view (read) mode renders all fields, including output-only", () => {
    render(<ExtendedFieldsSection schema={SCHEMA} fields={FIELDS} data={{}} mode="view" />);
    expect(screen.getByText("Tenant Input")).toBeInTheDocument();
    expect(screen.getByText("Computed Output")).toBeInTheDocument();
  });
});

describe("ExtendedFieldsInline input/output filtering", () => {
  it("edit (write) mode renders input fields (incl. create-only + edit-only), hides output-only", () => {
    render(<ExtendedFieldsInline schema={SCHEMA} fields={FIELDS} data={{}} mode="edit" />);
    expect(screen.getByText("Tenant Input")).toBeInTheDocument();
    expect(screen.getByText("Create Only")).toBeInTheDocument();
    expect(screen.getByText("Edit Only")).toBeInTheDocument();
    expect(screen.queryByText("Computed Output")).not.toBeInTheDocument();
  });

  it("view (read) mode renders all fields, including output-only", () => {
    render(<ExtendedFieldsInline schema={SCHEMA} fields={FIELDS} data={{}} mode="view" />);
    expect(screen.getByText("Tenant Input")).toBeInTheDocument();
    expect(screen.getByText("Computed Output")).toBeInTheDocument();
  });
});

describe("ExtendedFieldsSection disclosure a11y", () => {
  it("toggle is an accessible disclosure (aria-expanded + aria-controls → panel)", () => {
    render(<ExtendedFieldsSection schema={SCHEMA} fields={FIELDS} data={{}} mode="view" />);
    const toggle = screen.getByRole("button");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panelId = toggle.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId!);
    expect(panel).toBeInTheDocument();
    expect(panel).not.toHaveAttribute("inert");
  });

  it("collapsed content is inert (out of tab order + a11y tree)", () => {
    render(
      <ExtendedFieldsSection
        schema={SCHEMA}
        fields={FIELDS}
        data={{}}
        mode="view"
        defaultCollapsed
      />
    );
    const toggle = screen.getByRole("button");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const panel = document.getElementById(toggle.getAttribute("aria-controls")!);
    expect(panel).toHaveAttribute("inert");
  });
});
