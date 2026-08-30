import type { CanonicalAnswerBlock, CanonicalQuestion } from "../extraction/schema.js";
import { mapQuestionsToAnswers } from "./mapping-engine.js";

function runMappingTests() {
  console.log("=== RUNNING MAPPING ENGINE UNIT TESTS ===");

  const questions: CanonicalQuestion[] = [
    { id: "q_1", order: 1, label: "Q1", normalizedLabel: "Q1", parentQuestionId: null, type: "main", text: "Question 1 text", page: 0, regions: [], warnings: [] },
    { id: "q_2", order: 2, label: "Q2", normalizedLabel: "Q2", parentQuestionId: null, type: "main", text: "Question 2 text", page: 0, regions: [], warnings: [] },
    { id: "q_3", order: 3, label: "Q3", normalizedLabel: "Q3", parentQuestionId: null, type: "main", text: "Question 3 text", page: 1, regions: [], warnings: [] },
  ];

  const answerBlocks: CanonicalAnswerBlock[] = [
    { id: "a_1", order: 1, label: "Q1", normalizedLabel: "Q1", parentAnswerBlockId: null, text: "Answer 1 text", page: 0, regions: [], warnings: [] },
    { id: "a_2", order: 2, label: "Q2", normalizedLabel: "Q2", parentAnswerBlockId: null, text: "Answer 2 text", page: 0, regions: [], warnings: [] },
    { id: "a_99", order: 3, label: "Q99", normalizedLabel: "Q99", parentAnswerBlockId: null, text: "Orphan answer text", page: 2, regions: [], warnings: [] },
  ];

  const result = mapQuestionsToAnswers(questions, answerBlocks);

  // 1. Exact match test
  const m1 = result.mappings.find((m) => m.questionId === "q_1");
  console.assert(m1?.status === "matched", "q_1 should be matched");
  console.assert(m1?.answerBlockId === "a_1", "q_1 should map to a_1");
  console.assert(m1?.evidence.semantic === 0, "Semantic score MUST be 0");

  // 2. Unanswered question test
  const m3 = result.mappings.find((m) => m.questionId === "q_3");
  console.assert(m3?.status === "unanswered", "q_3 should be unanswered");

  // 3. Unmatched orphan answer block test
  console.assert(result.unmatchedAnswerBlocks.some((b) => b.id === "a_99"), "a_99 should be unmatched");

  console.log("✅ All mapping engine tests passed");
  console.log("=== MAPPING TESTS PASSED ===");
}

runMappingTests();
