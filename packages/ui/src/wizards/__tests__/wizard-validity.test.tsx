import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { WizardStep } from "../types";
import { useWizard } from "../use-wizard";
import { WizardNavigation } from "../wizard-navigation";
import { WizardProvider } from "../wizard-provider";

const validateRequiresName = (data: unknown) => {
  const d = data as { name?: string };
  if (!d.name?.trim()) {
    return { valid: false, errors: { name: "Name is required" } };
  }
  return { valid: true };
};

const steps: WizardStep[] = [
  { id: "one", title: "Step One", validate: validateRequiresName },
  { id: "two", title: "Step Two" },
];

function CurrentValidityProbe() {
  const { currentStepIsValid } = useWizard();
  return <span data-testid="valid-flag">{currentStepIsValid ? "valid" : "invalid"}</span>;
}

describe("currentStepIsValid + Next button gating", () => {
  it("exposes currentStepIsValid=false when the current step validator fails", () => {
    render(
      <WizardProvider steps={steps} initialData={{ name: "" }} onComplete={vi.fn()}>
        <CurrentValidityProbe />
      </WizardProvider>
    );
    expect(screen.getByTestId("valid-flag").textContent).toBe("invalid");
  });

  it("exposes currentStepIsValid=true when the current step validator passes", () => {
    render(
      <WizardProvider steps={steps} initialData={{ name: "Bob" }} onComplete={vi.fn()}>
        <CurrentValidityProbe />
      </WizardProvider>
    );
    expect(screen.getByTestId("valid-flag").textContent).toBe("valid");
  });

  it("treats a step with no validator as valid", () => {
    const stepsNoValidator: WizardStep[] = [{ id: "only", title: "Only" }];
    render(
      <WizardProvider steps={stepsNoValidator} initialData={{}} onComplete={vi.fn()}>
        <CurrentValidityProbe />
      </WizardProvider>
    );
    expect(screen.getByTestId("valid-flag").textContent).toBe("valid");
  });

  it("treats a step whose validator throws as invalid (fails closed)", () => {
    const stepsThrow: WizardStep[] = [
      {
        id: "bad",
        title: "Bad",
        validate: () => {
          throw new Error("boom");
        },
      },
    ];
    render(
      <WizardProvider steps={stepsThrow} initialData={{}} onComplete={vi.fn()}>
        <CurrentValidityProbe />
      </WizardProvider>
    );
    expect(screen.getByTestId("valid-flag").textContent).toBe("invalid");
  });

  it("treats a step with an async validator as valid (Promise fallback)", () => {
    const stepsAsync: WizardStep[] = [
      {
        id: "async",
        title: "Async",
        validate: () => Promise.resolve({ valid: false, errors: { x: "x" } }),
      },
    ];
    render(
      <WizardProvider steps={stepsAsync} initialData={{}} onComplete={vi.fn()}>
        <CurrentValidityProbe />
      </WizardProvider>
    );
    expect(screen.getByTestId("valid-flag").textContent).toBe("valid");
  });

  it("disables the Next button when current step is invalid", () => {
    render(
      <WizardProvider steps={steps} initialData={{ name: "" }} onComplete={vi.fn()}>
        <WizardNavigation />
      </WizardProvider>
    );
    const nextBtn = screen.getByRole("button", { name: /Continue/i });
    expect(nextBtn).toBeDisabled();
  });

  it("enables the Next button when current step is valid", () => {
    render(
      <WizardProvider steps={steps} initialData={{ name: "Bob" }} onComplete={vi.fn()}>
        <WizardNavigation />
      </WizardProvider>
    );
    const nextBtn = screen.getByRole("button", { name: /Continue/i });
    expect(nextBtn).toBeEnabled();
  });

  it("hides the final completion button when the step owns completion", () => {
    const customCompletionStep: WizardStep[] = [
      { id: "custom-completion", title: "Custom Completion", hideCompleteButton: true },
    ];

    render(
      <WizardProvider steps={customCompletionStep} initialData={{}} onComplete={vi.fn()}>
        <WizardNavigation />
      </WizardProvider>
    );

    expect(screen.queryByRole("button", { name: /complete setup/i })).not.toBeInTheDocument();
  });
});
