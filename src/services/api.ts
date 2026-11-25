import { clearSession, getSession } from './session.ts'

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:3000'

/** Lỗi API kèm mã HTTP để giao diện xử lý 401/403/409. */
export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Envelope<T> = { success?: boolean; message?: string | string[]; data?: T }

const messageOf = (body: unknown, fallback: string) => {
  const message = (body as Envelope<unknown> | null)?.message
  if (Array.isArray(message)) return message.join(', ')
  return typeof message === 'string' && message ? message : fallback
}

/** Gọi API backend, tự gắn Bearer token và bóc `{ success, message, data }`. */
export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getSession()?.accessToken
  let response: Response
  try {
    response = await fetch(BASE_URL + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ. Vui lòng thử lại.')
  }
  const payload = (await response.json().catch(() => null)) as Envelope<T> | null
  if (!response.ok) {
    if (response.status === 401 && token) {
      clearSession()
      window.dispatchEvent(new Event('hrm:logout'))
    }
    throw new ApiError(response.status, messageOf(payload, `Yêu cầu thất bại (${response.status}).`))
  }
  return (payload && 'data' in payload ? payload.data : payload) as T
}

/** Tải file nhị phân (ảnh) kèm Bearer token; lỗi được chuẩn hóa như `request`. */
export async function requestBlob(path: string): Promise<Blob> {
  const token = getSession()?.accessToken
  let response: Response
  try {
    response = await fetch(BASE_URL + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ. Vui lòng thử lại.')
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as Envelope<unknown> | null
    if (response.status === 401 && token) {
      clearSession()
      window.dispatchEvent(new Event('hrm:logout'))
    }
    throw new ApiError(response.status, messageOf(payload, `Yêu cầu thất bại (${response.status}).`))
  }
  return response.blob()
}
