/**
 * 주소 → 좌표 변환. PRD §5.2.
 *
 * 규칙:
 *  - **한 건씩 순차로** 처리한다. 병렬 호출하지 않는다. (F-2.13)
 *  - 변환되는 대로 `onGeocoded` 로 흘려보내 마커를 즉시 그린다. (F-2.14)
 *  - 중단 가능하다. (F-2.15)
 *  - 실패는 버리지 않고 사유와 함께 모아 화면에 안내한다. (F-2.7)
 *  - 동일 주소는 1회만 호출하고 캐시를 재사용한다. (F-2.9, F-2.10)
 */

import type { Cafe, CafeRow, GeocodeFailure, GeocodeFailureReason } from '@/types/cafe'

export type GeocodeOutcome =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: GeocodeFailureReason }

/** 주소 하나를 좌표로 바꾸는 함수. 테스트에서는 가짜 구현을 주입한다. */
export type AddressGeocoder = (address: string) => Promise<GeocodeOutcome>

export interface GeocodeCafeRowsOptions {
  geocoder: AddressGeocoder
  /** 진행률. (F-2.3) */
  onProgress?: (done: number, total: number) => void
  /** 변환 성공 즉시 호출. 마커를 하나씩 그리기 위함. (F-2.14) */
  onGeocoded?: (cafe: Cafe) => void
  /** 변환 실패 즉시 호출. */
  onFailed?: (failure: GeocodeFailure) => void
  /** 중단 신호. (F-2.15) */
  signal?: AbortSignal
  /** 재시도 대기 시간 계산. 테스트에서 0 을 주어 즉시 진행시킨다. */
  backoffMs?: (attempt: number) => number
}

export interface GeocodeCafeRowsResult {
  cafes: Cafe[]
  failures: GeocodeFailure[]
  /** 중단으로 끝났는지 여부. */
  aborted: boolean
}

/** 일시적 실패만 재시도한다. 결과 없음/형식 오류는 다시 해도 같다. */
function isRetryable(reason: GeocodeFailureReason): boolean {
  return reason === 'NETWORK_ERROR' || reason === 'RATE_LIMITED'
}

const MAX_RETRIES = 2

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

/**
 * 카페 행 목록을 순차로 변환한다.
 *
 * 같은 주소가 여러 행에 있으면 첫 행에서만 호출하고, 이후 행은 캐시된 좌표를 쓴다.
 */
export async function geocodeCafeRows(
  rows: CafeRow[],
  options: GeocodeCafeRowsOptions,
): Promise<GeocodeCafeRowsResult> {
  const { geocoder, onProgress, onGeocoded, onFailed, signal, backoffMs } = options
  const computeBackoff = backoffMs ?? ((attempt: number) => 300 * 2 ** attempt)

  const cafes: Cafe[] = []
  const failures: GeocodeFailure[] = []
  /** 주소 → 결과 캐시. 같은 주소를 두 번 호출하지 않는다. */
  const cache = new Map<string, GeocodeOutcome>()

  for (let index = 0; index < rows.length; index += 1) {
    if (signal?.aborted) {
      return { cafes, failures, aborted: true }
    }

    const row = rows[index]
    const cacheKey = row.address.trim()

    let outcome = cache.get(cacheKey)

    if (!outcome) {
      outcome = await geocodeOnce(geocoder, row.address, computeBackoff, signal)
      cache.set(cacheKey, outcome)
    }

    if (outcome.ok) {
      const cafe: Cafe = { ...row, lat: outcome.lat, lng: outcome.lng }
      cafes.push(cafe)
      onGeocoded?.(cafe)
    } else {
      const failure: GeocodeFailure = { row, reason: outcome.reason }
      failures.push(failure)
      onFailed?.(failure)
    }

    onProgress?.(index + 1, rows.length)
  }

  return { cafes, failures, aborted: false }
}

/** 한 주소를 변환한다. 일시적 실패는 지수 백오프로 최대 2회 재시도. */
async function geocodeOnce(
  geocoder: AddressGeocoder,
  address: string,
  computeBackoff: (attempt: number) => number,
  signal?: AbortSignal,
): Promise<GeocodeOutcome> {
  let last: GeocodeOutcome = { ok: false, reason: 'NOT_FOUND' }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    if (signal?.aborted) return last

    try {
      last = await geocoder(address)
    } catch {
      last = { ok: false, reason: 'NETWORK_ERROR' }
    }

    if (last.ok || !isRetryable(last.reason)) return last

    if (attempt < MAX_RETRIES) {
      await delay(computeBackoff(attempt), signal)
    }
  }

  return last
}

/**
 * 카카오맵 SDK 기반 지오코더. `libraries=services` 가 없으면 만들 수 없다.
 *
 * 주소 검색이 실패하면 키워드 검색으로 1회 보조 시도한다. (PRD §5.2)
 */
export function createKakaoGeocoder(): AddressGeocoder {
  const maps = window.kakao?.maps
  const services = maps?.services

  if (!maps || !services) {
    throw new Error(
      'kakao.maps.services 가 없습니다. SDK URL 에 libraries=services 가 포함됐는지 확인하세요.',
    )
  }

  const geocoder = new services.Geocoder()
  const places = new services.Places()
  const { Status } = services

  return (address) =>
    new Promise<GeocodeOutcome>((resolve) => {
      geocoder.addressSearch(address, (result, status) => {
        if (status === Status.OK && result.length > 0) {
          resolve({ ok: true, lat: Number(result[0].y), lng: Number(result[0].x) })
          return
        }

        if (status === Status.ERROR) {
          resolve({ ok: false, reason: 'NETWORK_ERROR' })
          return
        }

        // 주소 검색 실패 → 키워드 검색으로 1회 보조 시도
        places.keywordSearch(address, (placeResult, placeStatus) => {
          if (placeStatus === Status.OK && placeResult.length > 0) {
            resolve({ ok: true, lat: Number(placeResult[0].y), lng: Number(placeResult[0].x) })
            return
          }
          resolve({ ok: false, reason: 'NOT_FOUND' })
        })
      })
    })
}
