import { useEffect, useRef } from 'react'
import type { Cafe } from '@/types/cafe'
import type { KakaoInfoWindow, KakaoMapInstance, KakaoMarker } from '@/types/kakao'
import { useKakaoLoader } from '@/hooks/useKakaoLoader'
import { SEOUL_CITY_HALL } from '@/lib/constants'
import { getMarkerImages } from '@/lib/markerIcons'
import { isCafeVisited } from '@/lib/visitedKeys'

/** 기본값을 매번 새로 만들면 마커 렌더 effect 가 계속 다시 돈다. */
const NO_VISITED_KEYS: ReadonlySet<string> = new Set<string>()

interface CafeMapProps {
  cafes: Cafe[]
  /**
   * 방문 체크된 카페의 합성 키. `@/lib/visitedKeys` 의 `buildVisitedKeys` 로 만든 값만 넣는다.
   * 이 값이 바뀌면 마커를 다시 그려 색·모양을 갱신한다. (PRD F-2.17, §4.2)
   */
  visitedKeys?: ReadonlySet<string>
  /** 지도 중심. 기본값은 서울시청. */
  center?: { lat: number; lng: number }
  /**
   * 이 값이 바뀌면 지도 범위를 다시 맞춘다. 새 파일을 업로드했을 때만 올린다.
   * 필터 변경으로는 바꾸지 않는다 — 보던 위치를 유지해야 한다. (PRD F-6.7)
   */
  fitBoundsKey?: number
  /**
   * 이 값이 바뀔 때마다 해당 좌표로 지도를 옮긴다. 방문 목록에서 항목을 누를 때 쓴다.
   *
   * 좌표만 보면 같은 카페를 두 번 눌렀을 때 지도가 반응하지 않으므로,
   * 매번 증가하는 `nonce` 로 "다시 이동하라"는 신호를 구분한다.
   */
  focus?: { lat: number; lng: number; nonce: number } | null
  onMarkerClick?: (cafe: Cafe) => void
}

/**
 * 카카오맵 + 마커 + 말풍선. PRD F-2.4 ~ F-2.16.
 *
 * 마커 재렌더 규칙(CLAUDE.md): 다시 그릴 때는 이전 마커를 **모두 제거한 뒤** 새로 그린다.
 * 배열 참조만 버리면 지도에서 사라지지 않으므로 각 마커에 `setMap(null)` 을 호출한다.
 */
export function CafeMap({
  cafes,
  visitedKeys = NO_VISITED_KEYS,
  center = SEOUL_CITY_HALL,
  fitBoundsKey = 0,
  focus = null,
  onMarkerClick,
}: CafeMapProps) {
  const { loading, ready, error } = useKakaoLoader()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<KakaoMapInstance | null>(null)
  const markersRef = useRef<KakaoMarker[]>([])
  /** 말풍선은 하나만 띄운다. 재사용하지 않으면 클릭할수록 쌓인다. */
  const infoWindowRef = useRef<KakaoInfoWindow | null>(null)
  /** 이 키로 범위를 이미 맞췄는지. 같은 업로드 안에서는 다시 맞추지 않는다. */
  const fittedKeyRef = useRef<number | null>(null)

  // 지도 생성 (1회)
  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return
    const kakao = window.kakao
    if (!kakao) return

    mapRef.current = new kakao.maps.Map(containerRef.current, {
      center: new kakao.maps.LatLng(center.lat, center.lng),
      level: 5,
    })
    infoWindowRef.current = new kakao.maps.InfoWindow({ content: '', removable: true })
  }, [ready, center.lat, center.lng])

  // 마커 렌더 — 전량 제거 후 재생성
  useEffect(() => {
    const map = mapRef.current
    const kakao = window.kakao
    if (!ready || !map || !kakao) return

    // 이전 마커와 말풍선을 먼저 모두 지운다. (PRD F-2.16)
    infoWindowRef.current?.close()
    clearMarkers(markersRef.current)
    markersRef.current = []

    const bounds = new kakao.maps.LatLngBounds()
    // 두 종류만 만들어 모든 마커가 공유한다.
    const images = getMarkerImages()

    for (const cafe of cafes) {
      const visited = isCafeVisited(visitedKeys, cafe)
      const position = new kakao.maps.LatLng(cafe.lat, cafe.lng)
      const marker = new kakao.maps.Marker({
        position,
        title: `${cafe.name} (${visited ? '방문' : '미방문'})`,
        image: visited ? images.visited : images.unvisited,
      })
      marker.setMap(map)

      kakao.maps.event.addListener(marker, 'click', () => {
        // 마커를 누르면 카페 이름과 방문 여부를 말풍선으로 띄운다.
        // 색·모양에 더해 텍스트로도 적는다. (PRD §9 접근성)
        const infoWindow = infoWindowRef.current
        if (infoWindow) {
          infoWindow.setContent(
            `<div style="padding:6px 10px;font-size:13px;white-space:nowrap;">` +
              `${escapeHtml(cafe.name)}` +
              `<span style="margin-left:6px;color:${visited ? '#047857' : '#64748b'};">` +
              `${visited ? '· 방문' : '· 미방문'}</span></div>`,
          )
          infoWindow.open(map, marker)
        }
        onMarkerClick?.(cafe)
      })

      markersRef.current.push(marker)
      bounds.extend(position)
    }

    // 새 업로드일 때만 범위를 맞춘다.
    // 방문 체크가 바뀌어 다시 그리는 경우에는 `fitBoundsKey` 가 그대로라 여기 들어오지 않는다 —
    // 저장할 때마다 보던 위치가 튀면 안 된다. (PRD F-6.7 과 같은 원칙)
    if (fittedKeyRef.current !== fitBoundsKey && cafes.length > 0 && !bounds.isEmpty()) {
      map.setBounds(bounds)
      fittedKeyRef.current = fitBoundsKey
    }
  }, [ready, cafes, visitedKeys, fitBoundsKey, onMarkerClick])

  // 방문 목록에서 고른 카페로 중심 이동. (PRD F-5)
  useEffect(() => {
    const map = mapRef.current
    const kakao = window.kakao
    if (!ready || !map || !kakao || !focus) return

    // 너무 멀리 축소돼 있으면 카페가 어디인지 안 보인다. 확대만 하고 축소는 하지 않는다.
    if (map.getLevel() > 5) map.setLevel(5)
    map.panTo(new kakao.maps.LatLng(focus.lat, focus.lng))
  }, [ready, focus])

  // 언마운트 시 정리
  useEffect(
    () => () => {
      infoWindowRef.current?.close()
      clearMarkers(markersRef.current)
      markersRef.current = []
    },
    [],
  )

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-lg border md:h-[520px]">
      {/* 지도 컨테이너는 높이가 필요하다. 0px 이면 에러 없이 빈 화면이 된다. */}
      <div ref={containerRef} className="h-full w-full" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/40 text-sm text-muted-foreground">
          지도를 불러오는 중…
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background p-6 text-center">
          <p className="text-sm font-medium text-destructive">지도를 불러오지 못했습니다.</p>
          <p className="max-w-md text-xs text-muted-foreground">{error.message}</p>
        </div>
      )}
    </div>
  )
}

/** 마커를 지도에서 떼어낸다. 배열을 비우는 것만으로는 지워지지 않는다. */
function clearMarkers(markers: KakaoMarker[]) {
  for (const marker of markers) {
    marker.setMap(null)
  }
}

/** 말풍선은 HTML 문자열이므로 카페 이름을 이스케이프한다. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
