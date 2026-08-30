import type {
  CanonicalAnswerBlock,
  CanonicalQuestion,
  QuestionAnswerMapping,
} from "../extraction/schema.js";

/**
 * Stage 1: Explicit Label Matcher
 */
function evaluateLabelScore(q: CanonicalQuestion, a: CanonicalAnswerBlock): { score: number; reason: string | null } {
  if (!q.normalizedLabel || !a.normalizedLabel) return { score: 0, reason: null };

  const qNorm = q.normalizedLabel.toUpperCase();
  const aNorm = a.normalizedLabel.toUpperCase();

  // Direct exact match (e.g. Q1 === Q1, Q1A === Q1A)
  if (qNorm === aNorm) {
    return { score: 1.0, reason: `Exact normalized label match '${qNorm}'` };
  }

  // Question ID match (e.g. q.id = "q_1", a.label = "q_1")
  if (a.label && (a.label.toLowerCase() === q.id.toLowerCase() || a.label.replace(/^a_/, "q_") === q.id)) {
    return { score: 0.95, reason: `Direct Question ID reference '${q.id}'` };
  }

  // Partial main question match (e.g. Q1 matches answer with label Q1)
  const qNum = qNorm.match(/^Q(\d+)/)?.[1];
  const aNum = aNorm.match(/^Q(\d+)/)?.[1];
  if (qNum && aNum && qNum === aNum) {
    return { score: 0.75, reason: `Shared main question number Q${qNum}` };
  }

  return { score: 0, reason: null };
}

/**
 * Stage 2: Structural Matcher
 */
function evaluateStructuralScore(q: CanonicalQuestion, a: CanonicalAnswerBlock): { score: number; reason: string | null } {
  let score = 0;
  const reasons: string[] = [];

  // Order alignment
  if (q.order === a.order) {
    score += 0.5;
    reasons.push(`Matching sequence position (order ${q.order})`);
  } else if (Math.abs(q.order - a.order) === 1) {
    score += 0.2;
    reasons.push(`Adjacent sequence position (q:${q.order}, a:${a.order})`);
  }

  // Page continuity
  if (q.page !== null && a.page !== null) {
    if (q.page === a.page) {
      score += 0.3;
      reasons.push(`Identical document page ${q.page}`);
    } else if (Math.abs(q.page - a.page) === 1) {
      score += 0.1;
      reasons.push(`Consecutive document page`);
    }
  }

  return {
    score: Math.min(1.0, score),
    reason: reasons.length > 0 ? reasons.join("; ") : null,
  };
}

export type MappingEngineResult = {
  mappings: QuestionAnswerMapping[];
  unmatchedAnswerBlocks: CanonicalAnswerBlock[];
};

/**
 * 5-Stage Deterministic Mapping Engine
 */
export function mapQuestionsToAnswers(
  questions: CanonicalQuestion[],
  answerBlocks: CanonicalAnswerBlock[]
): MappingEngineResult {
  const candidateMap = new Map<string, Array<{ block: CanonicalAnswerBlock; confidence: number; labelScore: number; structScore: number; reasons: string[] }>>();

  // Candidate Generation & Stage 1-3 Scoring
  questions.forEach((q) => {
    const candidates: Array<{ block: CanonicalAnswerBlock; confidence: number; labelScore: number; structScore: number; reasons: string[] }> = [];

    answerBlocks.forEach((a) => {
      const labelRes = evaluateLabelScore(q, a);
      const structRes = evaluateStructuralScore(q, a);

      const labelScore = labelRes.score;
      const structScore = structRes.score;

      // Combined confidence (semantic is strictly 0)
      const confidence = Number(Math.min(1.0, labelScore * 0.7 + structScore * 0.3).toFixed(2));

      // Candidate generation requirement: label match or strong structural alignment
      if (labelScore > 0 || (structScore >= 0.8 && labelScore >= 0)) {
        const reasons: string[] = [];
        if (labelRes.reason) reasons.push(labelRes.reason);
        if (structRes.reason) reasons.push(structRes.reason);

        candidates.push({
          block: a,
          confidence,
          labelScore,
          structScore,
          reasons,
        });
      }
    });

    // Sort candidates descending by confidence
    candidates.sort((c1, c2) => c2.confidence - c1.confidence);
    candidateMap.set(q.id, candidates);
  });

  // Stage 4: Conflict Resolution & Stage 5 Margin Check
  const assignedAnswers = new Set<string>();
  const mappings: QuestionAnswerMapping[] = [];

  questions.forEach((q) => {
    const candidates = candidateMap.get(q.id) || [];

    if (candidates.length === 0) {
      mappings.push({
        questionId: q.id,
        answerBlockId: null,
        confidence: 0,
        status: "unanswered",
        evidence: {
          label: 0,
          structural: 0,
          semantic: 0,
          reasons: ["No candidate answer block found"],
        },
      });
      return;
    }

    const top = candidates[0];
    const second = candidates.length > 1 ? candidates[1] : null;

    // Check if answer block is already assigned to a higher-confidence question
    if (assignedAnswers.has(top.block.id)) {
      mappings.push({
        questionId: q.id,
        answerBlockId: top.block.id,
        confidence: Number((top.confidence * 0.5).toFixed(2)),
        status: "uncertain",
        evidence: {
          label: top.labelScore,
          structural: top.structScore,
          semantic: 0,
          reasons: [...top.reasons, "Conflict: Answer block was also assigned to another question"],
        },
      });
      return;
    }

    // Stage 5: Margin Check
    const margin = second ? top.confidence - second.confidence : 1.0;
    let status: "matched" | "uncertain" = top.confidence >= 0.7 ? "matched" : "uncertain";

    if (margin < 0.15 && top.confidence < 0.9) {
      status = "uncertain";
      top.reasons.push(`Tight confidence margin (${margin.toFixed(2)}) against alternative candidate`);
    }

    assignedAnswers.add(top.block.id);

    mappings.push({
      questionId: q.id,
      answerBlockId: top.block.id,
      confidence: top.confidence,
      status,
      evidence: {
        label: top.labelScore,
        structural: top.structScore,
        semantic: 0,
        reasons: top.reasons,
      },
    });
  });

  const unmatchedAnswerBlocks = answerBlocks.filter((a) => !assignedAnswers.has(a.id));

  return {
    mappings,
    unmatchedAnswerBlocks,
  };
}
