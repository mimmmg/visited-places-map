import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import type { Cafe, CafeNote, CafeWithNote, SaveCafeNoteInput } from '@/types/cafe'
import { AppHeader } from '@/components/AppHeader'
import { AuthDialog } from '@/components/AuthDialog'
import { CafeCardList } from '@/components/CafeCardList'
import { CafeMap } from '@/components/CafeMap'
import { CafeNoteDialog } from '@/components/CafeNoteDialog'
import { GeocodeFailureList } from '@/components/GeocodeFailureList'
import { UploadStatus } from '@/components/UploadStatus'
import { VisitedCafeList } from '@/components/VisitedCafeList'
import { useAuth } from '@/hooks/useAuth'
import { useCafeUpload } from '@/hooks/useCafeUpload'
import { fetchMyCafeNotes, fetchMyVisitedCafeNotes, saveCafeNote } from '@/data/cafeNotes'
import { toCafeKey, toCafeNoteKey } from '@/lib/normalize'
import { AuthRequiredError } from '@/lib/supabase'
import { buildVisitedKeys } from '@/lib/visitedKeys'

/**
 * 홈 화면. PRD §6.1.
 *
 * 엑셀 업로드 → 순차 좌표 변환 → 마커 표시까지 동작한다.
 * 로그인/로그아웃은 Supabase Auth 로 실제 동작하고,
 * 소감 저장은 아직 가짜 데이터(메모리)에 남는다.
 */
export default function App() {
  const { cafes, failures, summary, progress, error, fitBoundsKey, isRunning, upload, cancel } =
    useCafeUpload()
  const { user, loading: authLoading, signOut } = useAuth()
  const userId = user?.id ?? null
  const [notes, setNotes] = useState<CafeNote[]>([])
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  /** 기록 조회 실패 안내. 조회는 실패해도 지도·목록은 그대로 쓸 수 있어야 한다. */
  const [notesError, setNotesError] = useState<string | null>(null)

  // 방문 목록 (PRD F-5). 엑셀과 무관하게 로그인만 되어 있으면 조회한다.
  const [visitedNotes, setVisitedNotes] = useState<CafeNote[]>([])
  const [visitedLoading, setVisitedLoading] = useState(false)
  const [visitedError, setVisitedError] = useState<string | null>(null)
  /** 저장 후 방문 목록을 다시 불러오기 위한 신호. */
  const [visitedVersion, setVisitedVersion] = useState(0)
  /** 방문 목록에서 고른 좌표. nonce 로 "같은 카페 재클릭"도 이동 신호가 된다. */
  const [mapFocus, setMapFocus] = useState<{ lat: number; lng: number; nonce: number } | null>(null)
  /** 팝업에 띄운 카페. null 이면 닫힌 상태. */
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // 업로드된 카페 중 내 기록이 있는 것을 조회한다. (PRD F-4.5)
  // 변환이 끝난 뒤 한 번만 조회한다. `cafes` 는 변환 중 매 건마다 바뀌므로
  // isRunning 을 보지 않으면 카페 수만큼 질의가 나간다.
  //
  // 로그인/로그아웃도 재조회 조건이다 — 로그인하면 기존 기록이 마커에 반영되고,
  // 로그아웃하면 화면에 남아 있던 남의 기록이 즉시 사라져야 한다. (AC-4)
  useEffect(() => {
    let cancelled = false

    // 세션 확정 전에 조회하면 로그인 상태인데도 "기록 없음"이 된다.
    if (authLoading) return
    if (isRunning) return
    if (userId === null || cafes.length === 0) {
      setNotes([])
      return
    }

    void fetchMyCafeNotes(cafes)
      .then((myNotes) => {
        if (cancelled) return
        setNotes(myNotes)
        setNotesError(null)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setNotes([])
        // 세션이 풀린 경우는 에러가 아니라 안내로 다룬다.
        setNotesError(
          caught instanceof AuthRequiredError
            ? caught.message
            : '기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        )
      })

    return () => {
      cancelled = true
    }
  }, [cafes, isRunning, userId, authLoading])

  // 방문 목록 조회. 엑셀(`cafes`)에 의존하지 않는다 — 업로드 없이도 보여야 한다. (PRD F-5)
  useEffect(() => {
    let cancelled = false

    // 세션 확정 전에 조회하면 로그인 상태인데도 "기록 없음"이 된다.
    if (authLoading) return
    if (userId === null) {
      setVisitedNotes([])
      setVisitedError(null)
      return
    }

    setVisitedLoading(true)
    void fetchMyVisitedCafeNotes()
      .then((rows) => {
        if (cancelled) return
        setVisitedNotes(rows)
        setVisitedError(null)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setVisitedNotes([])
        setVisitedError(
          caught instanceof AuthRequiredError
            ? caught.message
            : '방문 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        )
      })
      .finally(() => {
        if (!cancelled) setVisitedLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId, authLoading, visitedVersion])

  /**
   * 지도에 그릴 카페. 엑셀 목록 + 방문 기록 중 엑셀에 없는 것.
   *
   * 방문 목록에서 항목을 눌러 이동했는데 그 자리에 마커가 없으면 빈 지도만 보인다.
   * `visit_notes` 에 좌표를 저장해 둔 이유가 이것이다. (PRD F-5)
   */
  const mapCafes = useMemo<Cafe[]>(() => {
    const seen = new Set(cafes.map((cafe) => toCafeKey(cafe.name, cafe.address)))
    const fromNotes = visitedNotes
      .filter((note) => note.lat !== null && note.lng !== null)
      .filter((note) => !seen.has(toCafeNoteKey(note)))
      .map<Cafe>((note) => ({
        // 엑셀 행이 아니므로 행 번호는 없다. 변환 실패 안내에만 쓰이는 값이라 0 으로 둔다.
        rowNumber: 0,
        name: note.cafeName,
        address: note.cafeAddress,
        category: undefined,
        lat: note.lat as number,
        lng: note.lng as number,
      }))
    return [...cafes, ...fromNotes]
  }, [cafes, visitedNotes])

  /**
   * 방문 마커로 그릴 카페들. (PRD F-2.17)
   * 참조가 매 렌더마다 바뀌면 마커가 계속 재생성되므로 메모한다.
   */
  const visitedKeys = useMemo(() => buildVisitedKeys(notes, visitedNotes), [notes, visitedNotes])

  /** 카페 + 내 기록을 `이름+주소` 키로 이어 붙인다. (PRD §3.1) */
  const items = useMemo<CafeWithNote[]>(() => {
    const noteByKey = new Map(notes.map((note) => [toCafeNoteKey(note), note]))
    return cafes.map((cafe) => ({
      cafe,
      note: noteByKey.get(toCafeKey(cafe.name, cafe.address)) ?? null,
    }))
  }, [cafes, notes])

  /** 선택된 카페에 대한 내 기존 기록. 팝업을 열 때 채워 보여준다. (PRD F-4.6) */
  const selectedNote = useMemo<CafeNote | null>(() => {
    if (!selectedCafe) return null
    const key = toCafeKey(selectedCafe.name, selectedCafe.address)
    return notes.find((note) => toCafeNoteKey(note) === key) ?? null
  }, [selectedCafe, notes])

  // CafeMap 의 마커 재렌더 의존성이므로 참조를 고정한다.
  // 참조가 매 렌더마다 바뀌면 마커가 계속 재생성된다.
  const handleMarkerClick = useCallback((cafe: Cafe) => {
    setSaveError(null)
    setSelectedCafe(cafe)
  }, [])

  const handleCardSelect = useCallback((item: CafeWithNote) => {
    setSaveError(null)
    setSelectedCafe(item.cafe)
  }, [])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setSelectedCafe(null)
  }, [])

  /**
   * 소감 저장. 지금은 `@/data/cafeNotes` 의 가짜 upsert 로 메모리에만 반영된다.
   * 새로고침하면 사라진다. 다음 단계에서 이 함수 안쪽만 Supabase upsert 로 바꾼다.
   *
   * 로그인 필수 경로다. (PRD §6.0)
   */
  const handleSave = useCallback(async (input: SaveCafeNoteInput) => {
    // UI 에서도 잠그지만, 어떤 경로로든 여기 도달하면 로그인부터 시킨다.
    if (userId === null) {
      setAuthDialogOpen(true)
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      const saved = await saveCafeNote(input)
      // 같은 장소 기록은 1개만 유지한다 — 있으면 교체, 없으면 추가. (PRD §7.2)
      setNotes((prev) => {
        const others = prev.filter(
          (note) => !(note.nameKey === saved.nameKey && note.addressKey === saved.addressKey),
        )
        return [...others, saved]
      })
      // 방문 체크를 켜거나 끈 결과가 방문 목록에도 반영돼야 한다.
      setVisitedVersion((version) => version + 1)
      setSelectedCafe(null)
    } catch (error) {
      // 저장 실패 시 입력 내용을 잃지 않는다. 팝업은 열어 둔다. (PRD F-3.7)
      setSaveError(
        error instanceof Error ? error.message : '저장에 실패했습니다. 다시 시도해 주세요.',
      )
      // 세션 만료는 에러 화면이 아니라 안내 + 로그인 모달로 처리한다.
      // 다시 로그인하면 팝업에 쓰던 내용 그대로 저장을 다시 누를 수 있다.
      if (error instanceof AuthRequiredError) setAuthDialogOpen(true)
    } finally {
      setSaving(false)
    }
  }, [userId])

  // 페이지 이동이 아니라 모달이다. 업로드한 목록·지도 상태가 메모리에만 있어서
  // 화면을 옮기면 사라진다. (PRD §6.0, R-8)
  const handleLoginClick = useCallback(() => {
    setAuthError(null)
    setAuthDialogOpen(true)
  }, [])

  /** 방문 목록 항목 클릭 → 지도 중심 이동. (PRD F-5) */
  const handleVisitedSelect = useCallback((note: CafeNote) => {
    if (note.lat === null || note.lng === null) return
    setMapFocus((prev) => ({
      lat: note.lat as number,
      lng: note.lng as number,
      nonce: (prev?.nonce ?? 0) + 1,
    }))
  }, [])

  const handleLogoutClick = useCallback(async () => {
    setAuthError(null)
    try {
      await signOut()
      // 열려 있던 소감 팝업은 닫는다 — 방금 로그아웃한 계정의 입력이 남아 있으면 혼란스럽다.
      setSelectedCafe(null)
    } catch (caught) {
      setAuthError(caught instanceof Error ? caught.message : '로그아웃에 실패했습니다.')
    }
  }, [signOut])

  const hasUploaded = summary !== null || error !== null

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        onFileSelected={(file) => void upload(file)}
        onLoginClick={handleLoginClick}
        onLogoutClick={() => void handleLogoutClick()}
        userEmail={user?.email ?? null}
        authLoading={authLoading}
      />

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        {authError && <p className="text-sm text-destructive">{authError}</p>}
        {notesError && <p className="text-sm text-muted-foreground">{notesError}</p>}

        {/* 좁은 화면에서는 지도 아래로 쌓이고, 넓은 화면에서는 오른쪽 사이드바가 된다. */}
        <div className="gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            {!hasUploaded && (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
                <FileSpreadsheet className="h-6 w-6 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">엑셀 파일을 업로드해 주세요.</p>
                <p className="text-xs text-muted-foreground">
                  첫 줄에 <strong>이름 · 주소 · 카테고리</strong> 열이 있어야 합니다. (.xlsx / .xls
                  / .csv, 최대 5MB · 500행)
                </p>
              </div>
            )}

            <UploadStatus
              summary={summary}
              progress={progress}
              error={error}
              geocodedCount={cafes.length}
              failureCount={failures.length}
              isRunning={isRunning}
              onCancel={cancel}
            />

            {/* TODO: 카테고리/방문 필터 자리 (PRD §5.6) */}

            <CafeMap
              cafes={mapCafes}
              visitedKeys={visitedKeys}
              fitBoundsKey={fitBoundsKey}
              focus={mapFocus}
              onMarkerClick={handleMarkerClick}
            />

            <GeocodeFailureList failures={failures} />

            {cafes.length > 0 && <CafeCardList items={items} onSelect={handleCardSelect} />}
          </div>

          <aside className="mt-4 lg:mt-0 lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:self-start lg:overflow-y-auto">
            <VisitedCafeList
              notes={visitedNotes}
              loading={visitedLoading}
              error={visitedError}
              isAuthenticated={userId !== null}
              authLoading={authLoading}
              onSelect={handleVisitedSelect}
              onLoginClick={handleLoginClick}
            />
          </aside>
        </div>
      </main>

      <CafeNoteDialog
        cafe={selectedCafe}
        existingNote={selectedNote}
        onOpenChange={handleDialogOpenChange}
        onSave={handleSave}
        saving={saving}
        error={saveError}
        isAuthenticated={userId !== null}
        authLoading={authLoading}
        onLoginClick={handleLoginClick}
      />

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </div>
  )
}
