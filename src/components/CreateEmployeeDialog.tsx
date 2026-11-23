import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../services/api.ts'
import { getEmployeeBranches, isActiveDepartment, type NewWorkEmployee, type WorkBranch, type WorkDepartment, type WorkEmployee, type WorkEmployeeDraft } from '../services/workShifts.ts'

type Props = {
  branchId: string
  departments: WorkDepartment[]
  draft?: WorkEmployeeDraft
  employee?: WorkEmployee
  onSubmit: (employee: NewWorkEmployee, branch?: WorkBranch) => Promise<void>
  onClose: () => void
}

export default function CreateEmployeeDialog({ branchId, departments, draft, employee, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deferBranch, setDeferBranch] = useState(false)
  const [receivingBranch, setReceivingBranch] = useState(branchId)
  const [branchRequest, setBranchRequest] = useState(0)
  const [catalog, setCatalog] = useState<{ request: number; branches: WorkBranch[]; error?: string }>()
  const branchCatalog = catalog?.request === branchRequest ? catalog : undefined
  const creating = !draft && !employee
  const record = employee ? { code: employee.code, name: employee.name, ...employee.editProfile } : draft
  const emailRequired = !employee || Boolean(employee.editProfile?.hasAccount)
  const needsBranch = creating && !deferBranch
  const currentDepartment = departments.find(({ id }) => record?.departmentId === id)?.id ?? ''

  useEffect(() => {
    if (!creating) return
    let active = true
    void getEmployeeBranches().then(
      (branches) => { if (active) setCatalog({ request: branchRequest, branches }) },
      (cause: unknown) => {
        if (active) setCatalog({ request: branchRequest, branches: [], error: cause instanceof Error ? cause.message : 'Không tải được chi nhánh.' })
      },
    )
    return () => { active = false }
  }, [branchRequest, creating])

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
    const departmentId = String(form.get('departmentId') ?? '')
    const targetBranch = branchCatalog?.branches.find(({ id }) => id === receivingBranch)
    if (!code || !name || !departmentId || (emailRequired && !email)) {
      setError('Vui lòng điền các trường bắt buộc.')
      return
    }
    if (needsBranch && !targetBranch) {
      setError('Vui lòng chọn chi nhánh tiếp nhận nhân viên.')
      return
    }

    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      await onSubmit({
        code,
        name,
        departmentId,
        phone: employee ? phone : phone || undefined,
        email,
      }, needsBranch ? targetBranch : undefined)
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 409 && cause.message === 'Dữ liệu đã tồn tại'
        ? 'Mã nhân viên hoặc email đã tồn tại.'
        : cause instanceof Error ? cause.message : 'Không lưu được hồ sơ nhân viên.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="assign-dialog"
      aria-labelledby="create-employee-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!savingRef.current) onClose()
      }}
    >
      <header className="assign-header">
        <h2 id="create-employee-title">{employee ? 'Sửa hồ sơ nhân viên' : draft ? 'Sửa hồ sơ chờ' : 'Thêm nhân viên'}</h2>
        <button className="assign-close" type="button" aria-label="Đóng" onClick={onClose} disabled={saving}>×</button>
      </header>
      <form className="assign-form" onSubmit={submit} aria-busy={saving}>
        <fieldset className="assign-fields" aria-label="Thông tin nhân viên" disabled={saving}>
          {needsBranch && (
            <label>
              Chi nhánh tiếp nhận
              <select name="branchId" value={receivingBranch} onChange={(event) => setReceivingBranch(event.target.value)} required disabled={!branchCatalog?.branches.length}>
                <option value="">{branchCatalog ? 'Chọn chi nhánh' : 'Đang tải chi nhánh…'}</option>
                {branchCatalog?.branches.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
              {branchCatalog?.error && <span role="alert">{branchCatalog.error} <button type="button" onClick={() => setBranchRequest((request) => request + 1)}>Thử lại</button></span>}
            </label>
          )}
          <div className="assign-row">
            <label>Mã nhân viên <input ref={codeRef} name="code" defaultValue={record?.code} maxLength={50} required /></label>
            <label>Họ và tên <input name="name" defaultValue={record?.name} maxLength={150} autoComplete="name" required /></label>
          </div>
          <label>
            Phòng ban
            <select name="departmentId" defaultValue={currentDepartment} required>
              <option value="" disabled>Chọn phòng ban</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}{isActiveDepartment(department) ? '' : ' (Ngừng sử dụng)'}
                </option>
              ))}
            </select>
          </label>
          <div className="assign-row">
            <label>Số điện thoại (tùy chọn) <input name="phone" defaultValue={record?.phone ?? ''} type="tel" maxLength={30} autoComplete="tel" /></label>
            <label>{emailRequired ? 'Email đăng nhập' : 'Email'} <input name="email" defaultValue={record?.email ?? ''} type="email" maxLength={254} autoComplete="email" required={emailRequired} /></label>
          </div>
          {creating && <label className="hrm-defer-branch"><input type="checkbox" checked={deferBranch} onChange={(event) => setDeferBranch(event.target.checked)} /> Gán chi nhánh sau</label>}
        </fieldset>
        {error && <p className="assign-error" role="alert">{error}</p>}
        <footer className="assign-actions">
          <button type="button" onClick={onClose} disabled={saving}>Hủy</button>
          <button className="assign-save" type="submit" disabled={saving || !departments.length || (needsBranch && !branchCatalog?.branches.length)}>{saving ? 'Đang lưu…' : draft ? 'Lưu hồ sơ chờ' : 'Lưu nhân viên'}</button>
        </footer>
      </form>
    </dialog>
  )
}
