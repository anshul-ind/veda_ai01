import type { FileValidationResult } from "@/types/upload";

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MiB per file
export const MAX_TOTAL_UPLOAD_SIZE = 35 * 1024 * 1024; // 35 MiB combined

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
] as const;

export function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx === -1) return "";
  return fileName.slice(idx).toLowerCase();
}

/**
 * Sprint 2 validates declared MIME type + extension (metadata only).
 * File.type can be spoofed; no magic-byte/file-signature check in this sprint.
 */
export function validateSingleFile(file: File | null | undefined): FileValidationResult {
  if (!file) {
    return { valid: false, code: "MISSING", error: "Please select a file." };
  }

  if (typeof file !== "object" || !("size" in file) || !("name" in file)) {
    return { valid: false, code: "MISSING", error: "Invalid file." };
  }

  if (file.size === 0) {
    return { valid: false, code: "EMPTY", error: "File is empty." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      code: "TOO_LARGE",
      error: "File exceeds 20 MiB limit.",
    };
  }

  const ext = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return {
      valid: false,
      code: "INVALID_EXTENSION",
      error: "Invalid file extension. Use PDF, JPEG or PNG.",
    };
  }

  // Declared MIME validation (metadata only, not security guarantee)
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return {
      valid: false,
      code: "INVALID_TYPE",
      error: "Unsupported file type. Use PDF, JPEG or PNG.",
    };
  }

  return { valid: true };
}

export function validateTotalFileSize(
  questionFile: File | null,
  answerFile: File | null,
): FileValidationResult {
  if (!questionFile || !answerFile) return { valid: true };
  const total = questionFile.size + answerFile.size;
  if (total > MAX_TOTAL_UPLOAD_SIZE) {
    return {
      valid: false,
      code: "TOTAL_TOO_LARGE",
      error: "The two files together exceed the 35 MiB combined upload limit.",
    };
  }
  return { valid: true };
}

export function isDuplicateFileHeuristic(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

export function validateUploadFiles(
  questionFile: File | null,
  answerFile: File | null,
): { question: FileValidationResult; answer: FileValidationResult; total: FileValidationResult } {
  const question = validateSingleFile(questionFile);
  const answer = validateSingleFile(answerFile);
  const total = question.valid && answer.valid ? validateTotalFileSize(questionFile, answerFile) : { valid: true } as FileValidationResult;

  // Duplicate heuristic if both present and otherwise valid
  if (question.valid && answer.valid && questionFile && answerFile && isDuplicateFileHeuristic(questionFile, answerFile)) {
    const dup: FileValidationResult = {
      valid: false,
      code: "DUPLICATE",
      error: "Question Paper and Answer Sheet cannot be the same file.",
    };
    return { question, answer: dup, total };
  }

  return { question, answer, total };
}
