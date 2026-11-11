/** What a tool returns instead of throwing, so the model can tell the shopper what happened. */
export interface ToolError {
  error: string;
}

export const MEMBER_NOT_FOUND: ToolError = { error: "Member not found." };

export class MemberNotFound extends Error {}
export class OtherMembersData extends Error {}
class TimedOut extends Error {}
class Cancelled extends Error {}

function statusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

/**
 * Maps any failure to a fixed message. Messages never include the error's own text, which can
 * echo request details, so the API key can't reach the model or the shopper.
 */
export function toToolError(error: unknown, readFailed: string): ToolError {
  if (error instanceof MemberNotFound) return MEMBER_NOT_FOUND;
  if (error instanceof OtherMembersData) return { error: readFailed };
  if (error instanceof TimedOut)
    return { error: "Loom Loyalty took too long to answer. Try again in a moment." };
  if (error instanceof Cancelled) return { error: "The request was cancelled." };
  switch (statusOf(error)) {
    case 401:
      return { error: "The Loom Loyalty API key is invalid or has been revoked." };
    case 403:
      return { error: "The Loom Loyalty API key isn't allowed to read this." };
    case 429:
      return { error: "Loom Loyalty is busy. Try again in a moment." };
    default:
      return { error: "Loom Loyalty couldn't answer right now. Try again in a moment." };
  }
}

export function isNotFound(error: unknown): boolean {
  return statusOf(error) === 404;
}

/** Races `work` against a timeout and the AI SDK's abort signal. */
export async function bounded<T>(
  work: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const limits = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimedOut()), timeoutMs);
    if (signal) {
      if (signal.aborted) reject(new Cancelled());
      onAbort = () => reject(new Cancelled());
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
  try {
    return await Promise.race([work, limits]);
  } finally {
    clearTimeout(timer);
    if (signal && onAbort) signal.removeEventListener("abort", onAbort);
  }
}
