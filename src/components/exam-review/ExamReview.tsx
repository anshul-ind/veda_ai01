"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bug,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useAppStore, type QuestionGrade } from "@/stores/app-store";
import type {
  CanonicalAnswerBlock,
  CanonicalRegion,
  QuestionAnswerMapping,
} from "@/lib/extraction-schema";

// -------------------------------------------------------
// Sprint 6 — DocumentViewer interface (format-agnostic)
// -------------------------------------------------------
interface DocumentPage {
  pageNumber: number;
  width: number;
  height: number;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface DocumentViewerHandle {
  getPageCount(): number;
  getCurrentPage(): DocumentPage;
  goToPage(pageNumber: number): void;
  getZoomLevel(): number;
  setZoomLevel(level: number): void;
}

// -------------------------------------------------------
// Mapping status visual config
// -------------------------------------------------------
type MappingStatus = "matched" | "uncertain" | "unanswered" | "unmatched";

const STATUS_CONFIG: Record<
  MappingStatus,
  {
    stroke: string;
    fill: string;
    dasharray: string | undefined;
    accentCls: string;
    badgeCls: string;
    badgeLabel: string;
  }
> = {
  matched: {
    stroke: "#22c55e",
    fill: "rgba(34,197,94,0.15)",
    dasharray: undefined,
    accentCls: "border-l-emerald-500 border-emerald-200",
    badgeCls: "bg-emerald-100 text-emerald-700",
    badgeLabel: "Matched",
  },
  uncertain: {
    stroke: "#f59e0b",
    fill: "rgba(245,158,11,0.12)",
    dasharray: "8 4",
    accentCls: "border-l-amber-400 border-amber-200",
    badgeCls: "bg-amber-100 text-amber-700",
    badgeLabel: "Uncertain",
  },
  unanswered: {
    stroke: "transparent",
    fill: "transparent",
    dasharray: undefined,
    accentCls: "border-l-rose-400 border-rose-200",
    badgeCls: "bg-rose-100 text-rose-600",
    badgeLabel: "No Answer",
  },
  unmatched: {
    stroke: "#94a3b8",
    fill: "rgba(148,163,184,0.10)",
    dasharray: "6 4",
    accentCls: "border-l-slate-400 border-slate-200",
    badgeCls: "bg-slate-100 text-slate-500",
    badgeLabel: "Unmatched",
  },
};

// -------------------------------------------------------
// GradeCard sub-component (Phase 11 Fix)
// -------------------------------------------------------
function GradeCard({
  grade,
  onRetry,
}: {
  grade: QuestionGrade;
  onRetry?: () => void;
}) {
  const { score, maxScore, feedback, strengths, improvements, warnings } = grade;

  const scoreCls =
    score === null
      ? "bg-slate-100 text-slate-500"
      : maxScore !== null && score === maxScore
        ? "bg-emerald-100 text-emerald-700"
        : score > 0
          ? "bg-amber-100 text-amber-700"
          : "bg-rose-100 text-rose-700";

  return (
    <div className="rounded-xl bg-orange-soft/30 border border-orange-soft/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-orange uppercase tracking-wider">
          AI Grading
        </span>
        <div className="flex items-center gap-2">
          {score !== null && maxScore !== null && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${scoreCls}`}>
              {score}/{maxScore}
            </span>
          )}
          {onRetry && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              className="text-[10px] text-slate-400 hover:text-orange underline font-medium transition-colors"
            >
              Re-grade
            </button>
          )}
        </div>
      </div>

      {feedback && <p className="text-xs text-slate-700 leading-relaxed">{feedback}</p>}

      {strengths.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mb-1">
            Strengths
          </p>
          <ul className="space-y-0.5">
            {strengths.map((s, i) => (
              <li key={i} className="text-[11px] text-slate-700 flex gap-1.5 leading-relaxed">
                <span className="text-emerald-500 shrink-0">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {improvements.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1">
            To Improve
          </p>
          <ul className="space-y-0.5">
            {improvements.map((im, i) => (
              <li key={i} className="text-[11px] text-slate-700 flex gap-1.5 leading-relaxed">
                <span className="text-amber-500 shrink-0">→</span>
                {im}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg bg-rose-50 border border-rose-100 px-2.5 py-1.5">
          <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wide mb-1">
            Warnings
          </p>
          {warnings.map((w, i) => (
            <p key={i} className="text-[11px] text-rose-600">
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------
// SVG Highlight Overlay (Sprint 7 — Option A: viewBox="0 0 1000 1000")
// -------------------------------------------------------
function HighlightOverlay({
  regions,
  status,
  label,
}: {
  regions: CanonicalRegion[];
  status: MappingStatus;
  label: string;
}) {
  const cfg = STATUS_CONFIG[status];
  if (regions.length === 0 || status === "unanswered") return null;

  return (
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {regions.map((region, idx) => {
        const x = region.x1;
        const y = region.y1;
        const w = region.x2 - region.x1;
        const h = region.y2 - region.y1;
        const labelW = Math.max(40, label.length * 8 + 14);

        return (
          <g key={idx} className="highlight-region">
            {/* Region rect */}
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={cfg.fill}
              stroke={cfg.stroke}
              strokeWidth={5}
              strokeDasharray={cfg.dasharray}
              rx={4}
            />
            {/* Label badge background */}
            <rect
              x={x}
              y={Math.max(0, y - 24)}
              width={labelW}
              height={22}
              fill={cfg.stroke}
              rx={4}
            />
            {/* Label text */}
            <text
              x={x + 6}
              y={Math.max(0, y - 24) + 15}
              fill="white"
              fontSize="12"
              fontWeight="bold"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// -------------------------------------------------------
// Phase 1: Dev-Only Debug Overlay Mode
// -------------------------------------------------------
function DebugOverlay({
  answerBlocks,
  mappings,
  selectedQuestionId,
}: {
  answerBlocks: CanonicalAnswerBlock[];
  mappings: QuestionAnswerMapping[];
  selectedQuestionId: string | null;
}) {
  const selectedMapping = useMemo(
    () => mappings.find((m) => m.questionId === selectedQuestionId),
    [mappings, selectedQuestionId]
  );
  const selectedBlockId = selectedMapping?.answerBlockId;

  return (
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 30,
      }}
    >
      {answerBlocks.map((block) => {
        if (!block.regions || block.regions.length === 0) return null;
        const region = block.regions[0];
        const isSelected = block.id === selectedBlockId;
        const mapping = mappings.find((m) => m.answerBlockId === block.id);
        const status = mapping?.status ?? "unmatched";

        const strokeColor = isSelected
          ? "#22c55e"
          : status === "matched"
            ? "#06b6d4"
            : status === "uncertain"
              ? "#f59e0b"
              : "#94a3b8";

        const fillColor = isSelected
          ? "rgba(34,197,94,0.22)"
          : status === "matched"
            ? "rgba(6,182,212,0.12)"
            : "rgba(148,163,184,0.10)";

        const x = region.x1;
        const y = region.y1;
        const w = region.x2 - region.x1;
        const h = region.y2 - region.y1;

        const snippet = block.text.replace(/\s+/g, " ").slice(0, 55);
        const tagText = `${block.id} | ${block.normalizedLabel ?? block.label ?? "?"} [${status}]`;
        const coordText = `Raw:[${region.x1},${region.y1},${region.x2},${region.y2}] SVG:[${x},${y},${w}x${h}]`;

        return (
          <g key={block.id}>
            {/* Region Rect */}
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={isSelected ? 6 : 3}
              strokeDasharray={status === "uncertain" ? "8 4" : undefined}
              rx={4}
            />

            {/* Top Telemetry Header */}
            <rect x={x} y={Math.max(0, y - 22)} width={230} height={20} fill={strokeColor} rx={3} />
            <text
              x={x + 5}
              y={Math.max(0, y - 22) + 14}
              fill="white"
              fontSize="10"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {tagText}
            </text>

            {/* Bottom Telemetry & Snippet Box */}
            <rect
              x={x}
              y={Math.min(960, y + h + 2)}
              width={Math.max(w, 280)}
              height={32}
              fill="rgba(15,23,42,0.85)"
              rx={3}
            />
            <text
              x={x + 5}
              y={Math.min(960, y + h + 2) + 13}
              fill="#38bdf8"
              fontSize="8.5"
              fontFamily="monospace"
            >
              {coordText}
            </text>
            <text
              x={x + 5}
              y={Math.min(960, y + h + 2) + 26}
              fill="#e2e8f0"
              fontSize="8.5"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              &ldquo;{snippet}&hellip;&rdquo;
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// -------------------------------------------------------
// Main ExamReview Component
// -------------------------------------------------------
const PROCESSOR_URL = process.env.NEXT_PUBLIC_PROCESSOR_URL?.replace(/\/$/, "");

export function ExamReview() {
  const {
    extractionResult,
    answerFile,
    selectedQuestionId,
    setSelectedQuestionId,
    activeTab,
    setActiveTab,
    viewerZoom,
    setViewerZoom,
    resetUploadState,
    gradingCache,
    setGradeCacheEntry,
  } = useAppStore();

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Set<string>>(new Set());
  const [isDebugOverlayOpen, setIsDebugOverlayOpen] = useState(false);

  // Load answer file as object URL — NO auto-select, NO auto-expansion on mount.
  useEffect(() => {
    if (answerFile) {
      const url = URL.createObjectURL(answerFile);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [answerFile]);

  if (!extractionResult?.data?.canonical) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        No extraction result found.
      </div>
    );
  }

  const { canonical, mappings = [] } = extractionResult.data;
  const { questions, answerBlocks } = canonical;

  // Build lookup: questionId → mapping (only for question-bearing entries)
  const mappingByQuestionId = useMemo(() => {
    const map = new Map<string, QuestionAnswerMapping>();
    mappings.forEach((m) => {
      if (m.questionId) map.set(m.questionId, m);
    });
    return map;
  }, [mappings]);

  // Separate out unmatched orphan answer blocks
  const unmatchedMappings = useMemo(
    () => mappings.filter((m) => m.status === "unmatched" && !m.questionId),
    [mappings]
  );

  // -------------------------------------------------------
  // Lazy grading — triggered on click of a MATCHED question
  // -------------------------------------------------------
  const triggerGrading = useCallback(
    (questionId: string, mapping: QuestionAnswerMapping) => {
      // Race condition guard: skip if request already in-flight or cached
      const existing = gradingCache[questionId];
      if (existing && (existing.status === "loading" || existing.status === "graded")) return;

      const question = questions.find((q) => q.id === questionId);
      const answerBlock = answerBlocks.find((a) => a.id === mapping.answerBlockId);

      if (!question || !answerBlock || !PROCESSOR_URL) {
        setGradeCacheEntry(questionId, {
          status: "not_eligible",
          reason: !PROCESSOR_URL
            ? "Processor URL not configured."
            : "Missing question or answer data.",
        });
        return;
      }

      setGradeCacheEntry(questionId, { status: "loading" });

      const maxMarks =
        typeof question.maxMarks === "number" && !isNaN(question.maxMarks) && question.maxMarks > 0
          ? question.maxMarks
          : 1;

      fetch(`${PROCESSOR_URL}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          questionText: question.text,
          answerText: answerBlock.text,
          maxMarks,
        }),
      })
        .then((res) => res.json())
        .then((data: { success?: boolean; grade?: QuestionGrade; error?: string }) => {
          if (data.success && data.grade) {
            setGradeCacheEntry(questionId, { status: "graded", data: data.grade });
          } else {
            setGradeCacheEntry(questionId, {
              status: "error",
              error: data.error ?? "Grading failed.",
            });
          }
        })
        .catch((err: Error) => {
          setGradeCacheEntry(questionId, { status: "error", error: err.message });
        });
    },
    [gradingCache, questions, answerBlocks, setGradeCacheEntry]
  );

  // -------------------------------------------------------
  // Card click — pure toggle
  // -------------------------------------------------------
  const handleQuestionClick = useCallback(
    (questionId: string) => {
      if (selectedQuestionId === questionId) {
        // Deselect: hide highlight, collapse card
        setSelectedQuestionId(null);
        setExpandedQuestionIds((prev) => {
          const next = new Set(prev);
          next.delete(questionId);
          return next;
        });
      } else {
        // Select: reveal highlight, expand card, trigger lazy grading if eligible
        setSelectedQuestionId(questionId);
        setExpandedQuestionIds((prev) => new Set([...prev, questionId]));

        const mapping = mappingByQuestionId.get(questionId);
        if (mapping?.status === "matched" && mapping.answerBlockId) {
          triggerGrading(questionId, mapping);
        } else if (mapping && mapping.status !== "matched") {
          // Mark ineligible statuses immediately (no grading fetch)
          const reasonMap: Record<string, string> = {
            uncertain: "Grading is not available for uncertain matches.",
            unanswered: "No answer was detected for this question.",
            unmatched: "This answer block could not be matched to a question.",
          };
          const existing = gradingCache[questionId];
          if (!existing) {
            setGradeCacheEntry(questionId, {
              status: "not_eligible",
              reason: reasonMap[mapping.status] ?? "Not eligible for grading.",
            });
          }
        }
      }
    },
    [
      selectedQuestionId,
      setSelectedQuestionId,
      mappingByQuestionId,
      triggerGrading,
      gradingCache,
      setGradeCacheEntry,
    ]
  );

  // Expand All: text only — never touches selectedQuestionId or highlights
  const handleExpandAllToggle = () => {
    if (expandedQuestionIds.size === questions.length) {
      setExpandedQuestionIds(new Set());
    } else {
      setExpandedQuestionIds(new Set(questions.map((q) => q.id)));
    }
  };

  const handleZoomIn = () => setViewerZoom(Math.min(viewerZoom + 0.25, 2.5));
  const handleZoomOut = () => setViewerZoom(Math.max(viewerZoom - 0.25, 0.5));
  const handleZoomReset = () => setViewerZoom(1);

  // -------------------------------------------------------
  // Compute active highlight (only when a question is selected)
  // -------------------------------------------------------
  const activeHighlight = useMemo(() => {
    if (!selectedQuestionId) return null;
    const mapping = mappingByQuestionId.get(selectedQuestionId);
    if (!mapping) return null;
    // Unanswered: no regions to show
    if (mapping.status === "unanswered" || !mapping.answerBlockId) return null;
    const block = answerBlocks.find((b) => b.id === mapping.answerBlockId);
    if (!block || block.regions.length === 0) return null;

    const normalizedLabel = block.normalizedLabel ?? block.label ?? "A";
    const confidenceSuffix =
      mapping.status === "uncertain" ? ` · ${(mapping.confidence * 100).toFixed(0)}%` : "";

    return {
      regions: block.regions,
      status: mapping.status as MappingStatus,
      label: normalizedLabel + confidenceSuffix,
    };
  }, [selectedQuestionId, mappingByQuestionId, answerBlocks]);

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  return (
    <div className="flex flex-col h-full w-full overflow-hidden font-sans">
      {/* Mobile tab switcher */}
      <div className="flex lg:hidden bg-white border border-slate-200 rounded-xl mb-2 overflow-hidden shrink-0">
        {(["questions", "answers"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors capitalize ${
              activeTab === tab
                ? "bg-foreground text-background"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab === "questions" ? `Questions (${questions.length})` : "Answer Sheet"}
          </button>
        ))}
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 gap-4 h-full min-h-0 overflow-hidden">
        {/* ═══════════════════════════════════════════
            LEFT PANEL — Questions list
        ═══════════════════════════════════════════ */}
        <div
          className={`w-full lg:w-[48%] xl:w-[45%] flex flex-col bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl overflow-hidden shadow-sm ${
            activeTab === "questions" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-white shrink-0 flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">
              Extracted Questions{" "}
              <span className="text-slate-400 font-normal text-xs">({questions.length})</span>
            </h2>
            <button
              onClick={handleExpandAllToggle}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              {expandedQuestionIds.size === questions.length ? "Collapse All" : "Expand All"}
            </button>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {questions.map((q, idx) => {
              const mapping = mappingByQuestionId.get(q.id);
              const status: MappingStatus = (mapping?.status as MappingStatus) ?? "unanswered";
              const cfg = STATUS_CONFIG[status];
              const isSelected = selectedQuestionId === q.id;
              const isExpanded = expandedQuestionIds.has(q.id);
              const gradeEntry = gradingCache[q.id];

              const cardCls = isSelected
                ? `border-l-4 ${cfg.accentCls} shadow-md bg-slate-50/80`
                : "border border-slate-200/80 hover:border-slate-300 hover:shadow-sm bg-white";

              return (
                <div
                  key={q.id}
                  id={`question-card-${q.id}`}
                  onClick={() => handleQuestionClick(q.id)}
                  className={`p-4 rounded-2xl transition-all cursor-pointer ${cardCls}`}
                  role="button"
                  aria-expanded={isExpanded}
                  aria-selected={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleQuestionClick(q.id);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Index badge */}
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                        isSelected ? "bg-orange text-white" : "bg-slate-800 text-white"
                      }`}
                    >
                      {idx + 1}
                    </span>

                    <div className="flex-1 min-w-0 pt-0.5">
                      {/* Row: question text + marks + badge + chevron */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-slate-800 leading-relaxed">
                          {q.label && (
                            <span className="font-bold text-slate-600 mr-1">{q.label}</span>
                          )}
                          {q.text}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {q.maxMarks && q.maxMarks > 0 && (
                            <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 rounded bg-slate-100">
                              {q.maxMarks}M
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.badgeCls}`}
                          >
                            {cfg.badgeLabel}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="size-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronDown className="size-4 text-slate-400 shrink-0" />
                          )}
                        </div>
                      </div>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="mt-3 pt-2 border-t border-slate-100 space-y-2">
                          {/* UNCERTAIN: show evidence reasons + confidence */}
                          {status === "uncertain" && mapping && (
                            <div className="rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-2">
                              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1">
                                Evidence (Uncertain Match ·{" "}
                                {(mapping.confidence * 100).toFixed(0)}%)
                              </p>
                              <ul className="space-y-0.5 list-disc list-inside">
                                {mapping.evidence.reasons.map((r, i) => (
                                  <li key={i} className="text-[11px] text-amber-700">
                                    {r}
                                  </li>
                                ))}
                              </ul>
                              <p className="text-[10px] text-amber-500 mt-1.5 italic">
                                Grading unavailable for uncertain matches.
                              </p>
                            </div>
                          )}

                          {/* UNANSWERED */}
                          {status === "unanswered" && (
                            <div className="rounded-xl bg-rose-50 border border-rose-100 p-2.5 text-xs text-rose-600 font-medium">
                              No answer detected for this question.
                            </div>
                          )}

                          {/* MATCHED: grading panel */}
                          {status === "matched" && (
                            <>
                              {!gradeEntry || gradeEntry.status === "idle" ? (
                                <p className="text-xs text-slate-400 italic">
                                  Grading will appear here...
                                </p>
                              ) : gradeEntry.status === "loading" ? (
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <span className="size-2 animate-bounce rounded-full bg-orange [animation-delay:-0.3s]" />
                                  <span className="size-2 animate-bounce rounded-full bg-orange [animation-delay:-0.15s]" />
                                  <span className="size-2 animate-bounce rounded-full bg-orange" />
                                  <span className="ml-1">Grading...</span>
                                </div>
                              ) : gradeEntry.status === "graded" && gradeEntry.data ? (
                                <GradeCard
                                  grade={gradeEntry.data}
                                  onRetry={() => {
                                    setGradeCacheEntry(q.id, { status: "idle" });
                                    const m = mappingByQuestionId.get(q.id);
                                    if (m) setTimeout(() => triggerGrading(q.id, m), 0);
                                  }}
                                />
                              ) : gradeEntry.status === "error" ? (
                                <div className="rounded-xl bg-rose-50 border border-rose-100 p-2.5 text-xs text-rose-600">
                                  <p className="font-semibold">Grading failed</p>
                                  <p className="mt-0.5 text-rose-500 text-[11px]">
                                    {gradeEntry.error}
                                  </p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setGradeCacheEntry(q.id, { status: "idle" });
                                      const m = mappingByQuestionId.get(q.id);
                                      if (m) setTimeout(() => triggerGrading(q.id, m), 0);
                                    }}
                                    className="mt-1.5 text-[10px] underline font-medium hover:no-underline text-rose-500"
                                  >
                                    Retry grading
                                  </button>
                                </div>
                              ) : gradeEntry.status === "not_eligible" ? (
                                <p className="text-[11px] text-slate-400 italic">
                                  {gradeEntry.reason}
                                </p>
                              ) : null}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Unmatched orphan answer blocks */}
            {unmatchedMappings.length > 0 && (
              <div className="mt-2 pt-3 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
                  Unmatched Answer Blocks ({unmatchedMappings.length})
                </p>
                <div className="space-y-2">
                  {unmatchedMappings.map((m) => {
                    const block = answerBlocks.find((b) => b.id === m.answerBlockId);
                    if (!block) return null;
                    return (
                      <div
                        key={m.answerBlockId ?? block.id}
                        className="p-3 rounded-xl border border-slate-200/80 bg-white"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                            Unmatched
                          </span>
                          {block.normalizedLabel && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {block.normalizedLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-700 leading-relaxed italic">
                          &ldquo;{block.text}&rdquo;
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            RIGHT PANEL — Answer sheet viewer
        ═══════════════════════════════════════════ */}
        <div
          className={`w-full lg:w-[52%] xl:w-[55%] flex flex-col bg-slate-800/95 border border-slate-700/60 rounded-2xl overflow-hidden shadow-sm relative ${
            activeTab === "answers" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Controls bar */}
          <div className="h-12 bg-slate-900/90 border-b border-slate-700/60 px-4 flex justify-between items-center text-white shrink-0 z-20">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">Answer Sheet</span>
              {/* Dev-Only Debug Overlay Mode Toggle */}
              <button
                onClick={() => setIsDebugOverlayOpen(!isDebugOverlayOpen)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors border ${
                  isDebugOverlayOpen
                    ? "bg-orange text-white border-orange shadow-sm"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-700"
                }`}
                title="Toggle Dev-Only All Regions Debug Overlay"
              >
                <Bug className="size-3" />
                <span>Debug Overlay</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Zoom */}
              <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700 text-xs">
                <button
                  onClick={handleZoomOut}
                  className="p-1 text-slate-300 hover:text-white transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="size-3.5" />
                </button>
                <span className="w-12 text-center text-[11px] font-bold text-slate-200">
                  {Math.round(viewerZoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-1 text-slate-300 hover:text-white transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="size-3.5" />
                </button>
                <button
                  onClick={handleZoomReset}
                  className="p-1 text-slate-400 hover:text-white transition-colors ml-1 border-l border-slate-700 pl-1.5"
                  title="Reset Zoom"
                >
                  <RotateCcw className="size-3" />
                </button>
              </div>

              {/* Page nav */}
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700 text-xs font-medium text-slate-300">
                <button className="text-slate-400 hover:text-white" aria-label="Previous page">
                  <ChevronLeft className="size-3.5" />
                </button>
                <span className="text-[11px]">Page 1 of 1</span>
                <button className="text-slate-400 hover:text-white" aria-label="Next page">
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable canvas */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto custom-scrollbar p-4 relative flex justify-center bg-slate-950/40">
            {imageUrl ? (
              <div
                className="relative bg-white shadow-2xl transition-transform duration-150 ease-out origin-top"
                style={{ transform: `scale(${viewerZoom})`, minWidth: "650px" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Answer Sheet"
                  className="w-full h-auto block select-none rounded-sm"
                  style={{ minWidth: "650px" }}
                  draggable={false}
                />

                {/* Normal Click-Gated SVG Highlight */}
                {!isDebugOverlayOpen && activeHighlight && (
                  <HighlightOverlay
                    key={selectedQuestionId}
                    regions={activeHighlight.regions}
                    status={activeHighlight.status}
                    label={activeHighlight.label}
                  />
                )}

                {/* Dev-Only Debug Overlay Layer */}
                {isDebugOverlayOpen && (
                  <DebugOverlay
                    answerBlocks={answerBlocks}
                    mappings={mappings}
                    selectedQuestionId={selectedQuestionId}
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                Answer sheet preview not available.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="h-10 bg-slate-900/90 border-t border-slate-700/60 px-4 flex justify-between items-center text-xs text-slate-400 shrink-0 z-20">
            <span>Deterministic 1:1 mapped output</span>
            <button
              onClick={resetUploadState}
              className="text-orange hover:underline font-semibold"
            >
              Upload another document
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
