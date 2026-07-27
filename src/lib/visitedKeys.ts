/**
 * 어떤 카페가 "방문한 곳"인지 판정한다. 마커 종류를 고르는 기준. PRD F-2.17.
 *
 * 판정 키는 반드시 `@/lib/normalize` 의 함수로만 만든다. 구분자가 NUL 이라
 * 템플릿 문자열로 조립하면 조용히 어긋난다. (PRD R-13)
 */

import type { Cafe, CafeNote } from '@/types/cafe'
import { toCafeKey, toCafeNoteKey } from '@/lib/normalize'

/**
 * 방문 체크된 카페의 합성 키 집합.
 *
 * 두 곳에서 방문 여부가 온다:
 *  - `visitedNotes` — 방문 목록 조회 결과. 정의상 전부 방문이다.
 *  - `uploadedNotes` — 업로드한 카페에 대한 내 기록. 방문/미방문이 섞여 있다.
 *
 * `uploadedNotes` 를 **나중에** 반영해 덮어쓰는 이유: 방금 체크를 풀고 저장했는데
 * 방문 목록 재조회가 아직 안 끝났을 수 있다. 그때 이 순서가 아니면 마커가
 * 한 박자 늦게 바뀐다.
 */
export function buildVisitedKeys(
  uploadedNotes: readonly CafeNote[],
  visitedNotes: readonly CafeNote[],
): Set<string> {
  const keys = new Set<string>()

  for (const note of visitedNotes) {
    if (note.visited) keys.add(toCafeNoteKey(note))
  }

  for (const note of uploadedNotes) {
    const key = toCafeNoteKey(note)
    if (note.visited) keys.add(key)
    else keys.delete(key)
  }

  return keys
}

/** 이 카페가 방문한 곳인가. */
export function isCafeVisited(
  visitedKeys: ReadonlySet<string>,
  cafe: Pick<Cafe, 'name' | 'address'>,
): boolean {
  return visitedKeys.has(toCafeKey(cafe.name, cafe.address))
}
