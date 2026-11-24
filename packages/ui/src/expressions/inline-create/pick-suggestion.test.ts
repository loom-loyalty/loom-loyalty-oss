import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { pickSuggestion, type SuggestionCandidate } from "./pick-suggestion";

const counter = (id: string, programIds: string[]) => ({ id, programIds, type: "COUNTER" });

describe("pickSuggestion (pickers brief)", () => {
  it("S3: suggests the only fitting candidate on a new rule", () => {
    expect(
      pickSuggestion({
        candidates: [counter("t1", ["p1"]), counter("t2", ["p2"])],
        ruleProgramIds: ["p1"],
        isNew: true,
        listComplete: true,
      })
    ).toBe("t1");
  });

  it("S3: makes no suggestion when two candidates fit", () => {
    expect(
      pickSuggestion({
        candidates: [counter("t1", ["p1"]), counter("t2", ["p1"])],
        ruleProgramIds: ["p1"],
        isNew: true,
        listComplete: true,
      })
    ).toBeUndefined();
  });

  it("S3: applies the caller's fit test", () => {
    expect(
      pickSuggestion({
        candidates: [counter("t1", ["p1"]), { id: "t2", programIds: ["p1"], type: "COMPLETION" }],
        ruleProgramIds: ["p1"],
        isNew: true,
        listComplete: true,
        fits: (candidate) => candidate.type === "COUNTER",
      })
    ).toBe("t1");
  });

  it("S3: suggests the record the sheet was opened from", () => {
    expect(
      pickSuggestion({
        candidates: [counter("e1", []), counter("e2", [])],
        ruleProgramIds: [],
        isNew: true,
        listComplete: true,
        preferredId: "e2",
      })
    ).toBe("e2");
  });

  it("S15: never suggests on an existing rule", () => {
    expect(
      pickSuggestion({
        candidates: [counter("t1", ["p1"])],
        ruleProgramIds: ["p1"],
        isNew: false,
        listComplete: true,
        preferredId: "t1",
      })
    ).toBeUndefined();
  });

  it("S16: never suggests while the list is loading or paged", () => {
    expect(
      pickSuggestion({
        candidates: [counter("t1", ["p1"])],
        ruleProgramIds: ["p1"],
        isNew: true,
        listComplete: false,
      })
    ).toBeUndefined();
  });

  it("S17: with several programs, only a candidate in every program fits", () => {
    expect(
      pickSuggestion({
        candidates: [counter("t1", ["p1"]), counter("t2", ["p1", "p2"])],
        ruleProgramIds: ["p1", "p2"],
        isNew: true,
        listComplete: true,
      })
    ).toBe("t2");
    expect(
      pickSuggestion({
        candidates: [counter("t1", ["p1"]), counter("t3", ["p2"])],
        ruleProgramIds: ["p1", "p2"],
        isNew: true,
        listComplete: true,
      })
    ).toBeUndefined();
  });

  it("S17 property: a suggestion is always in every rule program and is the only such candidate", () => {
    const programs = fc.constantFrom("p1", "p2", "p3");
    const candidate = fc.record({
      id: fc.uuid(),
      programIds: fc.uniqueArray(programs, { maxLength: 3 }),
    });
    fc.assert(
      fc.property(
        fc.uniqueArray(candidate, { selector: (c) => c.id, maxLength: 8 }),
        fc.uniqueArray(programs, { minLength: 1, maxLength: 3 }),
        (candidates, ruleProgramIds) => {
          const picked = pickSuggestion({
            candidates,
            ruleProgramIds,
            isNew: true,
            listComplete: true,
          });
          const fitting = candidates.filter((c) =>
            ruleProgramIds.every((p) => c.programIds.includes(p))
          );
          if (picked === undefined) {
            expect(fitting.length).not.toBe(1);
          } else {
            expect(fitting.map((c) => c.id)).toEqual([picked]);
          }
        }
      )
    );
  });

  it("S20 property: over two organizations, the suggestion only ever comes from the current organization's list", () => {
    // The API scopes lists to the caller's organization; the picker hands
    // pickSuggestion only that list. Whatever the other organization holds,
    // even records with the same programs, the pick stays within the list.
    const record = (org: "A" | "B") =>
      fc.record({
        id: fc.uuid(),
        org: fc.constant(org),
        programIds: fc.uniqueArray(fc.constantFrom("p1", "p2"), { maxLength: 2 }),
      });
    fc.assert(
      fc.property(
        fc.array(record("A"), { maxLength: 6 }),
        fc.array(record("B"), { maxLength: 6 }),
        fc.option(fc.uuid(), { nil: undefined }),
        (orgA, orgB, preferredId) => {
          const listForCurrentOrg: Array<SuggestionCandidate & { org: string }> = orgA;
          const picked = pickSuggestion({
            candidates: listForCurrentOrg,
            ruleProgramIds: ["p1"],
            isNew: true,
            listComplete: true,
            preferredId: preferredId ?? orgB[0]?.id,
          });
          if (picked !== undefined) {
            expect(orgA.some((r) => r.id === picked)).toBe(true);
            expect(orgB.some((r) => r.id === picked && !orgA.some((a) => a.id === picked))).toBe(
              false
            );
          }
        }
      )
    );
  });
});
