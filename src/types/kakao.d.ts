/**
 * 카카오맵 SDK 최소 타입 선언.
 * 공식 타입 패키지를 쓰지 않으므로 필요한 만큼만 느슨하게 선언한다.
 */

export interface KakaoLatLng {
  getLat(): number
  getLng(): number
}

export interface KakaoMapInstance {
  setCenter(latlng: KakaoLatLng): void
  /** 중심을 부드럽게 옮긴다. 거리가 멀면 SDK 가 알아서 즉시 이동으로 처리한다. */
  panTo(latlng: KakaoLatLng): void
  getCenter(): KakaoLatLng
  setLevel(level: number): void
  getLevel(): number
  relayout(): void
  setBounds(bounds: KakaoLatLngBounds): void
}

export interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void
  isEmpty(): boolean
}

export interface KakaoMarker {
  setMap(map: KakaoMapInstance | null): void
  getPosition(): KakaoLatLng
}

/** `kakao.maps.Size`. 마커 이미지의 픽셀 크기. */
export interface KakaoSize {
  equals(other: KakaoSize): boolean
}

/** `kakao.maps.Point`. 마커 이미지 안에서 좌표에 붙일 기준점. */
export interface KakaoPoint {
  equals(other: KakaoPoint): boolean
}

/**
 * `kakao.maps.MarkerImage`. 만들어서 Marker 옵션에 넘기기만 하고 속성을 읽지 않는다.
 * `__markerImage` 는 타입 구분용 표식이며 런타임에는 존재하지 않는다.
 */
export interface KakaoMarkerImage {
  readonly __markerImage?: never
}

export interface KakaoInfoWindow {
  open(map: KakaoMapInstance, marker: KakaoMarker): void
  close(): void
  setContent(content: string): void
}

/** 주소 검색 결과. `x` 는 경도, `y` 는 위도이며 문자열로 온다. */
export interface KakaoAddressResult {
  x: string
  y: string
  address_name: string
}

export interface KakaoPlaceResult {
  x: string
  y: string
  place_name: string
}

export interface KakaoServices {
  Geocoder: new () => {
    addressSearch(
      address: string,
      callback: (result: KakaoAddressResult[], status: string) => void,
    ): void
  }
  Places: new () => {
    keywordSearch(
      keyword: string,
      callback: (result: KakaoPlaceResult[], status: string) => void,
    ): void
  }
  Status: { OK: string; ZERO_RESULT: string; ERROR: string }
}

export interface KakaoMaps {
  /** `autoload=false` 로 불러온 뒤 이 안에서 초기화한다. */
  load(callback: () => void): void
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMapInstance
  LatLng: new (lat: number, lng: number) => KakaoLatLng
  LatLngBounds: new () => KakaoLatLngBounds
  Size: new (width: number, height: number) => KakaoSize
  Point: new (x: number, y: number) => KakaoPoint
  MarkerImage: new (
    src: string,
    size: KakaoSize,
    options?: { offset?: KakaoPoint; alt?: string },
  ) => KakaoMarkerImage
  Marker: new (options: {
    position: KakaoLatLng
    title?: string
    /** 없으면 SDK 기본 핀. 방문/미방문 구분에 쓴다. (PRD F-2.17) */
    image?: KakaoMarkerImage
  }) => KakaoMarker
  InfoWindow: new (options: { content: string; removable?: boolean }) => KakaoInfoWindow
  /** `libraries=services` 를 포함해야 존재한다. 없으면 주소 변환 불가. */
  services?: KakaoServices
  event: {
    addListener(target: object, type: string, handler: () => void): void
    removeListener(target: object, type: string, handler: () => void): void
  }
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps }
  }
}

export {}
