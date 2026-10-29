import type { ProgramSpec } from "../spec.js";

export type DocumentFormatId = "markdown" | "excel" | "word";

/** Stock `Partial<T>` only makes top-level fields optional; this recurses. */
export type DeepPartial<T> =
  T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

export interface DocumentFormat {
  id: DocumentFormatId;
  fileExtensions: string[];
  mimeTypes: string[];

  /** Uint8Array (not Buffer) so browser and Node consumers share the contract without polyfills. */
  parse(buffer: Uint8Array, opts?: ParseOptions): Promise<ParseResult>;

  /** Optional — formats that can't round-trip (e.g. docx) omit render; consumers detect via presence check. */
  render?: (spec: ProgramSpec, opts?: RenderOptions) => Promise<RenderResult>;
}

export interface ParseOptions {
  lenient?: boolean;
}

export interface ParseResult {
  partial: DeepPartial<ProgramSpec>;
  pendingExtractions: FreeformExtractionRequest[];
  warnings: Warning[];
}

export interface RenderOptions {
  includeSampleData?: boolean;
}

export interface RenderResult {
  buffer: Uint8Array;
  warnings: Warning[];
}

export interface Warning {
  code: string;
  message: string;
  line?: number;
  col?: number;
  field?: string;
}

export interface FreeformExtractionRequest {
  /** Dotted path of the target field, e.g. `"program.description"`. */
  expectedField: string;
  sectionContent: string;
  sourceLocation?: { line: number; col: number };
}

export interface FreeformExtractionResult {
  expectedField: string;
  value: unknown;
  /** 0.0 - 1.0; callers surface <0.7 as a user-facing warning before execute. */
  confidence: number;
  sourceLocation?: { line: number; col: number };
}

/**
 * UPDATE-mode dispatch contract — shared between ai-server (which builds
 * the response from the hydrator) and the hub (which consumes it to
 * translate user-checked deltas into POST /apply-update operations).
 * Defined here so both sides agree on the wire shape without
 * re-deriving the type in each package.
 *
 * Tier endpoints accept `code` as the URL identifier; everything else
 * uses its own *Id field. The map flattens that asymmetry so callers
 * can look up `entityIds.<type>[code]` (or `.id` for singletons)
 * without knowing per-resource URL conventions.
 */
export type ApplyEntityType =
  | "tier"
  | "badge"
  | "currency"
  | "expiryRule"
  | "pendingRule"
  | "eventRule"
  | "target";

export interface EntityIdsMap {
  /** Owning program's id — required on every CREATE payload (`programIds: [programId]`). */
  programId: string;
  tiers: Record<string, string>;
  badges: Record<string, string>;
  currency?: { id: string };
  expiryRule?: { id: string };
  pendingRule?: { id: string };
  eventRules: Record<string, string>;
  /**
   * Tier code → CounterTarget id (UUID). Populated for progression
   * tiers (rank > 1) which are backed by a CounterTarget carrying the
   * pointsThreshold value. Base tier (rank 1) has no entry. Used by
   * `buildApplyOperations` to route a tier `pointsThreshold` delta to a
   * `target` UPDATE op (the underlying target is what actually changes;
   * the Tier endpoint has no `pointsThreshold` field).
   */
  tierTargets?: Record<string, string>;
}

export type ApplyOperation =
  | { op: "create"; entityType: ApplyEntityType; payload: Record<string, unknown> }
  | {
      op: "update";
      entityType: ApplyEntityType;
      id: string;
      payload: Record<string, unknown>;
    }
  | { op: "delete"; entityType: ApplyEntityType; id: string };

export interface FailedApplyOperation {
  operation: ApplyOperation;
  /**
   * Curated error envelope.
   *   - `message`: stable, human-readable category text the UI can show
   *     when nothing more specific is available.
   *   - `code`: stable category the UI can branch on (INVALID_REQUEST,
   *     AUTH_FAILED, FORBIDDEN, NOT_FOUND, CONFLICT, VALIDATION_ERROR,
   *     RATE_LIMITED, PLATFORM_ERROR, UNKNOWN_ERROR).
   *   - `status`: HTTP status returned by the platform.
   *   - `platformCode` / `platformMessage` / `platformDetails`: pass-
   *     through of the platform's own error envelope so QA, on-call,
   *     and the hub UI can root-cause without server-log access. These
   *     are the platform's actual response body, not curated. They may
   *     carry constraint names or column refs — that is a deliberate
   *     trade-off for an authenticated B2B admin surface, where the
   *     caller is already authorized for the data being mutated.
   *   - `requestId`: the platform's request id, the support reference
   *     for finding the failing call in platform logs.
   */
  error: {
    message: string;
    code?: string;
    status?: number;
    platformCode?: string;
    platformMessage?: string;
    platformDetails?: Record<string, unknown>;
    requestId?: string;
  };
}

export interface ApplyUpdateResult {
  status: "ok" | "partial";
  applied: ApplyOperation[];
  failed: FailedApplyOperation[];
}
