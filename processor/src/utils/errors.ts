export type ProcessorErrorCode =
  | "INVALID_REQUEST"
  | "FILE_MISSING"
  | "FILE_EMPTY"
  | "FILE_TOO_LARGE"
  | "TOTAL_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "INVALID_FILE_EXTENSION"
  | "DUPLICATE_FILE_HEURISTIC"
  | "GEMINI_UPLOAD_FAILED"
  | "GEMINI_FILE_FAILED"
  | "GEMINI_FILE_TIMEOUT"
  | "GEMINI_REQUEST_FAILED"
  | "MODEL_OUTPUT_INVALID"
  | "SCHEMA_VALIDATION_FAILED"
  | "PROCESSING_TIMEOUT"
  | "PROCESSOR_INTERNAL_ERROR"
  | "GEMINI_EXTRACTION_UNAVAILABLE"
  | "RATE_LIMITED";

export class ProcessorError extends Error {
  code: ProcessorErrorCode;
  status: number;
  warnings?: string[];
  constructor(code: ProcessorErrorCode, status: number, message: string, warnings?: string[]) {
    super(message);
    this.code = code;
    this.status = status;
    this.warnings = warnings;
  }
}

export function toErrorResponse(err: unknown) {
  if (err instanceof ProcessorError) {
    return {
      status: err.status,
      body: { success: false, code: err.code, error: err.message, ...(err.warnings?.length ? { warnings: err.warnings } : {}) },
    };
  }
  return {
    status: 500,
    body: { success: false, code: "PROCESSOR_INTERNAL_ERROR" as ProcessorErrorCode, error: "Internal server error." },
  };
}
