/**
 * `@loom-loyalty/schema/expressions`
 *
 * Framework-free single source of truth for the Loom Loyalty expression DSL —
 * the recursive `Expression` AST shared by event rules, customer audiences, and
 * campaigns. Exports the backend-accurate Zod validators, their inferred/declared
 * types, and the per-surface operator allowlists.
 *
 * Consumed by:
 *  - `packages/ui/src/expressions/types.ts` (re-exports the types so the visual
 *    builder and its validator cannot drift from each other)
 *  - `apps/ai-server` (NL → Expression generation + validation)
 */

export * from "./actions.js";
export * from "./operators.js";
export * from "./pre-operations.js";
export * from "./surfaces.js";
