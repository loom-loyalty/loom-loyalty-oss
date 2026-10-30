import { install } from "./install.js";
import { listSkills } from "./skills.js";

export { install, type InstallOptions, type InstallResult } from "./install.js";
export { packSkills, type BlockRule, type PackOptions } from "./pack.js";
export { listSkills, readFrontmatter, SKILLS_DIR, type Skill } from "./skills.js";
export { createZip, type ZipEntry } from "./zip.js";

const USAGE = `Usage: npx @loom-loyalty/skills <command> [options]

Commands:
  install    Copy the Loom Loyalty skills into this project
  list       Show the skills in this package

Options for install:
  --agents   Install into .agents/skills/ instead of .claude/skills/
  --force    Replace skills that are already installed
  --list     Show the skills and install nothing`;

const INSTALL_FLAGS = new Set(["--agents", "--force", "--list"]);

function printList(): void {
  for (const skill of listSkills()) console.log(`${skill.name}\n  ${skill.description}`);
}

/** Runs the CLI and returns its exit code. */
export function main(argv: string[], cwd: string = process.cwd()): number {
  const [command, ...flags] = argv;
  if (command === "--help" || command === "-h" || command === "help") {
    console.log(USAGE);
    return 0;
  }
  if (command === "list" || command === "--list") {
    printList();
    return 0;
  }
  if (command !== "install") {
    console.error(command ? `Unknown command: ${command}\n\n${USAGE}` : USAGE);
    return 1;
  }
  const unknown = flags.filter((flag) => !INSTALL_FLAGS.has(flag));
  if (unknown.length > 0) {
    console.error(`Unknown option: ${unknown.join(", ")}\n\n${USAGE}`);
    return 1;
  }
  if (flags.includes("--list")) {
    printList();
    return 0;
  }
  const result = install({
    cwd,
    agents: flags.includes("--agents"),
    force: flags.includes("--force"),
  });
  for (const name of result.installed) console.log(`Installed ${name}`);
  for (const name of result.skipped)
    console.log(`Skipped ${name}: already installed (use --force to replace it)`);
  console.log(`\nSkills folder: ${result.target}`);
  return 0;
}
