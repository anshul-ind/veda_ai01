import { z } from "zod";
// =======================================================
// COMMON
// =======================================================
const nonNegativeNumber = z.number().finite().nonnegative();
export const normalizedRegionSchema = z
    .object({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    width: z.number().finite().gt(0).max(1),
    height: z.number().finite().gt(0).max(1),
})
    .superRefine((region, ctx) => {
    if (region.x + region.width > 1) {
        ctx.addIssue({
            code: "custom",
            message: "region x + width must not exceed 1",
        });
    }
    if (region.y + region.height > 1) {
        ctx.addIssue({
            code: "custom",
            message: "region y + height must not exceed 1",
        });
    }
});
// =======================================================
// CANONICAL 0-1000 REGION
// =======================================================
export const canonicalRegionSchema = z.object({
    x1: z.number().min(0).max(1000),
    y1: z.number().min(0).max(1000),
    x2: z.number().min(0).max(1000),
    y2: z.number().min(0).max(1000),
    page: z.number().int().positive().default(1),
    coordinateSource: z.literal("gemini_estimated").default("gemini_estimated"),
});
// =======================================================
// QUESTIONS
// =======================================================
export const questionSchema = z.object({
    id: z.string().regex(/^q_[1-9]\d*$/, "Question ids must use q_<number>"),
    index: z.number().int().positive(),
    questionText: z.string().trim().min(1),
    maxMarks: nonNegativeNumber,
    pageIndex: z.number().int().nonnegative(),
});
export const canonicalQuestionSchema = z.object({
    id: z.string(),
    order: z.number().int().positive(),
    label: z.string().nullable(),
    normalizedLabel: z.string().nullable(),
    parentQuestionId: z.string().nullable(),
    type: z.enum(["main", "sub", "unknown"]),
    text: z.string(),
    maxMarks: z.number().finite().nonnegative().default(1),
    page: z.number().int().positive().default(1),
    regions: z.array(canonicalRegionSchema).default([]),
    warnings: z.array(z.string()).default([]),
});
// =======================================================
// ANSWERS
// =======================================================
export const answerSchema = z.object({
    id: z.string().regex(/^a_[1-9]\d*$/, "Answer ids must use a_<number>"),
    questionId: z.string().regex(/^q_[1-9]\d*$/, "questionId must use q_<number>"),
    answerText: z.string().trim().min(1),
    pageIndex: z.number().int().nonnegative(),
    region: normalizedRegionSchema,
});
export const canonicalAnswerBlockSchema = z.object({
    id: z.string(),
    order: z.number().int().positive(),
    label: z.string().nullable(),
    normalizedLabel: z.string().nullable(),
    parentAnswerBlockId: z.string().nullable(),
    text: z.string(),
    page: z.number().int().positive().default(1),
    regions: z.array(canonicalRegionSchema).default([]),
    warnings: z.array(z.string()).default([]),
});
// =======================================================
// MAPPING & EVIDENCE
// =======================================================
export const mappingEvidenceSchema = z.object({
    label: z.number(),
    structural: z.number(),
    semantic: z.literal(0),
    reasons: z.array(z.string()),
});
export const questionAnswerMappingSchema = z.object({
    // null when status === "unmatched" (orphan answer block with no question)
    questionId: z.string().nullable(),
    answerBlockId: z.string().nullable(),
    confidence: z.number().min(0).max(1),
    status: z.enum(["matched", "uncertain", "unanswered", "unmatched"]),
    evidence: mappingEvidenceSchema,
});
// =======================================================
// BLOCKS, LABELS, REGIONS
// =======================================================
export const auditBlockSchema = z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    label: z.string().optional(),
    pageIndex: z.number().int().nonnegative().optional(),
    region: normalizedRegionSchema.optional(),
});
export const auditLabelSchema = z.object({
    id: z.string().min(1),
    text: z.string().min(1),
    type: z.string().min(1),
    pageIndex: z.number().int().nonnegative().optional(),
    region: normalizedRegionSchema.optional(),
});
export const auditRegionSchema = z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    pageIndex: z.number().int().nonnegative(),
    region: normalizedRegionSchema,
});
// =======================================================
// PAYLOADS
// =======================================================
export const questionPayloadSchema = z.object({
    questions: z.array(questionSchema).min(1),
    blocks: z.array(auditBlockSchema).default([]),
    labels: z.array(auditLabelSchema).default([]),
    regions: z.array(auditRegionSchema).default([]),
});
export const unmappedAnswerSchema = z.object({
    id: z.string().min(1),
    answerText: z.string().trim().min(1),
    pageIndex: z.number().int().nonnegative(),
    region: normalizedRegionSchema,
    reason: z.string().trim().min(1),
});
export const answerPayloadSchema = z.object({
    answers: z.array(answerSchema).default([]),
    unmappedAnswers: z.array(unmappedAnswerSchema).default([]),
    blocks: z.array(auditBlockSchema).default([]),
    labels: z.array(auditLabelSchema).default([]),
    regions: z.array(auditRegionSchema).default([]),
});
