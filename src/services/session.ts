/** Phiên đăng nhập HRM (token từ `POST /auth/staff/login`). */
export type HrmSession = {
  accessToken: string
  userId: string
  userType: string
  branchId: string
  fullName: string
}

const SESSION_KEY = 'diIchiHrmSession'

export function getSession(): HrmSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<HrmSession>
    return value.accessToken && value.branchId ? (value as HrmSession) : null
  } catch {
    return null
  }
}

export function saveSession(session: HrmSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
