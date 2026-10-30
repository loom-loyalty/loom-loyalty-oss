import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** One skill folder shipped in this package. */
export interface Skill {
  name: string;
  description: string;
  dir: string;
}

/** The `skills/` folder next to `dist/` (or `src/` under tests). */
export const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "skills");

/**
 * Reads the `name` and `description` from a SKILL.md frontmatter block. Only
 * single-line `key: value` pairs are read, which is all the skills use.
 */
export function readFrontmatter(markdown: string): Record<string, string> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!match?.[1]) return {};
  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (pair?.[1]) fields[pair[1]] = (pair[2] ?? "").trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return fields;
}

/** Lists every skill in `root`, sorted by name. */
export function listSkills(root: string = SKILLS_DIR): Skill[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, "SKILL.md")))
    .map((entry) => {
      const dir = join(root, entry.name);
      const fields = readFrontmatter(readFileSync(join(dir, "SKILL.md"), "utf8"));
      return { name: fields.name ?? entry.name, description: fields.description ?? "", dir };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
