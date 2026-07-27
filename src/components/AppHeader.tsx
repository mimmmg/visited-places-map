import { useRef } from 'react'
import { LogIn, LogOut, MapPin, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AppHeaderProps {
  /** 엑셀 파일 선택 시 호출. (PRD F-1.1) */
  onFileSelected?: (file: File) => void
  /** 로그인. 업로드한 목록이 사라지지 않게 모달 권장 (PRD §6.0, R-8) */
  onLoginClick?: () => void
  /** 로그아웃. (PRD F-4.3) */
  onLogoutClick?: () => void
  /** 로그인한 사용자 이메일. null 이면 비로그인. */
  userEmail?: string | null
  /**
   * 세션 복원 중. 이 동안은 로그인/로그아웃 버튼을 확정해 보여주지 않는다 —
   * 로그인 상태인데 "로그인" 버튼이 깜빡이는 것을 막는다. (CLAUDE.md 흔한 실수)
   */
  authLoading?: boolean
  uploadDisabled?: boolean
}

/** 헤더: 제목 + 엑셀 업로드 + 로그인/로그아웃. PRD §6.1. */
export function AppHeader({
  onFileSelected,
  onLoginClick,
  onLogoutClick,
  userEmail = null,
  authLoading = false,
  uploadDisabled,
}: AppHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <MapPin className="h-5 w-5 shrink-0" aria-hidden />
          내 방문 지도
        </h1>

        <div className="ml-auto flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onFileSelected?.(file)
              // 같은 파일을 다시 선택해도 change 가 발생하도록 값을 비운다.
              event.target.value = ''
            }}
          />

          <Button
            variant="outline"
            size="sm"
            disabled={uploadDisabled}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" aria-hidden />
            엑셀 업로드
          </Button>

          {authLoading ? (
            // 자리를 미리 잡아 둔다. 버튼이 나중에 끼어들며 레이아웃이 흔들리지 않게.
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted" aria-hidden />
          ) : userEmail ? (
            <div className="flex items-center gap-2">
              <span
                className="max-w-[10rem] truncate text-xs text-muted-foreground"
                title={userEmail}
              >
                {userEmail}
              </span>
              <Button variant="outline" size="sm" onClick={onLogoutClick}>
                <LogOut className="h-4 w-4" aria-hidden />
                로그아웃
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={onLoginClick}>
              <LogIn className="h-4 w-4" aria-hidden />
              로그인
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
