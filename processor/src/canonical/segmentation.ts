import type {
  Answer,
  CanonicalAnswerBlock,
  NormalizedRegion,
} from "../extraction/schema.js";
import { buildCanonicalAnswerBlocks, normalizeLabel } from "./normalizer.js";

/**
 * Structural-header detection with an auditable, deterministic result.
 *
 * Returns BOTH whether the text is a structural artifact AND which named pattern
 * matched, so callers can log exclusions (rather than silently dropping content).
 *
 * A block is treated as a structural artifact when known printed header/pattern
 * forms appear, or when the block is short ALL-CAPS printed text (a strong signal
 * it is a document header, not a handwritten mixed-case student answer).
 */
export type StructuralHeaderDetection = {
  isHeader: boolean;
  pattern: string | null;
};

export function detectStructuralHeader(text: string | null | undefined): StructuralHeaderDetection {
  if (!text) return { isHeader: false, pattern: null };
  const trimmed = text.trim();
  if (!trimmed) return { isHeader: false, pattern: null };

  const headerPatterns: Array<{ p: RegExp; n: string }> = [
    // SECTION A / SECTION B / SECTION - A etc.
    { p: /SECTION\s+[A-Z]/i, n: "SECTION_HEADER" },
    // (Multiple Choice Questions) / (Short Answer Questions - Type I) / (Long Answer Questions) etc.
    { p: /\(\s*(multiple\s+choice|short\s+answer|long\s+answer|very\s+short)[^)]*\)/i, n: "SECTION_TYPE_LABEL" },
    // PART I / PART - A etc.
    { p: /^PART\s*[-–—:]*\s*[0-9A-Z]/i, n: "PART_HEADER" },
    // ANSWERS - CLASS 10 SCIENCE / ANSWERS - CLASS X SCIENCE
    { p: /^ANSWERS?\s*[-–—]\s*CLASS/i, n: "ANSWER_CLASS_TITLE" },
    // QUESTION PAPER (REF ...) / QUESTION PAPER - REF ...
    { p: /^QUESTION\s+PAPER(?:\s*|-)\s*\(?REF/i, n: "QUESTION_PAPER_REF" },
    { p: /^QUESTION\s+PAPER(?:[-–—:]\s*.*)?$/i, n: "QUESTION_PAPER" },
    // (GENERAL) INSTRUCTIONS ...
    { p: /^(?:GENERAL\s+)?INSTRUCTIONS/i, n: "INSTRUCTIONS_HEADER" },
    { p: /^CLASS\s+[0-9IVXLCDM]+\s+(?:SCIENCE|MATHEMATICS|PHYSICS|CHEMISTRY|BIOLOGY|EXAM)?/i, n: "CLASS_LINE" },
    { p: /^MULTIPLE\s+CHOICE\s+QUESTIONS/i, n: "MCQ_HEADER" },
    // "MAX. MARKS", "TIME ALLOWED", "ROLL NO." style boilerplate headers
    { p: /^(?:MAX\.?\s*)?MARKS(?:[: ])/i, n: "MARKS_HEADER" },
    { p: /^TIME\s+(?:ALLOWED|DURATION)/i, n: "TIME_HEADER" },
    { p: /^ROLL\s*NO[.:]/i, n: "ROLLNO_HEADER" },
    // Page numbers / margin notes style: "Page 1", "PAGE 1 OF 2"
    { p: /^PAGE\s*\d+/i, n: "PAGE_NUMBER" },
  ];

  for (const { p, n } of headerPatterns) {
    if (p.test(trimmed)) return { isHeader: true, pattern: n };
  }

  // Secondary signal: short ALL-CAPS printed text with no lowercase letters at all.
  // Handwritten student answers in this dataset are consistently mixed-case.
  const onlyAsciiLetters = /^[A-Z0-9\s().,:;'"\-–—!?&%#/\\+]+$/.test(trimmed);
  if (onlyAsciiLetters) {
    const hasUppercase = /[A-Z]/.test(trimmed);
    const noLowercase = !/[a-z]/.test(trimmed);
    const lengthOk = trimmed.length <= 60;
    if (hasUppercase && noLowercase && lengthOk) {
      return { isHeader: true, pattern: "ALL_CAPS_SHORT" };
    }
  }

  return { isHeader: false, pattern: null };
}

/**
 * Boolean wrapper for the header detector (keeps existing imports valid).
 */
export function isStructuralHeader(text: string | null | undefined): boolean {
  return detectStructuralHeader(text).isHeader;
}

/**
 * Strips leading structural section headers from answer text if erroneously included by LLM.
 */
export function cleanAnswerText(text: string): { cleanedText: string; strippedHeader: string | null } {
  if (!text) return { cleanedText: "", strippedHeader: null };

  const lines = text.split("\n");
  if (lines.length > 1 && detectStructuralHeader(lines[0]).isHeader) {
    const stripped = lines[0].trim();
    const remaining = lines.slice(1).join("\n").trim();
    return { cleanedText: remaining.length > 0 ? remaining : text, strippedHeader: stripped };
  }

  return { cleanedText: text, strippedHeader: null };
}

/**
 * Logs an excluded structural artifact for auditability.
 */
function logExcludedHeader(
  text: string,
  pattern: string,
  source: "answer" | "unmapped" | "block",
  region?: NormalizedRegion | null
) {
  console.log(
    `[segmentation:excluded] ${JSON.stringify({
      excludedText: text.slice(0, 120),
      matchedPattern: pattern,
      source,
      region: region ?? undefined,
    })}`
  );
}

/**
 * Deterministic Answer Segmentation:
 * Takes extracted answers, unmapped answers, and raw text blocks to assemble canonical answer blocks.
 *
 * FIX (BUG 2 - Hardened structural-artifact exclusion):
 * Structural/header artifacts are now EXCLUDED authoritatively BEFORE they can ever
 * become a CanonicalAnswerBlock (and thus before they can ever be mapped). Previously
 * unmapped header blocks were pushed in with only a warning and could still be mapped
 * if the anchored pattern missed a merged/mis-segmented header. Each exclusion is
 * logged for auditability; nothing is silently dropped.
 */
export function segmentAnswers(
  rawAnswers: Answer[],
  unmappedAnswers: Array<{ id: string; answerText: string; pageIndex: number; region?: NormalizedRegion; reason: string }> = [],
  rawBlocks: Array<{ id: string; label?: string; region?: NormalizedRegion; pageIndex?: number }> = []
): CanonicalAnswerBlock[] {
  // Authoritatively exclude and clean raw answers (cleans merged leading headers AND
  // drops any block that is still a pure header artifact even after cleaning).
  const survivingAnswers: Answer[] = [];
  for (const ans of rawAnswers) {
    const { cleanedText, strippedHeader } = cleanAnswerText(ans.answerText);
    const effectiveText = strippedHeader ? cleanedText : ans.answerText;

    const det = detectStructuralHeader(effectiveText);
    if (det.isHeader) {
      logExcludedHeader(effectiveText, det.pattern ?? "UNKNOWN", "answer", ans.region);
      continue; // NEVER becomes a canonical block; never eligible for mapping
    }
    survivingAnswers.push(strippedHeader ? { ...ans, answerText: effectiveText } : ans);
  }

  const canonicalBlocks = buildCanonicalAnswerBlocks(survivingAnswers, rawBlocks);
  let currentOrder = canonicalBlocks.length + 1;

  // Process unmapped answers as standalone canonical answer blocks with warning,
  // but EXCLUDE those that are structural/header artifacts from ever being blocks.
  unmappedAnswers.forEach((u) => {
    // First clean a possibly-leading header line that was merged into the text.
    const { cleanedText, strippedHeader } = cleanAnswerText(u.answerText);
    const effectiveText = strippedHeader ? cleanedText : u.answerText;

    const det = detectStructuralHeader(effectiveText);
    if (det.isHeader) {
      logExcludedHeader(effectiveText, det.pattern ?? "UNKNOWN", "unmapped", u.region);
      return; // NEVER becomes a canonical block; never eligible for mapping
    }

    const warnings: string[] = [`Unmapped answer block: ${u.reason}`];

    const regions = u.region
      ? buildCanonicalAnswerBlocks([
          {
            id: u.id,
            questionId: null,
            answerText: effectiveText,
            pageIndex: u.pageIndex,
            region: u.region,
            detected_question_number: null,
            confidence: "low" as const,
            match_basis: "none" as const,
          },
        ])[0]?.regions ?? []
      : [];      canonicalBlocks.push({
      id: u.id,
      order: currentOrder++,
      label: u.id,
      normalizedLabel: normalizeLabel(u.id),
      parentAnswerBlockId: null,
      text: effectiveText,
      page: (u.pageIndex ?? 0) + 1,
      regions,
      warnings,
      detected_question_number: null,
      confidence: "low" as const,
      match_basis: "none" as const,
    });
  });

  // rawBlocks (Gemini-declared blocks) are currently not turned into canonical blocks by
  // normalizer, but filter out any that are structural headers so the debug overlay
  // never surfaces "SECTION A"/"SECTION B" blocks as candidates.
  for (const b of rawBlocks) {
    const text = b.label ?? b.id;
    if (text && detectStructuralHeader(text).isHeader) {
      logExcludedHeader(text, detectStructuralHeader(text).pattern ?? "UNKNOWN", "block", b.region);
    }
  }

  return canonicalBlocks;
}
