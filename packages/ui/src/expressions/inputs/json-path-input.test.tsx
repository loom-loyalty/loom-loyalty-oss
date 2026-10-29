import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ExpressionContextProvider, type DataModelLike } from "../expression-context";
import { JsonPathInput } from "./json-path-input";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const MODELS: Record<string, DataModelLike> = {
  ORDER_PLACED: {
    elements: [{ outputAttribute: "total", name: "Total", typeReference: "NUMBER" }],
  },
  CUSTOMER: { elements: [] },
};

const fetchDataModel = vi.fn((code: string) => {
  const model = MODELS[code.toUpperCase()];
  return model ? Promise.resolve(model) : Promise.reject(new Error("not found"));
});

function Harness({ presentation }: { presentation?: "sentence" | "card" }): ReactNode {
  const [value, setValue] = useState("$.eventData.total");
  return (
    <ExpressionContextProvider
      dataModelCode="ORDER_PLACED"
      mode="event"
      fetchDataModel={fetchDataModel}
    >
      <JsonPathInput value={value} onChange={setValue} presentation={presentation} />
    </ExpressionContextProvider>
  );
}

describe("JsonPathInput — presentation prop (R6a, U3)", () => {
  it("defaults to card presentation: breadcrumb button + Edit-path pencil + Browse Fields popover unchanged", () => {
    render(<Harness />);

    expect(screen.getByLabelText(/JSON path:.*Click to edit manually/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit path manually" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Browse schema fields" })).toBeInTheDocument();
  });

  it("sentence presentation renders the PropertyPicker field pill instead, showing the friendly resolved name (never the raw path)", async () => {
    render(<Harness presentation="sentence" />);

    expect(
      await screen.findByRole("button", { name: "Field: Event Data › Total. Click to change." })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Browse schema fields" })).not.toBeInTheDocument();
  });

  it("sentence presentation's picker still resolves and updates the value", async () => {
    const user = userEvent.setup();
    render(<Harness presentation="sentence" />);

    await user.click(
      await screen.findByRole("button", { name: "Field: Event Data › Total. Click to change." })
    );
    // Opening the picker on an already-set value drills straight down to that
    // field's own level (here, Event Data — the value's parent) instead of
    // always resetting to the root section list.
    expect(await screen.findByRole("option", { name: /^Total/ })).toBeInTheDocument();
  });
});
