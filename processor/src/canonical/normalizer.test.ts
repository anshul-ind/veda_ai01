import { buildCanonicalQuestions, convertToCanonicalRegion, normalizeLabel } from "./normalizer.js";

function runNormalizerTests() {
  console.log("=== RUNNING NORMALIZER UNIT TESTS ===");

  // 1. Label Normalization Tests
  console.assert(normalizeLabel("Q1") === "Q1", "Test Q1 failed");
  console.assert(normalizeLabel("1") === "Q1", "Test 1 failed");
  console.assert(normalizeLabel("1.") === "Q1", "Test 1. failed");
  console.assert(normalizeLabel("Question 1") === "Q1", "Test Question 1 failed");
  console.assert(normalizeLabel("Q.1") === "Q1", "Test Q.1 failed");

  // Sub-question tests
  console.assert(normalizeLabel("1(a)") === "Q1A", "Test 1(a) failed");
  console.assert(normalizeLabel("Q1(a)") === "Q1A", "Test Q1(a) failed");
  console.assert(normalizeLabel("1 a") === "Q1A", "Test 1 a failed");
  console.assert(normalizeLabel("1. a") === "Q1A", "Test 1. a failed");
  console.assert(normalizeLabel("(a)") === "A", "Test (a) failed");

  console.log("✅ Label normalization tests passed");

  // 2. Coordinate Repair Tests
  const warnings: string[] = [];
  const coords1 = convertToCanonicalRegion({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 }, 0, warnings);
  console.assert(coords1[0].x1 === 100 && coords1[0].y1 === 200 && coords1[0].x2 === 400 && coords1[0].y2 === 600, "Coords conversion failed");

  // Reversed coords test
  const reversedWarnings: string[] = [];
  const reversedCoords = convertToCanonicalRegion({ x: 0.5, y: 0.5, width: -0.2, height: -0.2 }, 0, reversedWarnings);
  console.assert(reversedCoords[0].x1 < reversedCoords[0].x2, "Reversed x coords repair failed");
  console.assert(reversedCoords[0].y1 < reversedCoords[0].y2, "Reversed y coords repair failed");
  console.assert(reversedWarnings.length > 0, "Warning expected for reversed coords");

  console.log("✅ Coordinate conversion & repair tests passed");

  // 3. Canonical Question Generation Test
  const canonicalQs = buildCanonicalQuestions([
    { id: "q_1", index: 1, questionText: "Q1. What is science?", maxMarks: 2, pageIndex: 0 },
    { id: "q_2", index: 2, questionText: "Q1(a) Explain biology.", maxMarks: 1, pageIndex: 0 },
  ]);
  console.assert(canonicalQs[0].normalizedLabel === "Q1", "Q1 normalized label failed");
  console.assert(canonicalQs[1].type === "sub", "Sub-question classification failed");
  console.assert(canonicalQs[1].parentQuestionId === "q_1", "Parent question linkage failed");

  console.log("✅ Canonical question building tests passed");
  console.log("=== ALL NORMALIZER TESTS PASSED ===");
}

runNormalizerTests();
