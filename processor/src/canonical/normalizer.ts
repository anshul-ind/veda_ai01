import type {
  Answer,
  CanonicalAnswerBlock,
  CanonicalQuestion,
  CanonicalRegion,
  NormalizedRegion,
  Question,
} from "../extraction/schema.js";

/**
 * Normalizes question & answer labels deterministically.
 * Examples:
 * - "Q1", "1", "1.", "Question 1", "Q.1" -> "Q1"
 * - "1(a)", "Q1(a)", "1 a", "1. a", "1a" -> "Q1A"
 * - "(a)", "a.", "a)" -> "A"
 */
export function normalizeLabel(rawLabel: string | null | undefined): string | null {
  if (!rawLabel) return null;
  const str = rawLabel.trim();
  if (!str) return null;

  // Case 1: Q1(a), Question 1(a), 1(a), 1.a, 1 a, Q1a
  const mainSubMatch = str.match(/^(?:Q|Question|\s)*\.?\s*([1-9]\d*)\s*[\.\(\-_\s]*\s*([a-zA-Z])\s*[\)\.]?$/i);
  if (mainSubMatch) {
    const num = mainSubMatch[1];
    const sub = mainSubMatch[2].toUpperCase();
    return `Q${num}${sub}`;
  }

  // Case 2: Q1, Question 1, Q.1, 1., 1
  const mainMatch = str.match(/^(?:Q|Question|\s)*\.?\s*([1-9]\d*)\s*[\.\)]?$/i);
  if (mainMatch) {
    return `Q${mainMatch[1]}`;
  }

  // Case 3: (a), a., a)
  const subMatch = str.match(/^[\(\s]*([a-zA-Z])[\)\.\s]*$/);
  if (subMatch) {
    return subMatch[1].toUpperCase();
  }

  // Fallback: clean non-alphanumeric except numbers/letters
  const cleaned = str.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return cleaned.length > 0 ? cleaned : str;
}

/**
 * Extracts raw label string from question text or index
 */
export function extractQuestionLabel(
  questionText: string,
  index: number
): { label: string; normalizedLabel: string | null } {
  const match = questionText.match(/^(?:Q|Question|\s)*\.?\s*([1-9]\d*(?:\s*[\(\.A-Za-z0-9\)]+)?)/i);
  const rawLabel = match ? match[0].trim() : `Q${index}`;
  const normalizedLabel = normalizeLabel(rawLabel) ?? `Q${index}`;
  return { label: rawLabel, normalizedLabel };
}

/**
 * Extracts the visible question label from the start of an answer text.
 *
 * Examples:
 *   "Q1. The correct option is (a)..."  -> { rawLabel: "Q1", normalizedLabel: "Q1" }
 *   "Q.5 Plaster of Paris..."           -> { rawLabel: "Q.5", normalizedLabel: "Q5" }
 *   "5. The mitochondria..."            -> { rawLabel: "5", normalizedLabel: "Q5" }
 *   "Q1(a) Because..."                  -> { rawLabel: "Q1(a)", normalizedLabel: "Q1A" }
 *   "Question 3: The answer is..."      -> { rawLabel: "Question 3", normalizedLabel: "Q3" }
 *   "The answer is NaCl"                -> null visible label, falls back to fallbackQuestionId
 *
 * Returns null normalizedLabel when no visible Q-label is detectable and no fallback provided.
 */
export function extractAnswerLabel(
  answerText: string,
  fallbackQuestionId?: string | null
): { rawLabel: string | null; normalizedLabel: string | null } {
  if (answerText) {
    // Inspect only the first 80 chars of the first line for a visible label prefix
    const firstLine = answerText.split("\n")[0].slice(0, 80).trim();

    // Ordered from most-specific to least-specific:
    const prefixPatterns = [
      // Q1(a). / Q1(a): / Q.1(a) etc.
      /^((?:Q(?:uestion)?)?\.?\s*[1-9]\d*\s*[\(.\-\s]*\s*[a-zA-Z]\s*[).]?)\s*[.\-:)\s]/i,
      // Q1. / Q.1 / Question 1: / 1. / 1)
      /^((?:Q(?:uestion)?)?\.?\s*[1-9]\d*)\s*[.\-:)]/i,
    ];

    // A bare-number prefix is only a question label when the text is NOT an
    // enumerated sub-list. A real Q-labeled answer ("Q1. ...", "5. The mitochondria...")
    // has ONE leading number that points at the question. A student-typed sub-list
    // ("1. Chemical name..." / "2. Chemical formula...") uses consecutive numbers as
    // bullet points, NOT as a question label — so we must not treat it as one.
    const isNumberedList = (full: string): boolean => {
      const lines = full.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) return false;
      const numbered = lines.filter((l) => /^\d+\s*[.):-]/.test(l)).length;
      return numbered >= 2;
    };

    for (const pattern of prefixPatterns) {
      const m = firstLine.match(pattern);
      if (m) {
        const rawLabel = m[1].trim();
        const normalizedLabel = normalizeLabel(rawLabel);
        if (normalizedLabel && /^Q\d/.test(normalizedLabel)) {
          // Guard: if the extracted prefix was a BARE number (no Q/Question marker)
          // and the text is a numbered sub-list, this is structural enumeration, not
          // a question label → skip visible label so we fall through to questionId.
          const isBareNumber = /^[1-9]\d*$/.test(rawLabel);
          if (isBareNumber && isNumberedList(answerText)) {
            continue;
          }
          return { rawLabel, normalizedLabel };
        }
      }
    }
  }

  // No visible label found - fall back to questionId
  if (fallbackQuestionId) {
    // "q_5" -> strip prefix -> "5" -> normalizeLabel -> "Q5"
    const stripped = fallbackQuestionId.replace(/^[aq]_/, "");
    const fbNorm = normalizeLabel(stripped);
    return { rawLabel: fallbackQuestionId, normalizedLabel: fbNorm };
  }

  return { rawLabel: null, normalizedLabel: null };
}

/**
 * Converts 0-1 float region to 0-1000 integer canonical region with bounds repair & warnings
 */
export function convertToCanonicalRegion(
  region: NormalizedRegion | undefined,
  pageIndex: number | null | undefined,
  warnings: string[]
): CanonicalRegion[] {
  if (!region) return [];

  // Canonical page numbers are 1-based (pageIndex 0 -> page 1)
  const page = typeof pageIndex === "number" && pageIndex >= 0 ? pageIndex + 1 : 1;

  let x1 = Math.round(region.x * 1000);
  let y1 = Math.round(region.y * 1000);
  let x2 = Math.round((region.x + region.width) * 1000);
  let y2 = Math.round((region.y + region.height) * 1000);

  // Bounds clamping [0, 1000]
  if (x1 < 0 || y1 < 0 || x2 > 1000 || y2 > 1000) {
    warnings.push(`Region coordinates [${x1},${y1},${x2},${y2}] fell outside 0-1000 bounds and were clamped.`);
    x1 = Math.max(0, Math.min(1000, x1));
    y1 = Math.max(0, Math.min(1000, y1));
    x2 = Math.max(0, Math.min(1000, x2));
    y2 = Math.max(0, Math.min(1000, y2));
  }

  // Swap reversed coordinates
  if (x1 > x2) {
    warnings.push(`Reversed horizontal coordinates detected (x1=${x1} > x2=${x2}); swapped.`);
    const tmp = x1;
    x1 = x2;
    x2 = tmp;
  }

  if (y1 > y2) {
    warnings.push(`Reversed vertical coordinates detected (y1=${y1} > y2=${y2}); swapped.`);
    const tmp = y1;
    y1 = y2;
    y2 = tmp;
  }

  // Ensure non-zero width/height
  if (x1 === x2) x2 = Math.min(1000, x1 + 10);
  if (y1 === y2) y2 = Math.min(1000, y1 + 10);

  return [
    {
      x1,
      y1,
      x2,
      y2,
      page,
      coordinateSource: "gemini_estimated",
    },
  ];
}

/**
 * Transforms raw extracted questions to CanonicalQuestion[]
 */
export function buildCanonicalQuestions(rawQuestions: Question[]): CanonicalQuestion[] {
  return rawQuestions.map((q, idx) => {
    const warnings: string[] = [];
    const { label, normalizedLabel } = extractQuestionLabel(q.questionText, q.index);
    const isSub = Boolean(normalizedLabel && /^Q\d+[A-Z]$/.test(normalizedLabel));

    let parentQuestionId: string | null = null;
    if (isSub && normalizedLabel) {
      const parentLabel = normalizedLabel.replace(/[A-Z]$/, "");
      const parent = rawQuestions.find((pq) => {
        const { normalizedLabel: pNorm } = extractQuestionLabel(pq.questionText, pq.index);
        return pNorm === parentLabel;
      });
      if (parent) parentQuestionId = parent.id;
    }

    return {
      id: q.id,
      order: idx + 1,
      label,
      normalizedLabel,
      parentQuestionId,
      type: isSub ? "sub" : "main",
      text: q.questionText,
      maxMarks: typeof q.maxMarks === "number" && !isNaN(q.maxMarks) && q.maxMarks > 0 ? q.maxMarks : 1,
      page: (q.pageIndex ?? 0) + 1,
      regions: [],
      warnings,
    };
  });
}

/**
 * Transforms raw extracted answers & blocks to CanonicalAnswerBlock[].
 *
 * FIX (BUG 1): Label is now extracted from the VISIBLE TEXT of the answer
 * (e.g. "Q1. The correct option...") before falling back to questionId or id.
 * This ensures unmapped answers with visible "Q5." prefixes are correctly
 * labeled even when Gemini could not determine the questionId automatically.
 */
export function buildCanonicalAnswerBlocks(
  rawAnswers: Answer[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rawBlocks?: Array<{ id: string; label?: string; region?: NormalizedRegion; pageIndex?: number }>
): CanonicalAnswerBlock[] {
  const blocks: CanonicalAnswerBlock[] = [];

  rawAnswers.forEach((ans, idx) => {
    const warnings: string[] = [];
    const regions = convertToCanonicalRegion(ans.region, ans.pageIndex, warnings);

    // Extract label from visible answer text first; fall back to questionId
    const { rawLabel, normalizedLabel } = extractAnswerLabel(ans.answerText, ans.questionId);

    blocks.push({
      id: ans.id,
      order: idx + 1,
      label: rawLabel ?? ans.questionId,
      normalizedLabel,
      parentAnswerBlockId: null,
      text: ans.answerText,
      page: (ans.pageIndex ?? 0) + 1,
      regions,
      warnings,
      detected_question_number: (ans as any).detected_question_number ?? null,
      confidence: (ans as any).confidence ?? "low",
      match_basis: (ans as any).match_basis ?? "none",
    });
  });

  return blocks;
}