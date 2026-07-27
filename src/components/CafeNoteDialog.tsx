import { useEffect, useState } from 'react'
import { Lock, MapPin } from 'lucide-react'
import type { Cafe, CafeNote, SaveCafeNoteInput } from '@/types/cafe'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MAX_NOTE_LENGTH } from '@/lib/constants'
import { normalizeCategory } from '@/lib/normalize'

// 데이터 계층도 같은 상한을 참조해야 해서 `@/lib/constants` 로 옮겼다.
export { MAX_NOTE_LENGTH }

interface CafeNoteDialogProps {
  /** 선택된 카페. null 이면 팝업이 닫힌 상태. */
  cafe: Cafe | null
  /** 이 카페에 이미 남긴 기록. 있으면 그대로 채워 보여준다. (PRD F-4.6) */
  existingNote: CafeNote | null
  onOpenChange: (open: boolean) => void
  onSave: (input: SaveCafeNoteInput) => Promise<void> | void
  saving?: boolean
  /** 저장 실패 메시지. 표시해도 입력 내용은 잃지 않는다. (PRD F-3.7) */
  error?: string | null
  /** 로그인 여부. 비로그인이면 입력을 잠근다. (PRD F-3.6, §6.0) */
  isAuthenticated?: boolean
  /** 세션 복원 중. 확정 전에는 잠금 안내를 띄우지 않는다. */
  authLoading?: boolean
  /** 잠금 안내의 로그인 버튼. 모달로 띄워 목록을 유지한다. (PRD R-8) */
  onLoginClick?: () => void
}

/**
 * 마커 클릭 시 뜨는 방문 기록 팝업. PRD F-3.1 ~ F-3.4.
 *
 * shadcn/ui Dialog 사용. 저장은 아직 메모리에만 반영되고 서버에 남지 않는다.
 */
export function CafeNoteDialog({
  cafe,
  existingNote,
  onOpenChange,
  onSave,
  saving = false,
  error = null,
  isAuthenticated = false,
  authLoading = false,
  onLoginClick,
}: CafeNoteDialogProps) {
  const [visited, setVisited] = useState(false)
  const [note, setNote] = useState('')

  // 카페가 바뀌면 그 카페의 기존 기록으로 폼을 다시 채운다.
  // 기록이 없으면 빈 상태로 시작한다.
  useEffect(() => {
    if (!cafe) return
    setVisited(existingNote?.visited ?? false)
    setNote(existingNote?.note ?? '')
  }, [cafe, existingNote])

  const remaining = MAX_NOTE_LENGTH - note.length
  /** 세션 확정 전에는 잠그지도, 열지도 않는다 — 깜빡임을 만들지 않기 위해 잠금 취급만 한다. */
  const locked = !isAuthenticated

  const handleSave = async () => {
    if (!cafe || locked) return
    await onSave({
      cafeName: cafe.name,
      cafeAddress: cafe.address,
      category: cafe.category ?? null,
      visited,
      note: note.trim() === '' ? null : note.trim(),
      lat: cafe.lat,
      lng: cafe.lng,
    })
  }

  return (
    <Dialog open={cafe !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {cafe && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6">{cafe.name}</DialogTitle>
              <DialogDescription className="flex items-start gap-1">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {cafe.address}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                카테고리: {normalizeCategory(cafe.category)}
              </p>

              {/* 비로그인: 카페 정보는 그대로 보이고 입력만 잠긴다. (PRD F-3.6, §6.0) */}
              {locked && !authLoading && (
                <div className="flex items-start gap-2 rounded-md border bg-muted/50 p-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      방문 기록과 소감은 로그인 후 저장할 수 있습니다. 로그인해도 업로드한 목록은
                      그대로 유지됩니다.
                    </p>
                    <Button size="sm" onClick={onLoginClick}>
                      로그인 / 회원가입
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Checkbox
                  id="visited"
                  checked={visited}
                  disabled={locked}
                  onCheckedChange={(checked) => setVisited(checked === true)}
                />
                <Label
                  htmlFor="visited"
                  className={locked ? 'text-muted-foreground' : 'cursor-pointer'}
                >
                  방문했어요
                </Label>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="note">한줄 소감</Label>
                <Textarea
                  id="note"
                  value={note}
                  maxLength={MAX_NOTE_LENGTH}
                  disabled={locked}
                  placeholder={locked ? '로그인 후 입력할 수 있습니다' : '예: 라떼가 고소했다'}
                  onChange={(event) => setNote(event.target.value.slice(0, MAX_NOTE_LENGTH))}
                />
                <p className="text-right text-xs text-muted-foreground">
                  {note.length} / {MAX_NOTE_LENGTH}
                  {remaining === 0 && ' (최대 길이)'}
                </p>
              </div>

              {existingNote && (
                <p className="text-xs text-muted-foreground">
                  {formatSavedAt(existingNote.updatedAt)} 저장됨
                </p>
              )}

              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                닫기
              </Button>
              {/* 비로그인이면 저장 버튼 자리에 안내만 남긴다. 위 잠금 박스에 로그인 버튼이 있다. */}
              {authLoading ? (
                <Button disabled>확인 중…</Button>
              ) : locked ? (
                <p className="self-center text-xs text-muted-foreground">
                  로그인해야 저장할 수 있습니다.
                </p>
              ) : (
                <Button onClick={() => void handleSave()} disabled={saving}>
                  {saving ? '저장 중…' : '저장'}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function formatSavedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}
