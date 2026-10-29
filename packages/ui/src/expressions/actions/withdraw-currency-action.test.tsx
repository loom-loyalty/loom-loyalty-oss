// Regression test for the program/currency mismatch: ProgramCurrencyField is
// scoped to the selected program, so changing the program must clear a
// previously-chosen currency instead of silently keeping a code that may not
// belong to the new program (Codex adversarial review finding).

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

interface ProgramFieldProps {
  value: string;
  onValueChange: (id: string) => void;
}
let programField: ProgramFieldProps | null = null;

vi.mock("../../forms/program-field/index.js", () => ({
  ProgramField: (p: ProgramFieldProps) => {
    programField = p;
    return null;
  },
}));

vi.mock("../../forms/program-currency-field/index.js", () => ({
  ProgramCurrencyField: () => null,
}));

const PROGRAMS = [
  { programId: "program-uuid-1", code: "LOYALTY_A" },
  { programId: "program-uuid-2", code: "LOYALTY_B" },
];

vi.mock("../../forms/program-field/use-program-field.js", () => ({
  useProgramField: () => ({
    programs: PROGRAMS,
    findProgram: (id: string) => PROGRAMS.find((p) => p.programId === id),
  }),
}));

const { WithdrawCurrencyActionComponent } = await import("./withdraw-currency-action");

describe("WithdrawCurrencyActionComponent — program change clears currency", () => {
  it("clears programCurrencyCode when the program changes", () => {
    const handleChange = vi.fn();
    render(
      <WithdrawCurrencyActionComponent
        value={
          {
            defaultResult: 0,
            isFixedAmount: true,
            programCode: "LOYALTY_A",
            programCurrencyCode: "POINTS",
          } as never
        }
        onChange={handleChange}
      />
    );

    programField!.onValueChange("program-uuid-2");

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        programId: "program-uuid-2",
        programCode: "LOYALTY_B",
        programCurrencyCode: undefined,
      })
    );
  });
});
