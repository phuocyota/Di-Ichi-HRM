import type { WorkAssignment, WorkAttendance } from '../services/workShifts.ts'

export type AttendanceStatus =
  | 'upcoming'
  | 'waiting'
  | 'absent'
  | 'on-time'
  | 'late'
  | 'missing-checkout'
  | 'done'
  | 'early'

export type AttendanceRow = {
  assignment: WorkAssignment
  record: WorkAttendance | null
  /** Mốc bắt đầu/kết thúc ca (epoch ms, giờ Việt Nam); ca qua đêm kết thúc ngày hôm sau. */
  startsAt: number
  endsAt: number
  /** Phút check-in sau giờ bắt đầu / check-out trước giờ kết thúc (0 nếu không có). */
  lateMinutes: number
  earlyMinutes: number
  status: AttendanceStatus
}

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  upcoming: 'Chưa đến ca',
  waiting: 'Chưa check-in',
  absent: 'Vắng',
  'on-time': 'Đúng giờ',
  late: 'Đi muộn',
  'missing-checkout': 'Chưa check-out',
  done: 'Hoàn thành',
  early: 'Về sớm',
}

const MINUTE = 60_000

/** `date` (YYYY-MM-DD) + `time` (HH:mm) theo giờ Việt Nam → epoch ms. */
export const vnTime = (date: string, time: string) => Date.parse(`${date}T${time.slice(0, 5)}:00+07:00`)

/** Giờ HH:mm theo giờ Việt Nam của một mốc ISO. */
export const formatVnClock = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .format(new Date(value))
    : ''

export function attendanceRow(assignment: WorkAssignment, record: WorkAttendance | null, now: number): AttendanceRow {
  const startsAt = vnTime(assignment.date, assignment.start)
  let endsAt = vnTime(assignment.date, assignment.end)
  if (endsAt <= startsAt) endsAt += 24 * 60 * MINUTE
  const checkIn = record?.checkIn ? Date.parse(record.checkIn) : null
  const checkOut = record?.checkOut ? Date.parse(record.checkOut) : null
  const lateMinutes = checkIn !== null ? Math.max(0, Math.floor((checkIn - startsAt) / MINUTE)) : 0
  const earlyMinutes = checkOut !== null ? Math.max(0, Math.ceil((endsAt - checkOut) / MINUTE)) : 0

  let status: AttendanceStatus
  if (checkIn === null) status = now < startsAt ? 'upcoming' : now <= endsAt ? 'waiting' : 'absent'
  else if (checkOut === null) status = now > endsAt ? 'missing-checkout' : lateMinutes ? 'late' : 'on-time'
  else if (earlyMinutes) status = 'early'
  else status = lateMinutes ? 'late' : 'done'

  return { assignment, record, startsAt, endsAt, lateMinutes, earlyMinutes, status }
}

export type AttendanceFilter = {
  branchId: string
  fromDate: string
  toDate: string
  /** Trả true nếu nhân viên khớp ô tìm kiếm. */
  matchesPerson?: (personId: string) => boolean
}

/** Ca của nhân viên (mọi loại ca) trong khoảng ngày kèm bản ghi chấm công, mới nhất lên trước. */
export function attendanceRows(
  assignments: WorkAssignment[],
  attendance: WorkAttendance[],
  filter: AttendanceFilter,
  now: number,
): AttendanceRow[] {
  const records = new Map(attendance.map((item) => [item.assignmentId, item]))
  return assignments
    .filter((item) =>
      item.kind === 'employee' &&
      item.branchId === filter.branchId &&
      item.date >= filter.fromDate &&
      item.date <= filter.toDate &&
      (!filter.matchesPerson || filter.matchesPerson(item.personId)))
    .map((item) => attendanceRow(item, records.get(item.id) ?? null, now))
    .sort((a, b) => b.startsAt - a.startsAt)
}
