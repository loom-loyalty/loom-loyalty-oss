/**
 * Synthesize executor-required defaults on a parsed-from-markdown ProgramSpec.
 *
 * The executor's structural validator requires `awardRule.rulePayload` to be
 * an object with at least { code, name, category }. Markdown templates omit
 * these unless the author hand-wrote them in the YAML frontmatter — the
 * round-trip through markdown.ts:239-244 only emits the payload when both
 * `code` and `name` are present, and a freeform-only template won't have
 * either.
 *
 * Without this helper, every spec-only caller (`upload-page.tsx` today, plus
 * future programmatic batch imports / MCP tools / alternative ai-server
 * endpoints) has to re-derive the same defaults inline. Centralizing here
 * means there's one truth.
 *
 * Per-field fallbacks (not all-or-nothing replacement): a hand-authored .md
 * with `rulePayload: { name: "Custom" }` keeps the supplied name and only
 * fills in `code` and `category`.
 *
 * The synthesized name uses the template's own display name
 * (`${programName} ${template.name}` — e.g. "Coffee Loyalty Points per
 * Dollar Spent") to match the wizard's `award-rule-step.tsx:99-100` pattern.
 * This avoids the "Test Rewards Rewards" doubling artifact that an earlier
 * draft of this helper produced when it hardcoded "Rewards" as the suffix.
 * If the templateId is unknown (corrupt frontmatter), fall back to
 * `${programName} Rewards` rather than throwing — the executor will reject
 * the unknown templateId downstream with a clearer error.
 *
 * Returns a NEW spec object — does not mutate the input.
 */

import type { ProgramSpec } from "../spec";
import { getTemplateById } from "../templates";

interface RulePayloadDefaults {
  code?: string;
  name?: string;
  category?: string;
  [key: string]: unknown;
}

export function hydrateForExecution(spec: ProgramSpec): ProgramSpec {
  const programCode = spec.program?.code;
  if (!programCode) {
    throw new Error(
      "hydrateForExecution: spec.program.code is required to synthesize awardRule.rulePayload defaults"
    );
  }
  const programName = spec.program?.name;
  if (!programName) {
    throw new Error(
      "hydrateForExecution: spec.program.name is required to synthesize awardRule.rulePayload defaults"
    );
  }

  const userPayload = (spec.awardRule?.rulePayload ?? {}) as RulePayloadDefaults;
  const template = spec.awardRule?.templateId
    ? getTemplateById(spec.awardRule.templateId)
    : undefined;
  const synthesizedName = template ? `${programName} ${template.name}` : `${programName} Rewards`;

  const synthesizedRulePayload: RulePayloadDefaults = {
    ...userPayload,
    code: userPayload.code || `${programCode}-earn`,
    name: userPayload.name || synthesizedName,
    category: userPayload.category || "ORGANIZATION_DEFINED",
  };

  return {
    ...spec,
    awardRule: {
      ...spec.awardRule,
      rulePayload: synthesizedRulePayload as ProgramSpec["awardRule"]["rulePayload"],
    },
  };
}
