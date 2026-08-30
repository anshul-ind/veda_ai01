// Re-export canonical types inferred from Zod — single source of truth
export type {
  NormalizedRegion,
  ExtractedQuestion,
  ExtractedAnswer,
  ExtractedBlock,
  ExtractedLabel,
  ExtractedRegion,
  ExtractionMetadata,
  ExtractionData,
  ExtractionResult,
} from "@/lib/extraction-schema";

// Extraction stage for UI state machine (Sprint 3)
export type ExtractionStage =
  | "idle"
  | "validating"
  | "uploading"
  | "waiting_for_files"
  | "extracting_questions"
  | "extracting_answers"
  | "validating_output"
  | "done"
  | "error";
