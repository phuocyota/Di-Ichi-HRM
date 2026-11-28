import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlarmClock, Camera, CircleCheck, Search, UserX, X } from 'lucide-react'
import {
  ATTENDANCE_STATUS_LABEL,
  attendanceRows,
  formatVnClock,
  type AttendanceRow,
} from '../lib/attendance.ts'
import { addDays, todayVn, weekStart, weekdayLabel, workSearchText } from '../lib/schedule.ts'
import {
  getAttendanceChecks,
  getAttendancePhoto,
  type AttendanceCheck,
  type WorkEmployee,
  type WorkSnapshot,
} from '../services/workShifts.ts'
import './AttendanceBoard.css'

type Props = {
  branchId: string
  branchName?: string
  snapshot: WorkSnapshot
  employees: WorkEmployee[]
  branchPicker?: ReactNode
}

const dateLabel = (date: string) => date.split('-').reverse().join('/')
/** API lịch sử check giới hạn 62 ngày; khoảng dài hơn thì không tải ảnh check-out. */
const MAX_CHECK_RANGE_DAYS = 62
const dayCount = (from: string, to: string) => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1
type PhotoKind = 'check-in' | 'check-out'
const PHOTO_LABEL: Record<PhotoKind, string> = { 'check-in': 'Check-in', 'check-out': 'Check-out' }
const minutes = (value: number) => (value >= 60 ? `${Math.floor(value / 60)} giờ ${value % 60} phút` : `${value} phút`)

/** Bảng check-in / check-out theo ca của mọi nhân viên trong một cơ sở, mặc định hôm nay. */
export default function AttendanceBoard({ branchId, branchName, snapshot, employees, branchPicker }: Props) {
  const today = todayVn()
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [search, setSearch] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [photo, setPhoto] = useState<{ row: AttendanceRow; kind: PhotoKind; url?: string; error?: string } | null>(null)
  // Ảnh check-out chỉ có trong lịch sử check (roster chỉ giữ ảnh check-in).
  const [checks, setChecks] = useState<AttendanceCheck[]>([])
  const photoDialog = useRef<HTMLDialogElement>(null)

  // Trạng thái "Chưa check-in"/"Vắng" phụ thuộc giờ hiện tại nên cập nhật mỗi phút.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const peopleById = useMemo(() => new Map(employees.map((person) => [person.id, person])), [employees])
  const query = workSearchText(search)
  const rows = useMemo(() => attendanceRows(snapshot.roster.assignments, snapshot.roster.attendance, {
    branchId,
    fromDate: fromDate <= toDate ? fromDate : toDate,
    toDate: fromDate <= toDate ? toDate : fromDate,
    matchesPerson: query
      ? (personId) => {
          const person = peopleById.get(personId)
          return workSearchText(`${person?.name || ''} ${person?.code || ''}`).includes(query)
        }
      : undefined,
  }, now), [branchId, fromDate, now, peopleById, query, snapshot, toDate])

  const rangeFrom = fromDate <= toDate ? fromDate : toDate
  const rangeTo = fromDate <= toDate ? toDate : fromDate
  useEffect(() => {
    if (dayCount(rangeFrom, rangeTo) > MAX_CHECK_RANGE_DAYS) {
      setChecks([])
      return
    }
    let active = true
    getAttendanceChecks(branchId, rangeFrom, rangeTo)
      .then((result) => { if (active) setChecks(result.checks) })
      .catch(() => { if (active) setChecks([]) })
    return () => { active = false }
    // Tải lại khi roster đổi (nhân viên vừa check-in/out).
  }, [branchId, rangeFrom, rangeTo, snapshot.revision])

  // Ảnh check-out mới nhất của mỗi ca (danh sách mới nhất trước).
  const checkOutPhotos = useMemo(() => {
    const photos = new Map<string, string>()
    for (const check of checks) {
      if (check.type === 'check-out' && check.photoId && !photos.has(check.assignmentId)) photos.set(check.assignmentId, check.photoId)
    }
    return photos
  }, [checks])

  const count = (...statuses: AttendanceRow['status'][]) => rows.filter((row) => statuses.includes(row.status)).length
  const checkedIn = rows.filter((row) => row.record?.checkIn).length
  const late = rows.filter((row) => row.lateMinutes > 0).length
  const absent = count('absent')

  useEffect(() => {
    if (!photo) return
    const dialog = photoDialog.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [photo])

  // Thu hồi object URL khi đóng/đổi ảnh để không giữ blob trong bộ nhớ.
  useEffect(() => () => { if (photo?.url) URL.revokeObjectURL(photo.url) }, [photo?.url])

  const photoIdOf = (row: AttendanceRow, kind: PhotoKind) =>
    kind === 'check-in' ? row.record?.checkInPhotoId : checkOutPhotos.get(row.assignment.id)

  const openPhoto = async (row: AttendanceRow, kind: PhotoKind) => {
    const fileId = photoIdOf(row, kind)
    if (!fileId) return
    setPhoto({ row, kind })
    try {
      const blob = await getAttendancePhoto(branchId, fileId)
      const url = URL.createObjectURL(blob)
      setPhoto((current) => {
        if (current?.row !== row || current.kind !== kind) {
          URL.revokeObjectURL(url)
          return current
        }
        return { row, kind, url }
      })
    } catch (cause) {
      setPhoto((current) => current?.row === row && current.kind === kind
        ? { row, kind, error: cause instanceof Error ? cause.message : `Không tải được ảnh ${kind}.` }
        : current)
    }
  }

  const nameOf = (row: AttendanceRow) => peopleById.get(row.assignment.personId)?.name || row.assignment.personName || 'Nhân viên'
  const setRange = (from: string, to: string) => {
    setFromDate(from)
    setToDate(to)
  }

  return (
    <>
      <dl className="hrm-stats hrm-attendance-stats" aria-label="Tổng quan chấm công">
        <div data-tone="blue">
          <dt>Ca trong khoảng <AlarmClock className="hrm-stat-icon" aria-hidden="true" /></dt>
          <dd>{rows.length}</dd>
        </div>
        <div data-tone="green">
          <dt>Đã check-in <CircleCheck className="hrm-stat-icon" aria-hidden="true" /></dt>
          <dd>{checkedIn}</dd>
        </div>
        <div data-tone="amber">
          <dt>Đi muộn <AlarmClock className="hrm-stat-icon" aria-hidden="true" /></dt>
          <dd>{late}</dd>
        </div>
        <div data-tone="rose">
          <dt>Vắng <UserX className="hrm-stat-icon" aria-hidden="true" /></dt>
          <dd>{absent}</dd>
        </div>
      </dl>

      <section className="hrm-panel" aria-labelledby="hrm-attendance-title">
        <div className="hrm-panel-heading">
          <div>
            <h2 id="hrm-attendance-title">Chấm công {branchName && `· ${branchName}`}</h2>
            <p>Giờ check-in / check-out theo từng ca đã phân (giờ Việt Nam)</p>
          </div>
          <span className="hrm-period">{fromDate === toDate ? dateLabel(fromDate) : `${dateLabel(fromDate)} – ${dateLabel(toDate)}`}</span>
        </div>
        <div className="hrm-attendance-filters">
          <label className="hrm-people-field">
            Tìm nhân viên
            <span className="hrm-quick-search">
              <Search size={16} aria-hidden="true" />
              <input type="search" placeholder="Tên hoặc mã nhân viên…" value={search} onChange={(event) => setSearch(event.target.value)} />
            </span>
          </label>
          <label className="hrm-people-field">
            Từ ngày
            <input type="date" value={fromDate} max={toDate} onChange={(event) => event.target.value && setFromDate(event.target.value)} />
          </label>
          <label className="hrm-people-field">
            Đến ngày
            <input type="date" value={toDate} min={fromDate} onChange={(event) => event.target.value && setToDate(event.target.value)} />
          </label>
          <div className="hrm-attendance-quick" role="group" aria-label="Chọn nhanh khoảng ngày">
            <button type="button" onClick={() => setRange(today, today)}>Hôm nay</button>
            <button type="button" onClick={() => setRange(addDays(today, -1), addDays(today, -1))}>Hôm qua</button>
            <button type="button" onClick={() => setRange(weekStart(today), addDays(weekStart(today), 6))}>Tuần này</button>
          </div>
          {branchPicker}
        </div>
        <div className="hrm-directory-scroll" role="region" aria-label="Bảng chấm công" tabIndex={0}>
          <table className="hrm-directory-table hrm-attendance-table">
            <thead>
              <tr>
                <th scope="col">Ngày</th>
                <th scope="col">Nhân viên</th>
                <th scope="col">Ca</th>
                <th scope="col">Check-in</th>
                <th scope="col">Check-out</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Ảnh</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const { assignment, record } = row
                const person = peopleById.get(assignment.personId)
                return (
                  <tr key={assignment.id}>
                    <td>{weekdayLabel(assignment.date)} {dateLabel(assignment.date)}</td>
                    <th scope="row">
                      <span className="hrm-attendance-person">
                        {nameOf(row)}
                        {person?.code && <small>{person.code}</small>}
                      </span>
                    </th>
                    <td className="hrm-attendance-time">{assignment.start}–{assignment.end}</td>
                    <td className="hrm-attendance-time">
                      {record?.checkIn ? formatVnClock(record.checkIn) : '—'}
                      {row.lateMinutes > 0 && <small className="hrm-attendance-warn">Muộn {minutes(row.lateMinutes)}</small>}
                    </td>
                    <td className="hrm-attendance-time">
                      {record?.checkOut ? formatVnClock(record.checkOut) : '—'}
                      {row.earlyMinutes > 0 && <small className="hrm-attendance-warn">Sớm {minutes(row.earlyMinutes)}</small>}
                    </td>
                    <td>
                      <span className="hrm-attendance-status" data-status={row.status}>{ATTENDANCE_STATUS_LABEL[row.status]}</span>
                      {record?.source === 'admin' && <small className="hrm-attendance-source">Quản trị viên chấm</small>}
                    </td>
                    <td>
                      {record?.checkInPhotoId || checkOutPhotos.has(assignment.id)
                        ? (['check-in', 'check-out'] as const).filter((kind) => photoIdOf(row, kind)).map((kind) => (
                            <button key={kind} type="button" className="hrm-attendance-photo" onClick={() => void openPhoto(row, kind)}>
                              <Camera size={15} aria-hidden="true" /> {PHOTO_LABEL[kind]}
                            </button>
                          ))
                        : '—'}
                    </td>
                  </tr>
                )
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="hrm-directory-empty">
                    {query ? 'Không tìm thấy nhân viên phù hợp.' : 'Không có ca làm nào trong khoảng ngày đã chọn.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {photo && (
        <dialog
          ref={photoDialog}
          className="assign-dialog hrm-attendance-photo-dialog"
          aria-labelledby="hrm-attendance-photo-title"
          onCancel={(event) => { event.preventDefault(); setPhoto(null) }}
          onClick={(event) => { if (event.target === event.currentTarget) setPhoto(null) }}
        >
          <header className="assign-header">
            <h2 id="hrm-attendance-photo-title">
              Ảnh {photo.kind} · {nameOf(photo.row)} · {formatVnClock(photo.kind === 'check-in' ? photo.row.record?.checkIn : photo.row.record?.checkOut)} {dateLabel(photo.row.assignment.date)}
            </h2>
            <button type="button" className="assign-close" aria-label="Đóng" onClick={() => setPhoto(null)}><X size={18} aria-hidden="true" /></button>
          </header>
          <div className="assign-form">
            {!photo.url && !photo.error && <p role="status">Đang tải ảnh…</p>}
            {photo.error && <p className="hrm-message hrm-message-error" role="alert">{photo.error}</p>}
            {photo.url && <img src={photo.url} alt={`Ảnh ${photo.kind} của ${nameOf(photo.row)}`} />}
          </div>
        </dialog>
      )}
    </>
  )
}
