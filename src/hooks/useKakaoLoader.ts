import { useEffect, useState } from 'react'
import { readKakaoMapKey } from '@/lib/env'

/**
 * 카카오맵 SDK 로더. PRD §8.1.
 *
 * 지켜야 할 것 세 가지:
 *  1. `libraries=services` 포함 — 없으면 `kakao.maps.services.Geocoder` 가 없어서
 *     주소→좌표 변환 자체가 불가능하다.
 *  2. `autoload=false` + `kakao.maps.load()` — 스크립트 로드 타이밍에 따른 간헐적 실패 방지.
 *  3. 스크립트는 **한 번만** 주입 — React 리렌더와 StrictMode 이중 실행으로
 *     `<script>` 가 중복 삽입되는 것을 모듈 레벨 싱글턴으로 막는다.
 */

const SDK_SCRIPT_ID = 'kakao-maps-sdk'

/** 모듈 레벨 싱글턴. StrictMode 가 effect 를 두 번 돌려도 로드는 1회다. */
let loaderPromise: Promise<void> | null = null

function loadKakaoSdk(): Promise<void> {
  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise<void>((resolve, reject) => {
    const appkey = readKakaoMapKey()

    const existing = document.getElementById(SDK_SCRIPT_ID) as HTMLScriptElement | null
    const script = existing ?? document.createElement('script')

    const onReady = () => {
      const kakao = window.kakao
      if (!kakao) {
        reject(new Error('카카오맵 SDK 를 불러왔지만 window.kakao 가 없습니다.'))
        return
      }
      kakao.maps.load(() => {
        // libraries=services 누락은 조용히 넘기지 않고 명시적으로 실패시킨다.
        if (!window.kakao?.maps.services) {
          reject(
            new Error(
              'kakao.maps.services 가 없습니다. SDK URL 에 libraries=services 가 포함됐는지 확인하세요.',
            ),
          )
          return
        }
        resolve()
      })
    }

    if (!existing) {
      script.id = SDK_SCRIPT_ID
      script.async = true
      script.src =
        `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appkey}&libraries=services&autoload=false`
      script.onerror = () =>
        reject(
          new Error(
            '카카오맵 SDK 로드에 실패했습니다. VITE_KAKAO_MAP_KEY 값과 카카오 콘솔의 플랫폼 도메인 등록을 확인하세요.',
          ),
        )
      script.onload = onReady
      document.head.appendChild(script)
    } else {
      onReady()
    }
  })

  return loaderPromise
}

export interface KakaoLoaderState {
  loading: boolean
  ready: boolean
  error: Error | null
}

/** SDK 로드 상태를 컴포넌트에서 쓰기 위한 훅. */
export function useKakaoLoader(): KakaoLoaderState {
  const [state, setState] = useState<KakaoLoaderState>({
    loading: true,
    ready: false,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    loadKakaoSdk()
      .then(() => {
        if (!cancelled) setState({ loading: false, ready: true, error: null })
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ loading: false, ready: false, error })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
