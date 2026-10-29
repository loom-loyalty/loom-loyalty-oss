import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../../src/api/client.js";
import type {
  PackageInstallationResult,
  PackageInstallPlanRecord,
  WorkflowRequest,
} from "../../src/api/types.js";
import {
  executeApply,
  executePlan,
  executeStatus,
  EXIT_CHANGES,
  EXIT_ERROR,
  EXIT_OK,
  managedIds,
  openRequestsFor,
  parseManifestArgs,
  planExitCode,
  type ManifestOptions,
} from "../../src/commands/manifest.js";
import type { TenantManifest } from "../../src/manifest/schema.js";

const MANIFEST: TenantManifest = { schema: "loom-loyalty-config.v1", code: "warp-up" };

const OPTIONS: ManifestOptions = {
  file: "loom-loyalty-config.yaml",
  deployment: "production",
  yes: false,
};

function result(
  actions: string[],
  extra: Partial<PackageInstallationResult> = {}
): PackageInstallationResult {
  const records: PackageInstallPlanRecord[] = actions.map((action, i) => ({
    kind: "TIER",
    code: `tier-${i}`,
    action,
  }));
  return {
    packageCode: "warp-up",
    dryRun: true,
    applied: false,
    conflicted: actions.some((action) => action === "CONFLICT" || action === "BLOCKED"),
    packages: [{ packageCode: "warp-up", records }],
    ...extra,
  };
}

function fakeClient(overrides: Partial<Record<keyof ApiClient, unknown>>): ApiClient {
  return overrides as unknown as ApiClient;
}

const quiet = () => {};

describe("parseManifestArgs", () => {
  it("defaults to loom-loyalty-config.yaml on production", () => {
    expect(parseManifestArgs([])).toEqual(OPTIONS);
  });

  it("reads every option", () => {
    expect(
      parseManifestArgs([
        "-f",
        "cfg.yaml",
        "--env",
        "prod",
        "--deployment",
        "staging",
        "-t",
        "llk_abc",
        "--yes",
      ])
    ).toEqual({
      file: "cfg.yaml",
      env: "prod",
      deployment: "staging",
      token: "llk_abc",
      yes: true,
    });
  });

  it("rejects an unknown deployment, a missing value and an unknown option", () => {
    expect(parseManifestArgs(["--deployment", "moon"])).toHaveProperty("error");
    expect(parseManifestArgs(["--env"])).toHaveProperty("error");
    expect(parseManifestArgs(["--env", "--yes"])).toHaveProperty("error");
    expect(parseManifestArgs(["-e", "prod"])).toEqual({ error: "Unknown option: -e" });
  });

  it("asks for help", () => {
    expect(parseManifestArgs(["--help"])).toEqual({ help: true });
  });
});

describe("planExitCode", () => {
  it("is 0 when every record is unchanged", () => {
    expect(planExitCode(result(["UNCHANGED", "UNCHANGED"]))).toBe(EXIT_OK);
  });

  it("is 2 when a record would be created, adopted or updated", () => {
    expect(planExitCode(result(["UNCHANGED", "CREATE"]))).toBe(EXIT_CHANGES);
    expect(planExitCode(result(["ADOPT"]))).toBe(EXIT_CHANGES);
    expect(planExitCode(result(["UPDATE"]))).toBe(EXIT_CHANGES);
  });

  it("is 1 when a record conflicts or is blocked", () => {
    expect(planExitCode(result(["CREATE", "CONFLICT"]))).toBe(EXIT_ERROR);
    expect(planExitCode(result(["BLOCKED"]))).toBe(EXIT_ERROR);
  });

  it("counts an action it doesn't know as a change, so a gate never passes it", () => {
    expect(planExitCode(result(["UNCHANGED", "REPLACE"]))).toBe(EXIT_CHANGES);
  });
});

describe("executePlan", () => {
  it("sends a dry run with the manifest and the target environment", async () => {
    const installManifest = vi.fn().mockResolvedValue(result(["CREATE"]));
    const lines: string[] = [];

    const code = await executePlan(
      { ...OPTIONS, env: "prod" },
      MANIFEST,
      fakeClient({ installManifest }),
      (line) => lines.push(line)
    );

    expect(code).toBe(EXIT_CHANGES);
    expect(installManifest).toHaveBeenCalledWith({
      code: "warp-up",
      manifest: MANIFEST,
      dryRun: true,
      targetEnvironmentCode: "prod",
    });
    expect(lines.join("\n")).toContain("CREATE");
    expect(lines.join("\n")).toContain("tier-0");
  });
});

describe("executeApply", () => {
  it("applies after the person confirms", async () => {
    const installManifest = vi
      .fn()
      .mockResolvedValueOnce(result(["CREATE"]))
      .mockResolvedValueOnce(result(["CREATE"], { dryRun: false, applied: true }));
    const confirm = vi.fn().mockResolvedValue(true);

    const code = await executeApply(
      OPTIONS,
      MANIFEST,
      fakeClient({ installManifest }),
      confirm,
      quiet
    );

    expect(code).toBe(EXIT_OK);
    expect(confirm).toHaveBeenCalledWith("Apply warp-up?");
    expect(installManifest).toHaveBeenLastCalledWith(expect.objectContaining({ dryRun: false }));
  });

  it("writes nothing when the person declines", async () => {
    const installManifest = vi.fn().mockResolvedValue(result(["UPDATE"]));

    const code = await executeApply(
      OPTIONS,
      MANIFEST,
      fakeClient({ installManifest }),
      vi.fn().mockResolvedValue(false),
      quiet
    );

    expect(code).toBe(EXIT_ERROR);
    expect(installManifest).toHaveBeenCalledTimes(1);
  });

  it("doesn't ask with --yes", async () => {
    const installManifest = vi
      .fn()
      .mockResolvedValueOnce(result(["CREATE"]))
      .mockResolvedValueOnce(result(["CREATE"], { dryRun: false, applied: true }));
    const confirm = vi.fn();

    const code = await executeApply(
      { ...OPTIONS, yes: true },
      MANIFEST,
      fakeClient({ installManifest }),
      confirm,
      quiet
    );

    expect(code).toBe(EXIT_OK);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("stops at a conflicted plan without applying", async () => {
    const installManifest = vi.fn().mockResolvedValue(result(["CREATE", "CONFLICT"]));

    const code = await executeApply(
      { ...OPTIONS, yes: true },
      MANIFEST,
      fakeClient({ installManifest }),
      vi.fn(),
      quiet
    );

    expect(code).toBe(EXIT_ERROR);
    expect(installManifest).toHaveBeenCalledTimes(1);
  });

  it("does nothing when nothing changes and no environment is given", async () => {
    const installManifest = vi.fn().mockResolvedValue(result(["UNCHANGED"]));

    const code = await executeApply(
      { ...OPTIONS, yes: true },
      MANIFEST,
      fakeClient({ installManifest }),
      vi.fn(),
      quiet
    );

    expect(code).toBe(EXIT_OK);
    expect(installManifest).toHaveBeenCalledTimes(1);
  });

  it("still promotes an unchanged manifest into --env", async () => {
    const installManifest = vi
      .fn()
      .mockResolvedValueOnce(result(["UNCHANGED"]))
      .mockResolvedValueOnce(
        result(["UNCHANGED"], {
          dryRun: false,
          applied: true,
          promotions: [
            { entityType: "TIER", entityCount: 1, workflowRequestId: "wfr_1", status: "PENDING" },
          ],
        })
      );
    const lines: string[] = [];

    const code = await executeApply(
      { ...OPTIONS, env: "prod", yes: true },
      MANIFEST,
      fakeClient({ installManifest }),
      vi.fn(),
      (line) => lines.push(line)
    );

    expect(code).toBe(EXIT_OK);
    expect(installManifest).toHaveBeenLastCalledWith(
      expect.objectContaining({ dryRun: false, targetEnvironmentCode: "prod" })
    );
    expect(lines.join("\n")).toContain("wfr_1");
  });

  it("fails when a promotion request failed to open", async () => {
    const installManifest = vi
      .fn()
      .mockResolvedValueOnce(result(["CREATE"]))
      .mockResolvedValueOnce(
        result(["CREATE"], {
          dryRun: false,
          applied: true,
          promotions: [
            {
              entityType: "PROGRAM",
              entityCount: 1,
              workflowRequestId: "wfr_1",
              status: "PENDING",
            },
            { entityType: "TIER", entityCount: 2, status: "FAILED", message: "no workflow" },
          ],
        })
      );

    const code = await executeApply(
      { ...OPTIONS, env: "prod", yes: true },
      MANIFEST,
      fakeClient({ installManifest }),
      vi.fn(),
      quiet
    );

    expect(code).toBe(EXIT_ERROR);
  });

  it("fails when the organization changed between the plan and the apply", async () => {
    const installManifest = vi
      .fn()
      .mockResolvedValueOnce(result(["CREATE"]))
      .mockResolvedValueOnce(result(["CONFLICT"], { dryRun: false }));

    const code = await executeApply(
      { ...OPTIONS, yes: true },
      MANIFEST,
      fakeClient({ installManifest }),
      vi.fn(),
      quiet
    );

    expect(code).toBe(EXIT_ERROR);
  });
});

describe("status", () => {
  const requests: WorkflowRequest[] = [
    {
      environmentWorkflowRequestId: "wfr_open",
      status: "PENDING",
      entities: [
        { entityType: "TIER", entityId: "id-1" },
        { entityType: "TIER", entityId: "someone-else" },
      ],
    },
    {
      environmentWorkflowRequestId: "wfr_done",
      status: "APPROVED",
      entities: [{ entityType: "TIER", entityId: "id-1" }],
    },
    {
      environmentWorkflowRequestId: "wfr_other",
      status: "PENDING",
      entities: [{ entityType: "OFFER", entityId: "x" }],
    },
  ];

  it("reads the ids the ledger names", () => {
    expect(
      managedIds({ "record:TIER:gold": "id-1", "record:PROGRAM:warp-up": "id-2", other: "id-3" })
    ).toEqual(new Set(["id-1", "id-2"]));
    expect(managedIds(null)).toEqual(new Set());
  });

  it("keeps the open requests that carry a managed record", () => {
    expect(
      openRequestsFor(requests, new Set(["id-1"])).map((r) => r.environmentWorkflowRequestId)
    ).toEqual(["wfr_open"]);
  });

  it("lists them, counting only the manifest's records", async () => {
    const lines: string[] = [];
    const client = fakeClient({
      findInstallation: vi.fn().mockResolvedValue({
        packageInstallationId: "pi_1",
        packageCode: "warp-up",
        resources: { "record:TIER:gold": "id-1" },
      }),
      listWorkflowRequests: vi.fn().mockResolvedValue(requests),
    });

    const code = await executeStatus(MANIFEST, client, (line) => lines.push(line));

    expect(code).toBe(EXIT_OK);
    expect(lines.join("\n")).toContain("wfr_open  TIER x1");
    expect(lines.join("\n")).not.toContain("wfr_other");
  });

  it("lists a hub promotion, which carries the hub the ledger names", async () => {
    const lines: string[] = [];
    const client = fakeClient({
      findInstallation: vi.fn().mockResolvedValue({
        packageInstallationId: "pi_1",
        packageCode: "warp-up",
        resources: { "record:HUB_CONFIG:hub": "hub-dev" },
      }),
      listWorkflowRequests: vi.fn().mockResolvedValue([
        {
          environmentWorkflowRequestId: "wfr_hub",
          status: "PENDING",
          entities: [{ entityType: "HUB_CONFIG", entityId: "hub-dev" }],
        },
        {
          environmentWorkflowRequestId: "wfr_other_hub",
          status: "PENDING",
          entities: [{ entityType: "HUB_CONFIG", entityId: "hub-sandbox" }],
        },
      ]),
    });

    expect(await executeStatus(MANIFEST, client, (line) => lines.push(line))).toBe(EXIT_OK);
    expect(lines.join("\n")).toContain("wfr_hub  HUB_CONFIG x1");
    expect(lines.join("\n")).not.toContain("wfr_other_hub");
  });

  it("says so when the manifest was never applied", async () => {
    const lines: string[] = [];
    const client = fakeClient({ findInstallation: vi.fn().mockResolvedValue(null) });

    expect(await executeStatus(MANIFEST, client, (line) => lines.push(line))).toBe(EXIT_OK);
    expect(lines[0]).toContain("has not been applied");
  });
});
