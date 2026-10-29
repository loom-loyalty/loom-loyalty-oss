// Basic render/interaction coverage for RegisterTargetActionComponent (no test
// file existed previously). Also covers the eventRuleCode -> eventRuleName
// field-name fix: the backend's real DTO field is `eventRuleName`, not
// `eventRuleCode` (packages/schema/src/expressions/actions.ts).

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

interface FieldProps {
  value: string;
  onValueChange: (id: string) => void;
}

let targetField: FieldProps | null = null;
let programField: FieldProps | null = null;
let eventRuleField: FieldProps | null = null;

vi.mock("../../forms/target-field/index.js", () => ({
  TargetField: (p: FieldProps) => {
    targetField = p;
    return null;
  },
}));

vi.mock("../../forms/program-field/index.js", () => ({
  ProgramField: (p: FieldProps) => {
    programField = p;
    return null;
  },
}));

vi.mock("../../forms/event-rule-field/index.js", () => ({
  EventRuleField: (p: FieldProps) => {
    eventRuleField = p;
    return null;
  },
}));

const TARGETS = [{ targetId: "target-uuid-1", code: "T1" }];
const PROGRAMS = [{ programId: "program-uuid-1", code: "LOYALTY_A" }];
const EVENT_RULES = [
  { eventRuleId: "rule-uuid-1", code: "SPEND_500", name: "Spend $500 Challenge" },
];

vi.mock("../../forms/target-field/use-target-field.js", () => ({
  useTargetField: () => ({
    targets: TARGETS,
    findTarget: (id: string) => TARGETS.find((t) => t.targetId === id),
  }),
}));

vi.mock("../../forms/program-field/use-program-field.js", () => ({
  useProgramField: () => ({
    programs: PROGRAMS,
    findProgram: (id: string) => PROGRAMS.find((p) => p.programId === id),
  }),
}));

vi.mock("../../forms/event-rule-field/use-event-rule-field.js", () => ({
  useEventRuleField: () => ({
    eventRules: EVENT_RULES,
    findEventRule: (id: string) => EVENT_RULES.find((r) => r.eventRuleId === id),
  }),
}));

const { RegisterTargetActionComponent } = await import("./register-target-action");

function renderWith(value: Record<string, unknown>) {
  targetField = null;
  programField = null;
  eventRuleField = null;
  const handleChange = vi.fn();
  render(<RegisterTargetActionComponent value={value as never} onChange={handleChange} />);
  return handleChange;
}

describe("RegisterTargetActionComponent", () => {
  it("renders target, program, and event rule selectors", () => {
    renderWith({});
    expect(targetField).not.toBeNull();
    expect(programField).not.toBeNull();
    expect(eventRuleField).not.toBeNull();
  });

  it("selecting an event rule sets eventRuleName (not eventRuleCode) from the rule's name", () => {
    const handleChange = renderWith({});
    eventRuleField!.onValueChange("rule-uuid-1");
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        eventRuleId: "rule-uuid-1",
        eventRuleName: "Spend $500 Challenge",
      })
    );
    const calledWith = handleChange.mock.calls[0]?.[0];
    expect(calledWith).not.toHaveProperty("eventRuleCode");
  });

  it("clearing the event rule selection leaves eventRuleId and eventRuleName unset", () => {
    const handleChange = renderWith({
      eventRuleId: "rule-uuid-1",
      eventRuleName: "Spend $500 Challenge",
    });
    eventRuleField!.onValueChange("");
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ eventRuleId: undefined, eventRuleName: undefined })
    );
  });

  it("selecting a target sets targetId and targetCode", () => {
    const handleChange = renderWith({});
    targetField!.onValueChange("target-uuid-1");
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: "target-uuid-1", targetCode: "T1" })
    );
  });

  it("selecting a program sets programId and programCode", () => {
    const handleChange = renderWith({});
    programField!.onValueChange("program-uuid-1");
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ programId: "program-uuid-1", programCode: "LOYALTY_A" })
    );
  });
});
