import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { listSkills, readFrontmatter, SKILLS_DIR } from "../src/index.js";

/** Agent Skills caps `description` at 1024 characters. */
const MAX_DESCRIPTION = 1024;

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith(".md") ? [path] : [];
  });
}

/** Relative link targets in a markdown file, without anchors. */
function relativeLinks(markdown: string): string[] {
  return [...markdown.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((match) => match[1] ?? "")
    .filter((target) => !/^[a-z]+:/i.test(target) && !target.startsWith("#"))
    .map((target) => target.split("#")[0] ?? "");
}

const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(SKILLS_DIR, entry.name));

describe("readFrontmatter", () => {
  it("reads single-line fields and strips quotes", () => {
    expect(readFrontmatter('---\nname: a-b\ndescription: "Does x."\n---\nbody')).toEqual({
      name: "a-b",
      description: "Does x.",
    });
  });

  it("returns nothing without a frontmatter block", () => {
    expect(readFrontmatter("# Title")).toEqual({});
  });
});

describe.each(skillDirs.map((dir) => [basename(dir), dir]))("%s", (folder, dir) => {
  const skillFile = join(dir, "SKILL.md");

  it("has a SKILL.md", () => {
    expect(existsSync(skillFile)).toBe(true);
  });

  it("names itself after its folder and has only the Agent Skills fields", () => {
    const fields = readFrontmatter(readFileSync(skillFile, "utf8"));
    expect(fields.name).toBe(folder);
    expect(Object.keys(fields).sort()).toEqual(["description", "license", "name"]);
    expect(fields.license).toBe("Apache-2.0");
  });

  it("has a description within the length limit", () => {
    const { description = "" } = readFrontmatter(readFileSync(skillFile, "utf8"));
    expect(description.length).toBeGreaterThan(20);
    expect(description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });

  it("has no broken relative links", () => {
    const broken = markdownFiles(dir).flatMap((file) =>
      relativeLinks(readFileSync(file, "utf8"))
        .filter((target) => target && !existsSync(resolve(dirname(file), target)))
        .map((target) => `${file.slice(dir.length + 1)} -> ${target}`)
    );
    expect(broken).toEqual([]);
  });
});

describe("listSkills", () => {
  it("lists every skill folder", () => {
    expect(listSkills().map((skill) => skill.name)).toEqual(
      skillDirs.map((dir) => basename(dir)).sort()
    );
  });
});
