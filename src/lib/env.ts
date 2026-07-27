/**
 * 환경 변수 읽기 + 검증. PRD §8.2.
 *
 * Vite 는 `VITE_` 접두사가 붙은 변수만 클라이언트에 노출한다.
 * 접근은 `import.meta.env` 로 한다 (`process.env` 아님).
 *
 * 값이 없을 때 조용히 undefined 로 넘어가면 "에러 없는 빈 지도"가 되어
 * 원인을 찾기 어렵다. 그래서 어떤 변수가 없는지 이름을 찍어 실패시킨다.
 */

function readRequired(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `환경 변수 ${name} 가 설정되지 않았습니다. .env.example 을 .env 로 복사한 뒤 값을 채워주세요.`,
    )
  }
  return value
}

/** 카카오맵 JavaScript 키. REST API 키가 아니다. */
export function readKakaoMapKey(): string {
  return readRequired('VITE_KAKAO_MAP_KEY', import.meta.env.VITE_KAKAO_MAP_KEY)
}

/** Supabase 프로젝트 URL. `https://<ref>.supabase.co` 형태. */
export function readSupabaseUrl(): string {
  return readRequired('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL)
}

/**
 * Supabase anon key. 브라우저에 노출되는 게 정상이다 —
 * 실제 권한 경계는 RLS 이지 이 키가 아니다. (PRD §8.2)
 * service_role 키는 절대 프론트에 두지 않는다.
 */
export function readSupabaseAnonKey(): string {
  return readRequired('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY)
}

/**
 * 앱 시작 시 한 번 호출해 누락을 조기에 알린다.
 *
 * 주의: 여기서 던진 예외는 앱 전체를 멈춘다. 지도·업로드는 비로그인으로도 동작해야 하므로
 * (PRD §6.0) Supabase 변수 누락은 여기서 실패시키지 않고, 로그인 기능만 비활성화한다.
 * `@/lib/supabase` 의 `getSupabase()` 가 호출 시점에 검증한다.
 */
export function assertRequiredEnv(): void {
  readKakaoMapKey()
}
