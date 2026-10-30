import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { install, listSkills, main } from "../src/index.js";

const SKILL_COUNT = listSkills().length;

describe("install", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "skills-install-"));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("ships six skills", () => {
    expect(SKILL_COUNT).toBe(6);
  });

  it("copies every skill into .claude/skills", () => {
    const result = install({ cwd });
    expect(result.installed).toHaveLength(SKILL_COUNT);
    expect(readdirSync(join(cwd, ".claude/skills")).sort()).toEqual(
      listSkills().map((skill) => skill.name)
    );
    expect(existsSync(join(cwd, ".claude/skills/loom-loyalty-campaign/SKILL.md"))).toBe(true);
  });

  it("writes to .agents/skills with --agents", () => {
    install({ cwd, agents: true });
    expect(readdirSync(join(cwd, ".agents/skills"))).toHaveLength(SKILL_COUNT);
    expect(existsSync(join(cwd, ".claude"))).toBe(false);
  });

  it("leaves an installed skill alone without --force", () => {
    install({ cwd });
    const edited = join(cwd, ".claude/skills/loom-loyalty-offer/SKILL.md");
    writeFileSync(edited, "my edits");
    const result = install({ cwd });
    expect(result.skipped).toContain("loom-loyalty-offer");
    expect(result.installed).toHaveLength(0);
    expect(readFileSync(edited, "utf8")).toBe("my edits");
  });

  it("replaces an installed skill with --force", () => {
    install({ cwd });
    const edited = join(cwd, ".claude/skills/loom-loyalty-offer/SKILL.md");
    writeFileSync(edited, "my edits");
    install({ cwd, force: true });
    expect(readFileSync(edited, "utf8")).toMatch(/^---/);
  });
});

describe("main", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "skills-cli-"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("lists the skills and writes nothing with install --list", () => {
    expect(main(["install", "--list"], cwd)).toBe(0);
    expect(readdirSync(cwd)).toHaveLength(0);
    const printed = vi.mocked(console.log).mock.calls.map((call) => String(call[0]));
    expect(printed.filter((line) => line.startsWith("loom-loyalty-"))).toHaveLength(SKILL_COUNT);
  });

  it("installs with the install command", () => {
    expect(main(["install"], cwd)).toBe(0);
    expect(readdirSync(join(cwd, ".claude/skills"))).toHaveLength(SKILL_COUNT);
  });

  it("exits non-zero with usage on an unknown flag", () => {
    expect(main(["install", "--dir"], cwd)).toBe(1);
    expect(String(vi.mocked(console.error).mock.calls[0]?.[0])).toMatch(/Unknown option: --dir/);
    expect(existsSync(join(cwd, ".claude"))).toBe(false);
  });

  it("exits non-zero on an unknown command", () => {
    expect(main(["remove"], cwd)).toBe(1);
  });
});
