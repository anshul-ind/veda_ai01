import { isStructuralHeader, cleanAnswerText } from "../canonical/segmentation.js";
/**
 * Fix 2 audit: Trace label-priority behavior for the deterministic mapping engine.
 * Stage 1 (evaluateLabelScore) is authoritative and runs BEFORE any structural/positional
 * fallback; a matching explicit label is never overridden by a later stage. This log makes
 * that behaviour traceable for the real document.
 */
function traceLabels(questions, answerBlocks) {
    console.log(`[mapping:labels] ${JSON.stringify({
        questions: questions.map((q) => ({ id: q.id, normalizedLabel: q.normalizedLabel })),
        answerBlocks: answerBlocks.map((a) => ({ id: a.id, normalizedLabel: a.normalizedLabel, textPrefix: a.text.slice(0, 40) })),
    })}`);
}
/**
 * Fix 3 - Content-sanity safety net (defense in depth).
 * A mapped block must look like substantive student answer content, not a document
 * structural artifact. Returns true (keep as matched) only when the text is substantive.
 */
function looksLikeSubstantiveAnswer(text) {
    if (!text)
        return false;
    // A pure structural header can never be a substantive answer.
    if (isStructuralHeader(text))
        return false;
    // Strip a leading header line that may have been merged into an answer region.
    const { cleanedText } = cleanAnswerText(text);
    const tokens = cleanedText.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
    // Real answers carry at least a couple of words; a bare section label / page number
    // (or a merged block reduced to nothing) fails this minimum-substance gate.
    return tokens.length >= 2;
}
/**
 * Stage 1: Explicit Label Matcher
 */
function evaluateLabelScore(q, a) {
    if (!q.normalizedLabel || !a.normalizedLabel)
        return { score: 0, reason: null };
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
function evaluateStructuralScore(q, a) {
    let score = 0;
    const reasons = [];
    // Order alignment
    if (q.order === a.order) {
        score += 0.5;
        reasons.push(`Matching sequence position (order ${q.order})`);
    }
    else if (Math.abs(q.order - a.order) === 1) {
        score += 0.2;
        reasons.push(`Adjacent sequence position (q:${q.order}, a:${a.order})`);
    }
    // Page continuity
    if (q.page !== null && a.page !== null) {
        if (q.page === a.page) {
            score += 0.3;
            reasons.push(`Identical document page ${q.page}`);
        }
        else if (Math.abs(q.page - a.page) === 1) {
            score += 0.1;
            reasons.push(`Consecutive document page`);
        }
    }
    return {
        score: Math.min(1.0, score),
        reason: reasons.length > 0 ? reasons.join("; ") : null,
    };
}
/**
 * 5-Stage Deterministic Mapping Engine with Global Assignment & Margin Checks
 */
export function mapQuestionsToAnswers(questions, answerBlocks) {
    const allPairs = [];
    const candidateMap = new Map();
    // Fix 2 audit trace (label-priority visibility)
    traceLabels(questions, answerBlocks);
    // Stage 1-3: Candidate Generation & Scoring
    questions.forEach((q) => {
        const qCandidates = [];
        answerBlocks.forEach((a) => {
            // Exclude structural document headers from answer candidates
            if (isStructuralHeader(a.text)) {
                return;
            }
            const labelRes = evaluateLabelScore(q, a);
            const structRes = evaluateStructuralScore(q, a);
            const labelScore = labelRes.score;
            const structScore = structRes.score;
            // If both question and answer have explicit labels and they contradict (different numbers),
            // do NOT generate a naive positional candidate.
            const hasConflictingExplicitLabels = q.normalizedLabel &&
                a.normalizedLabel &&
                labelScore === 0 &&
                q.normalizedLabel.match(/^Q(\d+)/)?.[1] !== a.normalizedLabel.match(/^Q(\d+)/)?.[1];
            if (hasConflictingExplicitLabels) {
                return;
            }
            // Candidate generation requirement: label match or strong structural alignment without label conflict
            if (labelScore > 0 || structScore >= 0.8) {
                const reasons = [];
                if (labelRes.reason)
                    reasons.push(labelRes.reason);
                if (structRes.reason)
                    reasons.push(structRes.reason);
                const confidence = Number(Math.min(1.0, labelScore * 0.7 + structScore * 0.3).toFixed(2));
                const pair = {
                    questionId: q.id,
                    block: a,
                    confidence,
                    labelScore,
                    structScore,
                    reasons,
                };
                qCandidates.push(pair);
                allPairs.push(pair);
            }
        });
        qCandidates.sort((c1, c2) => c2.confidence - c1.confidence);
        candidateMap.set(q.id, qCandidates);
    });
    // Stage 4: Global Assignment (Highest confidence pairs assigned first)
    // Sort all candidate pairs globally descending by confidence
    allPairs.sort((p1, p2) => p2.confidence - p1.confidence);
    const assignedQuestions = new Map();
    const assignedAnswerBlockIds = new Set();
    allPairs.forEach((pair) => {
        if (assignedQuestions.has(pair.questionId))
            return;
        if (assignedAnswerBlockIds.has(pair.block.id))
            return;
        assignedQuestions.set(pair.questionId, pair);
        assignedAnswerBlockIds.add(pair.block.id);
    });
    // Stage 5: Final Mapping Assembly & Margin Check
    const mappings = [];
    questions.forEach((q) => {
        const assignedPair = assignedQuestions.get(q.id);
        const candidates = candidateMap.get(q.id) || [];
        if (!assignedPair) {
            // Check if there was a candidate that was stolen by higher confidence question
            if (candidates.length > 0) {
                const topCandidate = candidates[0];
                mappings.push({
                    questionId: q.id,
                    answerBlockId: topCandidate.block.id,
                    confidence: Number((topCandidate.confidence * 0.5).toFixed(2)),
                    status: "uncertain",
                    evidence: {
                        label: topCandidate.labelScore,
                        structural: topCandidate.structScore,
                        semantic: 0,
                        reasons: [
                            ...topCandidate.reasons,
                            "Conflict: Candidate answer block was assigned to another question with higher confidence",
                        ],
                    },
                });
            }
            else {
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
            }
            return;
        }
        // Margin check against 2nd candidate
        const second = candidates.find((c) => c.block.id !== assignedPair.block.id);
        const margin = second ? assignedPair.confidence - second.confidence : 1.0;
        let status = assignedPair.confidence >= 0.7 ? "matched" : "uncertain";
        if (margin < 0.15 && assignedPair.confidence < 0.9) {
            status = "uncertain";
            assignedPair.reasons.push(`Tight confidence margin (${margin.toFixed(2)}) against alternative candidate`);
        }
        // Fix 3 - Content-sanity safety net (defense in depth):
        // Never let a structural artifact render as a confident green "Matched" highlight.
        // This runs even if the label/structural stages above were fooled by a headered/merged block.
        if (status === "matched" && !looksLikeSubstantiveAnswer(assignedPair.block.text)) {
            status = "uncertain";
            assignedPair.reasons.push("mapped region appears to be document structural text rather than substantive answer content — flagged for manual review");
        }
        mappings.push({
            questionId: q.id,
            answerBlockId: assignedPair.block.id,
            confidence: assignedPair.confidence,
            status,
            evidence: {
                label: assignedPair.labelScore,
                structural: assignedPair.structScore,
                semantic: 0,
                reasons: assignedPair.reasons,
            },
        });
    });
    const unmatchedAnswerBlocks = answerBlocks.filter((a) => !assignedAnswerBlockIds.has(a.id));
    return {
        mappings,
        unmatchedAnswerBlocks,
    };
}
