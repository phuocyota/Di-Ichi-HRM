import { useEffect, useRef } from 'react'
import type { WorkEmployeeCredentials } from '../services/workShifts.ts'

export default function EmployeeCredentialsDialog({ credentials, onClose }: {
  credentials: WorkEmployeeCredentials
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog ref={dialogRef} className="assign-dialog" aria-labelledby="employee-credentials-title"
      onCancel={(event) => { event.preventDefault(); onClose() }}>
      <header className="assign-header">
        <h2 id="employee-credentials-title">Tài khoản đăng nhập nhân viên</h2>
      </header>
      <div className="assign-form">
        <p>Mật khẩu khởi tạo chỉ hiện tại đây. Hãy bàn giao riêng cho nhân viên.</p>
        <div className="assign-fields">
          <label>Email <input readOnly value={credentials.email} onFocus={(event) => event.currentTarget.select()} /></label>
          <label>Mật khẩu khởi tạo <input readOnly value={credentials.password} onFocus={(event) => event.currentTarget.select()} /></label>
        </div>
        <footer className="assign-actions">
          <button className="assign-save" type="button" autoFocus onClick={onClose}>Đóng</button>
        </footer>
      </div>
    </dialog>
  )
}
