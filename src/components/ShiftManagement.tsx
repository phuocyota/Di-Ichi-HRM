import { useState, type FormEvent, type ReactNode } from 'react'
import type { WorkShift, WorkSnapshot } from '../services/workShifts.ts'

type Props = {
  snapshot: WorkSnapshot
  branchName?: string
  branchPicker: ReactNode
  canAssign: boolean
  loading: boolean
  saving: boolean
  onSave: (shifts: WorkShift[], revision: number) => Promise<void>
}

const MAX_SHIFTS = 50
type Draft = { revision: number; shifts: WorkShift[] }

export default function ShiftManagement({ snapshot, branchName, branchPicker, canAssign, loading, saving, onSave }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')
  const shifts = draft?.shifts ?? snapshot.shifts
  const stale = draft !== null && draft.revision !== snapshot.revision
  const disabled = !canAssign || loading || saving || stale

  const update = (values: WorkShift[]) => {
    setDraft({ revision: draft?.revision ?? snapshot.revision, shifts: values })
    setError('')
  }

  const reset = () => {
    setDraft(null)
    setError('')
  }

  const change = (id: string, field: 'name' | 'start' | 'end', value: string) =>
    update(shifts.map((shift) => shift.id === id ? { ...shift, [field]: value } : shift))

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (disabled || (!draft && snapshot.saved !== false)) return
    const values = shifts.map(({ id, name, start, end }) => ({ id, name: name.trim(), start, end }))
    const names = new Set<string>()
    for (const shift of values) {
      const key = shift.name.toLocaleLowerCase('vi')
      if (!key || names.has(key)) return setError('Tên ca làm phải có nội dung và không được trùng.')
      if (shift.start >= shift.end) return setError(`${shift.name}: Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.`)
      names.add(key)
    }
    try {
      await onSave(values, draft?.revision ?? snapshot.revision)
      reset()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được cấu hình ca làm.')
    }
  }

  return (
    <section className="hrm-panel" aria-labelledby="hrm-shifts-title">
      <header className="hrm-panel-heading">
        <div>
          <h2 id="hrm-shifts-title">Khung giờ ca làm {branchName && `· ${branchName}`}</h2>
          <p>Khung giờ mới được áp dụng khi phân lịch. Lịch đã phân vẫn dùng giờ đã lưu.</p>
        </div>
        <div className="hrm-shift-toolbar">
          {branchPicker}
          {canAssign && (
            <button type="button" disabled={disabled || shifts.length >= MAX_SHIFTS} onClick={() => {
              update([...shifts, { id: crypto.randomUUID(), name: '', start: '', end: '' }])
            }}>+ Thêm ca làm</button>
          )}
        </div>
      </header>
      <form className="hrm-shift-form" onSubmit={submit}>
        {snapshot.saved === false && <p className="hrm-message">Chi nhánh đang dùng khung giờ mặc định.</p>}
        <fieldset className="hrm-shift-list" aria-label="Cấu hình khung giờ" disabled={disabled}>
          {shifts.map((shift, index) => {
            const fixed = shift.id === `${snapshot.branchId}-morning` || shift.id === `${snapshot.branchId}-evening`
            const isNew = !snapshot.shifts.some((item) => item.id === shift.id)
            return (
              <section key={shift.id} className="hrm-shift-card" aria-labelledby={`shift-${shift.id}`}>
                <header>
                  <h3 id={`shift-${shift.id}`}>{shift.name || 'Ca bổ sung'}</h3>
                  {isNew && (
                    <button type="button" aria-label={`Bỏ ca chưa lưu ${index + 1}`} onClick={() => update(shifts.filter((item) => item.id !== shift.id))}>Bỏ</button>
                  )}
                </header>
                {!fixed && (
                  <label>
                    Tên ca làm
                    <input required maxLength={100} value={shift.name} placeholder="Ví dụ: Ca chiều" onChange={(event) => change(shift.id, 'name', event.target.value)} />
                  </label>
                )}
                <div className="hrm-shift-times">
                  <label>
                    Từ giờ
                    <input type="time" required value={shift.start} onChange={(event) => change(shift.id, 'start', event.target.value)} />
                  </label>
                  <label>
                    Đến giờ
                    <input type="time" required value={shift.end} onChange={(event) => change(shift.id, 'end', event.target.value)} />
                  </label>
                </div>
              </section>
            )
          })}
        </fieldset>
        {stale ? (
          <p className="hrm-message hrm-message-error" role="alert">Dữ liệu máy chủ đã đổi. Bấm Hủy thay đổi để mở bản mới nhất rồi cập nhật lại khung giờ.</p>
        ) : error && <p className="hrm-message hrm-message-error" role="alert">{error}</p>}
        {canAssign && (
          <footer className="hrm-shift-footer">
            <button type="button" disabled={!draft || saving} onClick={reset}>Hủy thay đổi</button>
            <button type="submit" className="hrm-add" disabled={disabled || (!draft && snapshot.saved !== false)}>
              {saving ? 'Đang lưu…' : 'Lưu khung giờ ca làm'}
            </button>
          </footer>
        )}
      </form>
    </section>
  )
}
