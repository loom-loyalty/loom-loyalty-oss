/**
 * Eval corpus for the UPDATE-mode delta classifier.
 *
 * Unlike the freeform-extractor eval (LLM-backed, gated on
 * ANTHROPIC_API_KEY), this corpus runs entirely offline — the
 * classifier is a pure function and the fixtures are hand-authored
 * before/after pairs. Always-on; the corpus IS the contract.
 *
 * Each fixture lives in its own subdirectory under
 * `__fixtures__/templates/eval/update-mode/<name>/` and has three
 * files:
 *   - `before.md` — the program's prior state (what /program-state would hydrate)
 *   - `after.md` — the user's uploaded template (the new spec)
 *   - `expected-classification.json` — the DeltaClassification shape
 *
 * The harness parses both .md files via `markdownFormat.parse`, runs
 * `classifyDelta(beforeSpec, afterSpec)`, and asserts the result
 * matches the expected shape. Field-level details (the `details`
 * string on safe deltas, the `reason` on breaking/dataLoss) are NOT
 * compared — they're human-readable copy that may evolve. We compare
 * the structural identity: kind + entity.{type,code} + (for breaking)
 * field name.
 *
 * To add a new fixture: create the subdirectory, drop the three
 * files, and the harness picks it up on next run. No code change.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { ProgramSpec } from "../spec.js";
import { markdownFormat } from "./markdown.js";
import type {
  BreakingDelta,
  DataLossDelta,
  DeltaClassification,
  SafeDelta,
} from "./update-delta.js";
import { classifyDelta } from "./update-delta.js";

const EVAL_DIR = resolve(__dirname, "../../__fixtures__/templates/eval/update-mode");

interface ExpectedSafeDelta {
  kind: "add" | "modify-cosmetic";
  entity: { type: string; code: string };
}
interface ExpectedBreakingDelta {
  kind: "modify";
  entity: { type: string; code: string };
  field: string;
}
interface ExpectedDataLossDelta {
  kind: "remove";
  entity: { type: string; code: string };
}
interface ExpectedClassification {
  description?: string;
  safe: ExpectedSafeDelta[];
  breaking: ExpectedBreakingDelta[];
  dataLoss: ExpectedDataLossDelta[];
}

interface Fixture {
  name: string;
  beforeBytes: Uint8Array;
  afterBytes: Uint8Array;
  expected: ExpectedClassification;
}

function loadFixtures(): Fixture[] {
  const out: Fixture[] = [];
  for (const entry of readdirSync(EVAL_DIR)) {
    const dir = join(EVAL_DIR, entry);
    if (!statSync(dir).isDirectory()) continue;
    const beforePath = join(dir, "before.md");
    const afterPath = join(dir, "after.md");
    const expectedPath = join(dir, "expected-classification.json");
    out.push({
      name: entry,
      beforeBytes: new Uint8Array(readFileSync(beforePath)),
      afterBytes: new Uint8Array(readFileSync(afterPath)),
      expected: JSON.parse(readFileSync(expectedPath, "utf8")) as ExpectedClassification,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Compare two delta lists by structural identity. Order-insensitive
 * within a bucket — the classifier emits adds/removes from a Map
 * iteration whose order is insertion-dependent on the parsed spec,
 * not a stable contract.
 */
function shapesEqual(
  actual: SafeDelta[] | BreakingDelta[] | DataLossDelta[],
  expected: ExpectedSafeDelta[] | ExpectedBreakingDelta[] | ExpectedDataLossDelta[],
  bucket: "safe" | "breaking" | "dataLoss"
): { ok: true } | { ok: false; reason: string } {
  if (actual.length !== expected.length) {
    return {
      ok: false,
      reason: `${bucket}: expected ${expected.length} delta(s), got ${actual.length}. actual=${JSON.stringify(actual.map(simplify))}`,
    };
  }
  // Build a multiset of "id strings" for each side and compare.
  const toKey = (d: { kind: string; entity: { type: string; code: string }; field?: string }) =>
    `${d.kind}|${d.entity.type}|${d.entity.code}|${d.field ?? ""}`;
  const expectedKeys = expected.map(toKey).sort();
  const actualKeys = (
    actual as Array<{ kind: string; entity: { type: string; code: string }; field?: string }>
  )
    .map(toKey)
    .sort();
  for (let i = 0; i < expectedKeys.length; i++) {
    if (expectedKeys[i] !== actualKeys[i]) {
      return {
        ok: false,
        reason: `${bucket} mismatch: expected=${expectedKeys.join(",")} actual=${actualKeys.join(",")}`,
      };
    }
  }
  return { ok: true };
}

function simplify(d: SafeDelta | BreakingDelta | DataLossDelta) {
  return {
    kind: d.kind,
    entity: { type: d.entity.type, code: d.entity.code },
    ...("field" in d && d.field ? { field: d.field } : {}),
  };
}

describe("update-delta classifier corpus eval (10 paired before/after fixtures)", () => {
  const fixtures = loadFixtures();

  // Ensure the corpus didn't shrink — guards against an accidental fixture
  // delete that would silently reduce coverage.
  it("loads at least 10 fixtures", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
  });

  for (const fixture of fixtures) {
    it(`${fixture.name}: classifyDelta matches expected shape`, async () => {
      const beforeParse = await markdownFormat.parse(fixture.beforeBytes);
      const afterParse = await markdownFormat.parse(fixture.afterBytes);
      const beforeSpec = beforeParse.partial as ProgramSpec;
      const afterSpec = afterParse.partial as ProgramSpec;

      const actual: DeltaClassification = classifyDelta(beforeSpec, afterSpec);

      const safeCheck = shapesEqual(actual.safe, fixture.expected.safe, "safe");
      expect(safeCheck.ok, safeCheck.ok ? "" : safeCheck.reason).toBe(true);

      const breakingCheck = shapesEqual(actual.breaking, fixture.expected.breaking, "breaking");
      expect(breakingCheck.ok, breakingCheck.ok ? "" : breakingCheck.reason).toBe(true);

      const dataLossCheck = shapesEqual(actual.dataLoss, fixture.expected.dataLoss, "dataLoss");
      expect(dataLossCheck.ok, dataLossCheck.ok ? "" : dataLossCheck.reason).toBe(true);
    });
  }
});
