import type { DataModelElement } from "@loom-loyalty/sdk";
import { describe, expect, it } from "vitest";

import { planElementOperations } from "./element-changes";
import { elementToFormData } from "./types";

const SYSTEM: DataModelElement = {
  dataModelElementId: "dme_sys",
  name: "Code",
  inputAttribute: "code",
  outputAttribute: "code",
  typeReference: "STRING",
  system: true,
};
const CUSTOM: DataModelElement = {
  dataModelElementId: "dme_custom",
  name: "Color",
  inputAttribute: "color",
  outputAttribute: "color",
  typeReference: "STRING",
  description: { en: "Brand color" },
};

describe("planElementOperations", () => {
  it("plans nothing when the rows match the saved elements", () => {
    const rows = [SYSTEM, CUSTOM].map(elementToFormData);
    expect(planElementOperations([SYSTEM, CUSTOM], rows)).toEqual([]);
  });

  it("never updates or deletes system elements", () => {
    const sysRow = { ...elementToFormData(SYSTEM), name: "Renamed" };
    expect(planElementOperations([SYSTEM], [sysRow])).toEqual([]);
    expect(planElementOperations([SYSTEM], [])).toEqual([]);
  });

  it("updates a changed custom element and keeps fields the form doesn't edit", () => {
    const row = { ...elementToFormData(CUSTOM), required: true };
    const ops = planElementOperations([CUSTOM], [row]);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      kind: "update",
      elementId: "dme_custom",
      data: { name: "Color", required: true, description: { en: "Brand color" } },
    });
  });

  it("orders deletes before creates so a removed attribute can be re-added", () => {
    const ops = planElementOperations(
      [CUSTOM],
      [{ name: "Color", inputAttribute: "color", typeCode: "NUMBER", _rowKey: "r1" }]
    );
    expect(ops.map((op) => op.kind)).toEqual(["delete", "create"]);
  });
});
