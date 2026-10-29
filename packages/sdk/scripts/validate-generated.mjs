#!/usr/bin/env node
/**
 * Final gate of `pnpm generate`: refuses to hand tsc a generated tree that any
 * post-processing step left syntactically broken. Without it, a malformed file
 * only surfaces later as a confusing type-check failure in a downstream app.
 */

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

// This package's src, or the src of the package root passed as the first argument (a package
// without a generated class client is fine: a missing directory is skipped).
function srcDir() {
  return process.argv[2]
    ? join(resolve(process.argv[2]), "src")
    : fileURLToPath(new URL("../src/", import.meta.url));
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(fullPath);
    else if (entry.isFile() && entry.name.endsWith(".ts")) yield fullPath;
  }
}

/**
 * Syntax problems in one generated file, formatted like tsc output.
 * Only parse diagnostics are checked; type errors are left to `tsc`.
 */
export function syntaxProblems(displayPath, text) {
  if (text.trim() === "") return [`${displayPath}: file is empty`];

  const { diagnostics = [] } = ts.transpileModule(text, {
    fileName: displayPath,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
  });
  return diagnostics.map((diagnostic) => {
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
      diagnostic.start ?? 0
    );
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
    return `${displayPath}(${line + 1},${character + 1}): TS${diagnostic.code}: ${message}`;
  });
}

async function main() {
  const SRC_DIR = srcDir();
  const VALIDATED_DIRS = ["generated", "client"].map((dir) => join(SRC_DIR, dir));
  const problems = [];
  let fileCount = 0;

  for (const dir of VALIDATED_DIRS.filter((candidate) => existsSync(candidate))) {
    for await (const filePath of walk(dir)) {
      fileCount++;
      problems.push(
        ...syntaxProblems(relative(SRC_DIR, filePath), await readFile(filePath, "utf-8"))
      );
    }
  }

  if (problems.length > 0) {
    console.error(
      `\nGenerated SDK output is malformed (${problems.length} problem(s) across ${fileCount} files):`
    );
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(
      "\nRefusing to build from it. Re-run `pnpm generate`; if this reproduces, a post-processing step is at fault."
    );
    process.exit(1);
  }

  console.log(`Validated ${fileCount} generated files: no syntax errors`);
}

// Guard so importing this module for unit tests (e.g. `syntaxProblems`)
// doesn't also walk and validate the real generated tree as a side effect.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
}
