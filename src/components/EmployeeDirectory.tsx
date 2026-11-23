import { useState } from 'react'
import { CalendarDays, Search, UserPlus } from 'lucide-react'
import { addDays, shortDate, weekStart, workSearchText } from '../lib/schedule.ts'
import { EMPLOYEE_TYPE_LABEL, type EmployeeType, type WorkAssignment, type WorkEmployee } from '../services/workShifts.ts'
import './EmployeeDirectory.css'

type Props = {
  today: string
  employees: WorkEmployee[]
  assignments: WorkAssignment[]
  unclassified: number
  onViewSchedule: (employee: WorkEmployee) => void
  onEdit: (employee: WorkEmployee) => void
  editDisabled?: boolean
  onAssign?: (employee: WorkEmployee) => void
}

const PAGE_SIZE = 15

export default function EmployeeDirectory({ today, employees, assignments, unclassified, onViewSchedule, onEdit, editDisabled, onAssign }: Props) {
  const [search, setSearch] = useState('')
  const [type, setType] = useState<EmployeeType | ''>('')
  const [page, setPage] = useState(1)
  const firstDay = weekStart(today)
  const lastDay = addDays(firstDay, 6)
  const weekCounts = new Map<string, number>()
  for (const item of assignments) {
    if (item.date >= firstDay && item.date <= lastDay) {
      weekCounts.set(item.personId, (weekCounts.get(item.personId) ?? 0) + 1)
    }
  }

  const keyword = workSearchText(search)
  const filtered = employees.filter((employee) =>
    (!type || employee.employeeTypes.includes(type))
    && (!keyword || workSearchText(`${employee.name} ${employee.code} ${employee.position} ${employee.department ?? ''}`).includes(keyword)),
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * PAGE_SIZE
  const rows = filtered.slice(start, start + PAGE_SIZE)

  return (
    <section className="hrm-panel" aria-labelledby="hrm-employees-title">
      <header className="hrm-panel-heading">
        <div>
          <h2 id="hrm-employees-title">Danh sách nhân viên phân ca</h2>
          <p>Tuần {shortDate(firstDay)} – {shortDate(lastDay)}/{lastDay.slice(0, 4)}</p>
        </div>
        <span className="hrm-period" role="status">{filtered.length.toLocaleString('vi-VN')} / {employees.length.toLocaleString('vi-VN')} nhân viên</span>
      </header>
      <div className="hrm-filters hrm-directory-filters">
        <label className="hrm-quick-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" aria-label="Tìm nhân viên" placeholder="Tìm tên, mã, chức vụ hoặc phòng ban…" value={search} onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }} />
        </label>
        <select aria-label="Nhóm phân ca" value={type} onChange={(event) => {
          setType(event.target.value as EmployeeType | '')
          setPage(1)
        }}>
          <option value="">Tất cả nhóm phân ca</option>
          <option value="cskh">{EMPLOYEE_TYPE_LABEL.cskh}</option>
          <option value="sale">{EMPLOYEE_TYPE_LABEL.sale}</option>
        </select>
        {(keyword || type) && (
          <button type="button" onClick={() => {
            setSearch('')
            setType('')
            setPage(1)
          }}>Xóa bộ lọc</button>
        )}
      </div>
      {unclassified > 0 && (
        <p className="hrm-directory-note">Có {unclassified} nhân viên chưa được phân loại CSKH hoặc Sale để phân ca.</p>
      )}
      <div className="hrm-directory-scroll" role="region" aria-label="Bảng nhân viên" tabIndex={0}>
        <table className="hrm-directory-table">
          <thead>
            <tr>
              <th scope="col">Mã NV</th><th scope="col">Họ và tên</th><th scope="col">Phòng ban</th><th scope="col">Chức vụ</th>
              <th scope="col">Nhóm phân ca</th><th scope="col">Ca trong tuần</th><th scope="col">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((employee) => (
              <tr key={employee.id}>
                <td className="hrm-directory-code">{employee.code || '—'}</td>
                <th scope="row">{employee.name}</th>
                <td>{employee.department || '—'}</td>
                <td>{employee.position || '—'}</td>
                <td>
                  <div className="hrm-directory-tags">
                    {employee.employeeTypes.map((group) => (
                      <span key={group} data-type={group}>{EMPLOYEE_TYPE_LABEL[group]}</span>
                    ))}
                  </div>
                </td>
                <td className="hrm-directory-count">{weekCounts.get(employee.id) ?? 0}</td>
                <td>
                  <div className="hrm-directory-actions">
                    {employee.editProfile && (
                      <button type="button" aria-label={`Sửa hồ sơ của ${employee.name}`} disabled={editDisabled} onClick={() => onEdit(employee)}>Sửa</button>
                    )}
                    <button type="button" aria-label={`Xem lịch của ${employee.name}`} onClick={() => onViewSchedule(employee)}>
                      <CalendarDays size={15} aria-hidden="true" /> Xem lịch
                    </button>
                    {onAssign && (
                      <button type="button" aria-label={`Phân ca cho ${employee.name}`} onClick={() => onAssign(employee)}>
                        <UserPlus size={15} aria-hidden="true" /> Phân ca
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={7} className="hrm-directory-empty">
                {employees.length ? 'Không tìm thấy nhân viên phù hợp.' : 'Chi nhánh chưa có nhân viên đủ điều kiện phân ca.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <footer className="hrm-directory-pagination">
          <span aria-live="polite">Trang {currentPage} / {totalPages}</span>
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Trang trước</button>
          <button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Trang sau</button>
        </footer>
      )}
    </section>
  )
}
