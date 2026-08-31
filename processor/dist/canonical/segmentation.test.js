import { detectStructuralHeader, isStructuralHeader, cleanAnswerText, segmentAnswers, } from "./segmentation.js";
import { buildCanonicalQuestions } from "./normalizer.js";
import { mapQuestionsToAnswers } from "../mapping/mapping-engine.js";
function runSegmentationTests() {
    console.log("=== RUNNING SEGMENTATION (STRUCTURAL-ARTIFACT) UNIT TESTS ===");
    // 1. Pattern-based exclusions (Fix 1)
    const headerCases = [
        { text: "SECTION A (Multiple Choice Questions)", expectedPattern: "SECTION_HEADER" },
        { text: "SECTION B (Short Answer Questions - Type I)", expectedPattern: "SECTION_HEADER" },
        { text: "Section A", expectedPattern: "SECTION_HEADER" },
        { text: "(Multiple Choice Questions)", expectedPattern: "SECTION_TYPE_LABEL" },
        { text: "(Short Answer Questions - Type II)", expectedPattern: "SECTION_TYPE_LABEL" },
        { text: "(Long Answer Questions)", expectedPattern: "SECTION_TYPE_LABEL" },
        { text: "(Very Short Answer Questions)", expectedPattern: "SECTION_TYPE_LABEL" },
        { text: "ANSWERS - CLASS 10 SCIENCE", expectedPattern: "ANSWER_CLASS_TITLE" },
        { text: "ANSWERS - Class X Science", expectedPattern: "ANSWER_CLASS_TITLE" },
        { text: "QUESTION PAPER (REF NO. XYZ)", expectedPattern: "QUESTION_PAPER_REF" },
        { text: "GENERAL INSTRUCTIONS", expectedPattern: "INSTRUCTIONS_HEADER" },
        { text: "PAGE 1", expectedPattern: "PAGE_NUMBER" },
        { text: "Page 1 of 12", expectedPattern: "PAGE_NUMBER" },
    ];
    for (const { text, expectedPattern } of headerCases) {
        const det = detectStructuralHeader(text);
        console.assert(det.isHeader, `Should exclude structural header: "${text}"`);
        console.assert(det.pattern === expectedPattern, `Pattern mismatch for "${text}": expected ${expectedPattern}, got ${det.pattern}`);
    }
    // 2. ALL-CAPS short printed text (secondary signal)
    const allCapsCases = ["SECTION A", "MAX. MARKS", "ROLL NO.", "TIME ALLOWED", "PART I"];
    for (const t of allCapsCases) {
        console.assert(isStructuralHeader(t), `ALL-CAPS short text should be flagged as structural: "${t}"`);
    }
    // 3. Legitimate mixed-case student answers must NOT be excluded
    const legitAnswers = [
        { text: "Q1. The correct option is (a). NaOH + HCl \u2192 NaCl + H2O", pattern: null },
        { text: "Q2. The breakdown of pyruvate to give CO2, water and energy takes place in mitochondria.", pattern: null },
        { text: "Q5. Plaster of Paris is calcium sulphate hemihydrate.", pattern: null },
        { text: "Q7. The answer is because the light bends at the interface.", pattern: null },
    ];
    for (const { text, pattern } of legitAnswers) {
        const det = detectStructuralHeader(text);
        console.assert(!det.isHeader, `Legitimate answer must NOT be excluded: "${text}"`);
        console.assert(det.pattern === pattern, `Expected no pattern for legit answer: "${text}"`);
    }
    // Multi-line real answer starting with a header must be CLEANED, not dropped.
    const merged = "SECTION A (Multiple Choice Questions)\nQ1. The correct option is (a). NaOH + HCl \u2192 NaCl + H2O";
    const { cleanedText: mergedCleaned, strippedHeader } = cleanAnswerText(merged);
    console.assert(strippedHeader !== null, "Merged answer should have its leading header stripped");
    console.assert(mergedCleaned.startsWith("Q1."), `Cleaned merged answer should start with the real answer, got: "${mergedCleaned.slice(0, 20)}"`);
    console.assert(detectStructuralHeader(mergedCleaned).isHeader === false, "Cleaned merged answer should not be flagged as a header");
    // 4. Synthetic stray-text generalization test
    runSyntheticStrayTextTest();
}
function runSyntheticStrayTextTest() {
    // Mirror the real production split: real answers flow through `answers` (label
    // extraction works), while stray/header artifacts flow through `unmappedAnswers`.
    const answers = [
        { id: "a_1", questionId: "q_1", answerText: "Q1. The correct option is (a). NaOH + HCl \u2192 NaCl + H2O", pageIndex: 0, region: { x: 0.1, y: 0.3, width: 0.8, height: 0.15 } },
        { id: "a_2", questionId: "q_2", answerText: "Q2. Mitochondria is the correct organelle.", pageIndex: 0, region: { x: 0.1, y: 0.5, width: 0.8, height: 0.15 } },
    ];
    const unmapped = [
        { id: "u_headerA", answerText: "SECTION A (Multiple Choice Questions)", pageIndex: 0, region: { x: 0.1, y: 0.1, width: 0.5, height: 0.05 }, reason: "stray" },
        { id: "u_headerB", answerText: "SECTION B (Short Answer Questions - Type I)", pageIndex: 0, region: { x: 0.1, y: 0.2, width: 0.5, height: 0.05 }, reason: "stray" },
        { id: "u_margin", answerText: "PAGE 1", pageIndex: 0, region: { x: 0.9, y: 0.9, width: 0.08, height: 0.03 }, reason: "margin note" },
        { id: "u_stray", answerText: "MARGINALIA", pageIndex: 0, region: { x: 0.8, y: 0.85, width: 0.1, height: 0.03 }, reason: "stray note" },
    ];
    const canonicalBlocks = segmentAnswers(answers, unmapped);
    const headerIds = new Set(["u_headerA", "u_headerB", "u_margin", "u_stray"]);
    for (const id of headerIds) {
        console.assert(!canonicalBlocks.some((b) => b.id === id), `Stray/header block "${id}" must be excluded from canonical blocks`);
    }
    console.assert(canonicalBlocks.some((b) => b.id === "a_1") && canonicalBlocks.some((b) => b.id === "a_2"), "Legit answers must survive segmentation");
    // Map through the engine and confirm nothing structural can be confidently matched.
    const questions = buildCanonicalQuestions([
        { id: "q_1", index: 1, questionText: "Q1. Neutralization equation?", maxMarks: 1, pageIndex: 0 },
        { id: "q_2", index: 2, questionText: "Q2. Where does pyruvate break down?", maxMarks: 1, pageIndex: 0 },
    ]);
    const mappingResult = mapQuestionsToAnswers(questions, canonicalBlocks);
    const q1 = mappingResult.mappings.find((m) => m.questionId === "q_1");
    const q2 = mappingResult.mappings.find((m) => m.questionId === "q_2");
    console.assert(q1?.answerBlockId === "a_1", `Q1 should resolve to the real answer block, got: ${q1?.answerBlockId}`);
    console.assert(q2?.answerBlockId === "a_2", `Q2 should resolve to the real answer block, got: ${q2?.answerBlockId}`);
    const mappedTexts = mappingResult.mappings.map((m) => {
        const b = canonicalBlocks.find((cb) => cb.id === m.answerBlockId);
        return { q: m.questionId, status: m.status, text: b ? b.text.slice(0, 40) : null };
    });
    const anyHeaderMatched = mappedTexts.some((m) => m.text && isStructuralHeader(m.text));
    console.assert(!anyHeaderMatched, "No structural artifact may ever be matched to a question");
    console.log("\u{1F9EA} Synthetic stray-text generalization test PASSED");
    console.log("\u2705 All segmentation/structural-artifact tests passed");
    console.log("=== SEGMENTATION TESTS PASSED ====");
}
runSegmentationTests();
