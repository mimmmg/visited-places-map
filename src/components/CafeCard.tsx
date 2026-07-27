import { Check, MapPin } from 'lucide-react'
import type { CafeWithNote } from '@/types/cafe'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { normalizeCategory } from '@/lib/normalize'

interface CafeCardProps {
  item: CafeWithNote
  onSelect?: (item: CafeWithNote) => void
}

/** 카페 목록 카드 한 장. 방문 여부 + 소감 미리보기. */
export function CafeCard({ item, onSelect }: CafeCardProps) {
  const { cafe, note } = item
  const visited = note?.visited ?? false

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect?.(item)
        }
      }}
      className="cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm">{cafe.name}</CardTitle>
          {/* 방문 여부를 색만으로 구분하지 않는다 — 아이콘 병행 (PRD §9 접근성) */}
          {visited ? (
            <Badge variant="default" className="shrink-0 gap-1">
              <Check className="h-3 w-3" aria-hidden />
              방문
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0">
              미방문
            </Badge>
          )}
        </div>
        <p className="flex items-start gap-1 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          {cafe.address}
        </p>
      </CardHeader>

      <CardContent className="space-y-2">
        <Badge variant="secondary">{normalizeCategory(cafe.category)}</Badge>

        {note?.note ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-foreground/80">{note.note}</p>
        ) : (
          <p className="text-xs text-muted-foreground">아직 소감이 없습니다.</p>
        )}
      </CardContent>
    </Card>
  )
}
