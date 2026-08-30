export class ProcessorError extends Error {
    code;
    status;
    warnings;
    constructor(code, status, message, warnings) {
        super(message);
        this.code = code;
        this.status = status;
        this.warnings = warnings;
    }
}
export function toErrorResponse(err) {
    if (err instanceof ProcessorError) {
        return {
            status: err.status,
            body: { success: false, code: err.code, error: err.message, ...(err.warnings?.length ? { warnings: err.warnings } : {}) },
        };
    }
    return {
        status: 500,
        body: { success: false, code: "PROCESSOR_INTERNAL_ERROR", error: "Internal server error." },
    };
}
