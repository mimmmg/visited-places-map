/**
 * 하드코딩된 가짜 데이터. 실제 연동 전까지 화면을 완성하는 데 쓴다. (CLAUDE.md 규칙 5)
 *
 * 해피 패스만 넣지 않는다. 아래 경우를 일부러 섞어 뒀다:
 *  - 카테고리가 빈 카페 → `미분류` 그룹 (PRD F-6.5)
 *  - 방문 체크 + 소감이 있는 카페 (PRD F-4.6)
 *  - 방문 체크 없이 소감만 있는 카페 → 방문 목록에는 안 나옴 (PRD D-6)
 *  - 200자 꽉 채운 소감 (PRD F-3.3)
 *  - 좌표 변환 실패 행 (PRD F-2.7)
 */

import type { Cafe, CafeNote, GeocodeFailure } from '@/types/cafe'
import { toAddressKey, toNameKey } from '@/lib/normalize'

export { SEOUL_CITY_HALL } from '@/lib/constants'

const FAKE_USER_ID = '00000000-0000-0000-0000-000000000000'

export const MOCK_CAFES: Cafe[] = [
  {
    rowNumber: 2,
    name: '덕수궁 로스터리',
    address: '서울 중구 세종대로 99',
    category: '로스터리',
    lat: 37.5658,
    lng: 126.9751,
  },
  {
    rowNumber: 3,
    name: '을지로 디저트룸',
    address: '서울 중구 을지로 11',
    category: '디저트',
    lat: 37.5665,
    lng: 126.983,
  },
  {
    rowNumber: 4,
    name: '서울광장 작업실',
    address: '서울 중구 태평로1가 31',
    category: '작업용',
    lat: 37.5645,
    lng: 126.9772,
  },
  {
    // 카테고리 없음 → 화면에서 `미분류`로 묶인다
    rowNumber: 5,
    name: 'Myeongdong Stand Coffee',
    address: '서울 중구 명동길 14',
    lat: 37.5636,
    lng: 126.985,
  },
]

function makeNote(
  cafe: Cafe,
  fields: Pick<CafeNote, 'visited' | 'note'> & { updatedAt: string },
): CafeNote {
  return {
    id: `mock-note-${cafe.rowNumber}`,
    userId: FAKE_USER_ID,
    cafeName: cafe.name,
    cafeAddress: cafe.address,
    nameKey: toNameKey(cafe.name),
    addressKey: toAddressKey(cafe.address),
    category: cafe.category ?? null,
    visited: fields.visited,
    note: fields.note,
    lat: cafe.lat,
    lng: cafe.lng,
    createdAt: '2026-07-20T02:10:00.000Z',
    updatedAt: fields.updatedAt,
  }
}

/** 200자 꽉 채운 소감. 카드 레이아웃이 긴 텍스트에 견디는지 확인용. */
const LONG_NOTE = '라떼가 고소하고 산미가 적당했다. '.repeat(12).slice(0, 200)

export const MOCK_NOTES: CafeNote[] = [
  makeNote(MOCK_CAFES[0], {
    visited: true,
    note: '라떼가 고소했다',
    updatedAt: '2026-07-25T08:30:00.000Z',
  }),
  makeNote(MOCK_CAFES[1], {
    visited: true,
    note: LONG_NOTE,
    updatedAt: '2026-07-26T11:05:00.000Z',
  }),
  makeNote(MOCK_CAFES[2], {
    // 방문 체크 없이 소감만 → 방문 목록에는 안 보인다 (PRD D-6)
    visited: false,
    note: '주말에만 영업. 다음에 가보기',
    updatedAt: '2026-07-24T05:00:00.000Z',
  }),
  // MOCK_CAFES[3] 은 기록 없음 → 빈 입력 상태 확인용
]

/** 좌표 변환 실패 목록. 화면 하단 안내 패널 확인용. (PRD F-2.7) */
export const MOCK_GEOCODE_FAILURES: GeocodeFailure[] = [
  {
    row: { rowNumber: 6, name: '뭉카페', address: '서울 어딘가', category: '디저트' },
    reason: 'NOT_FOUND',
  },
  {
    row: { rowNumber: 7, name: '이름만 있는 카페', address: '???', category: undefined },
    reason: 'INVALID_FORMAT',
  },
]
