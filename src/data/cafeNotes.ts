/**
 * 소감/방문 기록 데이터 접근 경계. `public.visit_notes` 테이블.
 *
 * 백엔드 API 가 없어서 브라우저가 PostgREST 에 직접 붙는다. 따라서 **RLS 가 유일한 인증
 * 계층**이다. 여기서 `user_id` 를 넣는 건 편의일 뿐, 실제 강제는 서버의
 * `(select auth.uid()) = user_id` 정책이 한다.
 *
 * 테이블 제약 (마이그레이션 20260727064542):
 *  - `UNIQUE (user_id, place_name, address)` → upsert 의 충돌 대상
 *  - `CHECK (char_length(impression) <= 200)`
 *  - RLS: select/insert/update 는 본인 행만. **DELETE 정책은 없다.**
 */

import type { PostgrestError } from '@supabase/supabase-js'
import type { Cafe, CafeNote, SaveCafeNoteInput } from '@/types/cafe'
import { MAX_NOTE_LENGTH } from '@/lib/constants'
import { toAddressKey, toCafeKey, toCafeNoteKey, toNameKey } from '@/lib/normalize'
import { AuthRequiredError, getCurrentUserId, getSupabase, requireCurrentUserId } from '@/lib/supabase'

const TABLE = 'visit_notes'

/**
 * upsert 충돌 대상. **반드시 명시해야 한다** — 빼면 일반 insert 로 동작해서
 * 두 번째 저장부터 unique 위반(23505)이 난다. (CLAUDE.md 흔한 실수)
 */
const CONFLICT_TARGET = 'user_id,place_name,address'

/** `visit_notes` 한 행. DB 컬럼명 그대로. */
interface VisitNoteRow {
  id: string
  user_id: string
  place_name: string
  address: string
  lat: number | null
  lng: number | null
  visited: boolean
  impression: string | null
  created_at: string
  updated_at: string
}

/**
 * DB 행 → 화면용 도메인 타입.
 *
 * `nameKey`/`addressKey` 는 DB 컬럼이 아니라 여기서 계산한다. 저장 경로와 조회 경로가
 * **같은 `@/lib/normalize` 함수**를 쓰므로 키가 어긋나지 않는다. (PRD R-13)
 * `category` 는 `visit_notes` 에 컬럼이 없어서 항상 null 이다 — 화면은 엑셀의
 * `cafe.category` 를 쓰므로 표시에는 영향이 없다.
 */
function toCafeNote(row: VisitNoteRow): CafeNote {
  return {
    id: row.id,
    userId: row.user_id,
    cafeName: row.place_name,
    cafeAddress: row.address,
    nameKey: toNameKey(row.place_name),
    addressKey: toAddressKey(row.address),
    category: null,
    visited: row.visited,
    note: row.impression,
    lat: row.lat,
    lng: row.lng,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Postgres 오류를 화면에 띄울 메시지로 옮긴다.
 *
 * 세션 만료(PGRST301)와 RLS 거부(42501)는 `AuthRequiredError` 로 구분해 던진다.
 * 화면에서 빨간 에러 대신 "다시 로그인해 주세요" 안내를 띄우기 위해서다.
 */
function toFriendlyError(error: PostgrestError): Error {
  if (error.code === 'PGRST301' || error.code === '42501' || /jwt|token/i.test(error.message)) {
    return new AuthRequiredError()
  }
  if (error.code === '23505') {
    // upsert 에 onConflict 를 빼먹었을 때 나는 오류다. 사용자 잘못이 아니다.
    return new Error('같은 장소의 기록이 이미 있습니다. (충돌 대상 설정 확인 필요)')
  }
  if (error.code === '23514') {
    return new Error(`소감은 ${MAX_NOTE_LENGTH}자를 넘을 수 없습니다.`)
  }
  return new Error(error.message)
}

/**
 * 내 기록을 모두 가져온다. RLS 가 본인 행만 돌려준다.
 *
 * PRD F-4.5 는 `(이름, 주소)` 쌍으로 100건씩 나눠 조회하라고 하지만, PostgREST 에서
 * 쌍 조건은 `or=(and(...),and(...))` 로 URL 이 500개 항목만큼 길어진다.
 * 한 사람의 기록 수는 방문한 장소 수만큼으로 작으므로 전부 받아 메모리에서 맞춘다.
 * 기록이 수천 건으로 늘면 그때 쌍 단위 청크 조회로 바꾼다.
 */
async function fetchAllMyNotes(): Promise<CafeNote[]> {
  const userId = await getCurrentUserId()
  // 비로그인이면 이전 소감 불러오기는 없다. (PRD §6.0)
  if (userId === null) return []

  const { data, error } = await getSupabase()
    .from(TABLE)
    .select('*')
    // RLS 로도 걸러지지만 조건을 함께 넣는다. 인덱스(unique 제약)도 이 컬럼이 앞이다.
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw toFriendlyError(error)
  return (data as VisitNoteRow[]).map(toCafeNote)
}

/**
 * 업로드한 카페 목록 중 내 기록이 있는 것만 돌려준다. (PRD F-4.5)
 *
 * 주의: 여기서 빈 배열은 "기록 없음"일 수도, "RLS 에 막힘"일 수도 있다.
 * RLS 는 오류가 아니라 빈 결과를 준다. (PRD R-14)
 */
export async function fetchMyCafeNotes(cafes: Cafe[]): Promise<CafeNote[]> {
  const all = await fetchAllMyNotes()
  const wanted = new Set(cafes.map((cafe) => toCafeKey(cafe.name, cafe.address)))
  // 키는 반드시 같은 함수로 만든다. 템플릿으로 조립하면 구분자(NUL)가 어긋난다.
  return all.filter((note) => wanted.has(toCafeNoteKey(note)))
}

/**
 * 방문 체크한 카페만 조회한다. 엑셀 없이도 동작해야 한다. (PRD F-5)
 * 그래서 `visit_notes` 에 좌표를 함께 저장한다 — 지도로 이동할 수 있어야 하므로.
 */
export async function fetchMyVisitedCafeNotes(): Promise<CafeNote[]> {
  const all = await fetchAllMyNotes()
  return all.filter((note) => note.visited)
}

/**
 * 소감 저장. 같은 사람의 같은 장소 기록은 1개만 유지된다. (PRD §7.2)
 *
 * insert 가 아니라 **upsert** 다. 고쳐 저장하면 새 행이 생기지 않고 기존 행이 바뀐다.
 * `updated_at` 은 DB 트리거가 갱신하므로 여기서 보내지 않는다.
 */
export async function saveCafeNote(input: SaveCafeNoteInput): Promise<CafeNote> {
  // 클라이언트가 넘긴 값이 아니라 세션에서 가져온다. 없으면 AuthRequiredError.
  const userId = await requireCurrentUserId()

  const { data, error } = await getSupabase()
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        place_name: input.cafeName,
        address: input.cafeAddress,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        visited: input.visited,
        impression: input.note ?? null,
      },
      { onConflict: CONFLICT_TARGET },
    )
    .select()
    .single()

  if (error) throw toFriendlyError(error)
  return toCafeNote(data as VisitNoteRow)
}

/**
 * 기록 삭제. (PRD F-3.5)
 *
 * ⚠️ 현재 `visit_notes` 에는 **DELETE 정책이 없어서** RLS 가 전부 막는다.
 * 오류가 아니라 "0건 삭제"로 조용히 끝나므로, 성공한 것처럼 보이지 않게 여기서 막는다.
 * 활성화하려면 `for delete to authenticated using ((select auth.uid()) = user_id)` 정책이 필요하다.
 */
export async function deleteCafeNote(cafeName: string, cafeAddress: string): Promise<void> {
  void cafeName
  void cafeAddress
  throw new Error('기록 삭제는 아직 사용할 수 없습니다. (visit_notes 에 DELETE 정책 필요)')
}
