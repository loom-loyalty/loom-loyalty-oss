import { describe, expect, it } from "vitest";

import { validateForm } from "./metadata-create-sheet";

describe("[audit] metadata-create-sheet validateForm — trim-aware length", () => {
  it("does not flag whitespace-only descriptions (stripEmpty would drop them)", () => {
    const errors = validateForm(
      { name: "x", code: "x", description: { en: "ok", es: "   ".repeat(200) } },
      "METADATA"
    );
    expect(errors.description).toBeUndefined();
  });

  it("does not flag whitespace-padded content under 500 trimmed characters", () => {
    const padded = "   " + "a".repeat(495) + "   ";
    expect(padded.length).toBeGreaterThan(500);
    expect(padded.trim().length).toBeLessThanOrEqual(500);
    const errors = validateForm({ name: "x", code: "x", description: { en: padded } }, "METADATA");
    expect(errors.description).toBeUndefined();
  });

  it("flags content where trimmed length exceeds 500", () => {
    const errors = validateForm(
      { name: "x", code: "x", description: { en: "a".repeat(501) } },
      "METADATA"
    );
    expect(errors.description).toBeDefined();
  });

  it("flags whitespace-padded content where trimmed length exceeds 500", () => {
    const errors = validateForm(
      { name: "x", code: "x", description: { en: "   " + "a".repeat(501) + "   " } },
      "METADATA"
    );
    expect(errors.description).toBeDefined();
  });
});
