import type {
  Answer,
  CanonicalAnswerBlock,
  NormalizedRegion,
} from "../extraction/schema.js";
import { buildCanonicalAnswerBlocks, normalizeLabel } from "./normalizer.js";

/**
 * Deterministic Answer Segmentation:
 * Takes extracted answers, unmapped answers, and raw text blocks to assemble canonical answer blocks.
 */
export function segmentAnswers(
  rawAnswers: Answer[],
  unmappedAnswers: Array<{ id: string; answerText: string; pageIndex: number; region?: NormalizedRegion; reason: string }> = [],
  rawBlocks: Array<{ id: string; label?: string; region?: NormalizedRegion; pageIndex?: number }> = []
): CanonicalAnswerBlock[] {
  const canonicalBlocks = buildCanonicalAnswerBlocks(rawAnswers, rawBlocks);
  let currentOrder = canonicalBlocks.length + 1;

  // Process unmapped answers as standalone canonical answer blocks with warning
  unmappedAnswers.forEach((u) => {
    const warnings: string[] = [`Unmapped answer block: ${u.reason}`];
    const regions = u.region ? buildCanonicalAnswerBlocks([{ id: u.id, questionId: u.id, answerText: u.answerText, pageIndex: u.pageIndex, region: u.region }])[0]?.regions ?? [] : [];
    
    canonicalBlocks.push({
      id: u.id,
      order: currentOrder++,
      label: u.id,
      normalizedLabel: normalizeLabel(u.id),
      parentAnswerBlockId: null,
      text: u.answerText,
      page: u.pageIndex ?? 0,
      regions,
      warnings,
    });
  });

  return canonicalBlocks;
}
