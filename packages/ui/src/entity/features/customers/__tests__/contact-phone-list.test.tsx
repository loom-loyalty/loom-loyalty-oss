import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ContactPhoneList } from "../contact-phone-list";
import type { ContactPhone } from "../types";

const phone: ContactPhone = {
  id: "phone-1",
  number: "+1 312 555 0100",
  extension: "123",
  typeCode: "WORK",
  typeName: "Work",
  primary: false,
  status: "ACTIVE",
};

describe("ContactPhoneList sensitive value", () => {
  it("masks the phone number and extension until they are revealed", async () => {
    const user = userEvent.setup();
    const { container } = render(<ContactPhoneList phones={[phone]} />);

    expect(
      container.querySelector('[data-widget="masked-field"][data-sensitive="true"]')
    ).not.toBeNull();
    expect(screen.queryByText(phone.number)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reveal phone number" }));

    expect(screen.getByText(`${phone.number} ext. ${phone.extension}`)).toBeInTheDocument();
  });
});
