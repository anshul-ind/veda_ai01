import { NextResponse } from "next/server";

import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  getFileExtension,
  isDuplicateFileHeuristic,
  MAX_FILE_SIZE,
  MAX_TOTAL_UPLOAD_SIZE,
} from "@/lib/validations";
import type { UploadedFileMetadata } from "@/types/upload";

// Sprint 2: local multipart contract validation only.
// This endpoint must NOT be treated as the final production heavy-file processing architecture.
// Sprint 3 will implement a separate processing service boundary for Gemini extraction
// so heavy processing is not coupled to Vercel's serverless request and execution constraints.
// The exact browser-to-processing-service upload strategy will be verified against the
// current deployment and Gemini Files API requirements.

function toMetadata(file: File): UploadedFileMetadata {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
  };
}

function validateServerFile(file: unknown, label: string): { valid: true; file: File } | { valid: false; status: number; error: string } {
  if (!(file instanceof File)) {
    return { valid: false, status: 400, error: `${label} is required.` };
  }

  if (file.size === 0) {
    return { valid: false, status: 400, error: `${label} is empty.` };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, status: 413, error: `${label} exceeds 20 MiB limit.` };
  }

  const ext = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return { valid: false, status: 415, error: `${label}: Invalid file extension. Use PDF, JPEG or PNG.` };
  }

  // Declared MIME validation (metadata only, not security guarantee; can be spoofed)
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return { valid: false, status: 415, error: `${label}: Unsupported file type. Use PDF, JPEG or PNG.` };
  }

  return { valid: true, file };
}

export async function POST(request: Request) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid multipart request." }, { status: 400 });
    }

    const questionRaw = formData.get("questionFile");
    const answerRaw = formData.get("answerFile");

    const qCheck = validateServerFile(questionRaw, "Question Paper");
    if (!qCheck.valid) {
      return NextResponse.json({ success: false, error: qCheck.error }, { status: qCheck.status });
    }

    const aCheck = validateServerFile(answerRaw, "Answer Sheet");
    if (!aCheck.valid) {
      return NextResponse.json({ success: false, error: aCheck.error }, { status: aCheck.status });
    }

    const questionFile = qCheck.file;
    const answerFile = aCheck.file;

    // Combined size
    if (questionFile.size + answerFile.size > MAX_TOTAL_UPLOAD_SIZE) {
      return NextResponse.json(
        { success: false, error: "The two files together exceed the 35 MiB combined upload limit." },
        { status: 413 },
      );
    }

    // Duplicate heuristic
    if (isDuplicateFileHeuristic(questionFile, answerFile)) {
      return NextResponse.json(
        { success: false, error: "Question Paper and Answer Sheet cannot be the same file." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        files: {
          question: toMetadata(questionFile),
          answer: toMetadata(answerFile),
        },
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}
