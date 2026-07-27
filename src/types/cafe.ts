/**
 * 도메인 타입. PRD §3, §7.2 기준.
 *
 * 카페 마스터 테이블은 없다. 엑셀이 원본이고, 장소 식별자는 `이름 + 주소`다.
 */

/** 엑셀 한 행 = 카페 하나. 아직 좌표는 없다. (PRD §5.1) */
export interface CafeRow {
  /** 엑셀 원본 행 번호. 변환 실패 안내에 쓴다. (PRD F-2.7) */
  rowNumber: number
  /** 카페명 원본 표기 */
  name: string
  /** 주소 원본 표기 */
  address: string
  /** 카테고리. 비어 있으면 `미분류`로 묶는다. (PRD F-6.5) */
  category?: string
}

/** 좌표 변환에 성공한 카페. 지도에 마커로 그릴 수 있는 상태. (PRD F-2.4) */
export interface Cafe extends CafeRow {
  lat: number
  lng: number
}

/** 좌표 변환 실패 사유. 화면 안내 문구와 1:1 대응. (PRD §5.2) */
export type GeocodeFailureReason =
  | 'NOT_FOUND'
  | 'INVALID_FORMAT'
  | 'NETWORK_ERROR'
  | 'RATE_LIMITED'

/** 변환 실패 항목. 화면에 목록으로 안내한다. (PRD F-2.7) */
export interface GeocodeFailure {
  row: CafeRow
  reason: GeocodeFailureReason
}

/**
 * 사용자의 방문 기록 + 한줄 소감. `cafe_notes` 테이블 한 행. (PRD §7.2)
 *
 * 같은 사용자가 같은 `(이름, 주소)`에 남긴 기록은 1개만 존재한다.
 * DB 에서 `UNIQUE (user_id, name_key, address_key)` 로 강제된다.
 */
export interface CafeNote {
  id: string
  userId: string
  cafeName: string
  cafeAddress: string
  /** 정규화된 카페명. 매칭 전용. (PRD §3.2) */
  nameKey: string
  /** 정규화된 주소. 매칭 전용. (PRD §3.2) */
  addressKey: string
  category: string | null
  visited: boolean
  /** 최대 200자. (PRD F-3.3) */
  note: string | null
  lat: number | null
  lng: number | null
  createdAt: string
  updatedAt: string
}

/** 소감 저장 입력. upsert 대상. (PRD §7.2) */
export interface SaveCafeNoteInput {
  cafeName: string
  cafeAddress: string
  category?: string | null
  visited: boolean
  note?: string | null
  lat?: number | null
  lng?: number | null
}

/** 카페 + 그 카페에 대한 내 기록. 화면에서 함께 다루는 단위. */
export interface CafeWithNote {
  cafe: Cafe
  note: CafeNote | null
}
