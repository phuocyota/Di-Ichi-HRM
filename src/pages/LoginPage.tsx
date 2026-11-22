import { useState, type FormEvent } from 'react'
import { loginStaff } from '../services/workShifts.ts'
import { saveSession, type HrmSession } from '../services/session.ts'

export default function LoginPage({ onLogin }: { onLogin: (session: HrmSession) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session = await loginStaff(email.trim(), password)
      saveSession(session)
      onLogin(session)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Đăng nhập thất bại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit}>
        <h1>Di-Ichi HRM</h1>
        <p className="muted">Đăng nhập bằng tài khoản nhân sự để phân lịch làm việc.</p>
        <label>
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Mật khẩu
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </main>
  )
}
