import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * A server-only app (a Next.js route, a Worker, an AI SDK tool) uses `@loom-loyalty/sdk/core`
 * and `@loom-loyalty/sdk/client` with an API key. It must install without React, TanStack Query
 * or WorkOS, which only the hooks entry point needs.
 */

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

const UI_ONLY_PEERS = ["react", "@tanstack/react-query", "@workos-inc/authkit-react"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("server-only install", () => {
  it.each(UI_ONLY_PEERS)("marks %s as an optional peer dependency", (name) => {
    expect(packageJson.peerDependencies?.[name]).toBeDefined();
    expect(packageJson.peerDependenciesMeta?.[name]?.optional).toBe(true);
  });

  it("keeps zod a required peer", () => {
    expect(packageJson.peerDependencies?.zod).toBeDefined();
    expect(packageJson.peerDependenciesMeta?.zod?.optional).not.toBe(true);
  });

  it.each(["core", "client"])("src/%s imports no UI-only peer at runtime", (entry) => {
    const offenders = sourceFiles(join(packageRoot, "src", entry)).filter((file) => {
      const text = readFileSync(file, "utf8");
      return UI_ONLY_PEERS.some((peer) =>
        new RegExp(`^import (?!type )[^;]*from ["']${peer.replace("/", "\\/")}`, "m").test(text)
      );
    });
    expect(offenders).toEqual([]);
  });
});
