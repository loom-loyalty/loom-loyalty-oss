import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { listSkills, SKILLS_DIR } from "./skills.js";
import { createZip, type ZipEntry } from "./zip.js";

/** A case-insensitive pattern that must never appear in a published skill. */
export interface BlockRule {
  pattern: string;
  reason: string;
}

export interface PackOptions {
  /** Folder the zips are written to; it is emptied first. */
  outDir: string;
  /** Patterns that fail the pack, such as the OSS export denylist's `block` list. */
  blockRules?: BlockRule[];
  source?: string;
}

function filesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? filesIn(path) : [path];
    })
    .sort();
}

/**
 * Writes one `<skill>.zip` per skill, each holding a top-level `<skill>/` folder, so a
 * Claude user can upload it as a skill. Scans every file against `blockRules` first and
 * writes nothing when one matches.
 */
export function packSkills(options: PackOptions): string[] {
  const skills = listSkills(options.source ?? SKILLS_DIR);
  const rules = (options.blockRules ?? []).map((rule) => ({
    ...rule,
    regex: new RegExp(rule.pattern, "i"),
  }));
  const hits = skills.flatMap((skill) =>
    filesIn(skill.dir).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) =>
          rules
            .filter((rule) => rule.regex.test(line))
            .map(
              (rule) => `${skill.name}/${relative(skill.dir, file)}:${index + 1} [${rule.reason}]`
            )
        )
    )
  );
  if (hits.length > 0)
    throw new Error(`Blocked content in skills, no zips written:\n  ${hits.join("\n  ")}`);

  rmSync(options.outDir, { recursive: true, force: true });
  mkdirSync(options.outDir, { recursive: true });
  return skills.map((skill) => {
    const entries: ZipEntry[] = filesIn(skill.dir).map((file) => ({
      path: `${skill.name}/${relative(skill.dir, file).split("\\").join("/")}`,
      data: readFileSync(file),
    }));
    const zip = join(options.outDir, `${skill.name}.zip`);
    writeFileSync(zip, createZip(entries));
    return zip;
  });
}
