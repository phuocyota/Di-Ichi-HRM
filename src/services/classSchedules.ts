import { request } from './api.ts'

export type ClassScheduleItem = {
  id: string
  startAt: string
  endAt: string
  status: string
  class: { id: string; code: string; name: string } | null
  teacher: { id: string; code: string; name: string } | null
  room: { id: string; name: string } | null
}

/** Lịch học của chi nhánh theo khoảng ngày YYYY-MM-DD (giờ Việt Nam, tối đa 42 ngày); HRM chỉ xem. */
export const getClassSchedules = (branchId: string, from: string, to: string) =>
  request<{ branchId: string; from: string; to: string; readOnly: boolean; schedules: ClassScheduleItem[] }>(
    'GET',
    `/work-shifts/branches/${encodeURIComponent(branchId)}/class-schedules?${new URLSearchParams({ from, to })}`,
  )
