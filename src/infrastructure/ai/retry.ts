import { AI_DEFAULTS } from "@/domain/ai/config";

export async function withAiRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = AI_DEFAULTS.maxRetries
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("AI request failed after retries");
}
