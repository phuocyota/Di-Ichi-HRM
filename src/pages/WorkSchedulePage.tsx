import { useCallback, useEffect, useState } from 'react'
import AssignDialog from '../components/AssignDialog.tsx'
import { addDays, cellAssignments, shortDate, todayVn, weekDays, weekStart, weekdayLabel } from '../lib/schedule.ts'
import { ApiError } from '../services/api.ts'
import type { HrmSession } from '../services/session.ts'
import {
  EMPLOYEE_TYPE_LABEL,
  assignEmployees,
  getEmployees,
  getSnapshot,
  removeAssignment,
  type AssignItem,
  type WorkAssignment,
  type WorkEmployee,
  type WorkSnapshot,
} from '../services/workShifts.ts'

const CONFLICT = 'Lịch vừa được cập nhật ở nơi khác, đã tải lại dữ liệu mới. Vui lòng thao tác lại.'

export default function WorkSchedulePage({ session, onLogout }: { session: HrmSession; onLogout: () => void }) {
  const branchId = session.branchId
  const [week, setWeek] = useState(() => weekStart(todayVn()))
  const [snapshot, setSnapshot] = useState<WorkSnapshot | null>(null)
  const [canAssign, setCanAssign] = useState(false)
  const [employees, setEmployees] = useState<WorkEmployee[]>([])
  const [unclassified, setUnclassified] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dialog, setDialog] = useState<{ shiftId: string; date: string } | null>(null)
  const [removing, setRemoving] = useState<WorkAssignment | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [next, catalog] = await Promise.all([getSnapshot(branchId), getEmployees(branchId)])
      setSnapshot(next)
      setCanAssign(Boolean(next.canAssign))
      setEmployees(catalog.employees)
      setUnclassified(catalog.unclassified)
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 403
          ? 'Tài khoản chưa được cấp vai trò "Nhân sự phân lịch". Liên hệ quản trị viên để được cấp quyền.'
          : cause instanceof Error ? cause.message : 'Không tải được phân lịch.',
      )
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    // Tải dữ liệu từ máy chủ khi mở trang (đồng bộ với hệ thống bên ngoài).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  /** Ghi phân lịch; 409 (revision lệch) thì tải lại và báo người dùng. */
  const mutate = async (action: (revision: number) => Promise<WorkSnapshot>, message: string) => {
    if (!snapshot) return
    try {
      setSnapshot(await action(snapshot.revision))
      setNotice(message)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        await load()
        throw new Error(CONFLICT, { cause })
      }
      throw cause
    }
  }

  const assign = async (items: AssignItem[]) => {
    await mutate((revision) => assignEmployees(branchId, revision, items), `Đã phân ${items.length} lịch làm việc.`)
    setDialog(null)
  }

  const remove = async (item: WorkAssignment) => {
    setError('')
    try {
      await mutate((revision) => removeAssignment(branchId, item.id, revision), `Đã gỡ lịch của ${item.personName || 'nhân viên'}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không gỡ được lịch.')
    } finally {
      setRemoving(null)
    }
  }

  const days = weekDays(week)
  const shifts = snapshot?.shifts || []
  const assignments = snapshot?.roster.assignments.filter((item) => item.branchId === branchId) || []
  const offs = snapshot?.roster.preferences.filter((item) => item.shiftId === 'OFF' && item.branchId === branchId) || []
  const offName = (personId: string) =>
    employees.find((person) => person.id === personId)?.name || assignments.find((a) => a.personId === personId)?.personName || 'Nhân viên'
  const today = todayVn()
  const weekCount = assignments.filter((item) => item.kind === 'employee' && item.date >= week && item.date <= days[6]).length

  return (
    <div className="layout">
      <header className="topbar">
        <strong>Di-Ichi HRM</strong>
        <span className="muted">{session.fullName}</span>
        <button onClick={onLogout}>Đăng xuất</button>
      </header>
      <main className="content">
        <div className="heading">
          <div>
            <h1>Phân lịch làm việc</h1>
            <p className="muted">Phân nhân viên CSKH / Sale vào ca làm của cơ sở. {weekCount} lịch trong tuần.</p>
          </div>
          <div className="week-nav">
            <button onClick={() => setWeek(addDays(week, -7))} aria-label="Tuần trước">‹</button>
            <span>{shortDate(week)} – {shortDate(days[6])}/{days[6].slice(0, 4)}</span>
            <button onClick={() => setWeek(addDays(week, 7))} aria-label="Tuần sau">›</button>
            <button onClick={() => setWeek(weekStart(today))}>Tuần này</button>
            <button onClick={() => void load()} disabled={loading}>Tải lại</button>
          </div>
        </div>
        {loading && <p role="status" className="muted">Đang tải phân lịch…</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="notice" role="status">{notice}</p>}
        {snapshot && !canAssign && <p className="error">Bạn chỉ có quyền xem phân lịch.</p>}
        {unclassified > 0 && (
          <p className="muted">Có {unclassified} nhân viên chưa được phân loại CSKH / Sale (chức vụ hoặc vai trò) nên chưa thể phân ca.</p>
        )}
        {snapshot && (
          <div className="grid-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>Ca</th>
                  {days.map((date) => (
                    <th key={date} className={date === today ? 'today' : undefined}>
                      {weekdayLabel(date)}<br /><small>{shortDate(date)}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => (
                  <tr key={shift.id}>
                    <th>{shift.name}<br /><small className="muted">{shift.start}–{shift.end}</small></th>
                    {days.map((date) => (
                      <td key={date} className={date === today ? 'today' : undefined}>
                        {cellAssignments(assignments, shift.id, date).map((item) => (
                          <div key={item.id} className="slot">
                            <span>{item.personName || offName(item.personId)}</span>
                            {item.employeeType && <small className="tag">{EMPLOYEE_TYPE_LABEL[item.employeeType]}</small>}
                            {canAssign && (
                              <button className="link danger" onClick={() => setRemoving(item)} aria-label={`Gỡ lịch ${item.personName || ''}`}>×</button>
                            )}
                          </div>
                        ))}
                        {canAssign && (
                          <button className="link" onClick={() => { setNotice(''); setDialog({ shiftId: shift.id, date }) }}>+ Thêm</button>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th>Nghỉ (OFF)</th>
                  {days.map((date) => (
                    <td key={date} className="off">
                      {offs.filter((item) => item.date === date).map((item) => (
                        <div key={item.personId} className="muted">{offName(item.personId)}</div>
                      ))}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </main>
      {dialog && snapshot && (
        <AssignDialog
          shifts={shifts}
          employees={employees}
          days={days}
          existing={assignments}
          initial={dialog}
          onSubmit={assign}
          onClose={() => setDialog(null)}
        />
      )}
      {removing && (
        <div className="overlay" role="presentation" onClick={() => setRemoving(null)}>
          <div className="card dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>Gỡ lịch làm việc</h2>
            <p>
              Gỡ lịch của <strong>{removing.personName || offName(removing.personId)}</strong> ngày {shortDate(removing.date)} ({removing.start}–{removing.end})?
              Chấm công gắn với lịch này (nếu có) cũng bị xóa.
            </p>
            <div className="actions">
              <button onClick={() => setRemoving(null)}>Hủy</button>
              <button className="primary danger" onClick={() => void remove(removing)}>Gỡ lịch</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
