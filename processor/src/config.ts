// processor/src/config.ts

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash";
export const PROCESSING_TIMEOUT_MS = Number(process.env.PROCESSING_TIMEOUT_MS ?? "120000");
export const DEFAULT_MAX_POLL_ATTEMPTS = 30;
export const EXTRACTION_PROMPT_VERSION = "1.2";
export const EXTRACTION_SCHEMA_VERSION = "1.1";
