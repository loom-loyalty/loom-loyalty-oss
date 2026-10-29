import type { DataModel } from "@loom-loyalty/sdk";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataModelDetail } from "./data-model-detail.js";

function model(type: DataModel["type"]): DataModel {
  return {
    dataModelId: "dm-1",
    type,
    versionStatus: "DRAFT",
    elements: [{ name: "Name", inputAttribute: "name", typeReference: "STRING" }],
  } as DataModel;
}

describe("DataModelDetail lifecycle actions", () => {
  it("hides lifecycle and type actions for primitive data models", () => {
    render(
      <DataModelDetail
        dataModel={model({
          dataModelTypeId: "type-string",
          code: "STRING",
          name: "String",
          primitive: true,
        })}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onCreateVersion={vi.fn()}
        onPublish={vi.fn()}
        onEditType={vi.fn()}
        onDeleteType={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /^Edit$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Duplicate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New Version" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Type" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Type" })).not.toBeInTheDocument();
  });

  it("hides Version History Publish for a read-only model with a draft version", () => {
    const readOnlyModel = model({
      dataModelTypeId: "type-string",
      code: "STRING",
      name: "String",
      primitive: true,
    });

    render(
      <DataModelDetail
        dataModel={{ ...readOnlyModel, version: 1, versionStatus: "PUBLISHED" }}
        versions={[{ ...readOnlyModel, dataModelId: "dm-2", version: 2 }]}
        onPublishVersion={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Publish v2" })).not.toBeInTheDocument();
  });

  it.each([
    [
      "custom",
      {
        dataModelTypeId: "type-order",
        code: "ORDER",
        name: "Order",
        system: false,
        primitive: false,
      },
      true,
    ],
    [
      "system",
      { dataModelTypeId: "type-customer", code: "CUSTOMER", name: "Customer", system: true },
      false,
    ],
  ])(
    "keeps data-model lifecycle actions available for %s data models",
    (_classification, type, isCustomType) => {
      render(
        <DataModelDetail
          dataModel={model(type)}
          onEdit={vi.fn()}
          onDuplicate={vi.fn()}
          onCreateVersion={vi.fn()}
          onPublish={vi.fn()}
          onEditType={vi.fn()}
          onDeleteType={vi.fn()}
        />
      );

      // System and custom types both get the DataModel-instance-level actions —
      // the backend enforces no classification restriction there (only PUBLISHED
      // status blocks mutation, same for both).
      expect(screen.getByRole("button", { name: /^Edit$/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Duplicate" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "New Version" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();

      // Edit Type / Delete Type call PUT/DELETE /data-model-types/{id}, a
      // *different* endpoint the backend unconditionally rejects for any
      // non-custom type (confirmed live) — these stay custom-only regardless.
      if (isCustomType) {
        expect(screen.getByRole("button", { name: "Edit Type" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Delete Type" })).toBeInTheDocument();
      } else {
        expect(screen.queryByRole("button", { name: "Edit Type" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Delete Type" })).not.toBeInTheDocument();
      }
    }
  );
});

describe("DataModelDetail elements", () => {
  it("lists system-managed elements and marks them System", () => {
    const dataModel = {
      dataModelId: "dm-meta",
      type: { dataModelTypeId: "type-metadata", code: "metadata", name: "Metadata", system: true },
      versionStatus: "DRAFT",
      elements: [
        {
          dataModelElementId: "dme_1",
          name: "Code",
          inputAttribute: "code",
          typeReference: "STRING",
          system: true,
        },
        {
          dataModelElementId: "dme_2",
          name: "Color",
          inputAttribute: "color",
          typeReference: "STRING",
        },
      ],
    } as DataModel;

    render(<DataModelDetail dataModel={dataModel} />);

    expect(screen.getByText("Elements (2)")).toBeInTheDocument();
    expect(screen.getByText("Code").closest("tr")?.textContent).toContain("System");
    expect(screen.getByText("Color").closest("tr")?.textContent).not.toContain("System");
  });

  it("shows a skeleton, not Elements (0), while elements load, and holds Publish", () => {
    render(
      <DataModelDetail
        dataModel={{
          ...model({ dataModelTypeId: "type-metadata", code: "metadata", name: "Metadata" }),
          elements: [],
        }}
        elementsLoading
        onPublish={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Loading elements")).toBeInTheDocument();
    expect(screen.queryByText("Elements (0)")).not.toBeInTheDocument();
    expect(screen.queryByText(/add at least one element/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });
});
