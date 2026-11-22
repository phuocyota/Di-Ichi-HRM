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

/** Lịch nhân viên theo ô (ca × ngày). */
export function cellAssignments(assignments: WorkAssignment[], shiftId: string, date: string) {
  return assignments
    .filter((item) => item.kind === 'employee' && item.shiftId === shiftId && item.date === date)
    .sort((a, b) => (a.personName || '').localeCompare(b.personName || '', 'vi'))
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
