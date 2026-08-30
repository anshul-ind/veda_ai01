import type {
  Answer,
  CanonicalAnswerBlock,
  NormalizedRegion,
} from "../extraction/schema.js";
import { buildCanonicalAnswerBlocks, normalizeLabel } from "./normalizer.js";

/**
 * Detects if a text block contains purely document structure/headers rather than substantive student answer content.
 */
export function isStructuralHeader(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  const headerPatterns = [
    /^SECTION\s*[-–—:]*\s*[A-Z](?:\s*\(.*?\))?$/i,
    /^PART\s*[-–—:]*\s*[0-9A-Z](?:\s*\(.*?\))?$/i,
    /^(?:GENERAL\s+)?INSTRUCTIONS(?:\s*\(.*?\))?$/i,
    /^QUESTION\s+PAPER(?:\s*[-–—:]\s*.*)?$/i,
    /^CLASS\s+[0-9IVXLCDM]+\s+(?:SCIENCE|MATHEMATICS|PHYSICS|CHEMISTRY|BIOLOGY|EXAM)?/i,
    /^ANSWERS?(?:\s+SHEET)?$/i,
    /^MULTIPLE\s+CHOICE\s+QUESTIONS(?:\s*\(.*?\))?$/i,
  ];

  return headerPatterns.some((pattern) => pattern.test(trimmed));
}

/**
 * Strips leading structural section headers from answer text if erroneously included by LLM.
 */
export function cleanAnswerText(text: string): { cleanedText: string; strippedHeader: string | null } {
  if (!text) return { cleanedText: "", strippedHeader: null };

  const lines = text.split("\n");
  if (lines.length > 1 && isStructuralHeader(lines[0])) {
    const stripped = lines[0].trim();
    const remaining = lines.slice(1).join("\n").trim();
    return { cleanedText: remaining.length > 0 ? remaining : text, strippedHeader: stripped };
  }

  return { cleanedText: text, strippedHeader: null };
}

/**
 * Deterministic Answer Segmentation:
 * Takes extracted answers, unmapped answers, and raw text blocks to assemble canonical answer blocks.
 */
export function segmentAnswers(
  rawAnswers: Answer[],
  unmappedAnswers: Array<{ id: string; answerText: string; pageIndex: number; region?: NormalizedRegion; reason: string }> = [],
  rawBlocks: Array<{ id: string; label?: string; region?: NormalizedRegion; pageIndex?: number }> = []
): CanonicalAnswerBlock[] {
  // Clean raw answer texts if leading headers are attached
  const cleanedRawAnswers = rawAnswers.map((ans) => {
    const { cleanedText, strippedHeader } = cleanAnswerText(ans.answerText);
    return strippedHeader ? { ...ans, answerText: cleanedText } : ans;
  });

  const canonicalBlocks = buildCanonicalAnswerBlocks(cleanedRawAnswers, rawBlocks);
  let currentOrder = canonicalBlocks.length + 1;

  // Process unmapped answers as standalone canonical answer blocks with warning
  unmappedAnswers.forEach((u) => {
    const isHeader = isStructuralHeader(u.answerText);
    const warnings: string[] = isHeader
      ? [`Structural header block detected: "${u.answerText.slice(0, 50)}"`]
      : [`Unmapped answer block: ${u.reason}`];

    const regions = u.region
      ? buildCanonicalAnswerBlocks([
          {
            id: u.id,
            questionId: u.id,
            answerText: u.answerText,
            pageIndex: u.pageIndex,
            region: u.region,
          },
        ])[0]?.regions ?? []
      : [];

    canonicalBlocks.push({
      id: u.id,
      order: currentOrder++,
      label: u.id,
      normalizedLabel: normalizeLabel(u.id),
      parentAnswerBlockId: null,
      text: u.answerText,
      page: (u.pageIndex ?? 0) + 1,
      regions,
      warnings,
    });
  });

  return canonicalBlocks;
}
