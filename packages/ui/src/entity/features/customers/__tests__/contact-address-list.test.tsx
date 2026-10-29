import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ContactAddressList } from "../contact-address-list";
import type { ContactAddress } from "../types";

const address: ContactAddress = {
  id: "address-1",
  addressLine1: "123 Main Street",
  addressLine2: "Suite 400",
  cityLocality: "Chicago",
  stateProvinceRegion: "IL",
  postalCode: "60601",
  countryCode: "US",
  typeCode: "WORK",
  typeName: "Work",
  primary: false,
  status: "ACTIVE",
};

describe("ContactAddressList sensitive value", () => {
  it("masks the postal address until it is revealed", async () => {
    const user = userEvent.setup();
    const { container } = render(<ContactAddressList addresses={[address]} />);

    expect(
      container.querySelector('[data-widget="masked-field"][data-sensitive="true"]')
    ).not.toBeNull();
    expect(screen.queryByText(address.addressLine1)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reveal postal address" }));

    expect(screen.getByText(address.addressLine1)).toBeInTheDocument();
    expect(screen.getByText("Chicago, IL 60601")).toBeInTheDocument();
  });
});
