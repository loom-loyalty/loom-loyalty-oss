import type { UIFieldConfig } from "@loom-loyalty/schema";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../forms/metadata-field/metadata-field", () => ({
  MetadataField: ({
    onValueChange,
  }: {
    onValueChange: (value: string, isSuggested: boolean) => void;
  }) => (
    <button type="button" data-testid="probe" onClick={() => onValueChange("PROBE_VALUE", true)}>
      probe
    </button>
  ),
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

describe("[audit] EntityField metadata-select forwards isSuggested", () => {
  it("meta.isSuggested=true reaches consumer onChange when suggested option picked", () => {
    const onChange = vi.fn();
    const field: UIFieldConfig = {
      ...baseField,
      widget: "metadata-select",
      metadataType: "FIAT_CURRENCY_TYPE",
    };
    const { getByTestId } = render(
      <EntityField field={field} value="" mode="edit" onChange={onChange} />
    );
    getByTestId("probe").click();
    expect(onChange).toHaveBeenCalledWith("PROBE_VALUE", { isSuggested: true });
  });
});
