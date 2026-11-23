import type { AssignItem, EmployeeType, WorkAssignment } from '../services/workShifts.ts'

/** Ngày dạng `YYYY-MM-DD` theo lịch, không phụ thuộc múi giờ máy. */
const parse = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const format = (value: Date) => value.toISOString().slice(0, 10)

export function addDays(date: string, days: number) {
  const value = parse(date)
  value.setUTCDate(value.getUTCDate() + days)
  return format(value)
}

/** Thứ Hai của tuần chứa `date`. */
export function weekStart(date: string) {
  const day = parse(date).getUTCDay()
  return addDays(date, day === 0 ? -6 : 1 - day)
}

/** Hôm nay theo giờ Việt Nam. */
export function todayVn(now = Date.now()) {
  return new Date(now + 7 * 3600_000).toISOString().slice(0, 10)
}

export const weekDays = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i))

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
export const weekdayLabel = (date: string) => WEEKDAY[parse(date).getUTCDay()]
export const shortDate = (date: string) => date.slice(8, 10) + '/' + date.slice(5, 7)

export const workSearchText = (value: string) =>
  value.trim().toLocaleLowerCase('vi').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd')

export const timeToMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

/** Mặc định hiển thị 07:00–23:00 như CRM, mở rộng khi có ca ngoài khung giờ. */
export function workTimeRange(items: { start: string; end: string }[]) {
  const anchor = 7 * 60
  let start = anchor
  let end = 23 * 60
  for (const item of items) {
    const from = timeToMinutes(item.start)
    const to = timeToMinutes(item.end)
    if (to < from) return { start: 0, end: 24 * 60 }
    start = Math.min(start, anchor + Math.floor((from - anchor) / 120) * 120)
    end = Math.max(end, anchor + Math.ceil((to - anchor) / 120) * 120)
  }
  return { start: Math.max(0, start), end: Math.min(24 * 60, end) }
}

/**
 * Tạo danh sách phân ca cho nhiều nhân viên × nhiều ngày, bỏ các lịch đã tồn tại
 * (cùng người, ngày, ca) để không gửi trùng lên máy chủ.
 */
export function buildAssignments(input: {
  personIds: string[]
  dates: string[]
  shiftId: string
  employeeType: EmployeeType
  existing: WorkAssignment[]
}): AssignItem[] {
  const taken = new Set(
    input.existing
      .filter((item) => item.kind === 'employee')
      .map((item) => `${item.personId}|${item.date}|${item.shiftId}`),
  )
  return input.personIds.flatMap((personId) =>
    input.dates
      .filter((date) => !taken.has(`${personId}|${date}|${input.shiftId}`))
      .map((date) => ({ personId, date, shiftId: input.shiftId, employeeType: input.employeeType })),
  )
}
