import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { IdentifierList } from "../identifier-list";
import type { CustomerIdentifier } from "../types";

const identifier: CustomerIdentifier = {
  identifierId: "identifier-1",
  typeCode: "MEMBER_ID",
  typeName: "Member ID",
  value: "member-12345",
  status: "ACTIVE",
  createdDateTime: "2026-01-01T00:00:00Z",
};

describe("IdentifierList sensitive value", () => {
  it("masks the identifier until it is revealed", async () => {
    const user = userEvent.setup();
    const { container } = render(<IdentifierList identifiers={[identifier]} />);

    expect(
      container.querySelector('[data-widget="masked-field"][data-sensitive="true"]')
    ).not.toBeNull();
    expect(screen.queryByText(identifier.value)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reveal identifier" }));

    expect(screen.getByText(identifier.value)).toBeInTheDocument();
  });
});
