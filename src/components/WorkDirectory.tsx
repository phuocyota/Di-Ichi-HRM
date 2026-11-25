import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { getWorkDirectory, type WorkDirectoryKind, type WorkDirectoryPage } from '../services/workDirectory.ts'
import './EmployeeDirectory.css'
import './WorkDirectory.css'

const studentStatuses: Record<string, string> = {
  trial: 'Học thử',
  active: 'Đang học',
  potential: 'Tiềm năng',
  stopped: 'Đã nghỉ',
  reserved: 'Bảo lưu',
}

const teacherStatuses: Record<string, string> = {
  active: 'Đang làm việc',
  inactive: 'Ngừng làm việc',
}

type DirectoryQuery = {
  page: number
  size: number
  search: string
  status: string
}

type Result = {
  query: DirectoryQuery
  revision: number
  data?: WorkDirectoryPage
  error?: string
}

export default function WorkDirectory({
  branchId,
  kind,
  revision,
}: {
  branchId: string
  kind: WorkDirectoryKind
  revision: number
}) {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState<DirectoryQuery>({ page: 1, size: 10, search: '', status: '' })
  const [result, setResult] = useState<Result>()
  const current = result?.query === query && result.revision === revision ? result : undefined
  const data = current?.data
  const { page, size, search, status } = query
  const sameFilter = result?.query.search === search && result.query.status === status
  const total = sameFilter ? result.data?.total : undefined
  const totalPages = Math.max(1, Math.ceil((total ?? 0) / size))
  const students = kind === 'students'
  const label = students ? 'học viên' : 'giáo viên'
  const statuses = students ? studentStatuses : teacherStatuses

  useEffect(() => {
    if (input.trim() === search) return
    const timer = window.setTimeout(() => {
      setQuery((current) => ({ ...current, search: input.trim(), page: 1 }))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [input, search])

  useEffect(() => {
    let active = true
    void getWorkDirectory(branchId, kind, query)
      .then((data) => {
        if (!active) return
        const lastPage = Math.max(1, Math.ceil(data.total / data.size))
        if (query.page > lastPage) setQuery({ ...query, page: lastPage })
        else setResult({ query, revision, data })
      })
      .catch((cause) => {
        if (active)
          setResult({
            query,
            revision,
            error: cause instanceof Error ? cause.message : `Không tải được danh sách ${label}.`,
          })
      })
    return () => {
      active = false
    }
  }, [branchId, kind, label, query, revision])

  return (
    <section className="hrm-panel hrm-people-directory" aria-label={`Bảng ${label}`}>
      <form
        className="hrm-people-filters"
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          if (input.trim() !== search) setQuery({ ...query, search: input.trim(), page: 1 })
        }}
      >
        <label className="hrm-people-field">
          <span>Tìm {label}</span>
          <span className="hrm-quick-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              maxLength={100}
              placeholder="Mã hoặc họ tên…"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
          </span>
        </label>
        <label className="hrm-people-field">
          <span>Trạng thái</span>
          <select
            value={status}
            onChange={(event) => setQuery({ ...query, status: event.target.value, search: input.trim(), page: 1 })}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(statuses).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
        {(input || status) && (
          <button
            type="button"
            onClick={() => {
              setInput('')
              setQuery({ ...query, search: '', status: '', page: 1 })
            }}
          >
            <X size={15} aria-hidden="true" /> Xóa bộ lọc
          </button>
        )}
      </form>
      {!current && (
        <p className="hrm-panel-message" role="status">
          Đang tải danh sách {label}…
        </p>
      )}
      {current?.error && (
        <p className="hrm-panel-message hrm-message-error" role="alert">
          {current.error}
        </p>
      )}
      {data && (
        <div className="hrm-directory-scroll" role="region" aria-label={`Danh sách ${label}`} tabIndex={0}>
          <table className="hrm-directory-table hrm-people-table">
            <thead>
              <tr>
                <th scope="col">Mã {students ? 'HV' : 'GV'}</th>
                <th scope="col">Họ và tên</th>
                <th scope="col">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((person) => {
                const value = person.status.toLowerCase()
                const initials = person.name
                  .trim()
                  .split(/\s+/)
                  .slice(-2)
                  .map((word) => word[0])
                  .join('')
                  .toLocaleUpperCase('vi')
                return (
                  <tr key={person.id}>
                    <td className="hrm-directory-code">{person.code}</td>
                    <th scope="row">
                      <span className="hrm-people-name">
                        <span className="hrm-people-avatar" aria-hidden="true">
                          {initials}
                        </span>
                        {person.name}
                      </span>
                    </th>
                    <td>
                      <span className="hrm-people-status" data-status={value}>
                        {Object.hasOwn(statuses, value) ? statuses[value] : person.status || '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {!data.data.length && (
                <tr>
                  <td colSpan={3} className="hrm-directory-empty">
                    {search || status ? `Không tìm thấy ${label} phù hợp.` : `Chi nhánh chưa có ${label}.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <footer className="hrm-people-pagination">
        <span role="status">
          {data &&
            (data.total
              ? `${((page - 1) * size + 1).toLocaleString('vi-VN')}–${Math.min(page * size, data.total).toLocaleString('vi-VN')} / ${data.total.toLocaleString('vi-VN')} ${label}`
              : `0 ${label}`)}
        </span>
        <label>
          Số dòng mỗi trang
          <select
            value={size}
            onChange={(event) =>
              setQuery({ ...query, size: Number(event.target.value), search: input.trim(), page: 1 })
            }
          >
            {[10, 20, 50].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="hrm-people-page-controls" aria-label="Phân trang">
          <button
            type="button"
            aria-label="Trang trước"
            disabled={!data || page === 1}
            onClick={() => setQuery({ ...query, page: page - 1 })}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span aria-live="polite">
            Trang {page} / {totalPages}
          </span>
          <button
            type="button"
            aria-label="Trang sau"
            disabled={!data || page >= totalPages}
            onClick={() => setQuery({ ...query, page: page + 1 })}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </footer>
    </section>
  )
}
