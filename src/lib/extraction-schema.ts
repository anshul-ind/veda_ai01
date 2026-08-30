import { z } from "zod";

export const normalizedRegionSchema = z
  .object({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    width: z.number().finite().gt(0).max(1),
    height: z.number().finite().gt(0).max(1),
  })
  .superRefine((region, context) => {
    if (region.x + region.width > 1) context.addIssue({ code: "custom", message: "region x + width must not exceed 1" });
    if (region.y + region.height > 1) context.addIssue({ code: "custom", message: "region y + height must not exceed 1" });
  });

export const canonicalRegionSchema = z.object({
  x1: z.number().min(0).max(1000),
  y1: z.number().min(0).max(1000),
  x2: z.number().min(0).max(1000),
  y2: z.number().min(0).max(1000),
  page: z.number().int().nonnegative(),
  coordinateSource: z.literal("gemini_estimated").default("gemini_estimated"),
});

export const extractedQuestionSchema = z.object({
  id: z.string().regex(/^q_[1-9]\d*$/),
  index: z.number().int().positive(),
  questionText: z.string().trim().min(1),
  maxMarks: z.number().finite().nonnegative(),
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

export const extractedAnswerSchema = z.object({
  id: z.string().regex(/^a_[1-9]\d*$/),
  questionId: z.string().regex(/^q_[1-9]\d*$/),
  answerText: z.string().trim().min(1),
  awardedMarks: z.number().finite().nonnegative().optional(),
  maxMarks: z.number().finite().nonnegative().optional(),
  scoreStatus: z.enum(["correct", "partial", "incorrect", "UNGRADED"]).optional(),
  aiFeedback: z.string().trim().optional(),
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

const auditBlockSchema = z.object({ id: z.string().min(1), type: z.string().min(1), label: z.string().optional(), pageIndex: z.number().int().nonnegative().optional(), region: normalizedRegionSchema.optional() });
const auditLabelSchema = z.object({ id: z.string().min(1), text: z.string().min(1), type: z.string().min(1), pageIndex: z.number().int().nonnegative().optional(), region: normalizedRegionSchema.optional() });
const auditRegionSchema = z.object({ id: z.string().min(1), type: z.string().min(1), pageIndex: z.number().int().nonnegative(), region: normalizedRegionSchema });

export const extractionMetadataSchema = z.object({
  model: z.string().min(1),
  processedAt: z.string().datetime(),
  extractionVersion: z.literal("1.1"),
});

export const extractionDataSchema = z.object({
  questions: z.array(extractedQuestionSchema).min(1),
  answers: z.array(extractedAnswerSchema).default([]),
  blocks: z.array(auditBlockSchema).default([]),
  labels: z.array(auditLabelSchema).default([]),
  regions: z.array(auditRegionSchema).default([]),
  canonical: z.object({
    questions: z.array(canonicalQuestionSchema).default([]),
    answerBlocks: z.array(canonicalAnswerBlockSchema).default([]),
  }).optional(),
  mappings: z.array(questionAnswerMappingSchema).optional(),
  metadata: extractionMetadataSchema,
});

export const extractionResultSchema = z.object({
  success: z.literal(true),
  schemaVersion: z.literal("1.1"),
  data: extractionDataSchema,
  warnings: z.array(z.string()).default([]),
});

export type NormalizedRegion = z.infer<typeof normalizedRegionSchema>;
export type CanonicalRegion = z.infer<typeof canonicalRegionSchema>;
export type ExtractedQuestion = z.infer<typeof extractedQuestionSchema>;
export type CanonicalQuestion = z.infer<typeof canonicalQuestionSchema>;
export type ExtractedAnswer = z.infer<typeof extractedAnswerSchema>;
export type CanonicalAnswerBlock = z.infer<typeof canonicalAnswerBlockSchema>;
export type MappingEvidence = z.infer<typeof mappingEvidenceSchema>;
export type QuestionAnswerMapping = z.infer<typeof questionAnswerMappingSchema>;
export type ExtractedBlock = z.infer<typeof auditBlockSchema>;
export type ExtractedLabel = z.infer<typeof auditLabelSchema>;
export type ExtractedRegion = z.infer<typeof auditRegionSchema>;
export type ExtractionMetadata = z.infer<typeof extractionMetadataSchema>;
export type ExtractionData = z.infer<typeof extractionDataSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
