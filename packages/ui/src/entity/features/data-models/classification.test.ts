import type { DataModel, DataModelType } from "@loom-loyalty/sdk";
import { describe, expect, it } from "vitest";

import { canDeleteDataModel, canEditDataModel, getTypeClassification } from "./classification.js";

function type(overrides: Partial<DataModelType> = {}): DataModelType {
  return {
    dataModelTypeId: "dmt_test_string_classification",
    code: "STRING",
    name: "String",
    ...overrides,
  };
}

function model(typeOverrides: Partial<DataModelType> | undefined): DataModel {
  return {
    dataModelId: "dm-1",
    type: typeOverrides ? type(typeOverrides) : undefined,
  } as DataModel;
}

// ---------------------------------------------------------------------------
// getTypeClassification
// ---------------------------------------------------------------------------
describe("getTypeClassification", () => {
  it("returns 'primitive' when type.primitive is true", () => {
    expect(getTypeClassification(type({ primitive: true }))).toBe("primitive");
  });

  it("returns 'system' when type.system is true and primitive is false", () => {
    expect(getTypeClassification(type({ system: true }))).toBe("system");
  });

  it("returns 'custom' when both primitive and system are false", () => {
    expect(getTypeClassification(type({ primitive: false, system: false }))).toBe("custom");
  });

  it("returns 'custom' when the flags are undefined", () => {
    expect(getTypeClassification(type())).toBe("custom");
  });

  it("prefers 'primitive' over 'system' when both are set", () => {
    // Should never happen on the server, but guard against garbage input.
    expect(getTypeClassification(type({ primitive: true, system: true }))).toBe("primitive");
  });

  it("returns 'custom' when type is undefined", () => {
    expect(getTypeClassification(undefined)).toBe("custom");
  });

  it("returns 'custom' when type is null", () => {
    expect(getTypeClassification(null)).toBe("custom");
  });
});

// ---------------------------------------------------------------------------
// canEditDataModel
// ---------------------------------------------------------------------------
describe("canEditDataModel", () => {
  it("returns true for custom types", () => {
    expect(canEditDataModel(model({ primitive: false, system: false }))).toBe(true);
  });

  it("returns true for system types", () => {
    expect(canEditDataModel(model({ system: true }))).toBe(true);
  });

  it("returns false for primitive types", () => {
    expect(canEditDataModel(model({ primitive: true }))).toBe(false);
  });

  it("returns true when type is missing (defaults to custom)", () => {
    expect(canEditDataModel(model(undefined))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canDeleteDataModel
// ---------------------------------------------------------------------------
describe("canDeleteDataModel", () => {
  it("returns true for custom types", () => {
    expect(canDeleteDataModel(model({ primitive: false, system: false }))).toBe(true);
  });

  it("returns false for system types", () => {
    expect(canDeleteDataModel(model({ system: true }))).toBe(false);
  });

  it("returns false for primitive types", () => {
    expect(canDeleteDataModel(model({ primitive: true }))).toBe(false);
  });
});
