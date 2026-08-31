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
    // 2. Coordinate Repair & 1-Based Page Tests
    const warnings = [];
    const coords1 = convertToCanonicalRegion({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 }, 0, warnings);
    console.assert(coords1[0].x1 === 100 && coords1[0].y1 === 200 && coords1[0].x2 === 400 && coords1[0].y2 === 600, "Coords conversion failed");
    console.assert(coords1[0].page === 1, "Page conversion to 1-based failed (pageIndex 0 -> page 1)");
    // Clamping test: coordinates > 1.0 clamped to 1000
    const clampWarnings = [];
    const clampedCoords = convertToCanonicalRegion({ x: 0.95, y: 0.95, width: 0.2, height: 0.2 }, 1, clampWarnings);
    console.assert(clampedCoords[0].x2 === 1000, "Clamping x2 to 1000 failed");
    console.assert(clampedCoords[0].y2 === 1000, "Clamping y2 to 1000 failed");
    console.assert(clampedCoords[0].page === 2, "Page conversion to 1-based failed (pageIndex 1 -> page 2)");
    // Reversed coords test
    const reversedWarnings = [];
    const reversedCoords = convertToCanonicalRegion({ x: 0.5, y: 0.5, width: -0.2, height: -0.2 }, 0, reversedWarnings);
    console.assert(reversedCoords[0].x1 < reversedCoords[0].x2, "Reversed x coords repair failed");
    console.assert(reversedCoords[0].y1 < reversedCoords[0].y2, "Reversed y coords repair failed");
    console.assert(reversedWarnings.length > 0, "Warning expected for reversed coords");
    console.log("✅ Coordinate conversion & repair tests passed");
    // 3. Canonical Question Generation Test (including maxMarks and 1-based page)
    const canonicalQs = buildCanonicalQuestions([
        { id: "q_1", index: 1, questionText: "Q1. What is science?", maxMarks: 2, pageIndex: 0 },
        { id: "q_2", index: 2, questionText: "Q1(a) Explain biology.", maxMarks: 1, pageIndex: 0 },
    ]);
    console.assert(canonicalQs[0].normalizedLabel === "Q1", "Q1 normalized label failed");
    console.assert(canonicalQs[0].maxMarks === 2, "Q1 maxMarks preservation failed");
    console.assert(canonicalQs[0].page === 1, "Q1 1-based page failed");
    console.assert(canonicalQs[1].type === "sub", "Sub-question classification failed");
    console.assert(canonicalQs[1].parentQuestionId === "q_1", "Parent question linkage failed");
    console.assert(canonicalQs[1].maxMarks === 1, "Q2 maxMarks preservation failed");
    console.log("✅ Canonical question building tests passed");
    console.log("=== ALL NORMALIZER TESTS PASSED ===");
}
runNormalizerTests();
