'use client'

import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  CircleHelp,
  FileText,
  LayoutGrid,
  Menu,
  Settings,
  Sparkles,
  Upload,
  UserRound,
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

const PROCESSOR_URL = process.env.NEXT_PUBLIC_PROCESSOR_URL?.replace(/\/$/, '')

const teacherImage =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-xomLiIQBNNjO2SCf4uwnzwVufACQxv.png'

function Brand() {
  return (
    <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
      <span className="grid size-6 place-items-center rounded-md bg-foreground text-background">
        <Check className="size-4" strokeWidth={3} />
      </span>
      VedaAI
    </div>
  )
}

function Sidebar() {
  const items = [
    { label: 'Home', icon: LayoutGrid },
    { label: 'My Classroom', icon: BookOpen },
    { label: 'Assignments', icon: FileText },
    { label: 'Exams', icon: FileText, active: true },
    { label: 'My Library', icon: BookOpen },
  ]

  return (
    <aside className="fixed inset-y-3 left-3 z-10 hidden w-[304px] flex-col items-stretch justify-between rounded-[16px] bg-background p-6 lg:flex">
      <div className="flex h-[418px] w-[251px] flex-col gap-14">
        <div className="flex items-center justify-between">
          <Brand />
          <span className="text-xs text-muted-foreground">▣</span>
        </div>

        <button className="flex items-center justify-center gap-2 rounded-full border border-orange bg-foreground px-3 py-2 text-xs font-semibold text-background">
          <Sparkles className="size-3.5" />
          AI Teacher&apos;s Toolkit
        </button>

        <nav className="flex flex-col gap-1">
          {items.map(({ label, icon: Icon, active }) => (
            <button
              key={label}
              className={`flex items-center gap-2 rounded-md px-2 py-2 text-left text-xs ${
                active ? 'bg-muted font-semibold text-foreground' : 'text-muted-foreground'
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex h-[130px] w-[256px] flex-col gap-2">
        <button className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <Settings className="size-3.5" />
          Settings
        </button>

        <div className="rounded-xl bg-muted p-3">
          <div className="text-xs font-semibold">Delhi Public School</div>
          <div className="text-[10px] text-muted-foreground">Bokaro Steel City</div>
        </div>
      </div>
    </aside>
  )
}

function Topbar() {
  return (
    <header className="hidden h-14 w-full items-center justify-between gap-2 rounded-2xl bg-background pl-6 pr-2 shadow-sm lg:flex">
      <div className="flex items-center gap-3">
        <ArrowLeft className="size-4 text-muted-foreground" />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="size-3.5" />
          Exams
        </div>
      </div>

      <div className="flex items-center gap-4">
        <CircleHelp className="size-4" />
        <div className="relative">
          <Bell className="size-4" />
          <span className="absolute -right-1 -top-1 size-1.5 rounded-full bg-orange" />
        </div>
        <Sparkles className="size-4" />
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="grid size-6 place-items-center rounded-full bg-muted">
            <UserRound className="size-4" />
          </span>
          Madhur Rastogi
          <span className="text-muted-foreground">⌄</span>
        </div>
      </div>
    </header>
  )
}

function MobileHeader() {
  return (
    <header className="flex h-14 items-center justify-between rounded-2xl border border-border bg-background px-4 lg:hidden">
      <div className="flex items-center gap-3">
        <ArrowLeft className="size-5" />
        <Brand />
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Bell className="size-5" />
          <span className="absolute -right-1 -top-1 size-2 rounded-full bg-orange" />
        </div>
        <span className="grid size-7 place-items-center rounded-full bg-muted">
          <UserRound className="size-5" />
        </span>
        <Menu className="size-5" />
      </div>
    </header>
  )
}

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
    <div className="flex flex-1 flex-col">
      <label
        className={`group relative flex min-h-40 cursor-pointer flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed bg-background px-4 py-6 transition ${
          error
            ? 'border-destructive/60'
            : isDragOver
              ? 'border-orange bg-orange-soft/40'
              : 'border-foreground/25 hover:border-orange'
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
            // reset input to allow re-selecting same file
            event.target.value = ''
            if (selected) onChange(selected)
          }}
        />

        {file ? (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                onClear()
              }}
              className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
              aria-label={`Remove ${type}`}
            >
              <X className="size-3.5" />
            </button>

            <Check className="mb-2 size-6 rounded-md bg-orange p-1 text-background" strokeWidth={3} />

            <span className="max-w-full truncate text-center text-xs font-semibold">{file.name}</span>

            <span className="mt-1 text-[10px] text-muted-foreground">Ready to map</span>
          </>
        ) : (
          <>
            <Upload className="mb-2 size-6 rounded-md bg-muted p-1.5 text-foreground" />
            <span className="text-sm font-semibold">
              Upload <span className="text-orange">{type}</span>
            </span>
            <span className="mt-1 text-center text-[10px] text-muted-foreground">
              Max 20 MiB per file • 35 MiB combined
            </span>
          </>
        )}
      </label>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  )
}

function ExtractingView({ stage, error }: { stage: string; error?: string | null }) {
  const stageText: Record<string, string> = {
    validating: 'Validating documents...',
    uploading: 'Uploading securely...',
    waiting_for_files: 'Preparing documents...',
    extracting_questions: 'Extracting questions...',
    extracting_answers: 'Extracting answers...',
    validating_output: 'Validating extraction...',
    done: 'Extraction complete',
    error: 'Extraction failed',
  }
  const display = stageText[stage] ?? 'Extracting...'
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-8 sm:px-4 lg:py-9">
      <div className="flex w-full max-w-3xl flex-col items-center text-center">
        <div className="flex items-center gap-2 rounded-full bg-orange-soft px-3 py-1.5 text-xs font-semibold text-orange">
          <Sparkles className="size-3.5 animate-pulse" />
          {display}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {stage === 'error' ? (error ?? 'Something went wrong.') : 'This may take a while'}
        </p>
        {stage === 'error' ? null : (
          <div className="mt-6 flex items-center gap-2">
            <span className="size-2 animate-bounce rounded-full bg-orange [animation-delay:-0.3s]" />
            <span className="size-2 animate-bounce rounded-full bg-orange [animation-delay:-0.15s]" />
            <span className="size-2 animate-bounce rounded-full bg-orange" />
          </div>
        )}
        {stage === 'done' && <p className="mt-4 text-xs text-muted-foreground">Ready for mapping • Sprint 4</p>}
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
    // duplicate heuristic
    if (answerFile && isDuplicateFileHeuristic(file, answerFile)) {
      setQuestionFile(file)
      setQuestionFileError('Question Paper and Answer Sheet cannot be the same file.')
      return
    }
    // total size check
    if (answerFile && file.size + answerFile.size > MAX_TOTAL_UPLOAD_SIZE) {
      setQuestionFile(file)
      setQuestionFileError(null)
      setSubmissionError('The two files together exceed the 35 MiB combined upload limit.')
      return
    }
    setQuestionFile(file)
    setQuestionFileError(null)
    // if answer had duplicate error, clear when fixing
    if (answerFileError === 'Question Paper and Answer Sheet cannot be the same file.') {
      setAnswerFileError(null)
    }
    // clear combined error if now valid
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
    // clearing may resolve combined error
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
    // re-validate immediately
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

    // synchronous extracting switch before network — must be before any await
    console.log('[veda] stage→validating')
    setIsExtracting(true)
    setExtractionStage('validating')
    setExtractionError(null)

    // If processor URL is configured, heavy path goes directly to Render
    // Otherwise fallback to local /api/upload validation (Sprint 2 dev mode)
    const endpoint = PROCESSOR_URL ? `${PROCESSOR_URL}/extract` : '/api/upload'
    console.log('[veda] fetch start', endpoint)

    // Client-side timeout slightly longer than server PROCESSING_TIMEOUT_MS=120s
    // Without this, a hung request (CORS, DNS, wrong port, network drop) leaves UI stuck on "Uploading securely..." forever
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

      // Processor stages are server-side; show extracting while awaiting JSON
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
        // Map combined-size / duplicate to correct UI field if processor returns those codes
        if (typedData.code === 'TOTAL_TOO_LARGE') {
          setSubmissionError(msg)
        }
        throw new Error(msg)
      }

      // Sprint 3 processor returns ExtractionResult; local /api/upload returns {files}
      // For processor, store the full result; for fallback, keep extracting as handoff
      if (PROCESSOR_URL && (typedData as unknown as { data?: unknown }).data) {
        console.log('[veda] stage→validating_output')
        setExtractionStage('validating_output')
        const result = typedData as unknown as ExtractionResult
        console.log('[veda] stage→done', result.data.questions.length, result.data.answers.length)
        setExtractionResult(result)
        setExtractionStage('done')
        // Keep isExtracting derived false via stage, but keep files
      } else {
        // Fallback local validation success — keep isExtracting=true as Sprint 2 handoff
        // Sprint 3 will hand these files to the Render processing service for Gemini extraction.
        console.log('[veda] fallback success, keeping extracting')
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
      // If processor was used, also set extractionError for stage view
      if (PROCESSOR_URL) setExtractionError(message)
      setSubmissionError(message)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  if (extractionStage !== 'idle') {
    const isError = extractionStage === 'error'
    const isDone = extractionStage === 'done'
    return (
      <main className="min-h-screen overflow-hidden bg-page p-3 text-foreground sm:p-5">
        <div className="flex min-h-[calc(100vh-24px)] gap-4">
          <Sidebar />
          <section className="flex min-w-0 flex-1 flex-col lg:ml-[316px]">
            <Topbar />
            <MobileHeader />
            {isDone && extractionResult ? (
              <div className="flex h-full w-full flex-col p-2">
                <ExamReview />
              </div>
            ) : (
              <>
                <ExtractingView stage={extractionStage} error={extractionError ?? submissionError} />
                {isError && (
                  <div className="mx-auto mt-4 flex flex-col items-center gap-3">
                    <button
                      onClick={() => {
                        setExtractionStage('idle')
                        setExtractionError(null)
                        setSubmissionError(null)
                        setIsExtracting(false)
                      }}
                      className="rounded-full bg-foreground px-5 py-2 text-xs font-semibold text-background hover:opacity-90"
                    >
                      Try Again
                    </button>
                    <p className="text-[11px] text-muted-foreground">Files are preserved for retry</p>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    )
  }

  // Fallback for legacy isExtracting (Sprint 2)
  if (isExtracting) {
    return (
      <main className="min-h-screen overflow-hidden bg-page p-3 text-foreground sm:p-5">
        <div className="flex min-h-[calc(100vh-24px)] gap-4">
          <Sidebar />
          <section className="flex min-w-0 flex-1 flex-col lg:ml-[316px]">
            <Topbar />
            <MobileHeader />
            <ExtractingView stage={extractionStage} error={extractionError} />
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-hidden bg-page p-3 text-foreground sm:p-5">
      <div className="flex min-h-[calc(100vh-24px)] gap-4">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col lg:ml-[316px]">
          <Topbar />
          <MobileHeader />

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-8 sm:px-4 lg:py-9">
            <div className="flex w-full max-w-3xl flex-col items-center text-center">
              <h1 className="text-balance text-xl font-bold tracking-tight sm:whitespace-nowrap sm:text-3xl">
                Upload{' '}
                <span className="rounded-md bg-orange-soft px-1 text-orange">
                  Question Paper &amp; Answer Sheets
                </span>
              </h1>

              <p className="mt-2 text-xs text-muted-foreground">Upload both files to get started</p>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={teacherImage}
                alt="AI teacher illustration"
                className="mx-auto my-5 size-20 object-contain sm:size-24"
              />

              {submissionError && (
                <div className="mb-4 w-full max-w-3xl rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {submissionError}
                </div>
              )}

              <div className="mx-auto w-full rounded-[24px] border border-border bg-background p-3 shadow-[0_12px_30px_rgba(15,15,15,0.10)] sm:p-3 xl:h-[205px] xl:w-[789px]">
                <div className="grid h-full grid-cols-1 gap-2 sm:grid-cols-2">
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
              </div>

              <button
                disabled={!hasValidFiles}
                onClick={handleStartMapping}
                className="mx-auto mt-7 flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-xs font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted-foreground/40 disabled:text-background/70"
              >
                Start Mapping
                <ArrowRight className="size-4" />
              </button>

              <p className="mt-5 text-[10px] text-muted-foreground sm:text-xs">
                Once both files are uploaded, you&apos;ll be able to map answers with questions
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
