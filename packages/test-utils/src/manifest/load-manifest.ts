/**
 * loadManifest — multi-strategy resolver for BE entity manifest JSON.
 *
 * The audit's L1 widget-mapping tests need to assert FE form fields against
 * the BE manifest's typeReference for each element. This resolver tries two
 * strategies in order:
 *
 *   1. process.env.LOOM_MANIFEST_DIR points at a directory of manifests
 *      ({ENTITY}.json), such as the backend's data-model manifest directory.
 *   2. Snapshot fallback at <feRoot>/test-snapshots/manifest/{ENTITY}.json,
 *      where feRoot is found by walking up looking for `pnpm-workspace.yaml`.
 *      Emits console.warn so callers know the test is running off a snapshot.
 *
 * If both fail, throws an Error listing every attempted path so the
 * developer knows exactly what to fix.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse as parsePath } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const FE_REPO_MARKER = "pnpm-workspace.yaml";
const SNAPSHOT_REL = ["test-snapshots", "manifest"] as const;

/** Entity codes are SCREAMING_SNAKE_CASE per BE convention; restricting here
 *  prevents path-traversal abuse via `loadManifest('../../etc')` and gives a
 *  clean error at the loader boundary instead of a far-away ENOENT. */
const ENTITY_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/** Minimal shape gate. Any valid JSON would otherwise be cast to Manifest
 *  and crash consumers far from the load site. We don't validate the full
 *  manifest contract here — the BE owns that — just enough to fail loud
 *  when a snapshot is empty / wrong-file / mid-write. `looseObject` keeps
 *  the rest of the manifest fields intact for downstream consumers. */
const manifestShapeSchema = z.looseObject({
  type: z.looseObject({
    code: z.string().min(1),
  }),
  elements: z.array(z.unknown()),
});

/** Minimal shape consumers can rely on. The full manifest carries more
 *  fields than this; we type the subset the audit code reads. */
export interface ManifestElement {
  inputAttribute?: string;
  outputAttribute: string;
  name: string;
  description?: { en?: string } | string;
  typeReference: string;
  metadataType?: string;
  metadataTypeCategory?: string;
  required: boolean;
  system?: boolean;
  sensitive?: boolean;
  array?: boolean;
  inputOnly?: boolean;
  outputOnly?: boolean;
  createOnly?: boolean;
  jsonSchema?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Manifest {
  type: {
    code: string;
    name: string;
    description?: { en?: string } | string;
  };
  elements: ManifestElement[];
  parentTypeReference?: string;
  [key: string]: unknown;
}

export interface LoadManifestOptions {
  /** Override the starting directory for the FE-root walk-up that finds the
   *  snapshot directory. Defaults to the directory of this module (resolves
   *  correctly for both source and built consumers since the package is
   *  sourceless: noEmit). */
  startDir?: string;
  /** Override the snapshot directory (skips the FE-root walk-up). Useful in
   *  unit tests with isolated temp dirs. */
  snapshotDir?: string;
}

/** Walk up from startDir looking for the FE repo root (marked by
 *  pnpm-workspace.yaml). Returns null if not found. */
function findFeRoot(startDir: string): string | null {
  let dir = startDir;
  const root = parsePath(dir).root;
  while (dir !== root) {
    if (existsSync(join(dir, FE_REPO_MARKER))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function readManifestFile(path: string): Manifest {
  const content = readFileSync(path, "utf8");
  // JSON.parse throws on malformed JSON; let it propagate so callers see
  // exactly why the manifest didn't load.
  const parsed: unknown = JSON.parse(content);
  // Minimal shape gate. Catches empty `{}`, `null`, `[]`, mid-write half-files,
  // and the wrong-file-resolved-to-manifest-path case. Throws with the path so
  // the failure points at the loader, not at a downstream consumer crash.
  const result = manifestShapeSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Manifest at ${path} does not match expected shape (must have type.code and elements[]): ${result.error.message}`
    );
  }
  return result.data as unknown as Manifest;
}

/** Resolve and load the BE manifest JSON for an entity. */
export function loadManifest(entityCode: string, options: LoadManifestOptions = {}): Manifest {
  if (!ENTITY_CODE_PATTERN.test(entityCode)) {
    throw new Error(
      `entityCode must be SCREAMING_SNAKE_CASE matching ${ENTITY_CODE_PATTERN} (got "${entityCode}")`
    );
  }
  const startDir = options.startDir ?? dirname(fileURLToPath(import.meta.url));
  const attempted: string[] = [];

  // Strategy 1: env var
  const envDir = process.env.LOOM_MANIFEST_DIR;
  if (envDir) {
    const envPath = join(envDir, `${entityCode}.json`);
    attempted.push(`LOOM_MANIFEST_DIR → ${envPath}`);
    if (existsSync(envPath)) {
      return readManifestFile(envPath);
    }
  } else {
    attempted.push("LOOM_MANIFEST_DIR (unset)");
  }

  // Strategy 2: snapshot fallback
  const snapshotDir = options.snapshotDir ?? defaultSnapshotDir(startDir, attempted);
  if (snapshotDir) {
    const snapshotPath = join(snapshotDir, `${entityCode}.json`);
    attempted.push(`snapshot → ${snapshotPath}`);
    if (existsSync(snapshotPath)) {
      console.warn(
        `[loadManifest] BE repo not available; using snapshot at ${snapshotPath}. ` +
          `Set LOOM_MANIFEST_DIR or run \`pnpm audit:sync-manifest\` to refresh.`
      );
      return readManifestFile(snapshotPath);
    }
  }

  throw new Error(
    `Could not resolve manifest for entity '${entityCode}'. Attempted:\n  - ${attempted.join("\n  - ")}`
  );
}

function defaultSnapshotDir(startDir: string, attempted: string[]): string | null {
  const feRoot = findFeRoot(startDir);
  if (!feRoot) {
    attempted.push(`snapshot → no FE repo root (no ${FE_REPO_MARKER}) found above ${startDir}`);
    return null;
  }
  return join(feRoot, ...SNAPSHOT_REL);
}
