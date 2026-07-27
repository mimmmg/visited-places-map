/**
 * 방문 / 미방문 마커 아이콘. PRD F-2.17.
 *
 * **색만으로 구분하지 않는다** — 모양도 다르다. (PRD §9 접근성)
 *  - 방문   : 채워진 원 + 흰 체크
 *  - 미방문 : 속이 빈 핀
 * 색각 이상이 있어도 원/핀 실루엣으로 구분되고, 말풍선에도 텍스트로 한 번 더 적는다.
 *
 * 이미지는 외부 URL 없이 인라인 SVG data URI 다. 네트워크에 의존하지 않는다.
 * `MarkerImage` 객체는 종류마다 **한 번만** 만들어 재사용한다 —
 * 카페 500개마다 새로 만들면 그만큼 객체가 쌓인다.
 */

import type { KakaoMarkerImage } from '@/types/kakao'

/** 방문: 채워진 원 + 체크. 좌표에 원의 중심을 맞춘다. */
const VISITED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <circle cx="14" cy="14" r="11" fill="#047857" stroke="#ffffff" stroke-width="2"/>
  <path d="M8.8 14.4l3.6 3.6 6.8-7" fill="none" stroke="#ffffff" stroke-width="2.6"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

/** 미방문: 속이 빈 핀. 좌표에 핀 끝을 맞춘다. */
const UNVISITED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="34" viewBox="0 0 24 34">
  <path d="M12 1.6c-5.3 0-9.6 4.2-9.6 9.5 0 7 8.3 20.1 9.6 21.7 1.3-1.6 9.6-14.7 9.6-21.7 0-5.3-4.3-9.5-9.6-9.5z"
        fill="#ffffff" stroke="#475569" stroke-width="2.2" stroke-linejoin="round"/>
  <circle cx="12" cy="11" r="3.3" fill="none" stroke="#475569" stroke-width="2.2"/>
</svg>`

function toDataUri(svg: string): string {
  // `#` 등이 들어 있어 인코딩 없이 넣으면 URI 가 잘린다.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export interface MarkerImages {
  visited: KakaoMarkerImage
  unvisited: KakaoMarkerImage
}

/** 모듈 레벨 캐시. 두 개만 만들어 모든 마커가 공유한다. */
let cached: MarkerImages | null = null

/**
 * 마커 이미지를 가져온다. SDK 로드가 끝난 뒤에만 호출할 수 있다
 * (`kakao.maps.MarkerImage` 생성자가 필요하므로).
 */
export function getMarkerImages(): MarkerImages {
  if (cached) return cached

  const kakao = window.kakao
  if (!kakao) {
    throw new Error('카카오맵 SDK 로드 전에 마커 이미지를 만들 수 없습니다.')
  }

  cached = {
    visited: new kakao.maps.MarkerImage(
      toDataUri(VISITED_SVG),
      new kakao.maps.Size(28, 28),
      // 원의 중심이 좌표에 오도록.
      { offset: new kakao.maps.Point(14, 14), alt: '방문한 카페' },
    ),
    unvisited: new kakao.maps.MarkerImage(
      toDataUri(UNVISITED_SVG),
      new kakao.maps.Size(24, 34),
      // 핀은 뾰족한 끝이 좌표를 가리켜야 한다.
      { offset: new kakao.maps.Point(12, 33), alt: '아직 방문하지 않은 카페' },
    ),
  }

  return cached
}
