"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import { ChevronDown, ChevronUp, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { QuestionAnswerMapping } from "@/lib/extraction-schema";

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
  } = useAppStore();

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Set<string>>(new Set());

  // Load answer file image URL
  useEffect(() => {
    if (answerFile) {
      const url = URL.createObjectURL(answerFile);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [answerFile]);

  // Select first question by default if none selected
  useEffect(() => {
    if (extractionResult?.data?.canonical?.questions?.length && !selectedQuestionId) {
      const firstQ = extractionResult.data.canonical.questions[0];
      if (firstQ) {
        setSelectedQuestionId(firstQ.id);
        setExpandedQuestionIds(new Set([firstQ.id]));
      }
    }
  }, [extractionResult, selectedQuestionId, setSelectedQuestionId]);

  if (!extractionResult || !extractionResult.data.canonical) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        No extraction result found or legacy extraction format.
      </div>
    );
  }

  const { canonical, mappings = [] } = extractionResult.data;
  const { questions, answerBlocks } = canonical;

  const mappingByQuestionId = useMemo(() => {
    const map = new Map<string, QuestionAnswerMapping>();
    mappings.forEach((m) => map.set(m.questionId, m));
    return map;
  }, [mappings]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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

  return (
    <div className="flex flex-col h-full w-full overflow-hidden font-sans">
      
      {/* Mobile Tab Switcher */}
      <div className="flex lg:hidden bg-white border border-slate-200 rounded-xl mb-2 overflow-hidden shrink-0">
        <button
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "questions"
              ? "bg-foreground text-background"
              : "text-slate-600 hover:text-slate-900"
          }`}
          onClick={() => setActiveTab("questions")}
        >
          Questions ({questions.length})
        </button>
        <button
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "answers"
              ? "bg-foreground text-background"
              : "text-slate-600 hover:text-slate-900"
          }`}
          onClick={() => setActiveTab("answers")}
        >
          Answer Sheet
        </button>
      </div>

      {/* Two-Panel Layout */}
      <div className="flex flex-1 gap-4 h-full min-h-0 overflow-hidden">
        
        {/* Left Panel: Questions List Container (Independent Scroll) */}
        <div
          className={`w-full lg:w-[48%] xl:w-[45%] flex flex-col bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl overflow-hidden shadow-sm ${
            activeTab === "questions" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Header Bar */}
          <div className="p-4 border-b border-slate-100 bg-white shrink-0 flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">
              Extracted Questions <span className="text-slate-400 font-normal text-xs">(from question paper)</span>
            </h2>
            <button
              onClick={handleExpandAllToggle}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              {expandedQuestionIds.size === questions.length ? "Collapse All" : "Expand All"}
            </button>
          </div>

          {/* Scrollable Questions List (ONLY this scrolls internally) */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-3">
            {questions.map((q, idx) => {
              const mapping = mappingByQuestionId.get(q.id);
              const isSelected = selectedQuestionId === q.id;
              const isExpanded = expandedQuestionIds.has(q.id) || isSelected;
              const mappedAnswer = mapping?.answerBlockId
                ? answerBlocks.find((a) => a.id === mapping.answerBlockId)
                : null;

              // Display score badge mock or extracted max marks
              const maxMarks = (q as any).maxMarks || 2;
              const awardedMarks = mappedAnswer ? maxMarks : 0;
              const scoreText = `${awardedMarks}/${maxMarks}`;
              const isFullScore = awardedMarks === maxMarks && awardedMarks > 0;

              return (
                <div
                  key={q.id}
                  onClick={() => {
                    setSelectedQuestionId(q.id);
                    setExpandedQuestionIds((prev) => new Set(prev).add(q.id));
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer bg-white ${
                    isSelected
                      ? "border-2 border-orange/80 shadow-md ring-1 ring-orange/20"
                      : "border-slate-200/80 hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Circle Index Badge */}
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                        isSelected
                          ? "bg-orange text-white"
                          : "bg-slate-800 text-white"
                      }`}
                    >
                      {idx + 1}
                    </span>

                    {/* Question Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-slate-800 leading-relaxed">
                          {q.text}
                        </p>

                        {/* Marks & Expand Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              isFullScore
                                ? "bg-emerald-100 text-emerald-700"
                                : awardedMarks > 0
                                ? "bg-amber-100 text-amber-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {scoreText}
                          </span>
                          <button
                            onClick={(e) => toggleExpand(q.id, e)}
                            className="text-slate-400 hover:text-slate-600 p-0.5"
                          >
                            {isExpanded ? (
                              <ChevronUp className="size-4" />
                            ) : (
                              <ChevronDown className="size-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* AI Feedback & Mapped Answer Detail (when expanded) */}
                      {isExpanded && (
                        <div className="mt-3 space-y-2 pt-2 border-t border-slate-100">
                          {mappedAnswer ? (
                            <div className="rounded-xl bg-orange-soft/30 border border-orange-soft/60 p-3">
                              <div className="text-[11px] font-bold text-orange uppercase tracking-wider mb-1 flex justify-between items-center">
                                <span>AI Feedback</span>
                                {mapping?.confidence ? (
                                  <span className="text-[10px] text-slate-500 font-normal">
                                    {(mapping.confidence * 100).toFixed(0)}% Confidence
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-xs text-slate-700 leading-relaxed font-normal">
                                Excellent work! The answer block directly corresponds to this question label.
                              </p>
                              <div className="mt-2 pt-2 border-t border-orange-soft/40">
                                <span className="text-[10px] font-semibold text-slate-500 uppercase">Extracted Answer Text:</span>
                                <p className="text-xs text-slate-800 font-medium italic mt-0.5">
                                  &quot;{mappedAnswer.text}&quot;
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl bg-rose-50 border border-rose-100 p-2.5 text-xs text-rose-600 font-medium">
                              No answer sheet response mapped for this question.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Answer Sheet Viewer Container (Independent Scroll) */}
        <div
          className={`w-full lg:w-[52%] xl:w-[55%] flex flex-col bg-slate-800/95 border border-slate-700/60 rounded-2xl overflow-hidden shadow-sm relative ${
            activeTab === "answers" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Top Viewer Controls Bar */}
          <div className="h-12 bg-slate-900/90 border-b border-slate-700/60 px-4 flex justify-between items-center text-white shrink-0 z-20">
            <span className="text-xs font-semibold text-slate-200">Answer Sheet</span>

            <div className="flex items-center gap-3">
              {/* Zoom Controls */}
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

              {/* Page Navigator */}
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700 text-xs font-medium text-slate-300">
                <button className="text-slate-400 hover:text-white"><ChevronLeft className="size-3.5" /></button>
                <span className="text-[11px]">Page 1 of 1</span>
                <button className="text-slate-400 hover:text-white"><ChevronRight className="size-3.5" /></button>
              </div>
            </div>
          </div>

          {/* Scrollable Answer Sheet Canvas Container (ONLY this scrolls internally) */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto custom-scrollbar p-4 relative flex justify-center bg-slate-950/40">
            {imageUrl ? (
              <div
                className="relative bg-white shadow-2xl transition-transform duration-150 ease-out origin-top my-auto"
                style={{
                  transform: `scale(${viewerZoom})`,
                  minWidth: "650px",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Answer Sheet"
                  className="w-full h-auto block select-none rounded-sm"
                  style={{ minWidth: "650px" }}
                />

                {/* Answer Region Bounding Box Overlays */}
                {answerBlocks.map((block) => {
                  if (!block.regions || block.regions.length === 0) return null;

                  const isMappedToSelected =
                    selectedQuestionId &&
                    mappings.some(
                      (m) =>
                        m.questionId === selectedQuestionId &&
                        m.answerBlockId === block.id
                    );

                  return block.regions.map((region, rIdx) => {
                    const left = `${(region.x1 / 1000) * 100}%`;
                    const top = `${(region.y1 / 1000) * 100}%`;
                    const width = `${((region.x2 - region.x1) / 1000) * 100}%`;
                    const height = `${((region.y2 - region.y1) / 1000) * 100}%`;

                    const displayLabel = block.normalizedLabel || block.label || "A";

                    return (
                      <div
                        key={`${block.id}-r-${rIdx}`}
                        className={`absolute border-2 rounded-lg transition-all duration-200 ${
                          isMappedToSelected
                            ? "border-emerald-500 bg-emerald-500/15 ring-4 ring-emerald-500/20 z-30"
                            : "border-emerald-400/80 bg-emerald-400/10 hover:bg-emerald-400/20 z-10"
                        }`}
                        style={{ left, top, width, height }}
                      >
                        <span
                          className={`absolute -top-3 -left-3 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm ${
                            isMappedToSelected
                              ? "bg-emerald-600 text-white"
                              : "bg-emerald-500 text-white"
                          }`}
                        >
                          {displayLabel}
                        </span>
                      </div>
                    );
                  });
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                Answer sheet preview not loaded.
              </div>
            )}
          </div>

          {/* Footer Reset Action */}
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
