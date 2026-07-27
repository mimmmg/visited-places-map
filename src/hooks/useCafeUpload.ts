import { useCallback, useRef, useState } from 'react'
import type { Cafe, GeocodeFailure } from '@/types/cafe'
import { CafeExcelError, parseCafeExcel, type ParseCafeExcelResult } from '@/lib/cafeExcel'
import { createKakaoGeocoder, geocodeCafeRows } from '@/lib/geocode'

export interface UploadProgress {
  done: number
  total: number
}

export interface CafeUploadState {
  /** 좌표 변환에 성공해 지도에 그릴 카페. 변환되는 대로 늘어난다. (PRD F-2.14) */
  cafes: Cafe[]
  /** 좌표를 못 찾은 카페. 화면에 목록으로 안내한다. (PRD F-2.7) */
  failures: GeocodeFailure[]
  /** 엑셀 파싱 요약. (PRD F-1.6) */
  summary: ParseCafeExcelResult | null
  progress: UploadProgress | null
  /** 파싱 단계 오류(필수 열 누락, 파일 크기 초과 등). */
  error: string | null
  /** 이 값이 바뀌면 지도가 범위를 다시 맞춘다. */
  fitBoundsKey: number
  isRunning: boolean
}

const INITIAL_STATE: CafeUploadState = {
  cafes: [],
  failures: [],
  summary: null,
  progress: null,
  error: null,
  fitBoundsKey: 0,
  isRunning: false,
}

/**
 * 엑셀 업로드 → 파싱 → 순차 좌표 변환. PRD F-1, F-2.
 *
 * 파일을 다시 올리면 이전 결과를 **먼저 비운다.** 그래야 마커가 쌓이지 않는다.
 * 진행 중이던 변환은 중단시킨다.
 */
export function useCafeUpload() {
  const [state, setState] = useState<CafeUploadState>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState((prev) => ({ ...prev, isRunning: false, progress: null }))
  }, [])

  const upload = useCallback(async (file: File) => {
    // 진행 중이던 변환을 먼저 끊는다. 안 끊으면 이전 파일의 마커가 섞여 들어온다.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // 이전 결과 전량 초기화 → 마커 누적 방지
    setState((prev) => ({
      ...INITIAL_STATE,
      fitBoundsKey: prev.fitBoundsKey + 1,
      isRunning: true,
    }))

    let parsed: ParseCafeExcelResult
    try {
      parsed = await parseCafeExcel(file)
    } catch (error) {
      const message =
        error instanceof CafeExcelError
          ? error.message
          : '엑셀 파일을 읽지 못했습니다. .xlsx / .xls / .csv 파일인지 확인해 주세요.'
      setState((prev) => ({ ...prev, error: message, isRunning: false }))
      return
    }

    setState((prev) => ({
      ...prev,
      summary: parsed,
      progress: { done: 0, total: parsed.rows.length },
    }))

    if (parsed.rows.length === 0) {
      setState((prev) => ({ ...prev, isRunning: false, progress: null }))
      return
    }

    let geocoder
    try {
      geocoder = createKakaoGeocoder()
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : '지도 서비스를 사용할 수 없습니다.',
        isRunning: false,
        progress: null,
      }))
      return
    }

    await geocodeCafeRows(parsed.rows, {
      geocoder,
      signal: controller.signal,
      // 변환되는 대로 즉시 지도에 반영한다. (PRD F-2.14)
      onGeocoded: (cafe) => {
        if (controller.signal.aborted) return
        setState((prev) => ({ ...prev, cafes: [...prev.cafes, cafe] }))
      },
      onFailed: (failure) => {
        if (controller.signal.aborted) return
        setState((prev) => ({ ...prev, failures: [...prev.failures, failure] }))
      },
      onProgress: (done, total) => {
        if (controller.signal.aborted) return
        setState((prev) => ({ ...prev, progress: { done, total } }))
      },
    })

    if (!controller.signal.aborted) {
      setState((prev) => ({ ...prev, isRunning: false, progress: null }))
    }
  }, [])

  return { ...state, upload, cancel }
}
