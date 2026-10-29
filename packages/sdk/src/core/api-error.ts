/**
 * The error the SDK throws for a failed API call.
 *
 * The platform answers errors with RFC 9457 problem details plus a stable
 * `code`, a user-safe `message`, `requestId` and `fieldErrors`, while still
 * carrying the legacy `success`/`errors[]` envelope. `ApiError` reads either
 * shape, so it works against releases before and after the change.
 */

export interface ApiFieldError {
  /** Dotted JSON path of the failing field, e.g. `address.postcode`. */
  field: string;
  code?: string;
  message: string;
}

export interface ApiErrorInit {
  message: string;
  status: number;
  code?: string;
  requestId?: string;
  fieldErrors?: ApiFieldError[];
  params?: Record<string, unknown>;
  type?: string;
  title?: string;
  details?: Record<string, unknown>;
  data?: unknown;
}

export class ApiError extends Error {
  status: number;
  statusCode: number;
  /** Catalog code (e.g. `CUSTOMER_ALREADY_MERGED`), or the legacy numeric code as a string. */
  code?: string;
  requestId?: string;
  fieldErrors: ApiFieldError[];
  params?: Record<string, unknown>;
  type?: string;
  title?: string;
  details?: Record<string, unknown>;
  /** The error envelope's `data`, when the API returned one with the failure. */
  data?: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.statusCode = init.status;
    this.code = init.code;
    this.requestId = init.requestId;
    this.fieldErrors = init.fieldErrors ?? [];
    this.params = init.params;
    this.type = init.type;
    this.title = init.title;
    this.details = init.details;
    this.data = init.data;
  }
}

/** True for content types the SDK parses as JSON, including `application/problem+json`. */
export function isJsonContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

const CATALOG_CODE = /^[A-Z][A-Z0-9_]*$/;

/**
 * The stable catalog code of an error, or undefined when the error has none
 * (a legacy numeric code such as `"400"`, a plain `Error`, or a non-object).
 */
export function getErrorCode(error: unknown): string | undefined {
  const code = nonEmptyString(asRecord(error)?.code);
  return code && CATALOG_CODE.test(code) ? code : undefined;
}

/** The request id to quote to support, when the API returned one. */
export function getRequestId(error: unknown): string | undefined {
  return nonEmptyString(asRecord(error)?.requestId);
}

/** Field-level failures, skipping malformed entries. */
export function getFieldErrors(error: unknown): ApiFieldError[] {
  const raw = asRecord(error)?.fieldErrors;
  if (!Array.isArray(raw)) return [];
  const result: ApiFieldError[] = [];
  for (const entry of raw) {
    const record = asRecord(entry);
    const field = nonEmptyString(record?.field);
    const message = nonEmptyString(record?.message);
    if (field && message) {
      result.push({ field, code: nonEmptyString(record?.code), message });
    }
  }
  return result;
}

/** True when the error carries one of the given catalog codes. */
export function isApiErrorCode(error: unknown, ...codes: string[]): boolean {
  const code = getErrorCode(error);
  return code !== undefined && codes.includes(code);
}

export interface ApiErrorResponseInfo {
  status: number;
  statusText?: string;
  /** The `x-request-id` header; older releases only send the id there. */
  requestIdHeader?: string | null;
  /** The body as text, used for the message when it was not JSON. */
  rawText?: string | null;
  /** Code when the body has none (default: the HTTP status). */
  defaultCode?: string;
}

/** Coerce a structured `message` to JSON so callers never see "[object Object]". */
function messageText(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value.length > 0 ? value : undefined;
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

/**
 * Build the `ApiError` for a failed response from its parsed body, which may be
 * problem details, the legacy `{ success: false, errors: [...] }` envelope, both
 * or neither. Every SDK entry point uses this, so they all throw the same shape.
 */
export function apiErrorFromBody(body: unknown, info: ApiErrorResponseInfo): ApiError {
  const record = asRecord(body);
  const envelopeError = Array.isArray(record?.errors) ? asRecord(record.errors[0]) : null;
  const rawText = info.rawText?.trim() ? info.rawText.slice(0, 2048) : undefined;
  const envelopeCode = envelopeError?.code;

  return new ApiError({
    message:
      messageText(record?.message) ??
      messageText(envelopeError?.message) ??
      // Truncated so a stack trace dump doesn't fill the message.
      rawText ??
      nonEmptyString(info.statusText) ??
      `Request failed with status ${String(info.status)}`,
    code:
      nonEmptyString(record?.code) ??
      (envelopeCode != null && envelopeCode !== "" ? String(envelopeCode) : undefined) ??
      info.defaultCode ??
      String(info.status),
    status: info.status,
    // The body's id wins over the header.
    requestId: nonEmptyString(record?.requestId) ?? nonEmptyString(info.requestIdHeader),
    fieldErrors: getFieldErrors(record),
    params: asRecord(record?.params) ?? undefined,
    type: nonEmptyString(record?.type),
    title: nonEmptyString(record?.title),
    details: asRecord(record?.details) ?? undefined,
    // Some failures carry a payload, such as a package install's 409 with the plan of every
    // conflicting record; keep it so callers can show more than the first message.
    data: record?.data,
  });
}
