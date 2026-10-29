import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Replace the SDK-backed metadata pickers with plain inputs so the components
// render without a QueryClient/network.
vi.mock("../../forms/metadata-type-field/index.js", () => ({
  MetadataTypeField: ({
    id,
    value,
    onValueChange,
    disabled,
  }: {
    id?: string;
    value: string;
    onValueChange: (v: string) => void;
    disabled?: boolean;
  }) => (
    <input
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(e.target.value)}
    />
  ),
}));
vi.mock("../../forms/metadata-field/index.js", () => ({
  MetadataField: ({
    id,
    value,
    onValueChange,
    disabled,
  }: {
    id?: string;
    value: string;
    onValueChange: (v: string, s: boolean) => void;
    disabled?: boolean;
  }) => (
    <input
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(e.target.value, false)}
    />
  ),
}));

import { ExpressionContextProvider } from "../expression-context";
import { ExpressionNode } from "../expression-node";
import {
  InMetadataGroupExpressionComponent,
  IsChildMetadataExpressionComponent,
  IsMetadataTypeExpressionComponent,
} from "./metadata-hierarchy-expression";

const childValue = {
  path: "$.eventData.STORE",
  metadataTypeCode: "STORE",
  parentTypeCode: "REGION",
  parentCode: "WEST",
  directOnly: false,
};

function withProvider(ui: React.ReactNode) {
  return render(<ExpressionContextProvider mode="event">{ui}</ExpressionContextProvider>);
}

describe("IsChildMetadataExpressionComponent", () => {
  it("renders the current type, parent type and parent entry", () => {
    withProvider(
      <IsChildMetadataExpressionComponent value={childValue} onChange={vi.fn()} mode="edit" />
    );
    expect(screen.getByLabelText("Metadata Type")).toHaveValue("STORE");
    expect(screen.getByLabelText("Parent Metadata Type")).toHaveValue("REGION");
    expect(screen.getByLabelText("Parent Metadata Entry")).toHaveValue("WEST");
  });

  it("clears the parent entry when the parent type changes", () => {
    const onChange = vi.fn();
    withProvider(
      <IsChildMetadataExpressionComponent value={childValue} onChange={onChange} mode="edit" />
    );
    fireEvent.change(screen.getByLabelText("Parent Metadata Type"), {
      target: { value: "DISTRICT" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...childValue,
      parentTypeCode: "DISTRICT",
      parentCode: "",
    });
  });

  it("toggles directOnly", () => {
    const onChange = vi.fn();
    withProvider(
      <IsChildMetadataExpressionComponent value={childValue} onChange={onChange} mode="edit" />
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenLastCalledWith({ ...childValue, directOnly: true });
  });

  it("disables the entry picker until a parent type is chosen", () => {
    withProvider(
      <IsChildMetadataExpressionComponent
        value={{ ...childValue, parentTypeCode: "", parentCode: "" }}
        onChange={vi.fn()}
        mode="edit"
      />
    );
    expect(screen.getByLabelText("Parent Metadata Entry")).toBeDisabled();
  });

  it("renders a display line", () => {
    withProvider(
      <IsChildMetadataExpressionComponent value={childValue} onChange={vi.fn()} mode="display" />
    );
    expect(screen.getByText(/STORE under REGION WEST/)).toBeInTheDocument();
  });
});

describe("IsMetadataTypeExpressionComponent", () => {
  it("edits the type and resets the code", () => {
    const onChange = vi.fn();
    const value = {
      path: "$.eventData.STORE",
      metadataTypeCode: "REGION",
      metadataCode: "WEST",
    };
    withProvider(
      <IsMetadataTypeExpressionComponent value={value} onChange={onChange} mode="edit" />
    );
    fireEvent.change(screen.getByLabelText("Metadata Type"), { target: { value: "STORE" } });
    expect(onChange).toHaveBeenLastCalledWith({
      ...value,
      metadataTypeCode: "STORE",
      metadataCode: "",
    });
  });
});

describe("InMetadataGroupExpressionComponent", () => {
  it("edits the group code", () => {
    const onChange = vi.fn();
    const value = { path: "$.x.y", metadataTypeCode: "STORE", metadataGroupCode: "" };
    withProvider(
      <InMetadataGroupExpressionComponent value={value} onChange={onChange} mode="edit" />
    );
    fireEvent.change(screen.getByLabelText("Metadata Group Code"), {
      target: { value: "FLAGSHIPS" },
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...value, metadataGroupCode: "FLAGSHIPS" });
  });
});

describe("ExpressionNode dispatch", () => {
  it("renders the isChildMetadata editor for an isChildMetadata node", () => {
    withProvider(
      <ExpressionNode expression={{ isChildMetadata: childValue }} onChange={vi.fn()} depth={0} />
    );
    expect(screen.getByLabelText("Parent Metadata Entry")).toHaveValue("WEST");
  });
});
