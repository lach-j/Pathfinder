import { api } from "../api";
import type { FeedbackResponse } from "../types";

export async function loadFeedbackMarkdown(workstreamId: string): Promise<string> {
  const response = await api<FeedbackResponse>(
    `/api/workstreams/${encodeURIComponent(workstreamId)}/feedback`
  );

  return response.markdown;
}
