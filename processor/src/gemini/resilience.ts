import { ProcessorError } from "../utils/errors.js";

export interface ResilienceOptions {
  primaryModel: string;
  fallbackModel: string;
  maxAttemptsPerModel?: number;
  baseDelaysMs?: number[];
  signal?: AbortSignal;
}

export function isRetryableError(error: any): boolean {
  if (!error) return false;

  // Do NOT retry schema validation or invalid request errors
  if (error instanceof ProcessorError) {
    if (
      error.status === 400 ||
      error.code === "SCHEMA_VALIDATION_FAILED" ||
      error.code === "MODEL_OUTPUT_INVALID" ||
      error.code === "INVALID_REQUEST"
    ) {
      return false;
    }
    if (error.status === 503 || error.status === 429 || error.code === "GEMINI_REQUEST_FAILED") {
      return true;
    }
  }

  const status = error.status || error.statusCode || error.response?.status;
  if (status === 503 || status === 429) return true;
  if (status === 400 || status === 401 || status === 403) return false;

  const msg = String(error.message || error.statusText || error || "").toLowerCase();

  if (
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("overloaded") ||
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("rate limit") ||
    msg.includes("quota exceeded") ||
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout")
  ) {
    return true;
  }

  return false;
}

function calculateJitteredDelay(baseMs: number): number {
  const jitter = baseMs * 0.2 * (Math.random() * 2 - 1);
  return Math.max(100, Math.round(baseMs + jitter));
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new ProcessorError("PROCESSING_TIMEOUT", 504, "Request aborted during retry delay."));
    }
    const timer = setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new ProcessorError("PROCESSING_TIMEOUT", 504, "Request aborted during retry delay."));
      },
      { once: true }
    );
  });
}

export async function executeWithResilience<T>(
  action: (model: string) => Promise<T>,
  options: ResilienceOptions
): Promise<{ result: T; modelUsed: string }> {
  const {
    primaryModel,
    fallbackModel,
    maxAttemptsPerModel = 3,
    baseDelaysMs = [1000, 2000],
    signal,
  } = options;

  const models = [primaryModel, fallbackModel].filter(Boolean);
  let lastError: any = null;

  for (const model of models) {
    console.log(`[resilience] Starting attempts with model: ${model}`);

    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
      if (signal?.aborted) {
        throw new ProcessorError("PROCESSING_TIMEOUT", 504, "Execution aborted.");
      }

      try {
        const result = await action(model);
        console.log(`[resilience] ✅ Execution succeeded on model '${model}' (attempt ${attempt}/${maxAttemptsPerModel})`);
        return { result, modelUsed: model };
      } catch (error) {
        lastError = error;

        const retryable = isRetryableError(error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        const causeMsg = error instanceof Error && error.cause ? String(error.cause) : 'no-cause';

        console.warn(
          `[resilience] Model '${model}' attempt ${attempt}/${maxAttemptsPerModel} failed. Retryable: ${retryable}. Error: ${errorMsg} Cause: ${causeMsg}`
        );

        if (!retryable) {
          console.error(`[resilience] Non-retryable error encountered. Aborting retries.`);
          throw error;
        }

        if (attempt < maxAttemptsPerModel) {
          const baseDelay = baseDelaysMs[attempt - 1] ?? 2000;
          const waitTime = calculateJitteredDelay(baseDelay);
          console.log(`[resilience] Backing off for ${waitTime}ms before attempt ${attempt + 1}...`);
          await delay(waitTime, signal);
        } else {
          console.warn(`[resilience] Exhausted all ${maxAttemptsPerModel} attempts on model '${model}'.`);
        }
      }
    }
  }

  console.error(
    `[resilience] All models (${models.join(
      ", "
    )}) exhausted retries for transient/503 issues. Throwing GEMINI_EXTRACTION_UNAVAILABLE.`
  );

  throw new ProcessorError(
    "GEMINI_EXTRACTION_UNAVAILABLE",
    503,
    `Gemini API is currently unavailable or experiencing high demand after retries on primary (${primaryModel}) and fallback (${fallbackModel}) models.`
  );
}
