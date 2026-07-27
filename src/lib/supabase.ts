/**
 * Supabase 클라이언트. PRD §8.2.
 *
 * **한 번만 생성한다.** 컴포넌트 안에서 `createClient` 를 부르면 렌더마다 새 클라이언트가
 * 만들어지고, 그때마다 세션 구독·토큰 갱신 타이머가 중복된다. (CLAUDE.md 흔한 실수)
 *
 * 모듈 최상단에서 즉시 만들지 않고 첫 호출 때 만드는 이유:
 * `.env` 에 Supabase 값이 없을 때 import 단계에서 던지면 앱 전체가 흰 화면이 된다.
 * 지도·업로드는 로그인 없이도 동작해야 하므로 (PRD §6.0), 설정 누락은
 * "로그인 기능만 꺼짐"으로 좁힌다.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readSupabaseAnonKey, readSupabaseUrl } from '@/lib/env'

/**
 * 로그인이 필요하거나 세션이 만료됐을 때 던진다.
 *
 * 일반 오류와 구분하는 이유: 화면에서 빨간 에러 문구 대신 "다시 로그인해 주세요" 안내와
 * 로그인 모달을 띄워야 하기 때문이다. 세션 만료는 사용자 잘못이 아니다.
 */
export class AuthRequiredError extends Error {
  constructor(message = '로그인이 풀렸습니다. 다시 로그인한 뒤 저장해 주세요.') {
    super(message)
    this.name = 'AuthRequiredError'
  }
}

let client: SupabaseClient | null = null

/** 싱글턴 클라이언트. 환경 변수가 없으면 던진다. */
export function getSupabase(): SupabaseClient {
  if (client) return client

  client = createClient(readSupabaseUrl(), readSupabaseAnonKey(), {
    auth: {
      // 새로고침·재접속해도 로그인 상태를 유지한다. (PRD F-4.4)
      persistSession: true,
      autoRefreshToken: true,
      // 이메일 링크/OAuth 콜백을 쓰지 않으므로 URL 파싱은 하지 않는다.
      // 비밀번호 재설정(F-4.8)을 붙일 때 다시 켠다.
      detectSessionInUrl: false,
    },
  })

  return client
}

/**
 * 현재 로그인한 사용자 id. 비로그인이거나 Supabase 설정이 없으면 `null`.
 *
 * 클라이언트가 보낸 user_id 를 믿지 않고 항상 세션에서 가져온다.
 * 서버 측에서도 RLS 가 `auth.uid()` 로 한 번 더 강제한다. (PRD §7.3)
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getSession()
    return data.session?.user.id ?? null
  } catch {
    // 환경 변수 누락 = 로그인 불가 = 비로그인과 같게 취급한다.
    return null
  }
}

/** 로그인이 필요한 경로에서 사용. 비로그인이면 던진다. */
export async function requireCurrentUserId(): Promise<string> {
  const userId = await getCurrentUserId()
  if (!userId) throw new AuthRequiredError()
  return userId
}
