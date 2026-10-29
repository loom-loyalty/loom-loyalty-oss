import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ExpressionSummary } from "./expression-summary";

const comparison = {
  greaterThan: {
    path: "$.eventData.order.total",
    value: 100,
  },
};

const expressionWithActions = {
  true: {
    actions: [
      { issueProgramCurrency: { defaultResult: 10, programCurrencyCode: "POINTS" } },
      { issueCustomerBadge: { badgeCode: "WELCOME" } },
    ],
  },
};

describe("ExpressionSummary — friendly preview", () => {
  it("renders the tinted confirmation bar and checkmark only in friendly mode", () => {
    const { rerender } = render(
      <ExpressionSummary expression={comparison} label="Preview" friendly />
    );

    expect(screen.getByTestId("friendly-preview")).toHaveClass("bg-muted", "rounded-lg");
    expect(screen.getByLabelText("Structure valid")).toBeInTheDocument();

    rerender(<ExpressionSummary expression={comparison} label="Preview" />);

    expect(screen.queryByTestId("friendly-preview")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Structure valid")).not.toBeInTheDocument();
  });

  it("uses a resolved field name when supplied and retains the breadcrumb fallback otherwise", () => {
    const { rerender } = render(
      <ExpressionSummary
        expression={comparison}
        label="Preview"
        friendly
        resolveFieldName={(path) =>
          path === "$.eventData.order.total" ? "Order total" : undefined
        }
      />
    );

    expect(screen.getByText("Applies when Order total is more than 100.")).toBeInTheDocument();

    rerender(
      <ExpressionSummary
        expression={comparison}
        label="Preview"
        friendly
        resolveFieldName={() => undefined}
      />
    );

    expect(screen.getByText("Applies when Total is more than 100.")).toBeInTheDocument();
  });

  it("shows the incomplete badge instead of valid when isValid is false (Codex review F10 — checkmark rendered unconditionally before this fix)", () => {
    const { rerender } = render(
      <ExpressionSummary expression={comparison} label="Preview" friendly isValid={false} />
    );

    expect(screen.getByLabelText("Structure incomplete")).toBeInTheDocument();
    expect(screen.queryByLabelText("Structure valid")).not.toBeInTheDocument();

    rerender(<ExpressionSummary expression={comparison} label="Preview" friendly isValid />);

    expect(screen.getByLabelText("Structure valid")).toBeInTheDocument();
    expect(screen.queryByLabelText("Structure incomplete")).not.toBeInTheDocument();
  });

  it("keeps the JSON toggle visible and functional in friendly mode", async () => {
    const user = userEvent.setup();
    render(<ExpressionSummary expression={comparison} label="Preview" friendly />);

    await user.click(screen.getByRole("button", { name: "JSON" }));
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "CODE" && element.textContent?.includes('"greaterThan"') === true
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Summary" })).toBeInTheDocument();
  });

  it("renders action preview types as category-accented outline badges", () => {
    render(<ExpressionSummary expression={expressionWithActions} label="Preview" friendly />);

    expect(screen.getByText("2 actions:")).toBeInTheDocument();
    expect(screen.getByText("Issue Currency")).toHaveClass("text-[11px]");
    expect(screen.getByText("Issue Badge")).toHaveClass("text-[11px]");
  });
});

describe("ExpressionSummary — metadata-hierarchy conditions", () => {
  it("summarizes isChildMetadata as '<type> is under <parent type> <code>'", () => {
    render(
      <ExpressionSummary
        label="When"
        expression={{
          isChildMetadata: {
            path: "$.eventData.STORE",
            metadataTypeCode: "STORE",
            parentTypeCode: "REGION",
            parentCode: "WEST",
            directOnly: false,
          },
        }}
      />
    );
    expect(screen.getByText(/Store is under Region WEST/)).toBeInTheDocument();
  });

  it("says 'directly under' when directOnly is set", () => {
    render(
      <ExpressionSummary
        label="When"
        expression={{
          isChildMetadata: {
            path: "$.x",
            metadataTypeCode: "STORE",
            parentTypeCode: "REGION",
            parentCode: "WEST",
            directOnly: true,
          },
        }}
      />
    );
    expect(screen.getByText(/Store is directly under Region WEST/)).toBeInTheDocument();
  });

  it("summarizes isMetadataType and inMetadataGroup", () => {
    const { rerender } = render(
      <ExpressionSummary
        label="When"
        expression={{
          isMetadataType: { path: "$.x", metadataTypeCode: "REGION", metadataCode: "WEST" },
        }}
      />
    );
    expect(screen.getByText(/Region is WEST/)).toBeInTheDocument();

    rerender(
      <ExpressionSummary
        label="When"
        expression={{
          inMetadataGroup: {
            path: "$.x",
            metadataTypeCode: "STORE",
            metadataGroupCode: "FLAGSHIPS",
          },
        }}
      />
    );
    expect(screen.getByText(/Store is in group FLAGSHIPS/)).toBeInTheDocument();
  });

  it("reads as prose in friendly mode", () => {
    render(
      <ExpressionSummary
        label="When"
        friendly
        expression={{
          isChildMetadata: {
            path: "$.x",
            metadataTypeCode: "STORE",
            parentTypeCode: "REGION",
            parentCode: "WEST",
          },
        }}
      />
    );
    expect(screen.getByText(/Applies when Store is under Region WEST\./)).toBeInTheDocument();
  });
});

describe("ExpressionSummary — anniversary (birthday) shape", () => {
  it("reads matchesCurrentDate as 'is today' rather than 'is exactly true'", () => {
    render(
      <ExpressionSummary
        expression={{
          equals: {
            path: "$.birthDate",
            value: true,
            extractValueFromPath: false,
            preOperation: { matchesCurrentDate: { timeZone: "ORGANIZATION" } },
          },
        }}
        label="Preview"
        friendly
        resolveFieldName={() => "Birth date"}
      />
    );

    expect(
      screen.getByText("Applies when Birth date is today (month and day).")
    ).toBeInTheDocument();
  });
});
