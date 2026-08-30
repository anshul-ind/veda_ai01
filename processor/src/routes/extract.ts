import { Hono } from "hono";
import { validateUploadPair } from "../validation/upload.js";
import { ProcessorError, toErrorResponse } from "../utils/errors.js";
import { uploadToGemini, pollUntilActive } from "../gemini/files.js";
import { extractAnswers, extractQuestions } from "../gemini/extract.js";
import { answerPayloadSchema, questionPayloadSchema, type Answer, type QuestionContext } from "../extraction/schema.js";
import { GEMINI_MODEL, PROCESSING_TIMEOUT_MS, EXTRACTION_PROMPT_VERSION, EXTRACTION_SCHEMA_VERSION } from "../config.js";
import { buildCanonicalQuestions } from "../canonical/normalizer.js";
import { segmentAnswers } from "../canonical/segmentation.js";
import { mapQuestionsToAnswers } from "../mapping/mapping-engine.js";

export const extractRoute = new Hono();

function logAudit(event: string, details: Record<string, unknown>) {
  console.info(`[extract:${event}]`, JSON.stringify(details));
}

function uniqueIds(items: Array<{ id: string }>) {
  return new Set(items.map((item) => item.id)).size === items.length;
}

extractRoute.post("/extract", async (c) => {
  const overallTimeoutMs = PROCESSING_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), overallTimeoutMs);

  const uploaded: string[] = [];

  try {
    let formData: FormData;
    try {
      formData = await c.req.formData();
    } catch {
      throw new ProcessorError("INVALID_REQUEST", 400, "Invalid multipart request.");
    }
    const questionRaw = formData.get("questionFile");
    const answerRaw = formData.get("answerFile");
    const { questionFile, answerFile } = validateUploadPair(questionRaw, answerRaw);
    logAudit("received", {
      question: { name: questionFile.name, mimeType: questionFile.type, bytes: questionFile.size },
      answer: { name: answerFile.name, mimeType: answerFile.type, bytes: answerFile.size },
      model: GEMINI_MODEL,
      promptVersion: EXTRACTION_PROMPT_VERSION,
    });

    // Upload to Gemini
    const qUp = await uploadToGemini(questionFile);
    uploaded.push(qUp.name);
    const aUp = await uploadToGemini(answerFile);
    uploaded.push(aUp.name);
    logAudit("gemini_uploaded", {
      question: { name: qUp.displayName, mimeType: qUp.mimeType, bytes: qUp.size, uri: qUp.uri },
      answer: { name: aUp.displayName, mimeType: aUp.mimeType, bytes: aUp.size, uri: aUp.uri },
      model: GEMINI_MODEL,
      promptVersion: EXTRACTION_PROMPT_VERSION,
    });

    // Poll until active
    await pollUntilActive(qUp.name, { signal: controller.signal });
    await pollUntilActive(aUp.name, { signal: controller.signal });
    logAudit("polling_active", { question: qUp.name, answer: aUp.name });

    // Extract questions with resilience
    logAudit("questions_extract_start", { uri: qUp.uri, mimeType: qUp.mimeType, model: GEMINI_MODEL });
    const { parsed: qRaw, modelUsed: qModel } = await extractQuestions(qUp.uri, qUp.mimeType, controller.signal);
    logAudit("questions_extract_success", { modelUsed: qModel });

    const qParsed = questionPayloadSchema.safeParse(qRaw);
    if (!qParsed.success) {
      throw new ProcessorError("SCHEMA_VALIDATION_FAILED", 502, "Question extraction schema validation failed.", [qParsed.error.issues[0]?.message ?? "Invalid question output."]);
    }
    if (!uniqueIds(qParsed.data.questions)) {
      throw new ProcessorError("SCHEMA_VALIDATION_FAILED", 502, "Question extraction returned duplicate question IDs.");
    }

    const questionContext: QuestionContext[] = qParsed.data.questions.map(({ id, index, questionText, maxMarks }) => ({
      id,
      index,
      questionText,
      maxMarks,
    }));
    logAudit("questions_validated", { count: questionContext.length, modelUsed: qModel, promptVersion: EXTRACTION_PROMPT_VERSION });

    // Extract answers with resilience
    logAudit("answers_extract_start", { uri: aUp.uri, mimeType: aUp.mimeType, model: GEMINI_MODEL, contextCount: questionContext.length });
    const { parsed: aRaw, modelUsed: aModel } = await extractAnswers(aUp.uri, aUp.mimeType, questionContext, controller.signal);
    logAudit("answers_extract_success", { modelUsed: aModel });

    const aParsed = answerPayloadSchema.safeParse(aRaw);
    if (!aParsed.success) throw new ProcessorError("SCHEMA_VALIDATION_FAILED", 502, "Answer extraction schema validation failed.");

    const warnings = aParsed.data.unmappedAnswers.map((answer) => `Unmapped answer ${answer.id}: ${answer.reason}`);
    const questionById = new Map(qParsed.data.questions.map((question) => [question.id, question]));
    const answers: Answer[] = [];
    for (const answer of aParsed.data.answers) {
      const question = questionById.get(answer.questionId);
      if (!question) {
        warnings.push(`Excluded answer ${answer.id}: questionId ${answer.questionId} does not exist.`);
        continue;
      }
      const rawAns = answer as any;
      const canonicalMaxMarks = question.maxMarks;
      if (typeof rawAns.awardedMarks === "number" && rawAns.awardedMarks > canonicalMaxMarks && canonicalMaxMarks > 0) {
        throw new ProcessorError("SCHEMA_VALIDATION_FAILED", 502, `Answer ${answer.id} awardedMarks exceeds the referenced question maxMarks.`);
      }
      answers.push(answer);
    }
    if (!uniqueIds(answers)) throw new ProcessorError("SCHEMA_VALIDATION_FAILED", 502, "Answer extraction returned duplicate answer IDs.");
    if (answers.length === 0) {
      throw new ProcessorError("SCHEMA_VALIDATION_FAILED", 502, "Answer extraction returned no mapped answers for a non-empty document.", warnings);
    }

    // Build Canonical Questions & Answer Blocks
    const canonicalQuestions = buildCanonicalQuestions(qParsed.data.questions);
    const canonicalAnswerBlocks = segmentAnswers(
      answers,
      aParsed.data.unmappedAnswers,
      [...(qParsed.data.blocks ?? []), ...(aParsed.data.blocks ?? [])]
    );

    // Deterministic Mapping Engine
    const { mappings, unmatchedAnswerBlocks } = mapQuestionsToAnswers(canonicalQuestions, canonicalAnswerBlocks);

    // Include orphan answer blocks as "unmatched" entries so the frontend can surface them
    const unmatchedMappings = unmatchedAnswerBlocks.map((block) => ({
      questionId: null as string | null,
      answerBlockId: block.id,
      confidence: 0,
      status: "unmatched" as const,
      evidence: {
        label: 0,
        structural: 0,
        semantic: 0 as const,
        reasons: ["No matching question found for this answer block"],
      },
    }));
    const allMappings = [...mappings, ...unmatchedMappings];

    logAudit("canonical_mapped", {
      canonicalQuestionsCount: canonicalQuestions.length,
      canonicalAnswerBlocksCount: canonicalAnswerBlocks.length,
      mappingsCount: allMappings.length,
      matchedCount: mappings.filter((m) => m.status === "matched").length,
      uncertainCount: mappings.filter((m) => m.status === "uncertain").length,
      unansweredCount: mappings.filter((m) => m.status === "unanswered").length,
      unmatchedCount: unmatchedMappings.length,
      questionModelUsed: qModel,
      answerModelUsed: aModel,
    });

    const includeRaw = process.env.INCLUDE_RAW === "true";

    const result = {
      success: true as const,
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
      data: {
        questions: qParsed.data.questions,
        answers,
        blocks: [...(qParsed.data.blocks ?? []), ...(aParsed.data.blocks ?? [])],
        labels: [...(qParsed.data.labels ?? []), ...(aParsed.data.labels ?? [])],
        regions: [...(qParsed.data.regions ?? []), ...(aParsed.data.regions ?? [])],
        canonical: {
          questions: canonicalQuestions,
          answerBlocks: canonicalAnswerBlocks,
        },
        mappings: allMappings,
        metadata: {
          model: qModel,
          answerModel: aModel,
          processedAt: new Date().toISOString(),
          extractionVersion: EXTRACTION_SCHEMA_VERSION,
        },
      },
      warnings,
      ...(includeRaw
        ? {
            raw: {
              question: JSON.stringify(qRaw).slice(0, 20 * 1024),
              answer: JSON.stringify(aRaw).slice(0, 20 * 1024),
            },
          }
        : {}),
    };

    logAudit("complete", { questions: qParsed.data.questions.length, answers: answers.length, mappings: mappings.length, modelUsed: qModel });

    return c.json(result, 200);
  } catch (e) {
    const err = toErrorResponse(e);
    if (controller.signal.aborted && err.status === 500) {
      return c.json({ success: false, code: "PROCESSING_TIMEOUT", error: "Processing deadline exceeded." }, 504);
    }
    return c.json(err.body, err.status as 400 | 413 | 415 | 429 | 500 | 502 | 503 | 504);
  } finally {
    clearTimeout(timeout);
  }
});
