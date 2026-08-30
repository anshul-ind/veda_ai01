"use client";

import { create } from "zustand";
import type { ExtractionResult, ExtractionStage } from "@/types/extraction";

type AppStore = {
  questionFile: File | null;
  answerFile: File | null;

  questionFileError: string | null;
  answerFileError: string | null;

  isExtracting: boolean;
  submissionError: string | null;

  // Sprint 3 state machine
  extractionStage: ExtractionStage;
  extractionResult: ExtractionResult | null;
  extractionError: string | null;

  setQuestionFile: (file: File | null) => void;
  setAnswerFile: (file: File | null) => void;

  setQuestionFileError: (error: string | null) => void;
  setAnswerFileError: (error: string | null) => void;

  setIsExtracting: (value: boolean) => void;
  setSubmissionError: (error: string | null) => void;

  setExtractionStage: (stage: ExtractionStage) => void;
  setExtractionResult: (result: ExtractionResult | null) => void;
  setExtractionError: (error: string | null) => void;

  removeQuestionFile: () => void;
  removeAnswerFile: () => void;

  resetUploadState: () => void;
  resetExtractionState: () => void;

  // Sprint 4/5: Exam Review UI State
  selectedQuestionId: string | null;
  activeTab: "questions" | "answers";
  viewerZoom: number;

  isSidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;
  toggleSidebarExpanded: () => void;

  setSelectedQuestionId: (id: string | null) => void;
  setActiveTab: (tab: "questions" | "answers") => void;
  setViewerZoom: (zoom: number) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  questionFile: null,
  answerFile: null,

  questionFileError: null,
  answerFileError: null,

  isExtracting: false,
  submissionError: null,

  extractionStage: "idle",
  extractionResult: null,
  extractionError: null,

  setQuestionFile: (file) => set({ questionFile: file }),
  setAnswerFile: (file) => set({ answerFile: file }),

  setQuestionFileError: (error) => set({ questionFileError: error }),
  setAnswerFileError: (error) => set({ answerFileError: error }),

  setIsExtracting: (value) =>
    set({
      isExtracting: value,
      extractionStage: value ? "extracting_questions" : "idle",
    }),
  setSubmissionError: (error) => set({ submissionError: error }),

  setExtractionStage: (stage) =>
    set({
      extractionStage: stage,
      isExtracting: stage !== "idle" && stage !== "done" && stage !== "error",
    }),
  setExtractionResult: (result) => set({ extractionResult: result }),
  setExtractionError: (error) => set({ extractionError: error }),

  removeQuestionFile: () => set({ questionFile: null, questionFileError: null }),
  removeAnswerFile: () => set({ answerFile: null, answerFileError: null }),

  resetUploadState: () =>
    set({
      questionFile: null,
      answerFile: null,
      questionFileError: null,
      answerFileError: null,
      isExtracting: false,
      submissionError: null,
      extractionStage: "idle",
      extractionResult: null,
      extractionError: null,
      selectedQuestionId: null,
      activeTab: "questions",
      viewerZoom: 1,
    }),
  resetExtractionState: () =>
    set({
      extractionStage: "idle",
      extractionResult: null,
      extractionError: null,
      isExtracting: false,
      selectedQuestionId: null,
      activeTab: "questions",
      viewerZoom: 1,
    }),

  selectedQuestionId: null,
  activeTab: "questions",
  viewerZoom: 1,

  isSidebarExpanded: true,
  setSidebarExpanded: (expanded) => set({ isSidebarExpanded: expanded }),
  toggleSidebarExpanded: () => set((state) => ({ isSidebarExpanded: !state.isSidebarExpanded })),

  setSelectedQuestionId: (id) => set({ selectedQuestionId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setViewerZoom: (zoom) => set({ viewerZoom: zoom }),
}));
