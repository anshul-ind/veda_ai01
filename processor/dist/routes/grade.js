import { Hono } from "hono";
import { getGeminiClient } from "../gemini/client.js";
import { GEMINI_MODEL, GEMINI_FALLBACK_MODEL } from "../config.js";
import { executeWithResilience } from "../gemini/resilience.js";
import { ProcessorError, toErrorResponse } from "../utils/errors.js";
export const gradeRoute = new Hono();
const GRADING_PROMPT = `You are an expert exam grader. You will be given a question and a student's extracted answer text. Grade the student's answer objectively and return a structured JSON response.

Be strict but fair. Only award marks for content that is actually present in the answer text. Do not give benefit of the doubt for missing information.

Return ONLY valid JSON in this exact structure:
{
  "score": <number from 0 to maxMarks, use null if unable to assess>,
  "feedback": "<1-2 sentence overall feedback>",
  "strengths": ["<point 1>", "<point 2>"],
  "improvements": ["<point 1>", "<point 2>"],
  "warnings": ["<any concerns like illegible writing, off-topic, academic integrity>"]
}

Rules:
- score must be a number between 0 and maxMarks (inclusive), or null
- strengths/improvements/warnings must each be an array (empty array [] if none)
- feedback must be a non-empty string
- Do NOT fabricate content not present in the answer text
- Do NOT award partial marks for blank or irrelevant answers`;
gradeRoute.post("/grade", async (c) => {
    let body;
    try {
        body = await c.req.json();
    }
    catch {
        return c.json({ success: false, error: "Invalid JSON body." }, 400);
    }
    if (!body || typeof body !== "object") {
        return c.json({ success: false, error: "Request body must be a JSON object." }, 400);
    }
    const { questionId, questionText, answerText, maxMarks } = body;
    if (!questionId || typeof questionId !== "string" || !questionId.trim()) {
        return c.json({ success: false, error: "Missing or invalid 'questionId'." }, 400);
    }
    if (!questionText || typeof questionText !== "string" || !questionText.trim()) {
        return c.json({ success: false, error: "Missing or invalid 'questionText'." }, 400);
    }
    if (!answerText || typeof answerText !== "string" || !answerText.trim()) {
        return c.json({ success: false, error: "Missing or invalid 'answerText'." }, 400);
    }
    const parsedMaxMarks = typeof maxMarks === "number" ? maxMarks : Number(maxMarks);
    if (isNaN(parsedMaxMarks) || parsedMaxMarks < 0) {
        return c.json({ success: false, error: "Missing or invalid 'maxMarks'." }, 400);
    }
    try {
        const client = getGeminiClient();
        const prompt = [
            GRADING_PROMPT,
            `\n---`,
            `QUESTION: ${questionText.trim()}`,
            `MAXIMUM MARKS: ${parsedMaxMarks}`,
            `STUDENT ANSWER: ${answerText.trim()}`,
        ].join("\n");
        const { result: rawText, modelUsed } = await executeWithResilience(async (model) => {
            const response = await client.models.generateContent({
                model,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    temperature: 0,
                    responseMimeType: "application/json",
                    responseJsonSchema: {
                        type: "object",
                        properties: {
                            score: { type: "number" },
                            feedback: { type: "string" },
                            strengths: { type: "array", items: { type: "string" } },
                            improvements: { type: "array", items: { type: "string" } },
                            warnings: { type: "array", items: { type: "string" } },
                        },
                        required: ["feedback", "strengths", "improvements", "warnings"],
                    },
                },
            });
            return response.text ?? "";
        }, { primaryModel: GEMINI_MODEL, fallbackModel: GEMINI_FALLBACK_MODEL });
        console.info(`[grade] Graded '${questionId}' using model '${modelUsed}'`);
        let parsed;
        try {
            const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
            parsed = JSON.parse(cleaned);
        }
        catch {
            throw new ProcessorError("MODEL_OUTPUT_INVALID", 502, "Grading model returned invalid JSON.");
        }
        // Clamp score to [0, maxMarks]
        let score = null;
        if (typeof parsed.score === "number" && !isNaN(parsed.score)) {
            score = Math.min(parsedMaxMarks, Math.max(0, Math.round(parsed.score * 10) / 10));
        }
        const grade = {
            questionId: questionId,
            score,
            maxScore: parsedMaxMarks,
            status: "graded",
            feedback: typeof parsed.feedback === "string" ? parsed.feedback : null,
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter((s) => typeof s === "string") : [],
            improvements: Array.isArray(parsed.improvements) ? parsed.improvements.filter((s) => typeof s === "string") : [],
            warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((s) => typeof s === "string") : [],
        };
        return c.json({ success: true, grade }, 200);
    }
    catch (e) {
        const err = toErrorResponse(e);
        return c.json({ success: false, error: err.body.error }, err.status);
    }
});
