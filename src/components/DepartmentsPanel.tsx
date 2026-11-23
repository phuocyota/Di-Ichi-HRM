import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { isActiveDepartment, saveWorkDepartment, type WorkDepartment } from '../services/workShifts.ts'

type Props = {
  branchId: string
  branchName: string
  departments: WorkDepartment[]
  canManage: boolean
  onSaved: (name: string) => void
}

export default function DepartmentsPanel({ branchId, branchName, departments, canManage, onSaved }: Props) {
  const [editing, setEditing] = useState<WorkDepartment | 'new' | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const row = editing === 'new' ? null : editing

  useEffect(() => {
    if (!editing) return
    const dialog = dialogRef.current
    dialog?.showModal()
    inputRef.current?.focus()
    return () => dialog?.close()
  }, [editing])

  const open = (department: WorkDepartment | 'new') => {
    setError('')
    setEditing(department)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current) return
    const form = new FormData(event.currentTarget)
    const code = String(form.get('code') ?? '').trim()
    const name = String(form.get('name') ?? '').trim()
    const status = form.get('status') === 'inactive' ? 'inactive' : 'active'
    if (!code || !name) {
      setError('Vui lòng nhập mã và tên phòng ban.')
      return
    }
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const saved = await saveWorkDepartment(branchId, { code, name, status }, row?.id)
      setEditing(null)
      onSaved(saved.name)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được phòng ban.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <section className="hrm-panel" aria-labelledby="hrm-departments-title">
      <header className="hrm-panel-heading">
        <h2 id="hrm-departments-title">Danh sách phòng ban</h2>
        {canManage && (
          <button className="hrm-add hrm-directory-add" type="button" onClick={() => open('new')}>
            <Plus size={16} aria-hidden="true" /> Thêm phòng ban
          </button>
        )}
      </header>
      <div className="hrm-directory-scroll" role="region" aria-label="Bảng phòng ban" tabIndex={0}>
        <table className="hrm-directory-table hrm-compact-table">
          <thead>
            <tr>
              <th scope="col">Mã phòng ban</th><th scope="col">Tên phòng ban</th>
              <th scope="col">Trạng thái</th>{canManage && <th scope="col">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {departments.map((department) => (
              <tr key={department.id}>
                <td className="hrm-directory-code">{department.code}</td>
                <th scope="row">{department.name}</th>
                <td>{isActiveDepartment(department) ? 'Hoạt động' : 'Ngừng sử dụng'}</td>
                {canManage && <td className="hrm-directory-actions">
                  <button type="button" onClick={() => open(department)} aria-label={`Sửa phòng ban ${department.name}`}>Sửa</button>
                </td>}
              </tr>
            ))}
            {!departments.length && (
              <tr><td colSpan={canManage ? 4 : 3} className="hrm-directory-empty">Chi nhánh chưa có phòng ban.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <dialog ref={dialogRef} className="assign-dialog" aria-labelledby="edit-department-title" onCancel={(event) => {
          event.preventDefault()
          if (!savingRef.current) setEditing(null)
        }}>
          <header className="assign-header">
            <h2 id="edit-department-title">{row ? 'Sửa phòng ban' : 'Thêm phòng ban'}</h2>
            <button className="assign-close" type="button" aria-label="Đóng" disabled={saving} onClick={() => setEditing(null)}>×</button>
          </header>
          <form className="assign-form" onSubmit={submit} aria-busy={saving}>
            <fieldset className="assign-fields" disabled={saving} aria-label="Thông tin phòng ban">
              <p className="assign-branch"><strong>Chi nhánh</strong> {branchName}</p>
              <div className="assign-row">
                <label>Mã phòng ban <input ref={inputRef} name="code" defaultValue={row?.code} maxLength={50} required /></label>
                <label>Tên phòng ban <input name="name" defaultValue={row?.name} maxLength={150} required /></label>
              </div>
              <label>
                Trạng thái
                <select name="status" defaultValue={row && !isActiveDepartment(row) ? 'inactive' : 'active'}>
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Ngừng sử dụng</option>
                </select>
              </label>
            </fieldset>
            {error && <p className="assign-error" role="alert">{error}</p>}
            <footer className="assign-actions">
              <button type="button" onClick={() => setEditing(null)} disabled={saving}>Hủy</button>
              <button className="assign-save" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu phòng ban'}</button>
            </footer>
          </form>
        </dialog>
      )}
    </section>
  )
}
