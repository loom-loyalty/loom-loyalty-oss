import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExpressionMigrationNotice } from "./expression-migration-notice";

const cleanExpression = {
  between: { path: "$.x", lowerBound: 0, upperBound: 10, extractValueFromPath: false },
};
const oneCorruptExpression = { between: { path: "$.x", extractValueFromPath: false } };
const twoCorruptExpression = {
  and: {
    children: [
      { between: { path: "$.x", extractValueFromPath: false } },
      { between: { path: "$.y", extractValueFromPath: false } },
    ],
  },
};

describe("ExpressionMigrationNotice", () => {
  it("renders nothing for a clean (new-shape) expression", () => {
    const { container } = render(<ExpressionMigrationNotice expression={cleanExpression} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a null/absent expression", () => {
    const { container } = render(<ExpressionMigrationNotice expression={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("uses singular copy and one list item for a single corrupt node", () => {
    render(<ExpressionMigrationNotice expression={oneCorruptExpression} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/one value needs to be re-entered/i);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("uses plural copy and one list item per issue for multiple corrupt nodes", () => {
    render(<ExpressionMigrationNotice expression={twoCorruptExpression} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/2 values need to be re-entered/i);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
