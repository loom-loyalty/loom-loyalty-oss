import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runLogoutCommand } from "../../src/commands/logout.js";
import { clearRcCache } from "../../src/utils/rc.js";

let dir: string;
let cwd: string;

beforeEach(() => {
  cwd = process.cwd();
  dir = mkdtempSync(join(tmpdir(), "treadle-logout-"));
  process.chdir(dir);
  clearRcCache();
});

afterEach(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
  clearRcCache();
});

describe("treadle logout", () => {
  it("forgets the sign-in to the named organization", async () => {
    const forget = vi.fn(async () => ({ saved: true, ended: true as const }));
    const lines: string[] = [];

    const code = await runLogoutCommand(
      [
        "--deployment",
        "staging",
        "--org",
        "org_dev",
        "--dashboard-url",
        "https://dashboard.staging.example.com",
      ],
      forget,
      (line) => lines.push(line)
    );

    expect(code).toBe(0);
    expect(forget).toHaveBeenCalledWith("https://dashboard.staging.example.com", "org_dev");
    expect(lines.join("\n")).toContain("Signed out of org_dev");
  });

  it("asks for an organization when none is pinned", async () => {
    const forget = vi.fn(async () => ({ saved: false }));

    expect(await runLogoutCommand([], forget, () => {})).toBe(1);
    expect(forget).not.toHaveBeenCalled();
  });

  it("says so when the session couldn't be ended", async () => {
    const forget = vi.fn(async () => ({ saved: true, ended: "the dashboard answered HTTP 503" }));
    const lines: string[] = [];

    const code = await runLogoutCommand(["--org", "org_dev"], forget, (line) => lines.push(line));

    expect(code).toBe(0);
    expect(lines.join("\n")).toContain("Signed out of org_dev");
    expect(lines.join("\n")).toContain("couldn't be ended (the dashboard answered HTTP 503)");
  });
});
