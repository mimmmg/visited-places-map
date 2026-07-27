import { AlertTriangle } from 'lucide-react'
import type { GeocodeFailure, GeocodeFailureReason } from '@/types/cafe'

/** 실패 사유 → 화면 안내 문구. PRD §5.2. */
const FAILURE_MESSAGE: Record<GeocodeFailureReason, string> = {
  NOT_FOUND: '주소를 찾지 못했습니다. 도로명 주소로 다시 입력해 보세요.',
  INVALID_FORMAT: '주소 형식을 인식할 수 없습니다.',
  NETWORK_ERROR: '일시적인 오류입니다. 다시 시도해 주세요.',
  RATE_LIMITED: '요청이 많아 잠시 후 다시 시도해 주세요.',
}

interface GeocodeFailureListProps {
  failures: GeocodeFailure[]
}

/** 좌표 변환 실패 주소 안내. PRD F-2.7. 인라인 수정/재시도는 아직 자리만 잡아 둔다. */
export function GeocodeFailureList({ failures }: GeocodeFailureListProps) {
  if (failures.length === 0) return null

  return (
    <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
        주소를 찾지 못한 카페 {failures.length}건
      </h2>

      <ul className="mt-3 space-y-2">
        {failures.map((failure) => (
          <li key={failure.row.rowNumber} className="text-xs">
            <span className="text-muted-foreground">{failure.row.rowNumber}행</span>{' '}
            <span className="font-medium">{failure.row.name}</span>{' '}
            <span className="text-muted-foreground">/ {failure.row.address}</span>
            <p className="text-muted-foreground">{FAILURE_MESSAGE[failure.reason]}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
