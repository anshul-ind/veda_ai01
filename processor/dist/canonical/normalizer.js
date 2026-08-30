/**
 * Normalizes question & answer labels deterministically.
 * Examples:
 * - "Q1", "1", "1.", "Question 1", "Q.1" -> "Q1"
 * - "1(a)", "Q1(a)", "1 a", "1. a", "1a" -> "Q1A"
 * - "(a)", "a.", "a)" -> "A"
 */
export function normalizeLabel(rawLabel) {
    if (!rawLabel)
        return null;
    const str = rawLabel.trim();
    if (!str)
        return null;
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
export function extractQuestionLabel(questionText, index) {
    const match = questionText.match(/^(?:Q|Question|\s)*\.?\s*([1-9]\d*(?:\s*[\(\.A-Za-z0-9\)]+)?)/i);
    const rawLabel = match ? match[0].trim() : `Q${index}`;
    const normalizedLabel = normalizeLabel(rawLabel) ?? `Q${index}`;
    return { label: rawLabel, normalizedLabel };
}
/**
 * Converts 0-1 float region to 0-1000 integer canonical region with bounds repair & warnings
 */
export function convertToCanonicalRegion(region, pageIndex, warnings) {
    if (!region)
        return [];
    const page = pageIndex && pageIndex >= 0 ? pageIndex : 0;
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
    if (x1 === x2)
        x2 = Math.min(1000, x1 + 10);
    if (y1 === y2)
        y2 = Math.min(1000, y1 + 10);
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
export function buildCanonicalQuestions(rawQuestions) {
    return rawQuestions.map((q, idx) => {
        const warnings = [];
        const { label, normalizedLabel } = extractQuestionLabel(q.questionText, q.index);
        const isSub = Boolean(normalizedLabel && /^Q\d+[A-Z]$/.test(normalizedLabel));
        let parentQuestionId = null;
        if (isSub && normalizedLabel) {
            const parentLabel = normalizedLabel.replace(/[A-Z]$/, "");
            const parent = rawQuestions.find((pq) => {
                const { normalizedLabel: pNorm } = extractQuestionLabel(pq.questionText, pq.index);
                return pNorm === parentLabel;
            });
            if (parent)
                parentQuestionId = parent.id;
        }
        return {
            id: q.id,
            order: idx + 1,
            label,
            normalizedLabel,
            parentQuestionId,
            type: isSub ? "sub" : "main",
            text: q.questionText,
            page: q.pageIndex ?? 0,
            regions: [],
            warnings,
        };
    });
}
/**
 * Transforms raw extracted answers & blocks to CanonicalAnswerBlock[]
 */
export function buildCanonicalAnswerBlocks(rawAnswers, rawBlocks) {
    const blocks = [];
    rawAnswers.forEach((ans, idx) => {
        const warnings = [];
        const regions = convertToCanonicalRegion(ans.region, ans.pageIndex, warnings);
        const normalizedLabel = normalizeLabel(ans.questionId.replace(/^a_/, "q_")) || normalizeLabel(ans.id);
        blocks.push({
            id: ans.id,
            order: idx + 1,
            label: ans.questionId,
            normalizedLabel,
            parentAnswerBlockId: null,
            text: ans.answerText,
            page: ans.pageIndex ?? 0,
            regions,
            warnings,
        });
    });
    return blocks;
}
