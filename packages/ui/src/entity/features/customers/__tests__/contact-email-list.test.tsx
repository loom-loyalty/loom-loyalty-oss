import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ContactEmailList } from "../contact-email-list";
import type { ContactEmail } from "../types";

const email: ContactEmail = {
  id: "email-1",
  emailAddress: "private@example.com",
  typeCode: "HOME",
  typeName: "Home",
  primary: false,
  status: "ACTIVE",
  verified: true,
};

describe("ContactEmailList sensitive value", () => {
  it("masks the email address until it is revealed", async () => {
    const user = userEvent.setup();
    const { container } = render(<ContactEmailList emails={[email]} />);

    expect(
      container.querySelector('[data-widget="masked-field"][data-sensitive="true"]')
    ).not.toBeNull();
    expect(screen.queryByText(email.emailAddress)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reveal email address" }));

    expect(screen.getByText(email.emailAddress)).toBeInTheDocument();
  });
});
