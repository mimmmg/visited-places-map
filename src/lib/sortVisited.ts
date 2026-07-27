/**
 * 방문 목록 정렬. PRD F-5.5, F-5.11.
 *
 * 서버를 다시 조회하지 않고 메모리에 있는 목록만 다시 늘어놓는다.
 */

import type { CafeNote } from '@/types/cafe'

export type VisitedSortKey = 'recent' | 'name'

/** 버튼 라벨. 화면과 정렬 키를 한곳에서 관리한다. */
export const VISITED_SORT_LABELS: Record<VisitedSortKey, string> = {
  recent: '최신순',
  name: '이름순',
}

/**
 * 한글 로케일 비교기.
 *
 * 모듈 레벨에 한 번만 만든다 — 비교할 때마다 `new Intl.Collator` 를 만들면
 * 항목 수만큼 생성 비용이 든다.
 * `numeric` 을 켜서 `2호점` 이 `10호점` 보다 앞에 오게 한다.
 */
const collator = new Intl.Collator('ko', { numeric: true })

/**
 * 정렬한 새 배열을 돌려준다.
 *
 * `Array.prototype.sort` 는 제자리 정렬이라 state 배열에 직접 쓰면
 * React 가 변경을 알아채지 못한다. 반드시 복사한 뒤 정렬한다.
 */
export function sortVisitedNotes(
  notes: readonly CafeNote[],
  key: VisitedSortKey,
): CafeNote[] {
  return [...notes].sort(key === 'name' ? byName : byRecent)
}

/** 이름 → 주소 순. 같은 이름의 체인점이 있어도 순서가 흔들리지 않는다. */
function byName(a: CafeNote, b: CafeNote): number {
  const byCafeName = collator.compare(a.cafeName, b.cafeName)
  if (byCafeName !== 0) return byCafeName
  return collator.compare(a.cafeAddress, b.cafeAddress)
}

/**
 * 최근 수정 시각 내림차순. (PRD F-5.5)
 *
 * `updatedAt` 은 ISO 8601 문자열이라 사전순 비교가 곧 시간순이다.
 * 같은 시각이면 이름순으로 갈라 순서를 고정한다.
 */
function byRecent(a: CafeNote, b: CafeNote): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1
  return byName(a, b)
}
