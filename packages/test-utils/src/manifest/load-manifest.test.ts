/**
 * Tests for loadManifest — multi-strategy resolver for BE manifest JSON.
 *
 * Each test uses a real temp-dir fixture (rather than fs mocks) to exercise
 * the real path-walking logic. The function takes optional `startDir` and
 * `snapshotDir` overrides for test injection.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadManifest } from "./load-manifest.js";

interface FakeManifest {
  type: { code: string; name: string };
  elements: Array<{
    name: string;
    outputAttribute: string;
    typeReference: string;
    required: boolean;
  }>;
}

function fakeManifest(code: string): FakeManifest {
  return {
    type: { code, name: code },
    elements: [
      {
        name: "Code",
        outputAttribute: "code",
        typeReference: "STRING",
        required: true,
      },
    ],
  };
}

function setupManifestDir(root: string, manifests: FakeManifest[]): string {
  const manifestDir = join(root, "manifests");
  mkdirSync(manifestDir, { recursive: true });
  for (const m of manifests) {
    writeFileSync(join(manifestDir, `${m.type.code}.json`), JSON.stringify(m));
  }
  return manifestDir;
}

describe("loadManifest", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "loom-test-utils-"));
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  describe("env-var resolution (LOOM_MANIFEST_DIR)", () => {
    it("loads manifest from LOOM_MANIFEST_DIR when env var is set", () => {
      const manifestDir = setupManifestDir(tmpRoot, [fakeManifest("METADATA")]);
      vi.stubEnv("LOOM_MANIFEST_DIR", manifestDir);

      const manifest = loadManifest("METADATA");

      expect(manifest).toMatchObject({
        type: { code: "METADATA" },
        elements: [{ name: "Code", outputAttribute: "code" }],
      });
    });

    it("ignores LOOM_MANIFEST_DIR when the manifest file is not present there", () => {
      const manifestDir = setupManifestDir(tmpRoot, [fakeManifest("METADATA")]);
      vi.stubEnv("LOOM_MANIFEST_DIR", manifestDir);

      const snapshotDir = join(tmpRoot, "snapshots");
      mkdirSync(snapshotDir, { recursive: true });
      writeFileSync(join(snapshotDir, "OFFER.json"), JSON.stringify(fakeManifest("OFFER-snap")));

      const startDir = join(tmpRoot, "isolated");
      mkdirSync(startDir, { recursive: true });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      const manifest = loadManifest("OFFER", { startDir, snapshotDir });
      expect(manifest).toMatchObject({ type: { code: "OFFER-snap" } });
      warn.mockRestore();
    });
  });

  describe("snapshot fallback", () => {
    it("falls back to the snapshot dir and emits a console.warn", () => {
      const snapshotDir = join(tmpRoot, "snapshots");
      mkdirSync(snapshotDir, { recursive: true });
      writeFileSync(
        join(snapshotDir, "METADATA.json"),
        JSON.stringify(fakeManifest("METADATA-snap"))
      );

      const startDir = join(tmpRoot, "isolated", "deep", "path");
      mkdirSync(startDir, { recursive: true });

      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const manifest = loadManifest("METADATA", { startDir, snapshotDir });

      expect(manifest).toMatchObject({ type: { code: "METADATA-snap" } });
      expect(warn).toHaveBeenCalledTimes(1);
      const warnMessage = String(warn.mock.calls[0]?.[0] ?? "");
      expect(warnMessage).toMatch(/snapshot/i);
      expect(warnMessage).toContain(join(snapshotDir, "METADATA.json"));
      warn.mockRestore();
    });
  });

  describe("error path", () => {
    it("throws with all attempted paths when nothing resolves", () => {
      const startDir = join(tmpRoot, "isolated");
      mkdirSync(startDir, { recursive: true });
      const snapshotDir = join(tmpRoot, "non-existent-snapshots");

      expect(() => loadManifest("METADATA", { startDir, snapshotDir })).toThrow(
        /Could not resolve manifest/
      );

      try {
        loadManifest("METADATA", { startDir, snapshotDir });
      } catch (err) {
        const msg = (err as Error).message;
        expect(msg).toContain("METADATA");
        expect(msg).toContain("LOOM_MANIFEST_DIR");
        expect(msg).toContain(snapshotDir);
      }
    });

    it("throws on malformed manifest JSON (does not silently swallow)", () => {
      const manifestDir = join(tmpRoot, "manifests");
      mkdirSync(manifestDir, { recursive: true });
      writeFileSync(join(manifestDir, "METADATA.json"), "{ not valid json");
      vi.stubEnv("LOOM_MANIFEST_DIR", manifestDir);

      expect(() => loadManifest("METADATA")).toThrow();
    });

    it("throws on JSON that is structurally valid but wrong shape (e.g., null)", () => {
      const manifestDir = join(tmpRoot, "manifests");
      mkdirSync(manifestDir, { recursive: true });
      writeFileSync(join(manifestDir, "METADATA.json"), "null");
      vi.stubEnv("LOOM_MANIFEST_DIR", manifestDir);

      expect(() => loadManifest("METADATA")).toThrow(/expected shape/i);
    });

    it("throws on empty-object manifest (missing type, missing elements)", () => {
      const manifestDir = join(tmpRoot, "manifests");
      mkdirSync(manifestDir, { recursive: true });
      writeFileSync(join(manifestDir, "METADATA.json"), "{}");
      vi.stubEnv("LOOM_MANIFEST_DIR", manifestDir);

      expect(() => loadManifest("METADATA")).toThrow(/expected shape/i);
    });
  });

  describe("entityCode validation", () => {
    it("rejects path-traversal in entityCode", () => {
      expect(() => loadManifest("../../etc/passwd")).toThrow(/SCREAMING_SNAKE_CASE/);
      expect(() => loadManifest("../OFFER")).toThrow(/SCREAMING_SNAKE_CASE/);
    });

    it("rejects lowercase entityCode", () => {
      expect(() => loadManifest("metadata")).toThrow(/SCREAMING_SNAKE_CASE/);
    });

    it("rejects entityCode with slashes or dots", () => {
      expect(() => loadManifest("METADATA/OFFER")).toThrow(/SCREAMING_SNAKE_CASE/);
      expect(() => loadManifest("METADATA.json")).toThrow(/SCREAMING_SNAKE_CASE/);
    });

    it("rejects empty entityCode", () => {
      expect(() => loadManifest("")).toThrow(/SCREAMING_SNAKE_CASE/);
    });

    it("accepts canonical SCREAMING_SNAKE_CASE", () => {
      const manifestDir = setupManifestDir(tmpRoot, [fakeManifest("CUSTOMER_AUDIENCE")]);
      vi.stubEnv("LOOM_MANIFEST_DIR", manifestDir);

      const manifest = loadManifest("CUSTOMER_AUDIENCE");
      expect(manifest.type.code).toBe("CUSTOMER_AUDIENCE");
    });
  });
});
