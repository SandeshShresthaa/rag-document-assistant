import { setTimeout as delay } from "node:timers/promises";

export const busyMessage = "The AI model is busy. Please try again in a moment.";

export function isBusyError(error: unknown): boolean {
  const status = getStatus(error);
  return status === 429 || status === 503;
}

function getStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
    return error.status;
  }
}

type RetryOptions = {
  models: string[];
  signal?: AbortSignal;
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
};

export async function generateWithRetry<T>(
  generate: (model: string) => Promise<T>,
  { models, signal, wait = (ms, abortSignal) => delay(ms, undefined, { signal: abortSignal }) }: RetryOptions,
): Promise<T> {
  const candidates = [...new Set(models.filter(Boolean))];
  if (!candidates.length) throw new Error("GEMINI_MODEL must be configured.");

  for (const [index, model] of candidates.entries()) {
    for (let attempt = 0; attempt < 3; attempt++) {
      signal?.throwIfAborted();
      try {
        return await generate(model);
      } catch (error) {
        signal?.throwIfAborted();
        const hasFallback = index < candidates.length - 1;
        // A missing/retired model is not retried, but can use a configured fallback.
        if (getStatus(error) === 404 && hasFallback) break;
        if (!isBusyError(error)) throw error;
        if (attempt < 2) {
          await wait(1000 * 2 ** attempt, signal);
        } else if (hasFallback) {
          break;
        } else {
          throw error;
        }
      }
    }
  }
  throw new Error("No configured model could answer.");
}
