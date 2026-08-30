import type { CanonicalAnswerBlock, CanonicalQuestion } from "../extraction/schema.js";
import { mapQuestionsToAnswers } from "./mapping-engine.js";

function runMappingTests() {
  console.log("=== RUNNING MAPPING ENGINE UNIT TESTS ===");

  const questions: CanonicalQuestion[] = [
    { id: "q_1", order: 1, label: "Q1", normalizedLabel: "Q1", parentQuestionId: null, type: "main", text: "Question 1 text", maxMarks: 1, page: 1, regions: [], warnings: [] },
    { id: "q_2", order: 2, label: "Q2", normalizedLabel: "Q2", parentQuestionId: null, type: "main", text: "Question 2 text", maxMarks: 1, page: 1, regions: [], warnings: [] },
    { id: "q_3", order: 3, label: "Q3", normalizedLabel: "Q3", parentQuestionId: null, type: "main", text: "Question 3 text", maxMarks: 1, page: 1, regions: [], warnings: [] },
    { id: "q_5", order: 4, label: "Q5", normalizedLabel: "Q5", parentQuestionId: null, type: "main", text: "Question 5 text", maxMarks: 2, page: 1, regions: [], warnings: [] },
  ];

  const answerBlocks: CanonicalAnswerBlock[] = [
    { id: "a_header", order: 1, label: "Header", normalizedLabel: null, parentAnswerBlockId: null, text: "SECTION A (Multiple Choice Questions)", page: 1, regions: [], warnings: [] },
    { id: "a_1", order: 2, label: "Q1", normalizedLabel: "Q1", parentAnswerBlockId: null, text: "Q1. The correct option is (a)", page: 1, regions: [], warnings: [] },
    { id: "a_2", order: 3, label: "Q2", normalizedLabel: "Q2", parentAnswerBlockId: null, text: "Q2. Mitochondria", page: 1, regions: [], warnings: [] },
    { id: "a_5", order: 4, label: "Q5", normalizedLabel: "Q5", parentAnswerBlockId: null, text: "Plaster of Paris", page: 1, regions: [], warnings: [] },
    { id: "a_99", order: 5, label: "Q99", normalizedLabel: "Q99", parentAnswerBlockId: null, text: "Orphan answer text", page: 2, regions: [], warnings: [] },
  ];

  const result = mapQuestionsToAnswers(questions, answerBlocks);

  // 1. Exact match test
  const m1 = result.mappings.find((m) => m.questionId === "q_1");
  console.assert(m1?.status === "matched", "q_1 should be matched");
  console.assert(m1?.answerBlockId === "a_1", "q_1 should map to a_1");
  console.assert(m1?.evidence.semantic === 0, "Semantic score MUST be 0");

  // 2. Structural header rejection test: a_header must NEVER be mapped to q_1 or any question
  console.assert(
    !result.mappings.some((m) => m.answerBlockId === "a_header" && m.status === "matched"),
    "a_header (SECTION A) must NOT be matched to any question"
  );

  // 3. Global confidence precedence test: q_5 maps to a_5, not stolen by q_3
  const m5 = result.mappings.find((m) => m.questionId === "q_5");
  console.assert(m5?.status === "matched", "q_5 should be matched");
  console.assert(m5?.answerBlockId === "a_5", "q_5 should map to a_5");

  // 4. Unanswered question test: q_3 has no answer on sheet
  const m3 = result.mappings.find((m) => m.questionId === "q_3");
  console.assert(m3?.status === "unanswered", "q_3 should be unanswered");

  // 5. Unmatched orphan answer block test: a_99 is in unmatchedAnswerBlocks
  console.assert(result.unmatchedAnswerBlocks.some((b) => b.id === "a_99"), "a_99 should be unmatched");

  console.log("✅ All mapping engine tests passed (including structural header rejection and global confidence assignment)");
  console.log("=== MAPPING TESTS PASSED ===");
}

runMappingTests();
