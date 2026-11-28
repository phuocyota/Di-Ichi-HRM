import { useEffect, useState } from 'react'
import { addDays, shortDate, todayVn, weekDays, weekStart, weekdayLabel } from '../lib/schedule.ts'
import { ApiError } from '../services/api.ts'
import { getClassSchedules, type ClassScheduleItem } from '../services/classSchedules.ts'

const statusLabels: Record<string, string> = {
  active: 'Đang diễn ra',
  upcoming: 'Sắp diễn ra',
  checked: 'Đã điểm danh',
  conflict: 'Trùng lịch',
  cancelled: 'Đã hủy',
  makeup: 'Học bù',
}

const vnTime = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false })
const vnDay = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10)

type Result = { key: string; schedules?: ClassScheduleItem[]; error?: string }

/** Lịch học theo tuần của chi nhánh, chỉ xem. Thêm/sửa/hủy buổi học thực hiện ở CRM admin. */
export default function ClassSchedulePanel({ branchId, branchName, revision }: {
  branchId: string
  branchName?: string
  revision: number
}) {
  const [week, setWeek] = useState(() => weekStart(todayVn()))
  const [teacherId, setTeacherId] = useState('')
  const [result, setResult] = useState<Result>()
  const days = weekDays(week)
  const end = days[6]
  const key = `${branchId}:${week}:${revision}`
  const current = result?.key === key ? result : undefined

  useEffect(() => {
    let active = true
    void getClassSchedules(branchId, week, end).then(
      (data) => { if (active) setResult({ key, schedules: data.schedules }) },
      (cause: unknown) => {
        if (active) setResult({
          key,
          error: cause instanceof ApiError && cause.status === 403
            ? 'Tài khoản chưa được cấp quyền xem lịch học.'
            : cause instanceof Error ? cause.message : 'Không tải được lịch học.',
        })
      },
    )
    return () => { active = false }
  }, [branchId, end, key, week])

  const schedules = current?.schedules ?? []
  const teachers = [...new Map(schedules.flatMap((item) => item.teacher ? [[item.teacher.id, item.teacher]] : [])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  const visible = schedules.filter((item) => !teacherId || item.teacher?.id === teacherId)
  const period = `${shortDate(week)} – ${shortDate(end)}/${end.slice(0, 4)}`

  return (
    <section className="hrm-panel" aria-labelledby="hrm-classes-title">
      <header className="hrm-panel-heading">
        <div>
          <h2 id="hrm-classes-title">Lịch học {branchName && `· ${branchName}`}</h2>
          <p>Chỉ xem. Muốn thêm, sửa hoặc hủy buổi học, vui lòng liên hệ admin chi nhánh trên CRM.</p>
        </div>
        <span className="hrm-period" role="status">{current?.schedules ? `${visible.length} buổi học` : period}</span>
      </header>
      <div className="hrm-filters">
        <div className="hrm-week-nav">
          <button type="button" aria-label="Tuần trước" onClick={() => setWeek(addDays(week, -7))}>‹</button>
          <label className="hrm-week-picker">
            <span aria-hidden="true">{period}</span>
            <input aria-label="Chọn tuần" type="date" value={week} onChange={(event) => {
              if (event.target.value) setWeek(weekStart(event.target.value))
            }} />
          </label>
          <button type="button" aria-label="Tuần sau" onClick={() => setWeek(addDays(week, 7))}>›</button>
          <button type="button" onClick={() => setWeek(weekStart(todayVn()))}>Tuần này</button>
        </div>
        <select aria-label="Lọc theo giáo viên" value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
          <option value="">Tất cả giáo viên</option>
          {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
        </select>
      </div>
      {!current && <p className="hrm-panel-message" role="status">Đang tải lịch học…</p>}
      {current?.error && <p className="hrm-panel-message hrm-message-error" role="alert">{current.error}</p>}
      {current?.schedules && (
        <div className="hrm-directory-scroll" role="region" aria-label="Bảng lịch học" tabIndex={0}>
          <table className="hrm-directory-table">
            <thead>
              <tr>
                <th scope="col">Ngày</th><th scope="col">Giờ</th><th scope="col">Lớp</th>
                <th scope="col">Giáo viên</th><th scope="col">Phòng</th><th scope="col">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {days.flatMap((day) => visible
                .filter((item) => vnDay(item.startAt) === day)
                .map((item, index) => (
                  <tr key={item.id} data-status={item.status}>
                    <td>{index === 0 ? `${weekdayLabel(day)} ${shortDate(day)}` : ''}</td>
                    <td className="hrm-directory-code">{vnTime.format(new Date(item.startAt))}–{vnTime.format(new Date(item.endAt))}</td>
                    <th scope="row">{item.class ? `${item.class.name} (${item.class.code})` : '—'}</th>
                    <td>{item.teacher?.name ?? '—'}</td>
                    <td>{item.room?.name ?? '—'}</td>
                    <td>{statusLabels[item.status] ?? item.status}</td>
                  </tr>
                )))}
              {!visible.length && (
                <tr><td colSpan={6} className="hrm-directory-empty">
                  {teacherId ? 'Giáo viên này không có buổi học trong tuần.' : 'Chi nhánh không có buổi học trong tuần.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
