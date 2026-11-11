import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, type ApiClient } from "../../src/api/client.js";
import type { PackageInstallationResult, PackageInstallPlanRecord } from "../../src/api/types.js";
import {
  checkVersions,
  executeDoctor,
  parseDoctorArgs,
  signInFailure,
  type DoctorDeps,
  type DoctorOptions,
} from "../../src/commands/doctor.js";
import type { SignedInClient } from "../../src/utils/deployment.js";
import { clearRcCache } from "../../src/utils/rc.js";

const FILE = [
  "schema: loom-loyalty-config.v1",
  "code: directory-review",
  "programs:",
  "  - code: coffee-club",
  "    typeCode: tiered",
  "    name: Coffee Club",
  "",
].join("\n");

const OPTIONS: DoctorOptions = {
  file: "loom-loyalty-config.yaml",
  deployment: "production",
  yes: false,
  fix: false,
};

function plan(records: PackageInstallPlanRecord[]): PackageInstallationResult {
  return {
    packageCode: "directory-review",
    dryRun: true,
    applied: false,
    conflicted: records.some((record) => record.action === "CONFLICT"),
    packages: [{ packageCode: "directory-review", records }],
  };
}

const MISSING_TIERED = plan([
  {
    kind: "PROGRAM",
    code: "coffee-club",
    action: "CONFLICT",
    reason:
      "typeCode names tiered, a PROGRAM_TYPE value that neither the manifest nor the organization has",
    missing: [{ kind: "METADATA", type: "PROGRAM_TYPE", code: "tiered", field: "typeCode" }],
  },
]);

function client(overrides: Partial<Record<keyof ApiClient, unknown>> = {}): ApiClient {
  return {
    installManifest: vi.fn(async () =>
      plan([{ kind: "PROGRAM", code: "coffee-club", action: "UNCHANGED" }])
    ),
    findInstallation: vi.fn(async () => null),
    listWorkflowRequests: vi.fn(async () => []),
    listActiveEnablePolicies: vi.fn(async () => []),
    ...overrides,
  } as unknown as ApiClient;
}

function deps(
  api: ApiClient,
  overrides: Partial<DoctorDeps> = {}
): DoctorDeps & { lines: string[]; written: string[] } {
  const lines: string[] = [];
  const written: string[] = [];
  const signedIn: SignedInClient = { client: api, via: "token", token: "llk_key" };
  return {
    signIn: vi.fn(async () => signedIn),
    readText: vi.fn(async () => FILE),
    writeText: vi.fn(async (_path: string, text: string) => {
      written.push(text);
    }),
    confirm: vi.fn(async () => true),
    pinOrganization: vi.fn(async () => 0),
    cliVersion: async () => "0.8.0",
    nodeVersion: "v22.11.0",
    log: (line: string) => lines.push(line),
    ...overrides,
    lines,
    written,
  };
}

let dir: string;
let cwd: string;

beforeEach(() => {
  cwd = process.cwd();
  dir = mkdtempSync(join(tmpdir(), "treadle-doctor-"));
  process.chdir(dir);
  clearRcCache();
});

afterEach(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
  clearRcCache();
});

describe("parseDoctorArgs", () => {
  it("reads --fix beside the plan options", () => {
    expect(parseDoctorArgs(["--fix", "--env", "prod"])).toEqual({
      ...OPTIONS,
      env: "prod",
      fix: true,
    });
  });
});

describe("checkVersions", () => {
  it("fails on a Node older than 18", () => {
    expect(checkVersions("0.8.0", "v16.20.0").status).toBe("fail");
    expect(checkVersions("0.8.0", "v22.11.0").status).toBe("pass");
  });
});

describe("signInFailure", () => {
  it("points a rate-limited sign-in at LOOM_API_TOKEN", () => {
    const check = signInFailure(
      new Error("Too many authentication attempts. Please try again later.")
    );
    expect(check.status).toBe("fail");
    expect(check.lines.join("\n")).toContain("LOOM_API_TOKEN");
    expect(check.lines.join("\n")).toContain("15 minutes");
  });
});

describe("treadle doctor", () => {
  it("passes a file that plans clean", async () => {
    const d = deps(client());

    expect(await executeDoctor(OPTIONS, d)).toBe(0);
    expect(d.lines.join("\n")).toContain("All checks passed");
    expect(d.written).toEqual([]);
  });

  it("names each missing lookup value and what needs it, and writes nothing without --fix", async () => {
    const d = deps(client({ installManifest: vi.fn(async () => MISSING_TIERED) }));

    expect(await executeDoctor(OPTIONS, d)).toBe(1);
    const output = d.lines.join("\n");
    expect(output).toContain("PROGRAM_TYPE tiered ← PROGRAM coffee-club (typeCode)");
    expect(d.written).toEqual([]);
  });

  it("declares the missing values with --fix, after asking", async () => {
    const d = deps(client({ installManifest: vi.fn(async () => MISSING_TIERED) }));

    expect(await executeDoctor({ ...OPTIONS, fix: true }, d)).toBe(0);
    expect(d.confirm).toHaveBeenCalled();
    expect(d.written).toHaveLength(1);
    expect(d.written[0]).toContain("type: PROGRAM_TYPE");
    expect(d.written[0]).toContain("name: Tiered Loyalty Program");
  });

  it("writes nothing when the fix is declined", async () => {
    const d = deps(client({ installManifest: vi.fn(async () => MISSING_TIERED) }), {
      confirm: vi.fn(async () => false),
    });

    expect(await executeDoctor({ ...OPTIONS, fix: true }, d)).toBe(1);
    expect(d.written).toEqual([]);
  });

  it("skips the plan checks when the sign-in fails", async () => {
    const api = client();
    const d = deps(api, {
      signIn: vi.fn(async () => Promise.reject(new Error("Too many authentication attempts."))),
    });

    expect(await executeDoctor(OPTIONS, d)).toBe(1);
    expect(api.installManifest).not.toHaveBeenCalled();
    expect(d.lines.join("\n")).toContain("needs a sign-in");
  });

  it("reports an invalid file without planning it", async () => {
    const api = client();
    const d = deps(api, { readText: vi.fn(async () => "schema: nope\n") });

    expect(await executeDoctor(OPTIONS, d)).toBe(1);
    expect(api.installManifest).not.toHaveBeenCalled();
    expect(d.lines.join("\n")).toContain("not a valid loom-loyalty-config.v1 manifest");
  });

  it("lists blocked records under permissions and changed records under drift", async () => {
    const d = deps(
      client({
        installManifest: vi.fn(async () =>
          plan([
            {
              kind: "TIER",
              code: "gold",
              action: "BLOCKED",
              reason: "needs env-workflow:live-entities:write",
            },
            {
              kind: "TIER",
              code: "silver",
              action: "UPDATE",
              reason: "the manifest changes [rank]",
            },
          ])
        ),
      })
    );

    expect(await executeDoctor(OPTIONS, d)).toBe(1);
    const output = d.lines.join("\n");
    expect(output).toContain("TIER gold: needs env-workflow:live-entities:write");
    expect(output).toContain("UPDATE TIER silver: the manifest changes [rank]");
    expect(output).toContain("treadle pull");
  });

  it("says when the sign-in can't open requests into --env, and still plans", async () => {
    const installManifest = vi.fn(async (input: { targetEnvironmentCode?: string }) => {
      if (input.targetEnvironmentCode) throw new ApiError("Forbidden", 403);
      return plan([{ kind: "PROGRAM", code: "coffee-club", action: "UNCHANGED" }]);
    });
    const d = deps(client({ installManifest }));

    expect(await executeDoctor({ ...OPTIONS, env: "prod" }, d)).toBe(1);
    expect(installManifest).toHaveBeenCalledTimes(2);
    expect(d.lines.join("\n")).toContain("can't open approval requests into prod");
  });

  it("warns about waiting approvals and an environment no policy targets", async () => {
    const d = deps(
      client({
        findInstallation: vi.fn(async () => ({
          packageInstallationId: "i",
          packageCode: "directory-review",
          resources: { "record:PROGRAM:coffee-club": "p1" },
        })),
        listWorkflowRequests: vi.fn(async () => [
          {
            environmentWorkflowRequestId: "r1",
            status: "PENDING",
            entities: [{ entityId: "p1", entityType: "PROGRAM" }],
          },
        ]),
        listActiveEnablePolicies: vi.fn(async () => [
          { code: "dev-auto", targetEnvironmentCode: "dev", autoEnable: true },
        ]),
      })
    );

    expect(await executeDoctor({ ...OPTIONS, env: "prod" }, d)).toBe(0);
    const output = d.lines.join("\n");
    expect(output).toContain("1 approval request(s) still wait");
    expect(output).toContain("No active enable policy targets prod");
  });

  it("pins the organization the sign-in picked with --fix when none is pinned", async () => {
    const api = client();
    const d = deps(api, {
      signIn: vi.fn(async () => ({
        client: api,
        via: "browser" as const,
        token: "jwt",
        organizationId: "org_picked",
      })),
    });

    await executeDoctor({ ...OPTIONS, fix: true }, d);

    expect(d.pinOrganization).toHaveBeenCalledWith("production", "org_picked");
    expect(d.lines.join("\n")).toContain("Pinned the organization");
  });

  it("fails the sign-in check for a token that is neither an API key nor a session token", async () => {
    const api = client();
    const d = deps(api, {
      signIn: vi.fn(async () => ({ client: api, via: "token" as const, token: "not-a-token" })),
    });

    expect(await executeDoctor(OPTIONS, d)).toBe(1);
    expect(d.lines.join("\n")).toContain("neither an API key nor a session token");
    expect(api.installManifest).not.toHaveBeenCalled();
  });

  it("counts a record the organization doesn't have yet as drift", async () => {
    const d = deps(
      client({
        installManifest: vi.fn(async () =>
          plan([{ kind: "TIER", code: "bronze", action: "CREATE" }])
        ),
      })
    );

    await executeDoctor(OPTIONS, d);

    const output = d.lines.join("\n");
    expect(output).toContain("CREATE TIER bronze");
    expect(output).not.toContain("The organization matches the file");
  });

  it("says changes to existing records go through a self-approving request under an automatic policy", async () => {
    const d = deps(
      client({
        listActiveEnablePolicies: vi.fn(async () => [
          { code: "dev-auto", targetEnvironmentCode: "dev", autoEnable: true },
        ]),
      })
    );

    await executeDoctor({ ...OPTIONS, env: "dev" }, d);

    expect(d.lines.join("\n")).toContain(
      "New records reach dev automatically (dev-auto); changes to existing records go through the enable request apply --env opens, which approves itself"
    );
  });
});
