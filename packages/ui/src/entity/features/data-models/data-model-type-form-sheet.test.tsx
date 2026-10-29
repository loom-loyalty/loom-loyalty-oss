import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataModelTypeFormSheet } from "./data-model-type-form-sheet";

describe("DataModelTypeFormSheet", () => {
  it("sends the parent as parentDataModelTypeCode, the field the platform binds", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <DataModelTypeFormSheet open onOpenChange={vi.fn()} mode="create" onSubmit={onSubmit} />
    );

    fireEvent.change(screen.getByLabelText(/name/i, { selector: "#dmt-name" }), {
      target: { value: "Store visit" },
    });
    fireEvent.change(screen.getByLabelText(/parent type/i), { target: { value: "custom-event" } });
    fireEvent.click(screen.getByRole("button", { name: /create data model type/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const body = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    // The generated `parentTypeReference` request field is silently ignored by
    // the API, which leaves the type parentless (#1116).
    expect(body).toMatchObject({ parentDataModelTypeCode: "custom-event" });
    expect(body).not.toHaveProperty("parentTypeReference");
  });
});
