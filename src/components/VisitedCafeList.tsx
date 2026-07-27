import { useMemo, useState, type KeyboardEvent } from 'react'
import { Check, MapPin } from 'lucide-react'
import type { CafeNote } from '@/types/cafe'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  VISITED_SORT_LABELS,
  sortVisitedNotes,
  type VisitedSortKey,
} from '@/lib/sortVisited'

interface VisitedCafeListProps {
  /** 방문 체크한 내 기록. 이미 `visited=true` 로 걸러진 것만 들어온다. */
  notes: CafeNote[]
  loading?: boolean
  error?: string | null
  isAuthenticated?: boolean
  /** 세션 복원 중. 확정 전에 "로그인하세요" 를 띄우면 깜빡인다. */
  authLoading?: boolean
  /** 항목 클릭 → 지도 중심 이동. 좌표가 없는 기록은 호출되지 않는다. */
  onSelect?: (note: CafeNote) => void
  onLoginClick?: () => void
}

/**
 * 방문한 카페 목록. PRD F-5.
 *
 * **엑셀 업로드와 무관하게** 동작해야 한다 — 로그인만 되어 있으면 보인다.
 * 그래서 `visit_notes` 에 좌표를 함께 저장한다. 좌표가 있어야 엑셀 없이도 지도로 이동할 수 있다.
 */
export function VisitedCafeList({
  notes,
  loading = false,
  error = null,
  isAuthenticated = false,
  authLoading = false,
  onSelect,
  onLoginClick,
}: VisitedCafeListProps) {
  /**
   * 정렬 기준. 기본은 최신순. (PRD F-5.11)
   *
   * 이 state 를 App 이 아니라 여기에 두는 이유: 소감을 저장하면 App 이 방문 목록을
   * 다시 조회해 `notes` 를 새 배열로 갈아끼우는데, 그때 정렬 선택까지 초기화되면 안 된다.
   * 컴포넌트는 언마운트되지 않으므로 선택이 그대로 유지된다.
   * 새로고침하면 컴포넌트가 다시 만들어져 최신순으로 돌아간다 — 의도된 동작이다.
   */
  const [sortKey, setSortKey] = useState<VisitedSortKey>('recent')

  const sortedNotes = useMemo(() => sortVisitedNotes(notes, sortKey), [notes, sortKey])
  const showSort = isAuthenticated && !authLoading && !loading && !error && notes.length > 0

  return (
    <section aria-labelledby="visited-heading" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="visited-heading" className="text-sm font-semibold">
          방문한 카페
        </h2>
        {isAuthenticated && !loading && (
          <span className="text-xs text-muted-foreground">{notes.length}곳</span>
        )}
      </div>

      {showSort && (
        <div className="flex items-center gap-1" role="group" aria-label="정렬 기준">
          {(Object.keys(VISITED_SORT_LABELS) as VisitedSortKey[]).map((key) => (
            <SortButton
              key={key}
              active={sortKey === key}
              label={VISITED_SORT_LABELS[key]}
              onClick={() => setSortKey(key)}
            />
          ))}
        </div>
      )}

      {authLoading ? (
        <div className="h-20 animate-pulse rounded-lg border bg-muted/40" aria-hidden />
      ) : !isAuthenticated ? (
        <div className="space-y-2 rounded-lg border border-dashed p-4">
          <p className="text-xs text-muted-foreground">
            로그인하면 방문한 카페를 모아볼 수 있어요.
          </p>
          <Button size="sm" onClick={onLoginClick}>
            로그인 / 회원가입
          </Button>
        </div>
      ) : error ? (
        <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">{error}</p>
      ) : loading ? (
        <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
          불러오는 중…
        </p>
      ) : notes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
          아직 방문 체크한 카페가 없습니다. 마커를 눌러 &ldquo;방문했어요&rdquo;를 체크해 보세요.
        </p>
      ) : (
        <ul className="space-y-2">
          {sortedNotes.map((note) => (
            <li key={note.id}>
              <VisitedCafeItem note={note} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * 정렬 전환 버튼. 선택 상태를 색뿐 아니라 `aria-pressed` 로도 알린다.
 * Button 이 <button> 이라 키보드 조작은 기본으로 된다. (PRD §9 접근성)
 */
function SortButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'secondary' : 'ghost'}
      aria-pressed={active}
      onClick={onClick}
      className={cn('h-7 px-2 text-xs', active && 'font-semibold')}
    >
      {label}
    </Button>
  )
}

function VisitedCafeItem({
  note,
  onSelect,
}: {
  note: CafeNote
  onSelect?: (note: CafeNote) => void
}) {
  // 좌표 없이 저장된 기록은 지도로 보낼 곳이 없다. 눌러도 아무 일 없는 버튼은 만들지 않는다.
  const canFocus = note.lat !== null && note.lng !== null
  const select = () => {
    if (canFocus) onSelect?.(note)
  }

  return (
    <Card
      {...(canFocus
        ? {
            role: 'button' as const,
            tabIndex: 0,
            onClick: select,
            onKeyDown: (event: KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                select()
              }
            },
          }
        : {})}
      className={
        canFocus
          ? 'cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          : ''
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm">{note.cafeName}</CardTitle>
          {/* 색만으로 구분하지 않는다 — 아이콘 병행 (PRD §9 접근성) */}
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-label="방문함" />
        </div>
        <p className="flex items-start gap-1 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          {note.cafeAddress}
        </p>
      </CardHeader>

      <CardContent className="space-y-1">
        {note.note ? (
          <p className="text-xs leading-relaxed text-foreground/80">{note.note}</p>
        ) : (
          <p className="text-xs text-muted-foreground">소감 없이 방문만 체크했습니다.</p>
        )}
        {!canFocus && (
          <p className="text-xs text-muted-foreground">좌표가 없어 지도로 이동할 수 없습니다.</p>
        )}
      </CardContent>
    </Card>
  )
}
