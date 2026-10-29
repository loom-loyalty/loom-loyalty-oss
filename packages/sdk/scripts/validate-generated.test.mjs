import { describe, expect, it } from "vitest";

import { syntaxProblems } from "./validate-generated.mjs";

const GOOD_SCHEMA = `import type { PreOperation } from './preOperation';

export type ExpressionActionOneOfUseCustomerCoupon = {
  path?: string;
  preOperation?: PreOperation;
  [key: string]: unknown;
};
`;

describe("syntaxProblems", () => {
  it("accepts a well-formed generated file", () => {
    expect(syntaxProblems("generated/schemas/ok.ts", GOOD_SCHEMA)).toEqual([]);
  });

  it("reports a file truncated mid-declaration with its position", () => {
    const truncated = GOOD_SCHEMA.slice(0, GOOD_SCHEMA.indexOf("preOperation?: Pre") + 18);
    const problems = syntaxProblems("generated/schemas/truncated.ts", truncated);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(
      /^generated\/schemas\/truncated\.ts\(\d+,\d+\): TS1005: '}' expected\.$/
    );
  });

  it("reports an empty type annotation left behind by post-processing", () => {
    const problems = syntaxProblems(
      "generated/schemas/empty-type.ts",
      "export type Foo = {\n  bar?: ;\n};\n"
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(
      /^generated\/schemas\/empty-type\.ts\(2,9\): TS1110: Type expected\.$/
    );
  });

  it("reports an interface whose closing brace was skipped", () => {
    const problems = syntaxProblems(
      "generated/schemas/unbalanced.ts",
      "export interface A {\n  x: string;\n"
    );
    expect(problems.some((problem) => problem.includes("TS1005: '}' expected."))).toBe(true);
  });

  it("reports an empty file", () => {
    expect(syntaxProblems("generated/schemas/empty.ts", "\n\n")).toEqual([
      "generated/schemas/empty.ts: file is empty",
    ]);
  });
});
