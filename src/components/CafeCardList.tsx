import type { CafeWithNote } from '@/types/cafe'
import { CafeCard } from '@/components/CafeCard'

interface CafeCardListProps {
  items: CafeWithNote[]
  onSelect?: (item: CafeWithNote) => void
}

/** 지도 아래 카페 목록 카드 영역. PRD §6.1. */
export function CafeCardList({ items, onSelect }: CafeCardListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">표시할 카페가 없습니다.</p>
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">카페 목록</h2>
        <span className="text-xs text-muted-foreground">{items.length}곳</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <CafeCard
            key={`${item.cafe.name}-${item.cafe.address}`}
            item={item}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  )
}
