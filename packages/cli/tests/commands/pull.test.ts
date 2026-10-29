import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../../src/api/client.js";
import type { PackageManifestExport } from "../../src/api/types.js";
import { EXIT_ERROR, EXIT_OK } from "../../src/commands/manifest.js";
import {
  executePull,
  parsePullArgs,
  readIdentity,
  renderManifest,
  resolveCode,
  type PullFiles,
  type PullOptions,
} from "../../src/commands/pull.js";
import { parseManifest } from "../../src/manifest/load.js";
import { MANIFEST_SECTIONS, sectionRecordCount } from "../../src/manifest/schema.js";

const OPTIONS: PullOptions = {
  file: "loom-loyalty-config.yaml",
  deployment: "production",
  force: false,
};

/** An export as the Platform sends it: keys in its own order, empty sections absent. */
const EXPORT: PackageManifestExport = {
  manifest: {
    schema: "loom-loyalty-config.v1",
    code: "warp-up",
    tiers: [
      { code: "gold", name: "Gold", rank: 2, programCodes: ["warp-up"] },
      { code: "silver", name: "Silver", rank: 1, programCodes: ["warp-up"] },
    ],
    metadata: [{ type: "PROGRAM_TYPE", code: "LOYALTY", name: "Loyalty" }],
    programs: [{ code: "warp-up", name: "Warp Up", typeCode: "LOYALTY" }],
    dataModels: [
      {
        type: { code: "hotel-stay", name: "Hotel stay" },
        elements: [{ inputAttribute: "nights", typeReference: "INTEGER", array: false }],
      },
    ],
  },
  warnings: ["Event rule stay-tier: version 2 is a draft"],
};

function memoryFiles(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const files: PullFiles = {
    read: async (path) => store.get(path) ?? null,
    write: async (path, text) => {
      store.set(path, text);
    },
  };
  return { files, store };
}

function connectTo(exported: PackageManifestExport = EXPORT) {
  const exportManifest = vi.fn().mockResolvedValue(exported);
  const connect = vi.fn().mockResolvedValue({ exportManifest } as unknown as ApiClient);
  return { connect, exportManifest };
}

describe("parsePullArgs", () => {
  it("defaults to loom-loyalty-config.yaml on production without overwriting", () => {
    expect(parsePullArgs([])).toEqual(OPTIONS);
  });

  it("reads every option", () => {
    expect(
      parsePullArgs([
        "-f",
        "acme.yaml",
        "--deployment",
        "staging",
        "-t",
        "llk_x",
        "--code",
        "acme",
        "--program",
        "rewards",
        "--force",
      ])
    ).toEqual({
      file: "acme.yaml",
      deployment: "staging",
      token: "llk_x",
      code: "acme",
      program: "rewards",
      force: true,
    });
  });

  it("rejects a missing value, an unknown deployment and an unknown option", () => {
    expect(parsePullArgs(["--code"])).toEqual({ error: "--code requires the manifest's code" });
    expect(parsePullArgs(["--program", "--force"])).toEqual({
      error: "--program requires a program code",
    });
    expect(parsePullArgs(["--deployment", "moon"])).toMatchObject({ error: expect.any(String) });
    expect(parsePullArgs(["--env", "prod"])).toEqual({ error: "Unknown option: --env" });
  });

  it("asks for help", () => {
    expect(parsePullArgs(["--help"])).toEqual({ help: true });
  });
});

describe("resolveCode", () => {
  it("takes --code, else the existing file's code", () => {
    expect(resolveCode({ ...OPTIONS, code: "acme" }, null)).toEqual({ code: "acme" });
    expect(resolveCode(OPTIONS, { code: "warp-up" })).toEqual({ code: "warp-up" });
    expect(resolveCode({ ...OPTIONS, code: "warp-up" }, { code: "warp-up" })).toEqual({
      code: "warp-up",
    });
  });

  it("refuses a --code that differs from the file's, and no code at all", () => {
    expect(resolveCode({ ...OPTIONS, code: "acme" }, { code: "warp-up" })).toMatchObject({
      error: expect.stringContaining("differs"),
    });
    expect(resolveCode(OPTIONS, null)).toMatchObject({
      error: expect.stringContaining("--code is required"),
    });
    expect(resolveCode(OPTIONS, {})).toMatchObject({ error: expect.any(String) });
  });
});

describe("readIdentity", () => {
  it("reads the code and name of a file that wouldn't otherwise load", () => {
    expect(readIdentity("code: warp-up\nname: Warp Up\ntiers: 7\n")).toEqual({
      code: "warp-up",
      name: "Warp Up",
    });
  });

  it("reads nothing from broken YAML or a list", () => {
    expect(readIdentity("code: [")).toEqual({});
    expect(readIdentity("- a\n- b\n")).toEqual({});
  });
});

describe("sectionRecordCount", () => {
  it("counts a list's records and a hub that sets anything as one", () => {
    expect(sectionRecordCount([{ code: "a" }, { code: "b" }])).toBe(2);
    expect(sectionRecordCount({ theme: { primaryColor: "#123456" } })).toBe(1);
    expect(sectionRecordCount({})).toBe(0);
    expect(sectionRecordCount(null)).toBe(0);
    expect(sectionRecordCount(undefined)).toBe(0);
  });
});

describe("renderManifest", () => {
  const header = ["Pulled from production with treadle pull."];

  it("writes the identity first, then each section in the schema's order", () => {
    const yaml = renderManifest(EXPORT.manifest, { code: "warp-up", name: "Warp Up" }, header);

    expect(yaml).toBe(`# Pulled from production with treadle pull.
schema: loom-loyalty-config.v1
code: warp-up
name: Warp Up
dataModels:
  - type:
      code: hotel-stay
      name: Hotel stay
    elements:
      - inputAttribute: nights
        typeReference: INTEGER
        array: false
metadata:
  - type: PROGRAM_TYPE
    code: LOYALTY
    name: Loyalty
programs:
  - code: warp-up
    name: Warp Up
    typeCode: LOYALTY
tiers:
  - code: gold
    name: Gold
    rank: 2
    programCodes:
      - warp-up
  - code: silver
    name: Silver
    rank: 1
    programCodes:
      - warp-up
`);
  });

  it("writes the same bytes however the export orders its sections", () => {
    const reordered = Object.fromEntries(Object.entries(EXPORT.manifest).reverse());

    expect(renderManifest(reordered, { code: "warp-up" }, header)).toBe(
      renderManifest(EXPORT.manifest, { code: "warp-up" }, header)
    );
  });

  it("leaves out empty sections and keys this CLI doesn't know", () => {
    const yaml = renderManifest(
      { tiers: [], segments: [{ code: "welcome" }], programs: [{ code: "p" }], hub: {} },
      { code: "warp-up" },
      header
    );

    expect(yaml).not.toContain("tiers");
    expect(yaml).not.toContain("segments");
    expect(yaml).not.toContain("hub");
    expect(yaml).toContain("programs:");
  });

  it("writes the hub as one object after the flows", () => {
    const yaml = renderManifest(
      {
        hub: { theme: { primaryColor: "#123456" }, featureFlags: { showApiExplorer: true } },
        flows: [{ code: "welcome", name: "Welcome" }],
      },
      { code: "warp-up" },
      header
    );

    expect(yaml).toBe(`# Pulled from production with treadle pull.
schema: loom-loyalty-config.v1
code: warp-up
flows:
  - code: welcome
    name: Welcome
hub:
  theme:
    primaryColor: "#123456"
  featureFlags:
    showApiExplorer: true
`);
  });

  it("writes long strings on one line", () => {
    const description = "word ".repeat(40).trim();
    const yaml = renderManifest(
      { programs: [{ code: "p", description }] },
      { code: "warp-up" },
      header
    );

    expect(yaml).toContain(`description: ${description}\n`);
  });

  it("loads back as a manifest with every section the CLI knows", () => {
    const manifest = Object.fromEntries(
      MANIFEST_SECTIONS.map((section) => [
        section,
        section === "metadata"
          ? [{ type: "T", code: "V" }]
          : section === "dataModels"
            ? [{ type: { code: "m" } }]
            : section === "hub"
              ? { theme: { primaryColor: "#123456" } }
              : [{ code: "c" }],
      ])
    );

    const loaded = parseManifest(renderManifest(manifest, { code: "warp-up" }, header));

    expect(loaded.ok).toBe(true);
  });
});

describe("executePull", () => {
  it("writes a new file, asks for every section and prints the warnings", async () => {
    const { files, store } = memoryFiles();
    const { connect, exportManifest } = connectTo();
    const log = vi.fn();

    const code = await executePull({ ...OPTIONS, code: "warp-up" }, connect, files, log);

    expect(code).toBe(EXIT_OK);
    expect(exportManifest).toHaveBeenCalledWith({
      code: "warp-up",
      sections: MANIFEST_SECTIONS,
      program: undefined,
    });
    const written = store.get("loom-loyalty-config.yaml")!;
    expect(written.startsWith("# Pulled from production with treadle pull.\n")).toBe(true);
    expect(parseManifest(written).ok).toBe(true);
    const lines = log.mock.calls.map((call) => call[0] as string);
    expect(lines.some((line) => line.includes("Event rule stay-tier: version 2 is a draft"))).toBe(
      true
    );
    expect(lines.some((line) => line.includes("Wrote 5 records"))).toBe(true);
  });

  it("counts the hub as one record", async () => {
    const { files } = memoryFiles();
    const { connect } = connectTo({
      manifest: { ...EXPORT.manifest, hub: { theme: { primaryColor: "#123456" } } },
    });
    const log = vi.fn();

    await executePull({ ...OPTIONS, code: "warp-up" }, connect, files, log);

    const lines = log.mock.calls.map((call) => call[0] as string);
    expect(lines.some((line) => line.includes("Wrote 6 records"))).toBe(true);
  });

  it("refuses an existing file without --force, before connecting", async () => {
    const { files, store } = memoryFiles({ "loom-loyalty-config.yaml": "code: warp-up\n# mine\n" });
    const { connect } = connectTo();
    const log = vi.fn();

    const code = await executePull(OPTIONS, connect, files, log);

    expect(code).toBe(EXIT_ERROR);
    expect(connect).not.toHaveBeenCalled();
    expect(store.get("loom-loyalty-config.yaml")).toBe("code: warp-up\n# mine\n");
    expect(log.mock.calls[0]![0]).toContain("--force");
  });

  it("overwrites with --force, keeping the file's code and name", async () => {
    const { files, store } = memoryFiles({
      "loom-loyalty-config.yaml": "schema: loom-loyalty-config.v1\ncode: warp-up\nname: Warp Up\n",
    });
    const { connect, exportManifest } = connectTo();

    const code = await executePull(
      { ...OPTIONS, force: true, program: "warp-up" },
      connect,
      files,
      vi.fn()
    );

    expect(code).toBe(EXIT_OK);
    expect(exportManifest).toHaveBeenCalledWith(
      expect.objectContaining({ code: "warp-up", program: "warp-up" })
    );
    const written = store.get("loom-loyalty-config.yaml")!;
    expect(written).toContain("name: Warp Up\n");
    expect(written).toContain("# Pulled from program warp-up from production with treadle pull.");
  });

  it("refuses without a code, before connecting", async () => {
    const { files } = memoryFiles();
    const { connect } = connectTo();

    expect(await executePull(OPTIONS, connect, files, vi.fn())).toBe(EXIT_ERROR);
    expect(connect).not.toHaveBeenCalled();
  });

  it("writes nothing when the export doesn't load as a manifest", async () => {
    const { files, store } = memoryFiles();
    const { connect } = connectTo({
      manifest: { metadataTypes: [{ code: "T", unexpected: true }] },
    });
    const log = vi.fn();

    const code = await executePull({ ...OPTIONS, code: "warp-up" }, connect, files, log);

    expect(code).toBe(EXIT_ERROR);
    expect(store.size).toBe(0);
    expect(log.mock.calls[0]![0]).toContain("nothing was written");
  });

  it("writes the same bytes on a second pull of an unchanged organization", async () => {
    const { files, store } = memoryFiles();
    const { connect } = connectTo();
    await executePull({ ...OPTIONS, code: "warp-up" }, connect, files, vi.fn());
    const first = store.get("loom-loyalty-config.yaml");

    await executePull({ ...OPTIONS, force: true }, connect, files, vi.fn());

    expect(store.get("loom-loyalty-config.yaml")).toBe(first);
  });
});
