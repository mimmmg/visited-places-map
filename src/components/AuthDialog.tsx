import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'

/** Supabase Auth 기본값. UI 안내와 실제 제약을 같은 값으로 맞춘다. */
const MIN_PASSWORD_LENGTH = 6

type Mode = 'signin' | 'signup'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 열릴 때 처음 보여줄 화면. 기본은 로그인. */
  initialMode?: Mode
}

/**
 * 로그인 / 회원가입 모달. PRD F-4.1, F-4.2.
 *
 * 페이지 이동(`/login`)이 아니라 모달인 이유: 업로드한 목록과 지도 상태는 메모리에만 있어서
 * 화면을 옮기면 사라진다. (PRD §6.0, R-8)
 */
export function AuthDialog({ open, onOpenChange, initialMode = 'signin' }: AuthDialogProps) {
  const { signIn, signUp, configError } = useAuth()

  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // 닫았다 다시 열면 이전 입력·오류가 남지 않게 초기화한다.
  useEffect(() => {
    if (!open) return
    setMode(initialMode)
    setEmail('')
    setPassword('')
    setError(null)
    setNotice(null)
    setSubmitting(false)
  }, [open, initialMode])

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return

    setError(null)
    setNotice(null)

    // 서버에 보내기 전에 거를 수 있는 것만 먼저 거른다. 실제 검증은 Supabase 가 한다.
    if (email.trim() === '') {
      setError('이메일을 입력해 주세요.')
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`)
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        onOpenChange(false)
        return
      }

      const { needsEmailConfirmation } = await signUp(email, password)
      if (needsEmailConfirmation) {
        // 확인 메일 설정이 켜져 있는 경우. 가입은 됐지만 아직 로그인 상태가 아니다.
        setNotice(`${email.trim()} 으로 인증 메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료해 주세요.`)
        setPassword('')
        return
      }
      // 가입과 동시에 로그인된다 (PRD §12-B 전제). 세션 변경은 AuthProvider 가 받는다.
      onOpenChange(false)
    } catch (caught) {
      // 실패해도 입력한 이메일은 남긴다. 다시 치게 만들지 않는다.
      setError(caught instanceof Error ? caught.message : '처리에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const isSignUp = mode === 'signup'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="pr-6">{isSignUp ? '회원가입' : '로그인'}</DialogTitle>
          <DialogDescription>
            {isSignUp
              ? '이메일과 비밀번호로 가입합니다.'
              : '소감을 저장하려면 로그인이 필요합니다.'}
          </DialogDescription>
        </DialogHeader>

        {configError ? (
          <p className="text-sm text-destructive">{configError}</p>
        ) : (
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-1.5">
              <Label htmlFor="auth-email">이메일</Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                disabled={submitting}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="auth-password">비밀번호</Label>
              <Input
                id="auth-password"
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                placeholder={`${MIN_PASSWORD_LENGTH}자 이상`}
                value={password}
                disabled={submitting}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
            {notice && <p className="text-xs text-muted-foreground">{notice}</p>}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? '처리 중…' : isSignUp ? '가입하기' : '로그인'}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              {isSignUp ? '이미 계정이 있나요?' : '아직 계정이 없나요?'}{' '}
              <button
                type="button"
                className="font-medium underline underline-offset-2 hover:text-foreground"
                onClick={() => switchMode(isSignUp ? 'signin' : 'signup')}
              >
                {isSignUp ? '로그인' : '회원가입'}
              </button>
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
