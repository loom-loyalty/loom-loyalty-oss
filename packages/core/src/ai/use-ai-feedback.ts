/**
 * useAiFeedback Hook
 *
 * Submits thumbs up/down feedback on AI responses.
 */
import { useCallback, useState } from "react";

import type { AiConfig, AiFeedbackRequest } from "./types";

interface UseAiFeedbackOptions extends AiConfig {}

export function useAiFeedback(options: UseAiFeedbackOptions) {
  const { baseUrl, getToken, credentials } = options;
  const [submitting, setSubmitting] = useState(false);

  const submitFeedback = useCallback(
    async (threadId: string, feedback: AiFeedbackRequest) => {
      setSubmitting(true);
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (getToken) {
          const token = await getToken();
          headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(`${baseUrl}/api/ai/threads/${threadId}/feedback`, {
          method: "POST",
          headers,
          credentials: credentials ?? undefined,
          body: JSON.stringify(feedback),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } finally {
        setSubmitting(false);
      }
    },
    [baseUrl, getToken, credentials]
  );

  return { submitFeedback, submitting };
}
