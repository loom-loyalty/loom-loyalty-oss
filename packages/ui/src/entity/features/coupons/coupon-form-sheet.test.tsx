import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Hoisted mutable state so individual tests can control the mocked field.
// vi.mock factories are hoisted; use vi.hoisted to share state with them.
const metadataFieldMock = vi.hoisted(() => ({
  fireAsSuggested: false as boolean,
  hookReturn: {
    category: undefined as string | undefined,
    isTypeNotFound: false as boolean,
    findOption: ((_code: string) => undefined) as (code: string) => unknown,
    createMetadata: vi.fn<(data: unknown) => Promise<void>>().mockResolvedValue(undefined),
  },
}));

// Stub MetadataField + useMetadataField; this keeps the sheet hermetic from SDK metadata queries.
vi.mock("../../../forms/metadata-field/index.js", () => ({
  MetadataField: ({
    id,
    typeCode,
    value,
    onValueChange,
  }: {
    id?: string;
    typeCode: string;
    value: string;
    onValueChange: (v: string, isSuggested: boolean) => void;
  }) => (
    <input
      id={id}
      data-widget="metadata-select"
      data-metadata-type={typeCode}
      value={value}
      onChange={(e) => onValueChange(e.target.value, metadataFieldMock.fireAsSuggested)}
    />
  ),
  useMetadataField: () => metadataFieldMock.hookReturn,
}));

vi.mock("../../../forms/offer-field/index.js", () => ({
  OfferField: ({ id, value }: { id?: string; value: string }) => (
    <input id={id} value={value} readOnly />
  ),
}));

import { CouponFormSheet } from "./coupon-form-sheet.js";

function renderSheet() {
  const onSubmit = vi.fn().mockResolvedValue(undefined);

  render(
    <CouponFormSheet
      open
      onOpenChange={vi.fn()}
      mode="create"
      initialData={{ code: "SAVE10", offerId: "offer_123", status: "ACTIVE" }}
      onSubmit={onSubmit}
    />
  );

  return { onSubmit };
}

describe("CouponFormSheet", () => {
  it("renders discount value and currency type fields", () => {
    renderSheet();

    expect(screen.getByLabelText("Discount Value")).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("Discount Currency Type")).toHaveAttribute(
      "data-metadata-type",
      "FIAT_CURRENCY_TYPE"
    );
  });

  it("allows fractional discount values, capped at cents-level precision", () => {
    renderSheet();

    expect(screen.getByLabelText("Discount Value")).toHaveAttribute("step", "0.01");
  });

  it("submits the discount configuration with existing coupon data", async () => {
    const { onSubmit } = renderSheet();

    fireEvent.change(screen.getByLabelText("Discount Value"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Discount Currency Type"), {
      target: { value: "USD" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Coupon" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "SAVE10",
          offerId: "offer_123",
          discountValue: 12,
          discountCurrencyTypeCode: "USD",
        })
      );
    });
  });

  it("leaves the discount configuration undefined when blank", async () => {
    const { onSubmit } = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Create Coupon" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [submittedData] = onSubmit.mock.calls[0]!;
    expect(submittedData).toMatchObject({ code: "SAVE10", offerId: "offer_123" });
    expect(submittedData.discountValue).toBeUndefined();
    expect(submittedData.discountCurrencyTypeCode).toBeUndefined();
  });
});
