import { describe, expect, it } from 'vitest'
import type { WorkAssignment, WorkAttendance } from '../services/workShifts.ts'
import { attendanceRow, attendanceRows, formatVnClock, vnTime } from './attendance.ts'

const shift = (overrides: Partial<WorkAssignment> = {}): WorkAssignment => ({
  id: 'a1',
  kind: 'employee',
  personId: 'p1',
  branchId: 'b1',
  date: '2026-11-25',
  start: '08:00',
  end: '12:00',
  employeeType: 'sale',
  ...overrides,
})
const record = (checkIn: string | null, checkOut: string | null = null): WorkAttendance => ({
  assignmentId: 'a1',
  checkIn,
  checkOut,
  source: 'self',
})
const at = (time: string, date = '2026-11-25') => vnTime(date, time)
const iso = (time: string, date = '2026-11-25') => new Date(at(time, date)).toISOString()

describe('trạng thái chấm công', () => {
  it('chưa check-in: chưa đến ca, đang chờ, vắng', () => {
    expect(attendanceRow(shift(), null, at('07:30')).status).toBe('upcoming')
    expect(attendanceRow(shift(), null, at('09:00')).status).toBe('waiting')
    expect(attendanceRow(shift(), null, at('12:01')).status).toBe('absent')
  })

  it('đúng giờ, đi muộn và quên check-out', () => {
    expect(attendanceRow(shift(), record(iso('07:55')), at('09:00')).status).toBe('on-time')
    const late = attendanceRow(shift(), record(iso('08:17')), at('09:00'))
    expect([late.status, late.lateMinutes]).toEqual(['late', 17])
    expect(attendanceRow(shift(), record(iso('08:00')), at('13:00')).status).toBe('missing-checkout')
  })

  it('hoàn thành hoặc về sớm sau khi check-out', () => {
    expect(attendanceRow(shift(), record(iso('08:00'), iso('12:05')), at('13:00')).status).toBe('done')
    const early = attendanceRow(shift(), record(iso('08:00'), iso('11:30')), at('13:00'))
    expect([early.status, early.earlyMinutes]).toEqual(['early', 30])
  })

  it('ca qua đêm kết thúc vào ngày hôm sau', () => {
    const night = shift({ start: '22:00', end: '02:00' })
    const row = attendanceRow(night, record(iso('22:00'), iso('02:00', '2026-11-26')), at('03:00', '2026-11-26'))
    expect(row.status).toBe('done')
    expect(row.endsAt - row.startsAt).toBe(4 * 3600_000)
  })

  it('lọc theo chi nhánh và khoảng ngày, gồm mọi loại ca; mới nhất lên trước', () => {
    const items = [
      shift({ id: 'a1', date: '2026-11-24' }),
      shift({ id: 'a2', date: '2026-11-25' }),
      shift({ id: 'a3', date: '2026-11-25', employeeType: 'cskh' }),
      shift({ id: 'a4', date: '2026-11-25', branchId: 'b2' }),
      shift({ id: 'a5', date: '2026-11-20' }),
    ]
    const rows = attendanceRows(items, [{ ...record(iso('08:00')), assignmentId: 'a2' }], {
      branchId: 'b1', fromDate: '2026-11-24', toDate: '2026-11-25',
    }, at('09:00'))
    expect(rows.map((row) => row.assignment.id).sort()).toEqual(['a1', 'a2', 'a3'])
    expect(rows.at(-1)?.assignment.id).toBe('a1')
    expect(rows.find((row) => row.assignment.id === 'a2')?.record?.assignmentId).toBe('a2')
    expect(rows.find((row) => row.assignment.id === 'a3')?.record).toBeNull()
  })

  it('hiển thị giờ theo múi giờ Việt Nam', () => {
    expect(formatVnClock('2026-11-25T01:05:00.000Z')).toBe('08:05')
    expect(formatVnClock(null)).toBe('')
  })
})
