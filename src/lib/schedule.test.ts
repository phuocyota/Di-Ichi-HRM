import { describe, expect, it } from 'vitest'
import { addDays, buildAssignments, cellAssignments, todayVn, weekDays, weekStart, weekdayLabel } from './schedule.ts'
import type { WorkAssignment } from '../services/workShifts.ts'

describe('tuần làm việc', () => {
  it('lấy thứ Hai của tuần, kể cả khi đang là Chủ nhật', () => {
    expect(weekStart('2026-11-22')).toBe('2026-11-16') // Chủ nhật
    expect(weekStart('2026-11-23')).toBe('2026-11-23') // Thứ Hai
    expect(weekStart('2026-11-26')).toBe('2026-11-23')
  })
  it('cộng ngày qua tháng/năm và trả 7 ngày', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(weekDays('2026-11-23')).toHaveLength(7)
    expect(weekdayLabel('2026-11-23')).toBe('T2')
  })
  it('hôm nay theo giờ Việt Nam', () => {
    expect(todayVn(Date.parse('2026-11-22T18:00:00Z'))).toBe('2026-11-23')
  })
})

describe('phân ca', () => {
  const existing: WorkAssignment[] = [
    { id: 'a', kind: 'employee', personId: 'p1', branchId: 'b', date: '2026-11-23', start: '07:30', end: '13:30', shiftId: 's1', personName: 'Bình' },
    { id: 'b', kind: 'employee', personId: 'p2', branchId: 'b', date: '2026-11-23', start: '07:30', end: '13:30', shiftId: 's1', personName: 'An' },
    { id: 'c', kind: 'teacher', personId: 'p3', branchId: 'b', date: '2026-11-23', start: '07:30', end: '13:30', shiftId: 's1' },
  ]
  it('bỏ lịch trùng người/ngày/ca khi phân nhiều ngày', () => {
    expect(
      buildAssignments({ personIds: ['p1'], dates: ['2026-11-23', '2026-11-24'], shiftId: 's1', employeeType: 'sale', existing }),
    ).toEqual([{ personId: 'p1', date: '2026-11-24', shiftId: 's1', employeeType: 'sale' }])
  })
  it('chỉ lấy lịch nhân viên của ô, sắp theo tên', () => {
    expect(cellAssignments(existing, 's1', '2026-11-23').map((item) => item.id)).toEqual(['b', 'a'])
  })
})
