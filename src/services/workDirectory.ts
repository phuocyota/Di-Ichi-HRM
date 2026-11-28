import { request } from './api.ts'

export type WorkDirectoryKind = 'students' | 'teachers'

export type WorkDirectoryPerson = {
  id: string
  code: string
  name: string
  status: string
  /** Chỉ có khi tài khoản được quản lý giáo viên (`canManage`). */
  email?: string | null
  phone?: string | null
  specialtyId?: string | null
  specialty?: { id: string; name: string } | null
}

export type WorkDirectoryPage = {
  page: number
  size: number
  total: number
  data: WorkDirectoryPerson[]
  /** Danh sách giáo viên: được thêm/sửa/cho nghỉ việc giáo viên. */
  canManage?: boolean
  canReadClassSchedules?: boolean
}

const base = (branchId: string) => `/work-shifts/branches/${encodeURIComponent(branchId)}`

export function getWorkDirectory(
  branchId: string,
  kind: WorkDirectoryKind,
  {
    page,
    size,
    search,
    status,
  }: {
    page: number
    size: number
    search: string
    status: string
  },
) {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  return request<WorkDirectoryPage>('GET', `${base(branchId)}/directory/${kind}?${params}`)
}

export type WorkSpecialty = { id: string; code: string; name: string; status: string }

export type WorkTeacherInput = {
  code: string
  name: string
  email: string
  phone?: string
  specialtyId?: string | null
}

export type WorkCredentials = { email: string; password: string }

export const getWorkSpecialties = (branchId: string) =>
  request<WorkSpecialty[]>('GET', `${base(branchId)}/specialties`)

export const createWorkTeacher = (branchId: string, teacher: WorkTeacherInput) =>
  request<{ id: string; code: string; name: string; credentials: WorkCredentials }>(
    'POST',
    `${base(branchId)}/teachers`,
    teacher,
  )

export const updateWorkTeacher = (branchId: string, id: string, teacher: Omit<WorkTeacherInput, 'email'> & { email?: string }) =>
  request<{ id: string; code: string; name: string }>('PATCH', `${base(branchId)}/teachers/${encodeURIComponent(id)}`, teacher)

/** Cho nghỉ việc: khóa tài khoản, giữ lịch sử. Còn buổi dạy sắp tới thì máy chủ trả 409. */
export const deactivateWorkTeacher = (branchId: string, id: string) =>
  request<{ id: string; code: string; name: string }>('DELETE', `${base(branchId)}/teachers/${encodeURIComponent(id)}`)
