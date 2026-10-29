/**
 * Reads `loom-loyalty-config.yaml` and checks it against `loom-loyalty-config.v1` before any API call.
 */

import { readFile } from "node:fs/promises";
import { parseDocument } from "yaml";
import { manifestSchema, RECORD_SECTIONS, type TenantManifest } from "./schema.js";

export type LoadResult = { ok: true; manifest: TenantManifest } | { ok: false; problems: string[] };

/** Reads and validates the manifest at `path`. A missing or unreadable file is a problem, not a throw. */
export async function loadManifest(path: string): Promise<LoadResult> {
  let text: string;
  try {
    text = await readFile(path, "utf-8");
  } catch (error) {
    const reason = (error as NodeJS.ErrnoException).code === "ENOENT" ? "not found" : String(error);
    return { ok: false, problems: [`${path}: ${reason}`] };
  }
  return parseManifest(text);
}

/** Parses YAML text (JSON is valid YAML 1.2) and validates it. */
export function parseManifest(text: string): LoadResult {
  const document = parseDocument(text, { uniqueKeys: true });
  if (document.errors.length > 0) {
    return { ok: false, problems: document.errors.map((error) => error.message) };
  }
  const parsed = manifestSchema.safeParse(document.toJS());
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`),
    };
  }
  const duplicates = duplicateCodes(parsed.data);
  if (duplicates.length > 0) {
    return { ok: false, problems: duplicates };
  }
  return { ok: true, manifest: parsed.data };
}

/** A problem for each code a section declares twice; the Platform matches records by code. */
function duplicateCodes(manifest: TenantManifest): string[] {
  const problems: string[] = [];
  const check = (section: string, codes: string[]) => {
    const seen = new Set<string>();
    for (const code of codes) {
      if (seen.has(code)) problems.push(`${section}: declares ${code} twice`);
      seen.add(code);
    }
  };
  for (const section of RECORD_SECTIONS) {
    check(
      section,
      (manifest[section] ?? []).map((record) => record.code)
    );
  }
  check(
    "metadataTypes",
    (manifest.metadataTypes ?? []).map((type) => type.code)
  );
  check(
    "metadata",
    (manifest.metadata ?? []).map((value) => `${value.type}/${value.code}`)
  );
  check(
    "eventTypes",
    (manifest.eventTypes ?? []).map((type) => type.code)
  );
  check(
    "identifierTypes",
    (manifest.identifierTypes ?? []).map((type) => type.code)
  );
  return problems;
}

function formatPath(path: PropertyKey[]): string {
  if (path.length === 0) return "(top level)";
  return path
    .map((part, index) =>
      typeof part === "number" ? `[${part}]` : `${index === 0 ? "" : "."}${String(part)}`
    )
    .join("");
}
