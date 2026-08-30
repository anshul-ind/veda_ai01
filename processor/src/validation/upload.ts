import { ProcessorError } from "../utils/errors.js";

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_TOTAL_UPLOAD_SIZE = 35 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"] as const;

export function getFileExtension(name: string) {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx).toLowerCase();
}

export function validateFile(file: File, label: string) {
  if (file.size === 0) throw new ProcessorError("FILE_EMPTY", 400, `${label} is empty.`);
  if (file.size > MAX_FILE_SIZE) throw new ProcessorError("FILE_TOO_LARGE", 413, `${label} exceeds 20 MiB limit.`);
  const ext = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext as never)) throw new ProcessorError("INVALID_FILE_EXTENSION", 415, `${label}: Invalid file extension. Use PDF, JPEG or PNG.`);
  if (!ALLOWED_MIME_TYPES.includes(file.type as never)) throw new ProcessorError("INVALID_FILE_TYPE", 415, `${label}: Unsupported file type. Use PDF, JPEG or PNG.`);
}

export function validateUploadPair(questionFile: unknown, answerFile: unknown) {
  if (!(questionFile instanceof File)) throw new ProcessorError("FILE_MISSING", 400, "Question Paper is required.");
  if (!(answerFile instanceof File)) throw new ProcessorError("FILE_MISSING", 400, "Answer Sheet is required.");
  validateFile(questionFile, "Question Paper");
  validateFile(answerFile, "Answer Sheet");
  if (questionFile.size + answerFile.size > MAX_TOTAL_UPLOAD_SIZE)
    throw new ProcessorError("TOTAL_TOO_LARGE", 413, "The two files together exceed the 35 MiB combined upload limit.");
  if (
    questionFile.name === answerFile.name &&
    questionFile.size === answerFile.size &&
    questionFile.lastModified === answerFile.lastModified
  )
    throw new ProcessorError("DUPLICATE_FILE_HEURISTIC", 400, "Question Paper and Answer Sheet cannot be the same file.");
  return { questionFile, answerFile };
}
