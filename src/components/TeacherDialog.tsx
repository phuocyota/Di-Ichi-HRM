import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../services/api.ts'
import type { WorkDirectoryPerson, WorkSpecialty, WorkTeacherInput } from '../services/workDirectory.ts'

type Props = {
  teacher?: WorkDirectoryPerson
  specialties: WorkSpecialty[]
  onSubmit: (teacher: WorkTeacherInput) => Promise<void>
  onClose: () => void
}

/** Thêm/sửa giáo viên: mã, họ tên, email đăng nhập app giáo viên, SĐT, chuyên môn. */
export default function TeacherDialog({ teacher, specialties, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    codeRef.current?.focus()
    return () => dialog?.close()
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current) return
    const form = new FormData(event.currentTarget)
    const code = String(form.get('code')).trim()
    const name = String(form.get('name')).trim()
    const email = String(form.get('email') ?? '').trim()
    const phone = String(form.get('phone') ?? '').trim()
    const specialtyId = String(form.get('specialtyId') ?? '')
    if (!code || !name || !email) {
      setError('Vui lòng điền các trường bắt buộc.')
      return
    }
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      await onSubmit({
        code,
        name,
        email,
        phone: teacher ? phone : phone || undefined,
        specialtyId: specialtyId || (teacher ? null : undefined),
      })
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 409
        ? cause.message === 'Dữ liệu đã tồn tại' ? 'Mã giáo viên hoặc email đã tồn tại.' : cause.message
        : cause instanceof Error ? cause.message : 'Không lưu được hồ sơ giáo viên.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="assign-dialog"
      aria-labelledby="teacher-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!savingRef.current) onClose()
      }}
    >
      <header className="assign-header">
        <h2 id="teacher-dialog-title">{teacher ? 'Sửa hồ sơ giáo viên' : 'Thêm giáo viên'}</h2>
        <button className="assign-close" type="button" aria-label="Đóng" onClick={onClose} disabled={saving}>×</button>
      </header>
      <form className="assign-form" onSubmit={submit} aria-busy={saving}>
        <fieldset className="assign-fields" aria-label="Thông tin giáo viên" disabled={saving}>
          <div className="assign-row">
            <label>Mã giáo viên <input ref={codeRef} name="code" defaultValue={teacher?.code} maxLength={50} required /></label>
            <label>Họ và tên <input name="name" defaultValue={teacher?.name} maxLength={150} autoComplete="name" required /></label>
          </div>
          <div className="assign-row">
            <label>Email đăng nhập <input name="email" defaultValue={teacher?.email ?? ''} type="email" maxLength={254} autoComplete="email" required /></label>
            <label>Số điện thoại (tùy chọn) <input name="phone" defaultValue={teacher?.phone ?? ''} type="tel" maxLength={30} autoComplete="tel" /></label>
          </div>
          <label>
            Chuyên môn (tùy chọn)
            <select name="specialtyId" defaultValue={teacher?.specialtyId ?? ''}>
              <option value="">Chưa chọn</option>
              {specialties.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
              ))}
            </select>
          </label>
        </fieldset>
        {error && <p className="assign-error" role="alert">{error}</p>}
        <footer className="assign-actions">
          <button type="button" onClick={onClose} disabled={saving}>Hủy</button>
          <button className="assign-save" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu giáo viên'}</button>
        </footer>
      </form>
    </dialog>
  )
}
