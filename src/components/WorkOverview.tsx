import { ArrowRight, CalendarDays, CalendarOff, Clock3, Users } from 'lucide-react'
import { shortDate, weekDays, weekStart, weekdayLabel } from '../lib/schedule.ts'
import { EMPLOYEE_TYPE_LABEL, type BranchWorkOverview, type WorkAssignment } from '../services/workShifts.ts'
import './WorkOverview.css'

type Props = {
  today: string
  results: BranchWorkOverview[]
  onOpenWeek: () => void
  onDetail: (assignment: WorkAssignment) => void
}

export default function WorkOverview({ today, results, onOpenWeek, onDetail }: Props) {
  const firstDay = weekStart(today)
  const days = weekDays(firstDay)
  const lastDay = days[6]
  const inWeek = (date: string) => date >= firstDay && date <= lastDay
  const weekAssignments = results.flatMap(({ branch, snapshot }) =>
    snapshot.roster.assignments.filter((item) => item.branchId === branch.id && item.kind === 'employee' && inWeek(item.date)),
  )
  const todayAssignments = weekAssignments.filter((item) => item.date === today).sort((a, b) => a.start.localeCompare(b.start))
  const daysOffCount = results.reduce((count, { branch, snapshot }) =>
    count + snapshot.roster.preferences.filter((item) =>
      item.branchId === branch.id && item.shiftId === 'OFF' && inWeek(item.date),
    ).length, 0)
  const staffCount = new Set(weekAssignments.map((item) => item.personId)).size
  const dailyCounts = days.map((date) => {
    const items = weekAssignments.filter((item) => item.date === date)
    const cskh = items.filter((item) => item.employeeType === 'cskh').length
    const sale = items.filter((item) => item.employeeType === 'sale').length
    return { date, total: items.length, cskh, sale, other: items.length - cskh - sale }
  })
  const peak = Math.max(1, ...dailyCounts.map((item) => item.total))
  const metrics = [
    { label: 'Ca hôm nay', value: todayAssignments.length, icon: Clock3, tone: 'blue' },
    { label: 'Ca trong tuần', value: weekAssignments.length, icon: CalendarDays, tone: 'indigo' },
    { label: 'Nhân viên có lịch trong tuần', value: staffCount, icon: Users, tone: 'green' },
    { label: 'Lượt nghỉ trong tuần', value: daysOffCount, icon: CalendarOff, tone: 'amber' },
  ]
  const showOther = dailyCounts.some((item) => item.other > 0)
  const branches = new Map(results.map((result) => [result.branch.id, result]))

  return (
    <>
      <dl className="hrm-stats hrm-overview-stats" aria-label="Số liệu phân ca">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} data-tone={tone}>
            <dt>{label}<Icon className="hrm-stat-icon" aria-hidden="true" /></dt>
            <dd>{value.toLocaleString('vi-VN')}</dd>
          </div>
        ))}
      </dl>
      <div className="hrm-overview-panels">
        <section className="hrm-panel" aria-labelledby="hrm-overview-week">
          <header className="hrm-panel-heading">
            <div>
              <h2 id="hrm-overview-week">Phân ca tuần này</h2>
              <p>{shortDate(firstDay)} – {shortDate(lastDay)}/{lastDay.slice(0, 4)}</p>
            </div>
            <button type="button" className="hrm-overview-action" onClick={onOpenWeek}>
              Xem lịch theo chi nhánh <ArrowRight size={15} aria-hidden="true" />
            </button>
          </header>
          <div className="hrm-overview-chart">
            <div className="hrm-grid-legend hrm-overview-legend" aria-hidden="true">
              <span className="hrm-legend-cskh">CSKH</span>
              <span className="hrm-legend-sale">Sale</span>
              {showOther && <span className="hrm-legend-off">Chưa phân loại</span>}
            </div>
            <ul aria-label="Số ca theo ngày">
              {dailyCounts.map(({ date, total, cskh, sale, other }) => (
                <li key={date} aria-current={date === today ? 'date' : undefined}>
                  <span>{weekdayLabel(date)} <small>{shortDate(date)}</small></span>
                  <div
                    className="hrm-overview-bar"
                    role="img"
                    aria-label={`${cskh} ca CSKH, ${sale} ca Sale${other > 0 ? `, ${other} ca chưa phân loại` : ''}`}
                  >
                    <span className="hrm-overview-cskh" style={{ width: `${cskh / peak * 100}%` }} />
                    <span className="hrm-overview-sale" style={{ width: `${sale / peak * 100}%` }} />
                    <span className="hrm-overview-other" style={{ width: `${other / peak * 100}%` }} />
                  </div>
                  <strong>{total} <small>ca</small></strong>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="hrm-panel" aria-labelledby="hrm-overview-today">
          <header className="hrm-panel-heading">
            <div>
              <h2 id="hrm-overview-today">Ca làm hôm nay</h2>
              <p>{today.split('-').reverse().join('/')}</p>
            </div>
          </header>
          {todayAssignments.length ? (
            <div className="hrm-overview-table-scroll" role="region" aria-label="Danh sách ca làm hôm nay" tabIndex={0}>
              <table className="hrm-overview-table">
                <thead>
                  <tr><th scope="col">Nhân viên</th><th scope="col">Chi nhánh</th><th scope="col">Ca làm</th><th scope="col">Khung giờ</th></tr>
                </thead>
                <tbody>
                  {todayAssignments.map((item) => {
                    const name = item.personName || 'Nhân viên'
                    const result = branches.get(item.branchId)
                    const shift = result?.snapshot.shifts.find((entry) => entry.id === item.shiftId)
                    return (
                      <tr key={`${item.branchId}:${item.id}`}>
                        <td>
                          <button type="button" onClick={() => onDetail(item)} aria-label={`Xem ca của ${name}, ${item.start}–${item.end}`}>{name}</button>
                          {item.employeeType && <small>{EMPLOYEE_TYPE_LABEL[item.employeeType]}</small>}
                        </td>
                        <td>{result?.branch.name}</td>
                        <td>{shift?.name || 'Ca làm'}</td>
                        <td>{item.start}–{item.end}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="hrm-panel-message">Hôm nay chưa có ca làm được phân.</p>}
        </section>
      </div>
    </>
  )
}
