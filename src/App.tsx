import { lazy, Suspense, useEffect, useState } from 'react'
import LoginPage from './pages/LoginPage.tsx'
import { clearSession, getSession, type HrmSession } from './services/session.ts'

const WorkSchedulePage = lazy(() => import('./pages/WorkSchedulePage.tsx'))

export default function App() {
  const [session, setSession] = useState<HrmSession | null>(getSession)

  useEffect(() => {
    // Token hết hạn / bị thu hồi (401) thì quay về màn đăng nhập.
    const logout = () => setSession(null)
    window.addEventListener('hrm:logout', logout)
    return () => window.removeEventListener('hrm:logout', logout)
  }, [])

  if (!session) return <LoginPage onLogin={setSession} />
  return (
    <Suspense fallback={<p role="status">Đang mở lịch làm việc…</p>}>
      <WorkSchedulePage
        key={session.userId}
        session={session}
        onLogout={() => {
          clearSession()
          setSession(null)
        }}
      />
    </Suspense>
  )
}
