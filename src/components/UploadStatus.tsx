import { AlertTriangle, Loader2 } from 'lucide-react'
import type { ParseCafeExcelResult } from '@/lib/cafeExcel'
import type { UploadProgress } from '@/hooks/useCafeUpload'
import { Button } from '@/components/ui/button'

interface UploadStatusProps {
  summary: ParseCafeExcelResult | null
  progress: UploadProgress | null
  error: string | null
  geocodedCount: number
  failureCount: number
  isRunning: boolean
  onCancel: () => void
}

/** 업로드 요약 + 변환 진행률. PRD F-1.6, F-2.3, F-2.15. */
export function UploadStatus({
  summary,
  progress,
  error,
  geocodedCount,
  failureCount,
  isRunning,
  onCancel,
}: UploadStatusProps) {
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
        <p>{error}</p>
      </div>
    )
  }

  if (!summary) return null

  const notes: string[] = []
  if (summary.skippedRowNumbers.length > 0) {
    notes.push(
      `제외 ${summary.skippedRowNumbers.length}건 (${summary.skippedRowNumbers.join(', ')}행 — 이름 또는 주소 누락)`,
    )
  }
  if (summary.mergedDuplicateCount > 0) {
    notes.push(`중복 합침 ${summary.mergedDuplicateCount}건`)
  }
  if (summary.droppedByLimitCount > 0) {
    notes.push(`500행 초과로 미처리 ${summary.droppedByLimitCount}건`)
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          총 <strong>{summary.totalRowCount}</strong>건 · 유효{' '}
          <strong>{summary.rows.length}</strong>건
        </span>
        <span className="text-muted-foreground">
          좌표 변환 {geocodedCount}건 성공
          {failureCount > 0 && ` · ${failureCount}건 실패`}
        </span>

        {isRunning && progress && (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {progress.done} / {progress.total} 변환 중
            <Button variant="ghost" size="sm" onClick={onCancel}>
              중단
            </Button>
          </span>
        )}
      </div>

      {notes.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {notes.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
