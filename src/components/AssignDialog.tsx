import { useMemo, useState, type FormEvent } from 'react'
import { buildAssignments, shortDate, weekdayLabel } from '../lib/schedule.ts'
import {
  EMPLOYEE_TYPE_LABEL,
  type AssignItem,
  type EmployeeType,
  type WorkAssignment,
  type WorkEmployee,
  type WorkShift,
} from '../services/workShifts.ts'

type Props = {
  shifts: WorkShift[]
  employees: WorkEmployee[]
  days: string[]
  existing: WorkAssignment[]
  initial: { shiftId: string; date: string }
  onSubmit: (items: AssignItem[]) => Promise<void>
  onClose: () => void
}

/** Thêm một hoặc nhiều nhân viên vào một ca, trong một hoặc nhiều ngày của tuần. */
export default function AssignDialog({ shifts, employees, days, existing, initial, onSubmit, onClose }: Props) {
  const [employeeType, setEmployeeType] = useState<EmployeeType>('cskh')
  const [shiftId, setShiftId] = useState(initial.shiftId)
  const [dates, setDates] = useState<string[]>([initial.date])
  const [personIds, setPersonIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const candidates = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi')
    return employees.filter(
      (person) =>
        person.employeeTypes.includes(employeeType) &&
        (!keyword || `${person.name} ${person.code}`.toLocaleLowerCase('vi').includes(keyword)),
    )
  }, [employees, employeeType, search])

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const chosen = personIds.filter((id) => candidates.some((person) => person.id === id))
    if (!chosen.length) return setError('Chọn ít nhất một nhân viên.')
    if (!dates.length) return setError('Chọn ít nhất một ngày.')
    const items = buildAssignments({ personIds: chosen, dates, shiftId, employeeType, existing })
    if (!items.length) return setError('Các nhân viên đã có lịch ở ca và ngày đã chọn.')
    setSaving(true)
    try {
      await onSubmit(items)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được phân lịch.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <form className="card dialog" role="dialog" aria-modal="true" aria-labelledby="assign-title" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2 id="assign-title">Thêm nhân viên vào ca</h2>
        <div className="row">
          <label>
            Loại nhân viên
            <select value={employeeType} onChange={(e) => setEmployeeType(e.target.value as EmployeeType)}>
              {(Object.keys(EMPLOYEE_TYPE_LABEL) as EmployeeType[]).map((type) => (
                <option key={type} value={type}>{EMPLOYEE_TYPE_LABEL[type]}</option>
              ))}
            </select>
          </label>
          <label>
            Ca làm
            <select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>{shift.name} ({shift.start}–{shift.end})</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Ngày</legend>
          <div className="chips">
            {days.map((date) => (
              <label key={date} className={dates.includes(date) ? 'chip active' : 'chip'}>
                <input type="checkbox" checked={dates.includes(date)} onChange={() => setDates(toggle(dates, date))} />
                {weekdayLabel(date)} {shortDate(date)}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Nhân viên ({EMPLOYEE_TYPE_LABEL[employeeType]})</legend>
          <input type="search" placeholder="Tìm theo tên hoặc mã" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="people">
            {candidates.length === 0 && <p className="muted">Không có nhân viên phù hợp.</p>}
            {candidates.map((person) => (
              <label key={person.id} className="person">
                <input type="checkbox" checked={personIds.includes(person.id)} onChange={() => setPersonIds(toggle(personIds, person.id))} />
                <span>{person.name}</span>
                <small className="muted">{[person.code, person.position].filter(Boolean).join(' · ')}</small>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions">
          <button type="button" onClick={onClose} disabled={saving}>Hủy</button>
          <button className="primary" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Phân lịch'}</button>
        </div>
      </form>
    </div>
  )
}
