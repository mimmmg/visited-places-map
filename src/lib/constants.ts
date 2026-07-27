/** 서울시청. 지도 초기 중심. */
export const SEOUL_CITY_HALL = { lat: 37.5663, lng: 126.9779 } as const

/**
 * 소감 길이 상한. (PRD F-3.3)
 *
 * UI 카운터와 DB 의 `visit_notes_impression_length` CHECK 가 **같은 값**이어야 한다.
 * 여기를 고치면 마이그레이션도 함께 고친다.
 */
export const MAX_NOTE_LENGTH = 200
