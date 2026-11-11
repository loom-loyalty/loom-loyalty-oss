import type { Thread } from "@openuidev/react-headless";

/** One row of `/api/ai/threads`, as ai-server (Node and Worker paths) returns it. */
export interface ThreadRow {
  thread_id: string;
  title: string | null;
  created_at: string;
  updated_at?: string | null;
}

/** Headers for an AI server request: JSON, plus the bearer token when the app has one. */
export async function buildAiHeaders(
  getToken?: () => Promise<string>
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (getToken) headers["Authorization"] = `Bearer ${await getToken()}`;
  return headers;
}

/**
 * A thread row as the headless store (and the home page) shows it. The server
 * lists by last activity (`updated_at DESC`) and the store re-sorts by
 * `createdAt` whenever it merges a page or a new thread, so the activity time
 * goes in that slot and the list stays newest first. A blank title shows as
 * "Untitled".
 */
export function mapThreadRow(t: ThreadRow): Thread {
  return { id: t.thread_id, title: t.title || "Untitled", createdAt: t.updated_at || t.created_at };
}

export interface ListThreadsOptions {
  baseUrl: string;
  getToken?: () => Promise<string>;
  credentials?: RequestCredentials;
  cursor?: string;
  /** The server caps a page at 50 and defaults to it. */
  limit?: number;
  signal?: AbortSignal;
}

/** One page of the user's threads from `/api/ai/threads`. */
export async function listThreads({
  baseUrl,
  getToken,
  credentials,
  cursor,
  limit,
  signal,
}: ListThreadsOptions): Promise<{ threads: Thread[]; nextCursor: string | undefined }> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  const res = await fetch(`${baseUrl}/api/ai/threads${query ? `?${query}` : ""}`, {
    headers: await buildAiHeaders(getToken),
    credentials: credentials ?? undefined,
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { threads: ThreadRow[]; next_cursor?: string | null };
  return { threads: data.threads.map(mapThreadRow), nextCursor: data.next_cursor ?? undefined };
}
