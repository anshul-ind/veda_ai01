"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import {
  CanonicalQuestion,
  CanonicalAnswerBlock,
  QuestionAnswerMapping,
} from "@/lib/extraction-schema";

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

  // Load answer file image URL
  useEffect(() => {
    if (answerFile) {
      const url = URL.createObjectURL(answerFile);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [answerFile]);

  if (!extractionResult || !extractionResult.data.canonical) {
    return <div>No extraction result found or legacy extraction without canonical data.</div>;
  }

  const { canonical, mappings = [] } = extractionResult.data;
  const { questions, answerBlocks } = canonical;

  const handleZoomIn = () => setViewerZoom(Math.min(viewerZoom + 0.2, 3));
  const handleZoomOut = () => setViewerZoom(Math.max(viewerZoom - 0.2, 0.5));
  const handleZoomReset = () => setViewerZoom(1);

  // Group mappings by questionId for easy lookup
  const mappingByQuestionId = useMemo(() => {
    const map = new Map<string, QuestionAnswerMapping>();
    mappings.forEach((m) => map.set(m.questionId, m));
    return map;
  }, [mappings]);

  // Group unmatched answer blocks
  const unmatchedMappings = mappings.filter((m) => m.status === "unmatched");
  const unmatchedBlockIds = new Set(unmatchedMappings.map((m) => m.answerBlockId).filter(Boolean));
  const unmatchedBlocks = answerBlocks.filter((b) => !mappings.some(m => m.answerBlockId === b.id)); // fallback if unmatched mapping is not explicit

  const renderStatusBadge = (status?: "matched" | "uncertain" | "unanswered" | "unmatched") => {
    switch (status) {
      case "matched":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-700 border border-emerald-500/30">Matched</span>;
      case "uncertain":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-700 border border-amber-500/30">Uncertain</span>;
      case "unanswered":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-700 border border-rose-500/30">Unanswered</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-500/20 text-slate-700 border border-slate-500/30">Unknown</span>;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] w-full overflow-hidden bg-slate-50 border border-slate-200 rounded-xl shadow-lg mt-6 font-sans">
      
      {/* Mobile Tab Switcher */}
      <div className="flex lg:hidden bg-white border-b border-slate-200">
        <button
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === "questions" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-500 hover:text-slate-800"}`}
          onClick={() => setActiveTab("questions")}
        >
          Questions ({questions.length})
        </button>
        <button
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === "answers" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-500 hover:text-slate-800"}`}
          onClick={() => setActiveTab("answers")}
        >
          Answer Sheet
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Questions List */}
        <div className={`w-full lg:w-1/3 flex-col bg-white border-r border-slate-200 overflow-y-auto ${activeTab === "questions" ? "flex" : "hidden lg:flex"}`}>
          <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-10 flex justify-between items-center shadow-sm">
            <h2 className="text-lg font-bold text-slate-800">Exam Questions</h2>
            <div className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
              {questions.length} Items
            </div>
          </div>
          
          <div className="p-3 space-y-3">
            {questions.map((q) => {
              const mapping = mappingByQuestionId.get(q.id);
              const isSelected = selectedQuestionId === q.id;
              const mappedAnswer = mapping?.answerBlockId ? answerBlocks.find((a) => a.id === mapping.answerBlockId) : null;

              return (
                <div
                  key={q.id}
                  onClick={() => setSelectedQuestionId(q.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm hover:shadow-md ${
                    isSelected
                      ? "bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200"
                      : "bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {q.normalizedLabel || q.label || `Q${q.order}`}
                      </span>
                      {q.type === "sub" && (
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Sub</span>
                      )}
                    </div>
                    {renderStatusBadge(mapping?.status)}
                  </div>
                  
                  <p className="text-sm text-slate-700 leading-relaxed font-medium mb-3">
                    {q.text}
                  </p>

                  {mapping?.status !== "unanswered" && mappedAnswer && (
                    <div className={`mt-3 p-3 rounded-lg border text-sm ${isSelected ? 'bg-white border-indigo-100 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wide mb-1 flex justify-between">
                        <span>Extracted Answer</span>
                        {(mapping?.confidence ?? 0) > 0 && <span>{((mapping?.confidence ?? 0) * 100).toFixed(0)}% Match</span>}
                      </div>
                      <p className="text-slate-600 line-clamp-3 leading-relaxed">
                        {mappedAnswer.text}
                      </p>
                    </div>
                  )}
                  
                  {mapping?.status === "unanswered" && (
                    <div className="mt-3 p-2 rounded-lg bg-rose-50 border border-rose-100 text-xs text-rose-600 font-medium flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                      No answer detected in the submitted document.
                    </div>
                  )}
                </div>
              );
            })}

            {unmatchedBlocks.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">Unmatched Answers</h3>
                {unmatchedBlocks.map((b) => (
                  <div key={b.id} className="p-3 mb-2 rounded-lg bg-slate-50 border border-slate-200 opacity-75">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {b.normalizedLabel || b.label || "Unknown"}
                      </span>
                      {renderStatusBadge("unmatched")}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{b.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Answer Sheet Viewer */}
        <div className={`w-full lg:w-2/3 flex-col bg-slate-100 relative ${activeTab === "answers" ? "flex" : "hidden lg:flex"}`}>
          {/* Viewer Toolbar */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/90 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-slate-200/50">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-600 hover:text-indigo-600 hover:bg-indigo-50" onClick={handleZoomOut}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg>
            </Button>
            <div className="w-16 text-center text-xs font-bold text-slate-700 bg-slate-100/50 rounded-full py-1">
              {Math.round(viewerZoom * 100)}%
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-600 hover:text-indigo-600 hover:bg-indigo-50" onClick={handleZoomIn}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            </Button>
            <div className="w-px h-4 bg-slate-300 mx-1"></div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-600 hover:text-indigo-600 hover:bg-indigo-50" onClick={handleZoomReset}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
            </Button>
          </div>

          {/* Viewer Canvas Container */}
          <div className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar relative flex items-center justify-center bg-slate-900/5 inset-0" id="viewer-container">
            {imageUrl ? (
              <div 
                className="relative bg-white shadow-2xl transition-transform duration-200 ease-out origin-top"
                style={{ 
                  transform: `scale(${viewerZoom})`,
                  minWidth: "800px", // Baseline rendering width for coordinates
                  minHeight: "1000px" // Approximate baseline height
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={imageUrl} 
                  alt="Answer Sheet" 
                  className="w-full h-auto block select-none"
                  style={{ minWidth: "800px" }}
                />

                {/* Overlays */}
                {answerBlocks.map((block) => {
                  if (!block.regions || block.regions.length === 0) return null;
                  
                  // For mapping overlay highlighting
                  const isMappedToSelected = selectedQuestionId && mappings.some(m => m.questionId === selectedQuestionId && m.answerBlockId === block.id);
                  // Is it mapped to anything?
                  const isMapped = mappings.some(m => m.answerBlockId === block.id);
                  const isUnmatched = !isMapped;

                  return block.regions.map((region, idx) => {
                    // Coordinate system: region.x1, y1 etc are 0-1000 scale relative to image width/height
                    const left = `${(region.x1 / 1000) * 100}%`;
                    const top = `${(region.y1 / 1000) * 100}%`;
                    const width = `${((region.x2 - region.x1) / 1000) * 100}%`;
                    const height = `${((region.y2 - region.y1) / 1000) * 100}%`;

                    let ringClass = "border-slate-400 bg-slate-400/10";
                    let zIndex = 10;
                    
                    if (isMappedToSelected) {
                      ringClass = "border-indigo-500 bg-indigo-500/20 ring-4 ring-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.5)]";
                      zIndex = 30;
                    } else if (isMapped) {
                      ringClass = "border-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 hover:border-emerald-500";
                      zIndex = 20;
                    } else if (isUnmatched) {
                      ringClass = "border-amber-400 bg-amber-400/10 border-dashed hover:bg-amber-400/20";
                    }

                    return (
                      <div
                        key={`${block.id}-region-${idx}`}
                        className={`absolute border-2 rounded transition-all duration-300 cursor-help ${ringClass}`}
                        style={{ left, top, width, height, zIndex }}
                        title={`Block: ${block.normalizedLabel || block.label}\nText: ${block.text}`}
                      >
                        {isMappedToSelected && (
                          <div className="absolute -top-3 -left-3 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">
                            {block.normalizedLabel || block.label}
                          </div>
                        )}
                        {!isMappedToSelected && (
                          <div className="absolute -top-2 -left-2 bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm opacity-60">
                            {block.normalizedLabel || block.label}
                          </div>
                        )}
                      </div>
                    );
                  });
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <p className="font-medium">Image preview not available</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Bottom Footer Action */}
      <div className="bg-white border-t border-slate-200 p-3 flex justify-between items-center z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="text-sm font-medium text-slate-500 px-4">
          Extraction completed successfully. Review the mapped answers above.
        </div>
        <Button onClick={resetUploadState} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold px-6">
          Process Another Document
        </Button>
      </div>

    </div>
  );
}
