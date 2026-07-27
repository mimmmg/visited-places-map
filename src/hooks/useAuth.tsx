/**
 * 인증 상태 + 로그인/회원가입/로그아웃. PRD F-4.1 ~ F-4.4.
 *
 * 세션은 앱 어디서나 같은 값을 봐야 해서 Context 로 한 번만 구독한다.
 * 컴포넌트마다 `getSession()` 을 부르면 화면 사이에 로그인 상태가 어긋난다.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'

export interface SignUpResult {
  /** 확인 메일이 켜져 있으면 true — 가입은 됐지만 아직 로그인 상태가 아니다. (PRD §12-B) */
  needsEmailConfirmation: boolean
}

export interface AuthContextValue {
  user: User | null
  session: Session | null
  /**
   * 저장된 세션을 복원하는 중이면 true.
   *
   * `getSession()` 이 비동기라서 이 사이에는 로그인 상태여도 잠깐 비로그인으로 보인다.
   * 이때 "기록 없음"을 띄우거나 로그인을 요구하면 버그다. (CLAUDE.md 흔한 실수)
   */
  loading: boolean
  /** Supabase 환경 변수 누락 등으로 로그인 기능 자체를 쓸 수 없을 때의 사유. */
  configError: string | null
  signUp: (email: string, password: string) => Promise<SignUpResult>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    // StrictMode 는 이 effect 를 두 번 돌린다. 구독은 cleanup 에서 해제되고
    // 클라이언트는 싱글턴이라 중복 구독이 남지 않는다.
    let active = true

    let supabase
    try {
      supabase = getSupabase()
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : String(error))
      setLoading(false)
      return
    }

    // 먼저 구독한 뒤 현재 세션을 읽는다. 순서가 반대면 그 사이에 일어난
    // 로그인/로그아웃을 놓친다.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setLoading(false)
    })

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
    })
    if (error) throw new Error(toKoreanAuthError(error.message))

    // 확인 메일이 꺼져 있으면 가입과 동시에 세션이 온다 (PRD §12-B 전제).
    // 켜져 있으면 user 만 오고 session 은 null 이므로 안내가 필요하다.
    return { needsEmailConfirmation: data.session === null }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw new Error(toKoreanAuthError(error.message))
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await getSupabase().auth.signOut()
    if (error) throw new Error(toKoreanAuthError(error.message))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      configError,
      signUp,
      signIn,
      signOut,
    }),
    [session, loading, configError, signUp, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth 는 <AuthProvider> 안에서만 쓸 수 있습니다.')
  return value
}

/**
 * Supabase 인증 오류 메시지를 사용자에게 보여줄 한국어로 옮긴다.
 * 매칭되지 않으면 원문을 그대로 둔다 — 삼켜서 원인을 잃는 것보다 낫다.
 */
function toKoreanAuthError(message: string): string {
  const table: Array<[RegExp, string]> = [
    [/invalid login credentials/i, '이메일 또는 비밀번호가 올바르지 않습니다.'],
    [/user already registered|already been registered/i, '이미 가입된 이메일입니다.'],
    [/password should be at least (\d+)/i, '비밀번호는 6자 이상이어야 합니다.'],
    [/email not confirmed/i, '이메일 인증이 완료되지 않았습니다. 받은 메일함을 확인해 주세요.'],
    [/unable to validate email address|invalid format/i, '이메일 형식이 올바르지 않습니다.'],
    [/email rate limit exceeded|over_email_send_rate_limit/i, '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'],
    [/failed to fetch|network/i, '네트워크 오류입니다. 연결을 확인한 뒤 다시 시도해 주세요.'],
  ]

  for (const [pattern, korean] of table) {
    if (pattern.test(message)) return korean
  }
  return message
}
