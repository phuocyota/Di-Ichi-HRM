import { useEffect, useRef, useState, type FormEvent } from 'react'
import { buildAssignments, shortDate, weekdayLabel, workSearchText } from '../lib/schedule.ts'
import {
  EMPLOYEE_TYPE_LABEL,
  type AssignItem,
  type EmployeeType,
  type WorkAssignment,
  type WorkEmployee,
  type WorkShift,
} from '../services/workShifts.ts'

export type AssignmentSeed = { shiftId: string; date: string; employee?: WorkEmployee }

type Props = {
  branchName?: string
  shifts: WorkShift[]
  employees: WorkEmployee[]
  days: string[]
  existing: WorkAssignment[]
  initial: AssignmentSeed
  onSubmit: (items: AssignItem[]) => Promise<void>
  onClose: () => void
}

/** Thêm một hoặc nhiều nhân viên vào một ca, trong một hoặc nhiều ngày của tuần. */
export default function AssignDialog({ branchName, shifts, employees, days, existing, initial, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [employeeType, setEmployeeType] = useState<EmployeeType>(initial.employee?.employeeTypes[0] ?? 'cskh')
  const [shiftId, setShiftId] = useState(initial.shiftId)
  const [dates, setDates] = useState<string[]>([initial.date])
  const [personIds, setPersonIds] = useState<string[]>(initial.employee ? [initial.employee.id] : [])
  const [search, setSearch] = useState(initial.employee?.code || initial.employee?.name || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  const eligible = employees.filter((person) => person.employeeTypes.includes(employeeType))
  const keyword = workSearchText(search)
  const candidates = eligible.filter((person) => workSearchText(`${person.name} ${person.code}`).includes(keyword))
  const chosen = eligible.filter((person) => personIds.includes(person.id)).map((person) => person.id)

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    setError('')
    if (!chosen.length) return setError('Chọn ít nhất một nhân viên.')
    if (!dates.length) return setError('Chọn ít nhất một ngày.')
    if (!shifts.some((shift) => shift.id === shiftId)) return setError('Vui lòng chọn ca làm còn hiệu lực.')
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
    <dialog
      ref={dialogRef}
      className="assign-dialog"
      aria-labelledby="assign-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!saving) onClose()
      }}
      onClick={(event) => {
        if (!saving && event.target === event.currentTarget) onClose()
      }}
    >
      <header className="assign-header">
        <h2 id="assign-title">Thêm nhân viên vào ca</h2>
        <button className="assign-close" type="button" aria-label="Đóng" onClick={onClose} disabled={saving}>×</button>
      </header>
      <form className="assign-form" onSubmit={submit}>
        <fieldset className="assign-fields" aria-label="Thông tin phân lịch" disabled={saving}>
          {branchName && <p className="assign-branch"><strong>Chi nhánh</strong> {branchName}</p>}
          <fieldset className="assign-days">
            <legend>Ngày làm việc</legend>
            <div className="assign-chips">
              {days.map((date) => (
                <label key={date}>
                  <input type="checkbox" checked={dates.includes(date)} onChange={() => setDates(toggle(dates, date))} />
                  {weekdayLabel(date)} {shortDate(date)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="assign-row">
            <label>
              Loại nhân viên
              <select value={employeeType} onChange={(event) => {
                setEmployeeType(event.target.value as EmployeeType)
                setPersonIds([])
                setSearch('')
                setError('')
              }}>
                {(Object.keys(EMPLOYEE_TYPE_LABEL) as EmployeeType[]).map((type) => (
                  <option key={type} value={type}>{EMPLOYEE_TYPE_LABEL[type]}</option>
                ))}
              </select>
            </label>
            <label>
              Ca làm theo chi nhánh
              <select value={shiftId} onChange={(event) => setShiftId(event.target.value)} required>
                <option value="">Chọn ca làm</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>{shift.name} ({shift.start}–{shift.end})</option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="assign-employees">
            <legend>Nhân viên</legend>
            <input type="search" aria-label="Tìm nhân viên" placeholder="Tìm theo tên hoặc mã" value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="assign-people">
              {candidates.length === 0 && <p className="assign-empty">Không có nhân viên phù hợp.</p>}
              {candidates.map((person) => (
                <label key={person.id}>
                  <input type="checkbox" checked={personIds.includes(person.id)} onChange={() => setPersonIds(toggle(personIds, person.id))} />
                  <span>
                    {person.name}
                    <small>{[person.code, person.position].filter(Boolean).join(' · ')}</small>
                  </span>
                </label>
              ))}
            </div>
            <p className="assign-count" aria-live="polite">Đã chọn {chosen.length} nhân viên</p>
          </fieldset>
        </fieldset>
        {error && <p className="assign-error" role="alert">{error}</p>}
        <footer className="assign-actions">
          <button type="button" onClick={onClose} disabled={saving}>Hủy</button>
          <button className="assign-save" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu phân lịch'}</button>
        </footer>
      </form>
    </dialog>
  )
}
