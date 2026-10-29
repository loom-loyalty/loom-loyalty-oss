/**
 * Deep-set a value at a dotted path on a plain object, creating intermediate
 * objects/arrays as needed. Supports array indexing via `[N]` segments.
 *
 * Examples:
 *   setAtPath({}, "program.description", "hi") => { program: { description: "hi" } }
 *   setAtPath({}, "tiers[0].name", "Bronze")   => { tiers: [{ name: "Bronze" }] }
 *   setAtPath({ a: { b: 1 } }, "a.c", 2)        => { a: { b: 1, c: 2 } }
 *
 * Mutates the passed object and returns it.
 *
 * Rejects prototype-polluting paths: `__proto__`, `prototype`, `constructor`.
 * A malformed path throws before any mutation; callers that need atomicity
 * can validate first by passing a clone.
 */
// T is bounded to `object` rather than `Record<string, unknown>` so narrow
// interfaces (e.g. ProgramSpec) without an index signature can be passed
// directly. Internally we cast to `Record<string, unknown>` at the entry
// point — type-system nuisance the caller shouldn't have to carry.
export function setAtPath<T extends object>(target: T, path: string, value: unknown): T {
  if (!path) {
    throw new Error("setAtPath: path must be a non-empty string");
  }
  const segments = parsePath(path);
  if (segments.length === 0) {
    throw new Error(`setAtPath: path "${path}" produced no segments`);
  }

  let cursor: Record<string, unknown> | unknown[] = target as Record<string, unknown>;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    const next = segments[i + 1]!;
    const nextIsIndex = typeof next === "number";
    const existing = readSegment(cursor, seg);
    if (existing === undefined || existing === null) {
      const created: Record<string, unknown> | unknown[] = nextIsIndex ? [] : {};
      writeSegment(cursor, seg, created);
      cursor = created;
    } else if (typeof existing !== "object") {
      throw new Error(
        `setAtPath: segment "${String(seg)}" in path "${path}" has a non-object value; cannot descend`
      );
    } else {
      cursor = existing as Record<string, unknown> | unknown[];
    }
  }

  writeSegment(cursor, segments[segments.length - 1]!, value);
  return target;
}

type Segment = string | number;

function parsePath(path: string): Segment[] {
  const out: Segment[] = [];
  // Match alternating key tokens and [index] tokens. Regex is constant and safe
  // (no user-supplied pattern; only the input string is user-controlled).
  const tokenPattern = /([^.[\]]+)|\[(\d+)\]/g;
  while (true) {
    const hit = tokenPattern.exec(path);
    if (hit === null) break;
    if (hit[1] !== undefined) {
      const key = hit[1];
      assertSafeKey(key, path);
      out.push(key);
    } else if (hit[2] !== undefined) {
      out.push(Number(hit[2]));
    }
  }
  return out;
}

function assertSafeKey(key: string, path: string): void {
  if (key === "__proto__" || key === "prototype" || key === "constructor") {
    throw new Error(`setAtPath: path "${path}" contains forbidden key "${key}"`);
  }
}

function readSegment(cursor: Record<string, unknown> | unknown[], seg: Segment): unknown {
  if (typeof seg === "number") {
    if (!Array.isArray(cursor)) return undefined;
    return cursor[seg];
  }
  if (Array.isArray(cursor)) return undefined;
  return cursor[seg];
}

function writeSegment(
  cursor: Record<string, unknown> | unknown[],
  seg: Segment,
  value: unknown
): void {
  if (typeof seg === "number") {
    if (!Array.isArray(cursor)) {
      throw new Error(`setAtPath: cannot write numeric index to non-array segment`);
    }
    cursor[seg] = value;
    return;
  }
  if (Array.isArray(cursor)) {
    throw new Error(`setAtPath: cannot write string key "${seg}" to an array segment`);
  }
  cursor[seg] = value;
}
