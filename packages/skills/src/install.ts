import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { listSkills, SKILLS_DIR } from "./skills.js";

export interface InstallOptions {
  /** Project folder to install into. */
  cwd: string;
  /** `.agents/skills/` instead of `.claude/skills/`. */
  agents?: boolean;
  /** Replace skills that are already installed. */
  force?: boolean;
  /** Where the packaged skills live; tests point this elsewhere. */
  source?: string;
}

export interface InstallResult {
  target: string;
  installed: string[];
  skipped: string[];
}

/** Copies every packaged skill into the project's skills folder. */
export function install(options: InstallOptions): InstallResult {
  const target = resolve(options.cwd, options.agents ? ".agents/skills" : ".claude/skills");
  mkdirSync(target, { recursive: true });
  const result: InstallResult = { target, installed: [], skipped: [] };
  for (const skill of listSkills(options.source ?? SKILLS_DIR)) {
    const destination = join(target, skill.name);
    if (existsSync(destination)) {
      if (!options.force) {
        result.skipped.push(skill.name);
        continue;
      }
      rmSync(destination, { recursive: true, force: true });
    }
    cpSync(skill.dir, destination, { recursive: true });
    result.installed.push(skill.name);
  }
  return result;
}
