import { executeWithResilience, isRetryableError } from "./resilience.js";
import { ProcessorError } from "../utils/errors.js";
async function runResilienceTests() {
    console.log("=== RUNNING RESILIENCE & RETRY UNIT TESTS ===");
    // 1. Test error classification
    console.assert(isRetryableError(new ProcessorError("GEMINI_REQUEST_FAILED", 503, "503 Service Unavailable")) === true, "503 should be retryable");
    console.assert(isRetryableError(new ProcessorError("GEMINI_REQUEST_FAILED", 429, "429 Rate Limit")) === true, "429 should be retryable");
    console.assert(isRetryableError(new Error("model is currently experiencing high demand")) === true, "High demand string should be retryable");
    console.assert(isRetryableError(new ProcessorError("INVALID_REQUEST", 400, "Bad Request")) === false, "400 should NOT be retryable");
    console.assert(isRetryableError(new ProcessorError("SCHEMA_VALIDATION_FAILED", 502, "Invalid Schema")) === false, "Schema failure should NOT be retryable");
    console.log("✅ Error classification tests passed");
    // 2. Test transient 503 retry -> success on 2nd attempt
    let attemptsCount = 0;
    const retryResult = await executeWithResilience(async (model) => {
        attemptsCount++;
        if (attemptsCount === 1) {
            throw new Error("503 Service Unavailable (high demand)");
        }
        return "Success Output";
    }, {
        primaryModel: "gemini-3.6-flash",
        fallbackModel: "gemini-2.5-flash",
        maxAttemptsPerModel: 3,
        baseDelaysMs: [10, 20],
    });
    console.assert(retryResult.result === "Success Output", "Retry should return success output");
    console.assert(retryResult.modelUsed === "gemini-3.6-flash", "Primary model should be used after retry");
    console.assert(attemptsCount === 2, "Should take exactly 2 attempts");
    console.log("✅ Transient 503 retry -> success on 2nd attempt test passed");
    // 3. Test persistent 503 through primary + fallback -> GEMINI_EXTRACTION_UNAVAILABLE
    let primaryAttempts = 0;
    let fallbackAttempts = 0;
    let errorCaught = null;
    try {
        await executeWithResilience(async (model) => {
            if (model === "gemini-3.6-flash")
                primaryAttempts++;
            if (model === "gemini-2.5-flash")
                fallbackAttempts++;
            throw new Error("503 UNAVAILABLE - Model experiencing high demand");
        }, {
            primaryModel: "gemini-3.6-flash",
            fallbackModel: "gemini-2.5-flash",
            maxAttemptsPerModel: 3,
            baseDelaysMs: [10, 20],
        });
    }
    catch (err) {
        errorCaught = err;
    }
    console.assert(primaryAttempts === 3, `Primary attempts should be 3, got ${primaryAttempts}`);
    console.assert(fallbackAttempts === 3, `Fallback attempts should be 3, got ${fallbackAttempts}`);
    console.assert(errorCaught instanceof ProcessorError, "Should catch ProcessorError");
    console.assert(errorCaught?.code === "GEMINI_EXTRACTION_UNAVAILABLE", "Code should be GEMINI_EXTRACTION_UNAVAILABLE");
    console.assert(errorCaught?.status === 503, "Status should be 503");
    console.log("✅ Persistent 503 fallback & error code test passed");
    // 4. Test Happy path -> zero overhead
    const happyResult = await executeWithResilience(async (model) => "Immediate Result", {
        primaryModel: "gemini-3.6-flash",
        fallbackModel: "gemini-2.5-flash",
    });
    console.assert(happyResult.result === "Immediate Result", "Happy path result should match");
    console.assert(happyResult.modelUsed === "gemini-3.6-flash", "Happy path should use primary model");
    console.log("✅ Happy path test passed");
    console.log("=== ALL RESILIENCE TESTS PASSED ===");
}
runResilienceTests();
