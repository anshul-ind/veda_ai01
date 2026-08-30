import { getGeminiClient } from "./client.js";
import { ProcessorError } from "../utils/errors.js";
import { ANSWER_EXTRACTION_PROMPT, QUESTION_EXTRACTION_PROMPT, } from "../extraction/prompts.js";
import { GEMINI_MODEL } from "../config.js";
/**
 * Normalizes bounding box coordinates to { x, y, width, height }
 * guaranteed to be within [0, 1] bounds as required by normalizedRegionSchema.
 */
function normalizeRegion(r) {
    if (!r || typeof r !== "object")
        return { x: 0.1, y: 0.1, width: 0.8, height: 0.2 };
    let x = typeof r.x === "number" ? r.x : (typeof r.xmin === "number" ? r.xmin : 0.1);
    let y = typeof r.y === "number" ? r.y : (typeof r.ymin === "number" ? r.ymin : 0.1);
    let width = typeof r.width === "number" ? r.width : (typeof r.xmax === "number" && typeof r.xmin === "number" ? r.xmax - r.xmin : 0.8);
    let height = typeof r.height === "number" ? r.height : (typeof r.ymax === "number" && typeof r.ymin === "number" ? r.ymax - r.ymin : 0.2);
    x = Math.max(0, Math.min(0.95, x));
    y = Math.max(0, Math.min(0.95, y));
    width = Math.max(0.01, Math.min(1 - x, width));
    height = Math.max(0.01, Math.min(1 - y, height));
    return {
        x: Number(x.toFixed(4)),
        y: Number(y.toFixed(4)),
        width: Number(width.toFixed(4)),
        height: Number(height.toFixed(4)),
    };
}
/**
 * Logs raw Gemini output before JSON parsing.
 * This is required for Sprint 3 debugging and validation.
 */
function logRawOutput(documentType, raw) {
    console.log(`\n========== GEMINI RAW ${documentType.toUpperCase()} OUTPUT ==========`);
    console.log(raw);
    console.log(`========== END RAW ${documentType.toUpperCase()} OUTPUT ==========\n`);
}
/**
 * Removes markdown code fences if Gemini returns ```json ... ```
 */
function cleanGeminiJson(raw) {
    const trimmed = raw.trim();
    if (trimmed.startsWith("```json") || trimmed.startsWith("```JSON")) {
        return trimmed
            .replace(/^```(?:json|JSON)\s*/i, "")
            .replace(/\s*```$/, "")
            .trim();
    }
    if (trimmed.startsWith("```")) {
        return trimmed
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/, "")
            .trim();
    }
    return trimmed;
}
/**
 * Parses Gemini text output into JSON.
 */
function parseGeminiJson(raw, documentType) {
    if (!raw.trim()) {
        throw new ProcessorError("MODEL_OUTPUT_INVALID", 502, `Gemini returned an empty ${documentType} extraction response.`);
    }
    const cleaned = cleanGeminiJson(raw);
    try {
        return JSON.parse(cleaned);
    }
    catch (error) {
        console.error(`[gemini:${documentType}] Failed to parse JSON.`);
        console.error(`[gemini:${documentType}] Parse error:`, error);
        console.error(`[gemini:${documentType}] Raw response:`, cleaned);
        throw new ProcessorError("MODEL_OUTPUT_INVALID", 502, `Gemini returned invalid JSON for ${documentType} extraction.`);
    }
}
/**
 * Ensures that the uploaded Gemini file has the required URI.
 */
function validateFileReference(fileUri, mimeType, documentType) {
    if (!fileUri?.trim()) {
        throw new ProcessorError("INVALID_REQUEST", 400, `Missing Gemini file URI for ${documentType} extraction.`);
    }
    if (!mimeType?.trim()) {
        throw new ProcessorError("INVALID_REQUEST", 400, `Missing MIME type for ${documentType} extraction.`);
    }
}
/**
 * Extract structured question data from a question paper.
 */
export async function extractQuestions(fileUri, mimeType, signal) {
    validateFileReference(fileUri, mimeType, "question");
    if (signal?.aborted) {
        throw new ProcessorError("PROCESSING_TIMEOUT", 504, "Question extraction was aborted.");
    }
    const client = getGeminiClient();
    console.log("[gemini:questions] Starting extraction");
    console.log("[gemini:questions] Model:", GEMINI_MODEL);
    console.log("[gemini:questions] MIME type:", mimeType);
    console.log("[gemini:questions] File URI:", fileUri);
    try {
        const response = await client.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            fileData: {
                                fileUri,
                                mimeType,
                            },
                        },
                        {
                            text: QUESTION_EXTRACTION_PROMPT,
                        },
                    ],
                },
            ],
            config: {
                temperature: 0,
                responseMimeType: "application/json",
                responseJsonSchema: {
                    type: "object",
                    properties: {
                        questions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "string" },
                                    index: { type: "integer" },
                                    questionText: { type: "string" },
                                    maxMarks: { type: "number" },
                                    pageIndex: { type: "integer" },
                                },
                                required: ["id", "index", "questionText", "maxMarks", "pageIndex"],
                            },
                        },
                        blocks: { type: "array", items: { type: "object", properties: { id: { type: "string" }, type: { type: "string" } } } },
                        labels: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, type: { type: "string" } } } },
                        regions: { type: "array", items: { type: "object", properties: { id: { type: "string" }, type: { type: "string" }, pageIndex: { type: "integer" } } } },
                    },
                    required: ["questions"],
                },
            },
        });
        if (signal?.aborted) {
            throw new ProcessorError("PROCESSING_TIMEOUT", 504, "Question extraction was aborted.");
        }
        const raw = response.text ?? "";
        logRawOutput("question", raw);
        const parsed = parseGeminiJson(raw, "question");
        if (parsed && typeof parsed === "object") {
            if (Array.isArray(parsed.blocks)) {
                parsed.blocks = parsed.blocks.map((b) => b.region ? { ...b, region: normalizeRegion(b.region) } : b);
            }
            if (Array.isArray(parsed.labels)) {
                parsed.labels = parsed.labels.map((l) => l.region ? { ...l, region: normalizeRegion(l.region) } : l);
            }
            if (Array.isArray(parsed.regions)) {
                parsed.regions = parsed.regions.map((r) => ({ ...r, region: normalizeRegion(r.region ?? r) }));
            }
        }
        return parsed;
    }
    catch (error) {
        if (error instanceof ProcessorError) {
            throw error;
        }
        console.error("[gemini:questions] Extraction failed:", error);
        throw new ProcessorError("GEMINI_REQUEST_FAILED", 502, "Failed to extract structured data from the question document.");
    }
}
/**
 * Extract structured answer data from an answer sheet.
 */
export async function extractAnswers(fileUri, mimeType, questionContext, signal) {
    validateFileReference(fileUri, mimeType, "answer");
    if (!Array.isArray(questionContext)) {
        throw new ProcessorError("INVALID_REQUEST", 400, "Question context must be an array.");
    }
    if (questionContext.length === 0) {
        throw new ProcessorError("INVALID_REQUEST", 400, "Cannot extract answers because question context is empty.");
    }
    if (signal?.aborted) {
        throw new ProcessorError("PROCESSING_TIMEOUT", 504, "Answer extraction was aborted.");
    }
    const client = getGeminiClient();
    console.log("[gemini:answers] Starting extraction");
    console.log("[gemini:answers] Model:", GEMINI_MODEL);
    console.log("[gemini:answers] MIME type:", mimeType);
    console.log("[gemini:answers] File URI:", fileUri);
    console.log("[gemini:answers] Question context count:", questionContext.length);
    try {
        const response = await client.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            fileData: {
                                fileUri,
                                mimeType,
                            },
                        },
                        {
                            text: `${ANSWER_EXTRACTION_PROMPT}\n\nQUESTION CONTEXT:\n${JSON.stringify(questionContext, null, 2)}\n`,
                        },
                    ],
                },
            ],
            config: {
                temperature: 0,
                responseMimeType: "application/json",
                responseJsonSchema: {
                    type: "object",
                    properties: {
                        answers: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "string" },
                                    questionId: { type: "string" },
                                    answerText: { type: "string" },
                                    pageIndex: { type: "integer" },
                                    region: {
                                        type: "object",
                                        properties: {
                                            x: { type: "number" },
                                            y: { type: "number" },
                                            width: { type: "number" },
                                            height: { type: "number" },
                                        },
                                        required: ["x", "y", "width", "height"],
                                    },
                                },
                                required: ["id", "questionId", "answerText", "pageIndex", "region"],
                            },
                        },
                        blocks: { type: "array", items: { type: "object" } },
                        labels: { type: "array", items: { type: "object" } },
                        regions: { type: "array", items: { type: "object" } },
                        unmappedAnswers: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "string" },
                                    answerText: { type: "string" },
                                    pageIndex: { type: "integer" },
                                    region: {
                                        type: "object",
                                        properties: {
                                            x: { type: "number" },
                                            y: { type: "number" },
                                            width: { type: "number" },
                                            height: { type: "number" },
                                        },
                                    },
                                    reason: { type: "string" },
                                },
                                required: ["id", "answerText", "pageIndex", "region", "reason"],
                            },
                        },
                    },
                    required: ["answers"],
                },
            },
        });
        if (signal?.aborted) {
            throw new ProcessorError("PROCESSING_TIMEOUT", 504, "Answer extraction was aborted.");
        }
        const raw = response.text ?? "";
        logRawOutput("answer", raw);
        const parsed = parseGeminiJson(raw, "answer");
        if (parsed && typeof parsed === "object") {
            if (Array.isArray(parsed.answers)) {
                parsed.answers = parsed.answers.map((a) => ({
                    ...a,
                    region: normalizeRegion(a.region),
                }));
            }
            if (Array.isArray(parsed.unmappedAnswers)) {
                parsed.unmappedAnswers = parsed.unmappedAnswers.map((u) => ({
                    ...u,
                    region: normalizeRegion(u.region),
                }));
            }
            if (Array.isArray(parsed.blocks)) {
                parsed.blocks = parsed.blocks.map((b) => b.region ? { ...b, region: normalizeRegion(b.region) } : b);
            }
            if (Array.isArray(parsed.labels)) {
                parsed.labels = parsed.labels.map((l) => l.region ? { ...l, region: normalizeRegion(l.region) } : l);
            }
            if (Array.isArray(parsed.regions)) {
                parsed.regions = parsed.regions.map((r) => ({ ...r, region: normalizeRegion(r.region ?? r) }));
            }
        }
        return parsed;
    }
    catch (error) {
        if (error instanceof ProcessorError) {
            throw error;
        }
        console.error("[gemini:answers] Extraction failed:", error);
        throw new ProcessorError("GEMINI_REQUEST_FAILED", 502, "Failed to extract structured data from the answer document.");
    }
}
