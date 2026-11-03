/**
 * What `treadle doctor --fix` adds to a manifest: the lookup values (metadata) its records name
 * that neither the file nor the organization has, as the plan's `missing` lists them.
 */

import { isMap, isSeq, parseDocument, YAMLSeq } from "yaml";
import type { PackageInstallationResult, PackageMissingReference } from "../api/types.js";

/** A metadata value to declare, and the records that need it. */
export interface MissingValue {
  type: string;
  code: string;
  name: string;
  /** Each record that names it, as `<kind> <code> (<field>)` */
  neededBy: string[];
}

/** A missing record `--fix` can't declare (a program, an event type, ...), and who names it. */
export interface MissingRecord {
  kind: string;
  code: string;
  neededBy: string[];
}

export interface MissingDependencies {
  values: MissingValue[];
  records: MissingRecord[];
}

/**
 * Display names of the standard program and currency types, as the Hub's program builder creates
 * them (packages/program-builder/src/template-doc/standard-types.ts). Any other value is named after
 * its code.
 */
const STANDARD_NAMES: Record<string, Record<string, string>> = {
  PROGRAM_TYPE: {
    standard: "Standard Points Program",
    tiered: "Tiered Loyalty Program",
    subscription: "Subscription Program",
    coalition: "Coalition Program",
  },
  CURRENCY_TYPE: {
    points: "Points",
    miles: "Miles",
    credits: "Credits",
    stamps: "Stamps",
    tokens: "Tokens",
  },
};

/** The name `--fix` gives a new value: the standard one, else its code as words ("onboarding-step" → "Onboarding step"). */
export function valueName(type: string, code: string): string {
  const standard = STANDARD_NAMES[type]?.[code];
  if (standard) return standard;
  const words = code.replace(/[-_]+/g, " ").trim().toLowerCase();
  return words.length > 0 ? words[0]!.toUpperCase() + words.slice(1) : code;
}

/** The plan's missing references, merged: each missing value or record once, with everything that names it. */
export function missingDependencies(result: PackageInstallationResult): MissingDependencies {
  const values = new Map<string, MissingValue>();
  const records = new Map<string, MissingRecord>();
  for (const plan of result.packages) {
    for (const record of plan.records) {
      for (const missing of record.missing ?? []) {
        const by = `${record.kind} ${record.code} (${missing.field})`;
        if (isValue(missing)) {
          const key = `${missing.type}/${missing.code}`;
          const entry = values.get(key) ?? {
            type: missing.type,
            code: missing.code,
            name: valueName(missing.type, missing.code),
            neededBy: [],
          };
          entry.neededBy.push(by);
          values.set(key, entry);
        } else {
          const key = `${missing.kind}/${missing.code}`;
          const entry = records.get(key) ?? {
            kind: missing.kind,
            code: missing.code,
            neededBy: [],
          };
          entry.neededBy.push(by);
          records.set(key, entry);
        }
      }
    }
  }
  return { values: [...values.values()], records: [...records.values()] };
}

function isValue(missing: PackageMissingReference): missing is PackageMissingReference & {
  type: string;
} {
  return missing.kind === "METADATA" && typeof missing.type === "string" && missing.type.length > 0;
}

/**
 * `text` with each of `values` appended to its `metadata:` list (created when absent), keeping the
 * file's comments and layout. A value the list already declares is left as it is.
 */
export function addMetadataValues(text: string, values: MissingValue[]): string {
  const document = parseDocument(text);
  if (!isMap(document.contents)) {
    throw new Error("The manifest's top level is not a map");
  }
  let list = document.get("metadata", true);
  if (!isSeq(list)) {
    list = new YAMLSeq();
    document.set("metadata", list);
  }
  const seq = list as YAMLSeq;
  const declared = new Set(
    seq.items.map((item) => {
      const value = isMap(item) ? item.toJSON() : item;
      const entry = value as { type?: unknown; code?: unknown } | null;
      return `${String(entry?.type)}/${String(entry?.code)}`;
    })
  );
  for (const value of values) {
    if (declared.has(`${value.type}/${value.code}`)) continue;
    seq.add(document.createNode({ type: value.type, code: value.code, name: value.name }));
  }
  return document.toString();
}
