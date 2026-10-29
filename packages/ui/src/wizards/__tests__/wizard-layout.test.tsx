import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WizardStep } from "../types";
import { useWizard } from "../use-wizard";
import { WizardLayout } from "../wizard-layout";
import { WizardProvider } from "../wizard-provider";

const steps: WizardStep[] = [
  { id: "one", title: "Step One" },
  { id: "two", title: "Step Two" },
  { id: "three", title: "Step Three" },
];

// Surfaces nextStep so the test can advance the wizard.
function AdvanceButton() {
  const { nextStep } = useWizard();
  return (
    <button type="button" onClick={() => void nextStep()}>
      advance
    </button>
  );
}

function renderWizard() {
  return render(
    <WizardProvider steps={steps} initialData={{}} onComplete={vi.fn()}>
      <WizardLayout
        stepsSlot={<div data-testid="steps" />}
        contentSlot={
          <div>
            <p data-testid="content">step body</p>
            <AdvanceButton />
          </div>
        }
        title="Wizard"
      />
    </WizardProvider>
  );
}

describe("WizardLayout scroll-to-top", () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    // Default: motion allowed.
    (window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })
    );
  });

  it("does not scroll on initial mount", () => {
    const scrollSpy = Element.prototype.scrollTo as unknown as ReturnType<typeof vi.fn>;
    scrollSpy.mockClear();
    renderWizard();
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  // Regression: useReducedMotion's async state update used to retrigger the
  // scroll effect (its deps included prefersReducedMotion), spending the
  // hasMountedRef guard before mount completed and snapping reduced-motion
  // users to top on every initial render.
  it("does not scroll on mount when prefers-reduced-motion flips on after first paint", async () => {
    (window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })
    );

    const scrollSpy = Element.prototype.scrollTo as unknown as ReturnType<typeof vi.fn>;
    scrollSpy.mockClear();

    await act(async () => {
      renderWizard();
    });

    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("scrolls the content container to top when step advances", async () => {
    renderWizard();
    const advance = screen.getByRole("button", { name: "advance" });

    const scrollSpy = Element.prototype.scrollTo as unknown as ReturnType<typeof vi.fn>;
    scrollSpy.mockClear();

    await act(async () => {
      advance.click();
    });

    expect(scrollSpy).toHaveBeenCalled();
    const calls = scrollSpy.mock.calls as Array<[ScrollToOptions]>;
    const lastCall = calls[calls.length - 1]?.[0];
    expect(lastCall).toMatchObject({ top: 0 });
    expect(lastCall?.behavior).toBe("smooth");
  });

  it("uses instant scroll when prefers-reduced-motion is set", async () => {
    (window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })
    );

    renderWizard();
    const advance = screen.getByRole("button", { name: "advance" });

    const scrollSpy = Element.prototype.scrollTo as unknown as ReturnType<typeof vi.fn>;
    scrollSpy.mockClear();

    await act(async () => {
      advance.click();
    });

    const calls = scrollSpy.mock.calls as Array<[ScrollToOptions]>;
    const lastCall = calls[calls.length - 1]?.[0];
    expect(lastCall).toMatchObject({ top: 0 });
    expect(lastCall?.behavior).toBe("instant");
  });
});
