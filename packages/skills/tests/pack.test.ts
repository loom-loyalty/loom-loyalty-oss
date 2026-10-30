import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createZip, listSkills, packSkills, SKILLS_DIR } from "../src/index.js";

/** Reads a zip's entries back from its local file headers. */
function readZip(zip: Buffer): Map<string, string> {
  const files = new Map<string, string>();
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const size = zip.readUInt32LE(offset + 18);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const start = offset + 30 + nameLength + extraLength;
    files.set(name, inflateRawSync(zip.subarray(start, start + size)).toString("utf8"));
    offset = start + size;
  }
  return files;
}

describe("createZip", () => {
  it("round-trips file contents and paths", () => {
    const zip = createZip([
      { path: "a/SKILL.md", data: Buffer.from("hello") },
      { path: "a/references/x.md", data: Buffer.from("ünïcode") },
    ]);
    expect([...readZip(zip)]).toEqual([
      ["a/SKILL.md", "hello"],
      ["a/references/x.md", "ünïcode"],
    ]);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
  });

  it("gives the same bytes for the same files", () => {
    const entries = [{ path: "a.md", data: Buffer.from("x") }];
    expect(createZip(entries).equals(createZip(entries))).toBe(true);
  });
});

describe("packSkills", () => {
  let out: string;

  beforeEach(() => {
    out = mkdtempSync(join(tmpdir(), "skills-pack-"));
  });

  afterEach(() => {
    rmSync(out, { recursive: true, force: true });
  });

  it("writes one zip per skill with a top-level skill folder", () => {
    const zips = packSkills({ outDir: join(out, "skills") });
    expect(zips).toHaveLength(listSkills().length);
    const campaign = readZip(readFileSync(join(out, "skills", "loom-loyalty-campaign.zip")));
    expect(campaign.get("loom-loyalty-campaign/SKILL.md")).toMatch(
      /^---\nname: loom-loyalty-campaign/
    );
    expect([...campaign.keys()].every((path) => path.startsWith("loom-loyalty-campaign/"))).toBe(
      true
    );
  });

  it("clears zips from an earlier run", () => {
    const dir = join(out, "skills");
    packSkills({ outDir: dir });
    writeFileSync(join(dir, "loom-loyalty-removed.zip"), "stale");
    packSkills({ outDir: dir });
    expect(readdirSync(dir)).not.toContain("loom-loyalty-removed.zip");
    expect(readdirSync(dir)).toHaveLength(listSkills().length);
  });

  it("writes nothing when a skill matches a block rule", () => {
    const source = join(out, "source");
    cpSync(SKILLS_DIR, source, { recursive: true });
    writeFileSync(
      join(source, "loom-loyalty-offer", "references", "leak.md"),
      "See stagemcp.example\n"
    );
    expect(() =>
      packSkills({
        outDir: join(out, "skills"),
        source,
        blockRules: [{ pattern: "stagemcp", reason: "non-production host" }],
      })
    ).toThrow(/loom-loyalty-offer\/references\/leak\.md:1 \[non-production host\]/);
    expect(() => readdirSync(join(out, "skills"))).toThrow();
  });
});
