import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Mock @openuidev/react-lang — needed because defineOpenUIComponent calls defineComponent at import time
vi.mock("@openuidev/react-lang", () => ({
  defineComponent: (config: Record<string, unknown>) => ({
    ...config,
    ref: z.any(),
  }),
  useFormName: () => "test-form",
  useGetFieldValue: () => () => "",
  useSetFieldValue: () => vi.fn(),
  useSetDefaultValue: vi.fn(),
  useTriggerAction: () => vi.fn(),
  FormNameContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
  },
}));

import { FormGroup } from "../components/forms/form-group";
import { NumberInput } from "../components/forms/number-input";
import { TextInput } from "../components/forms/text-input";

const renderNode = (value: unknown) => <span data-testid="child">{String(value)}</span>;

describe("FormGroup", () => {
  const Component = FormGroup.component;

  it("renders a form with submit button", () => {
    render(
      <Component
        props={{ name: "my-form", submitAction: "save", children: ["field1"] }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByRole("form")).toHaveAttribute("aria-label", "my-form");
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("renders custom submit label", () => {
    render(
      <Component
        props={{ name: "form", submitAction: "save", submitLabel: "Save Changes", children: [] }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
  });

  it("renders children inside the form", () => {
    render(
      <Component
        props={{ name: "form", submitAction: "save", children: ["a", "b"] }}
        renderNode={renderNode}
      />
    );
    expect(screen.getAllByTestId("child")).toHaveLength(2);
  });
});

describe("TextInput", () => {
  const Component = TextInput.component;

  it("renders label and input", () => {
    render(
      <Component props={{ label: "Email", name: "email", type: "email" }} renderNode={renderNode} />
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("type", "email");
  });

  it("renders required indicator", () => {
    render(
      <Component props={{ label: "Name", name: "name", required: true }} renderNode={renderNode} />
    );
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("renders helpText with aria-describedby", () => {
    render(
      <Component
        props={{ label: "URL", name: "url", helpText: "Enter a valid URL" }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByText("Enter a valid URL")).toBeInTheDocument();
    const input = screen.getByRole("textbox");
    const helpId = input.getAttribute("aria-describedby");
    expect(helpId).toBeTruthy();
    expect(screen.getByText("Enter a valid URL").id).toBe(helpId);
  });

  it("does not render aria-describedby when no helpText", () => {
    render(<Component props={{ label: "Plain", name: "plain" }} renderNode={renderNode} />);
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-describedby");
  });
});

describe("NumberInput", () => {
  const Component = NumberInput.component;

  it("renders label and number input", () => {
    render(<Component props={{ label: "Amount", name: "amount" }} renderNode={renderNode} />);
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toHaveAttribute("type", "number");
  });

  it("renders helpText with aria-describedby", () => {
    render(
      <Component
        props={{ label: "Points", name: "points", helpText: "Minimum 100 points" }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByText("Minimum 100 points")).toBeInTheDocument();
    const input = screen.getByRole("spinbutton");
    const helpId = input.getAttribute("aria-describedby");
    expect(helpId).toBeTruthy();
    expect(screen.getByText("Minimum 100 points").id).toBe(helpId);
  });

  it("applies min, max, step constraints", () => {
    render(
      <Component
        props={{ label: "Score", name: "score", min: 0, max: 100, step: 5 }}
        renderNode={renderNode}
      />
    );
    const input = screen.getByRole("spinbutton");
    expect(input).toHaveAttribute("min", "0");
    expect(input).toHaveAttribute("max", "100");
    expect(input).toHaveAttribute("step", "5");
  });
});
