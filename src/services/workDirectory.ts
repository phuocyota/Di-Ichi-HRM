import { request } from './api.ts'

export type WorkDirectoryKind = 'students' | 'teachers'

export type WorkDirectoryPage = {
  page: number
  size: number
  total: number
  data: { id: string; code: string; name: string; status: string }[]
}

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
  return request<WorkDirectoryPage>(
    'GET',
    `/work-shifts/branches/${encodeURIComponent(branchId)}/directory/${kind}?${params}`,
  )
}
