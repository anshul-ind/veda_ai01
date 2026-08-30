'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  ArrowRight,
  Check,
  Clock,
  Cloud,
  MessageSquare,
  Settings,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

import {
  isDuplicateFileHeuristic,
  MAX_TOTAL_UPLOAD_SIZE,
  validateSingleFile,
  validateTotalFileSize,
} from '@/lib/validations'
import { useAppStore } from '@/stores/app-store'
import type { ExtractionResult } from '@/types/extraction'
import { ExamReview } from '@/components/exam-review/ExamReview'
import { AppShell } from '@/components/layout/AppShell'

const PROCESSOR_URL = process.env.NEXT_PUBLIC_PROCESSOR_URL?.replace(/\/$/, '')

function UploadCard({
  type,
  file,
  error,
  onChange,
  onClear,
}: {
  type: 'Question Paper' | 'Answer Sheet'
  file: File | null
  error: string | null
  onChange: (file: File) => void
  onClear: () => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)

  return (
    <div className="flex flex-col w-[386.5px] h-[205px]">
      <label
        className={`group relative flex w-[386.5px] h-[205px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-background/95 px-6 py-6 transition-all ${error
          ? 'border-destructive/60'
          : isDragOver
            ? 'border-orange bg-orange-soft/40'
            : 'border-foreground/20 hover:border-orange'
          }`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setIsDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragOver(false)
          const dropped = e.dataTransfer.files?.[0]
          if (dropped) onChange(dropped)
        }}
      >
        <input
          className="sr-only"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(event) => {
            const selected = event.target.files?.[0]
            event.target.value = ''
            if (selected) onChange(selected)
          }}
        />

        {file ? (
          <div className="flex flex-col items-center text-center px-2">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                onClear()
              }}
              className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted transition-colors"
              aria-label={`Remove ${type}`}
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="grid size-6 place-items-center rounded bg-orange text-background">
                <Check className="size-4" strokeWidth={3} />
              </span>
              <span className="max-w-[220px] truncate text-sm font-semibold text-foreground">
                {file.name}
              </span>
            </div>

            <span className="text-xs text-muted-foreground font-medium">
              {(file.size / (1024 * 1024)).toFixed(1)} MB • Ready to map
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <Upload className="mb-2 size-6 rounded bg-muted p-1 text-foreground" />
            <span className="text-sm font-semibold text-foreground">
              Upload <span className="text-orange">{type}</span>
            </span>
            <span className="mt-1 text-center text-xs text-muted-foreground">
              Max 20 MiB per file • 35 MiB combined
            </span>
          </div>
        )}
      </label>
      {error && <p className="mt-1.5 text-xs text-destructive text-center">{error}</p>}
    </div>
  )
}

function ExtractingView({ stage, error }: { stage: string; error?: string | null }) {
  const stageText: Record<string, string> = {
    validating: 'Uploading securely...',
    uploading: 'Uploading securely...',
    waiting_for_files: 'Uploading securely...',
    extracting_questions: 'Extracting...',
    extracting_answers: 'Extracting...',
    validating_output: 'Extracting...',
    done: 'Extraction complete',
    error: 'Extraction failed',
  }
  const display = stageText[stage] ?? 'Extracting...'

  return (
    <div className="flex h-full w-full min-h-0 flex-col items-center justify-center text-center p-4">
      {/* Outer Container: width: 177px; height: 221.4921875px; gap: 15px */}
      <div className="w-[177px] h-[221.49px] flex flex-col items-center justify-between gap-[15px]">

        {/* Sparkle Icon: width: 128.154296875px; height: 134.4921875px */}
       {/* <div className="relative w-[128.15px] h-[134.49px] shrink-0">
          <Image
            src="/sparkle.png"
            alt="Loading Sparkle"
            width={128.15}
            height={134.49}
            className="object-contain"
            priority
          />
        </div> */}

        {/* Text Block: width: 177px; height: 72px */}
        <div className="w-[177px] h-[72px] flex flex-col items-center justify-center">
          {/* Status Pill Badge */}
          <div className="inline-flex items-center justify-center rounded-full bg-orange-soft/90 border border-orange/20 px-3.5 py-1 text-xs font-semibold text-orange shadow-xs">
            <span>{display}</span>
          </div>

          {/* Subtext */}
          <p className="mt-1.5 text-xl text-muted-foreground font-medium whitespace-nowrap">
            {stage === 'error' ? (error ?? 'Something went wrong.') : 'This may take a while'}
          </p>

          {/* Sequential 3-Dot Loader */}
          {stage !== 'error' && (
            <div className="mt-2.5 flex items-center justify-center gap-1.5">
              <span className="size-2 animate-bounce rounded-full bg-orange [animation-delay:-0.3s]" />
              <span className="size-2 animate-bounce rounded-full bg-orange [animation-delay:-0.15s]" />
              <span className="size-2 animate-bounce rounded-full bg-orange" />
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default function Page() {
  const {
    questionFile,
    answerFile,
    questionFileError,
    answerFileError,
    isExtracting,
    submissionError,
    extractionStage,
    extractionResult,
    extractionError,
    setQuestionFile,
    setAnswerFile,
    setQuestionFileError,
    setAnswerFileError,
    setIsExtracting,
    setSubmissionError,
    setExtractionStage,
    setExtractionResult,
    setExtractionError,
    removeQuestionFile,
    removeAnswerFile,
  } = useAppStore()

  useEffect(() => {
    console.log('[veda] NEXT_PUBLIC_PROCESSOR_URL resolved', PROCESSOR_URL ?? '(not set; using /api/upload)')
  }, [])

  const handleQuestionSelect = (file: File) => {
    setSubmissionError(null)
    const result = validateSingleFile(file)
    if (!result.valid) {
      setQuestionFile(null)
      setQuestionFileError(result.error)
      return
    }
    if (answerFile && isDuplicateFileHeuristic(file, answerFile)) {
      setQuestionFile(file)
      setQuestionFileError('Question Paper and Answer Sheet cannot be the same file.')
      return
    }
    if (answerFile && file.size + answerFile.size > MAX_TOTAL_UPLOAD_SIZE) {
      setQuestionFile(file)
      setQuestionFileError(null)
      setSubmissionError('The two files together exceed the 35 MiB combined upload limit.')
      return
    }
    setQuestionFile(file)
    setQuestionFileError(null)
    if (answerFileError === 'Question Paper and Answer Sheet cannot be the same file.') {
      setAnswerFileError(null)
    }
    if (answerFile) {
      const total = validateTotalFileSize(file, answerFile)
      if (total.valid) setSubmissionError(null)
    }
  }

  const handleAnswerSelect = (file: File) => {
    setSubmissionError(null)
    const result = validateSingleFile(file)
    if (!result.valid) {
      setAnswerFile(null)
      setAnswerFileError(result.error)
      return
    }
    if (questionFile && isDuplicateFileHeuristic(questionFile, file)) {
      setAnswerFile(file)
      setAnswerFileError('Question Paper and Answer Sheet cannot be the same file.')
      return
    }
    if (questionFile && questionFile.size + file.size > MAX_TOTAL_UPLOAD_SIZE) {
      setAnswerFile(file)
      setAnswerFileError(null)
      setSubmissionError('The two files together exceed the 35 MiB combined upload limit.')
      return
    }
    setAnswerFile(file)
    setAnswerFileError(null)
    if (questionFileError === 'Question Paper and Answer Sheet cannot be the same file.') {
      setQuestionFileError(null)
    }
    if (questionFile) {
      const total = validateTotalFileSize(questionFile, file)
      if (total.valid) setSubmissionError(null)
    }
  }

  const handleQuestionClear = () => {
    removeQuestionFile()
    setSubmissionError(null)
    if (answerFileError === 'Question Paper and Answer Sheet cannot be the same file.') {
      setAnswerFileError(null)
    }
    if (answerFile) setSubmissionError(null)
  }

  const handleAnswerClear = () => {
    removeAnswerFile()
    setSubmissionError(null)
    if (questionFileError === 'Question Paper and Answer Sheet cannot be the same file.') {
      setQuestionFileError(null)
    }
    if (questionFile) setSubmissionError(null)
  }

  const hasValidFiles =
    Boolean(questionFile && answerFile && !questionFileError && !answerFileError && !submissionError)

  const handleStartMapping = async () => {
    setSubmissionError(null)
    setExtractionError(null)

    const qResult = questionFile ? validateSingleFile(questionFile) : { valid: false as const, code: 'MISSING' as const, error: 'Please select a Question Paper.' }
    const aResult = answerFile ? validateSingleFile(answerFile) : { valid: false as const, code: 'MISSING' as const, error: 'Please select an Answer Sheet.' }

    if (!qResult.valid) setQuestionFileError(qResult.error)
    if (!aResult.valid) setAnswerFileError(aResult.error)
    if (!qResult.valid || !aResult.valid) return

    if (questionFile && answerFile && isDuplicateFileHeuristic(questionFile, answerFile)) {
      setAnswerFileError('Question Paper and Answer Sheet cannot be the same file.')
      return
    }

    const totalResult = validateTotalFileSize(questionFile, answerFile)
    if (!totalResult.valid) {
      setSubmissionError(totalResult.error)
      return
    }

    console.log('[veda] stage→validating')
    setIsExtracting(true)
    setExtractionStage('validating')
    setExtractionError(null)

    const endpoint = PROCESSOR_URL ? `${PROCESSOR_URL}/extract` : '/api/upload'
    console.log('[veda] fetch start', endpoint)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.log('[veda] fetch abort timeout 130s')
      controller.abort()
    }, 130_000)

    try {
      console.log('[veda] stage→uploading')
      setExtractionStage('uploading')
      const formData = new FormData()
      formData.append('questionFile', questionFile!)
      formData.append('answerFile', answerFile!)

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      console.log('[veda] fetch resolved', response.status, response.ok)

      if (PROCESSOR_URL) {
        console.log('[veda] stage→extracting_questions')
        setExtractionStage('extracting_questions')
      }

      const data = (await response.json().catch(() => null)) as unknown
      console.log('[veda] json parsed', !!data)

      if (!data || typeof data !== 'object') {
        throw new Error('Upload validation service returned an invalid response.')
      }

      const typedData = data as { success?: boolean; error?: unknown; code?: string }

      if (!response.ok || typedData.success !== true) {
        const msg = typeof typedData.error === 'string' ? typedData.error : 'Unable to validate uploaded files.'
        if (typedData.code === 'TOTAL_TOO_LARGE') {
          setSubmissionError(msg)
        }
        throw new Error(msg)
      }

      if (PROCESSOR_URL && (typedData as unknown as { data?: unknown }).data) {
        console.log('[veda] stage→validating_output')
        setExtractionStage('validating_output')
        const result = typedData as unknown as ExtractionResult
        console.log('[veda] stage→done', result.data.questions.length, result.data.answers.length)
        setExtractionResult(result)
        setExtractionStage('done')
      } else {
        console.log('[veda] fallback success')
      }
    } catch (err) {
      clearTimeout(timeoutId)
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      console.log('[veda] fetch rejected', isAbort ? 'AbortError' : (err as Error).message)
      setIsExtracting(false)
      setExtractionStage('error')
      const message = isAbort
        ? 'Processing timed out. Please try again.'
        : err instanceof Error
          ? err.message
          : 'Upload failed. Please try again.'
      if (PROCESSOR_URL) setExtractionError(message)
      setSubmissionError(message)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  return (
    <AppShell>
      {extractionStage !== 'idle' ? (
        extractionStage === 'done' && extractionResult ? (
          <ExamReview />
        ) : (
          <div className="h-full flex flex-col justify-center items-center">
            <ExtractingView stage={extractionStage} error={extractionError ?? submissionError} />
            {extractionStage === 'error' && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <button
                  onClick={() => {
                    setExtractionStage('idle')
                    setExtractionError(null)
                    setSubmissionError(null)
                    setIsExtracting(false)
                  }}
                  className="rounded-full bg-foreground px-5 py-2 text-xs font-semibold text-background hover:opacity-90 transition-opacity"
                >
                  Try Again
                </button>
                <p className="text-[11px] text-muted-foreground">Files are preserved for retry</p>
              </div>
            )}
          </div>
        )
      ) : (
        /* PAGE 1: EXAMS UPLOAD SCREEN (Exact Figma Specifications) */
        <div className="h-full flex flex-col items-center justify-center px-4 py-2 my-auto">
          <div className="flex flex-col items-center text-center">

            {/* 1. HEADING BLOCK (w: 755px, h: 56px, gap: 12px) */}
            <div className="w-[755px] max-w-full h-[56px] flex items-center justify-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Upload</span>
                <span className="rounded-xl bg-orange-soft px-3 py-1 text-orange inline-block">
                  Question Paper &amp; Answer Sheets
                </span>
              </h1>
            </div>

            {/* 2. SUBTEXT (w: 269px, h: 28px, gap: 2px) */}
            <div className="w-[269px] max-w-full h-[28px] mt-1 flex items-center justify-center">
              <p className="text-sm font-medium text-muted-foreground">
                Upload both files to get started
              </p>
            </div>

            {/* 3. TUTOR ILLUSTRATION (w: 137.03px, h: 138.03px, padding: 13.2px 12px) */}
            <div className="relative w-[137.03px] h-[138.03px] my-4 flex items-center justify-center">
              {/* Soft Peach Circular Glow Ring */}
              <div className="absolute inset-0 rounded-full bg-orange-soft/70 border border-orange/20 shadow-xs" />

              {/* Tutor Illustration Image */}
              <div className="relative z-10 p-[12px]">
                <Image
                  src="/assets/exams/tutor-illustration.png"
                  alt="Tutor illustration"
                  width={113}
                  height={113}
                  className="object-contain"
                />
              </div>

              {/* 4 Corner Icon Badges */}
              <div className="absolute -top-1 -left-1 z-20 grid size-6 place-items-center rounded-full bg-background border border-orange/30 shadow-xs">
                <Clock className="size-3 text-orange" />
              </div>
              <div className="absolute -top-1 -right-1 z-20 grid size-6 place-items-center rounded-full bg-background border border-orange/30 shadow-xs">
                <MessageSquare className="size-3 text-orange" />
              </div>
              <div className="absolute -bottom-1 -left-1 z-20 grid size-6 place-items-center rounded-full bg-background border border-orange/30 shadow-xs">
                <Settings className="size-3 text-orange" />
              </div>
              <div className="absolute -bottom-1 -right-1 z-20 grid size-6 place-items-center rounded-full bg-background border border-orange/30 shadow-xs">
                <Cloud className="size-3 text-orange" />
              </div>
            </div>

            {submissionError && (
              <div className="mb-3 w-[789px] max-w-full rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                {submissionError}
              </div>
            )}

            {/* 4. UPLOAD CARDS CONTAINER (w: 789px, h: 205px, gap: 16px) */}
            <div className="w-[789px] max-w-full h-[205px] flex items-center justify-between gap-[16px]">
              <UploadCard
                type="Question Paper"
                file={questionFile}
                error={questionFileError}
                onChange={handleQuestionSelect}
                onClear={handleQuestionClear}
              />

              <UploadCard
                type="Answer Sheet"
                file={answerFile}
                error={answerFileError}
                onChange={handleAnswerSelect}
                onClear={handleAnswerClear}
              />
            </div>

            {/* 5. START MAPPING BUTTON (w: 161px, h: 44px, border-radius: 64px, gap: 8px) */}
            <button
              disabled={!hasValidFiles}
              onClick={handleStartMapping}
              style={{ borderRadius: '64px' }}
              className={`w-[161px] h-[44px] mt-6 flex items-center justify-center gap-2 border-2 px-5 py-3 text-xs font-bold transition-all shadow-xs ${hasValidFiles
                ? 'bg-foreground text-background border-foreground hover:opacity-90 cursor-pointer'
                : 'bg-muted text-muted-foreground/70 border-muted-foreground/30 cursor-not-allowed'
                }`}
            >
              <span>Start Mapping</span>
              <ArrowRight className="size-3.5" />
            </button>

            {/* 6. HELPER TEXT (w: 410px, h: 22px) */}
            <div className="w-[410px] max-w-full h-[22px] mt-2 flex items-center justify-center">
              <p className="text-xs font-normal text-muted-foreground">
                Once both files are uploaded, you&apos;ll be able to map answers with questions
              </p>
            </div>

          </div>
        </div>
      )}
    </AppShell>
  )
}
