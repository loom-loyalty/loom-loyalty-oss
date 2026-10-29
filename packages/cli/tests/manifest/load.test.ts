import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadManifest, parseManifest } from "../../src/manifest/load.js";

const VALID = `
schema: loom-loyalty-config.v1
code: warp-up
name: Warp Up
metadataTypes:
  - code: PROGRAM_TYPE
    name: Program Type
metadata:
  - type: PROGRAM_TYPE
    code: LOYALTY
    name: Loyalty
    description: { en: Loyalty }
programs:
  - code: warp-up
    name: Warp Up
    typeCode: LOYALTY
tiers:
  - code: apprentice
    name: Apprentice
    rank: 1
    programCodes: [warp-up]
`;

function problems(text: string): string[] {
  const result = parseManifest(text);
  return result.ok ? [] : result.problems;
}

describe("parseManifest", () => {
  it("reads a valid manifest and keeps each record's fields", () => {
    const result = parseManifest(VALID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.code).toBe("warp-up");
    expect(result.manifest.tiers?.[0]).toEqual({
      code: "apprentice",
      name: "Apprentice",
      rank: 1,
      programCodes: ["warp-up"],
    });
  });

  it("reads JSON, which is YAML 1.2", () => {
    const result = parseManifest(
      JSON.stringify({ schema: "loom-loyalty-config.v1", code: "warp-up" })
    );

    expect(result.ok).toBe(true);
  });

  it("rejects another schema", () => {
    expect(problems("schema: loom-loyalty-config.v2\ncode: warp-up\n")).toEqual([
      "schema: schema must be loom-loyalty-config.v1",
    ]);
  });

  it("rejects a misspelt section instead of ignoring it", () => {
    expect(problems("schema: loom-loyalty-config.v1\ncode: warp-up\ntier: []\n")[0]).toContain(
      "tier"
    );
  });

  it("names the record whose code is not a resource code", () => {
    const found = problems(
      "schema: loom-loyalty-config.v1\ncode: warp-up\ntiers:\n  - code: Gold Tier\n    name: Gold\n"
    );

    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^tiers\[0\]\.code: use lower-case letters/);
  });

  it("rejects a record without a code", () => {
    expect(
      problems("schema: loom-loyalty-config.v1\ncode: warp-up\nbadges:\n  - name: First Cloth\n")[0]
    ).toMatch(/^badges\[0\]\.code/);
  });

  it("rejects a code declared twice in one section", () => {
    const text = `${VALID}  - code: apprentice\n    name: Apprentice again\n`;

    expect(problems(text)).toEqual(["tiers: declares apprentice twice"]);
  });

  it("allows the same code in different sections", () => {
    const text = VALID.replace("tiers:\n  - code: apprentice", "tiers:\n  - code: warp-up");

    expect(parseManifest(text).ok).toBe(true);
  });

  it("reports a YAML syntax error and a duplicate key", () => {
    expect(problems("schema: [unclosed\n")).not.toEqual([]);
    expect(problems("schema: loom-loyalty-config.v1\ncode: a\ncode: b\n")[0]).toMatch(/unique/i);
  });

  it("caps a section at 500 records", () => {
    const tiers = Array.from({ length: 501 }, (_, i) => `  - code: t${i}\n`).join("");

    expect(problems(`schema: loom-loyalty-config.v1\ncode: warp-up\ntiers:\n${tiers}`)[0]).toMatch(
      /^tiers:/
    );
  });
});

describe("flows and hub", () => {
  const BASE = "schema: loom-loyalty-config.v1\ncode: warp-up\n";

  it("reads flows and the hub's four settings", () => {
    const result = parseManifest(`${BASE}flows:
  - code: welcome
    name: Welcome
    graph: { nodes: [], edges: [] }
hub:
  theme: { primaryColor: "#123456" }
  uiSettings: { defaultListView: table }
  entityOverrides: { customers: { label: Guests } }
  featureFlags: { showApiExplorer: true }
`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.flows?.[0]?.code).toBe("welcome");
    expect(result.manifest.hub?.featureFlags).toEqual({ showApiExplorer: true });
  });

  it("rejects a flow code declared twice", () => {
    expect(problems(`${BASE}flows:\n  - code: welcome\n  - code: welcome\n`)).toEqual([
      "flows: declares welcome twice",
    ]);
  });

  it("names the hub settings a manifest can't manage", () => {
    const found = problems(`${BASE}hub:
  theme: { primaryColor: "#123456" }
  subdomain: acme
  customComponents: { manifestUrl: https://example.com/manifest.json }
`);

    expect(found).toHaveLength(1);
    expect(found[0]).toContain("hub: can't manage subdomain, customComponents");
  });

  it("accepts an empty hub and rejects a setting that isn't an object", () => {
    expect(problems(`${BASE}hub: {}\n`)).toEqual([]);
    expect(problems(`${BASE}hub:\n  theme: [blue]\n`)).toHaveLength(1);
    expect(problems(`${BASE}hub:\n  entityOverrides: { customers: Guests }\n`)).toHaveLength(1);
  });

  it("rejects a feature flag that isn't true or false", () => {
    expect(problems(`${BASE}hub:\n  featureFlags: { showApiExplorer: "yes" }\n`)).toHaveLength(1);
  });
});

describe("loadManifest", () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("reads a file", async () => {
    dir = await mkdtemp(join(tmpdir(), "treadle-"));
    const file = join(dir, "loom-loyalty-config.yaml");
    await writeFile(file, VALID);

    expect((await loadManifest(file)).ok).toBe(true);
  });

  it("reports a missing file as a problem", async () => {
    const result = await loadManifest("/nonexistent/loom-loyalty-config.yaml");

    expect(result).toEqual({
      ok: false,
      problems: ["/nonexistent/loom-loyalty-config.yaml: not found"],
    });
  });
});
