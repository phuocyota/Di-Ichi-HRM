/** Phiên đăng nhập HRM (token từ `POST /auth/staff/login`). */
export type HrmSession = {
  accessToken: string
  userId: string
  userType: string
  /** Cơ sở của nhân sự; `null` với tài khoản SUPER_HRM (không gắn cơ sở, phân lịch mọi cơ sở). */
  branchId: string | null
  fullName: string
}

/** Loại tài khoản phân lịch toàn hệ thống: chỉ có tài khoản, không gắn nhân sự/cơ sở. */
export const SUPER_HRM = 'SUPER_HRM'

const SESSION_KEY = 'diIchiHrmSession'

export function getSession(): HrmSession | null {
  try {
    // Ưu tiên phiên tạm (sessionStorage) rồi mới tới phiên "ghi nhớ đăng nhập" (localStorage).
    const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<HrmSession>
    return value.accessToken && (value.branchId || value.userType === SUPER_HRM) ? (value as HrmSession) : null
  } catch {
    return null
  }
}

/** `remember = true` lưu vào localStorage; ngược lại chỉ giữ trong tab hiện tại (sessionStorage). */
export function saveSession(session: HrmSession, remember = true) {
  clearSession()
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
}
