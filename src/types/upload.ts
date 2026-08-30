export type DocumentKind = "question" | "answer";

export type UploadedFileMetadata = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  pageCount?: number;
};

export type FileValidationErrorCode =
  | "MISSING"
  | "EMPTY"
  | "TOO_LARGE"
  | "TOTAL_TOO_LARGE"
  | "INVALID_TYPE"
  | "INVALID_EXTENSION"
  | "DUPLICATE";

export type FileValidationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      code: FileValidationErrorCode;
      error: string;
    };

export type UploadSuccessResponse = {
  success: true;
  files: {
    question: UploadedFileMetadata;
    answer: UploadedFileMetadata;
  };
};

export type UploadErrorResponse = {
  success: false;
  error: string;
};
