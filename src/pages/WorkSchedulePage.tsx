import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, CalendarOff, ChevronRight, RefreshCw, Users } from 'lucide-react'
import AssignDialog, { type AssignmentSeed } from '../components/AssignDialog.tsx'
import EmployeeDirectory from '../components/EmployeeDirectory.tsx'
import HrmLayout, { type HrmView } from '../components/HrmLayout.tsx'
import ShiftManagement from '../components/ShiftManagement.tsx'
import WorkOverview from '../components/WorkOverview.tsx'
import WorkTimeGrid from '../components/WorkTimeGrid.tsx'
import { addDays, todayVn, weekDays, weekStart, workSearchText } from '../lib/schedule.ts'
import { ApiError } from '../services/api.ts'
import type { HrmSession } from '../services/session.ts'
import {
  EMPLOYEE_TYPE_LABEL,
  assignEmployees,
  configureWorkShifts,
  getBranches,
  getEmployees,
  getSnapshot,
  getWorkOverview,
  removeAssignment,
  type AssignItem,
  type BranchWorkOverview,
  type WorkAssignment,
  type WorkBranch,
  type WorkEmployee,
  type WorkSnapshot,
} from '../services/workShifts.ts'
import './WorkSchedulePage.css'

const CONFLICT = 'Lịch vừa được cập nhật ở nơi khác, đã tải lại dữ liệu mới. Vui lòng thao tác lại.'
const pageTitles: Record<HrmView, string> = {
  overview: 'Tổng quan',
  employees: 'Quản lý nhân viên',
  calendar: 'Phân lịch làm việc',
  shifts: 'Quản lý ca làm',
}
type OverviewLoad = { request: number; results: BranchWorkOverview[]; error: string }

/** Cơ sở đang xem được nhớ theo tài khoản trên trình duyệt này (chỉ tiện ích, có thể mất). */
const branchKey = (userId: string) => `diIchiHrmBranch:${userId}`
const rememberedBranch = (userId: string) => {
  try {
    return localStorage.getItem(branchKey(userId))
  } catch {
    return null
  }
}
const rememberBranch = (userId: string, branchId: string) => {
  try {
    localStorage.setItem(branchKey(userId), branchId)
  } catch {
    // Bỏ qua khi trình duyệt chặn lưu trữ.
  }
}

export default function WorkSchedulePage({ session, onLogout }: { session: HrmSession; onLogout: () => void }) {
  // SUPER_HRM không có cơ sở: chờ danh sách cơ sở rồi chọn cơ sở đã nhớ hoặc cơ sở đầu tiên.
  const [branchId, setBranchId] = useState(session.branchId ?? '')
  const [branches, setBranches] = useState<WorkBranch[]>([])
  const [allBranches, setAllBranches] = useState(false)
  /** Cơ sở của lần tải mới nhất: bỏ kết quả về muộn của cơ sở cũ khi đã đổi cơ sở. */
  const latestBranch = useRef(branchId)
  const [week, setWeek] = useState(() => weekStart(todayVn()))
  const [snapshot, setSnapshot] = useState<WorkSnapshot | null>(null)
  const [canAssign, setCanAssign] = useState(false)
  const [employees, setEmployees] = useState<WorkEmployee[]>([])
  const [unclassified, setUnclassified] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [calendarPersonId, setCalendarPersonId] = useState<string | null>(null)
  const [view, setView] = useState<HrmView>('overview')
  const [overviewRequest, setOverviewRequest] = useState(0)
  const [overviewLoad, setOverviewLoad] = useState<OverviewLoad | null>(null)
  const [overviewActionError, setOverviewActionError] = useState('')
  const [savingShifts, setSavingShifts] = useState(false)
  const [dialog, setDialog] = useState<AssignmentSeed | null>(null)
  const [selected, setSelected] = useState<WorkAssignment | null>(null)
  const [removing, setRemoving] = useState(false)
  const detailRef = useRef<HTMLDialogElement>(null)
  const showOverview = view === 'overview'
  const overview = overviewLoad?.request === overviewRequest ? overviewLoad : null
  const selectedOverviewBranch = overview?.results.find(({ branch }) => branch.id === selected?.branchId)
  const canRemove = selected && (showOverview
    ? selectedOverviewBranch?.snapshot.canAssign
    : selected.branchId === branchId && canAssign)

  const refreshOverview = () => {
    setOverviewActionError('')
    setOverviewRequest((request) => request + 1)
  }

  useEffect(() => {
    if (!showOverview) return
    let active = true
    void getWorkOverview()
      .then((results) => {
        if (active) setOverviewLoad({ request: overviewRequest, results, error: '' })
      })
      .catch((cause) => {
        if (active) setOverviewLoad({
          request: overviewRequest,
          results: [],
          error: cause instanceof Error ? cause.message : 'Không tải được tổng quan phân ca.',
        })
      })
    return () => { active = false }
  }, [showOverview, overviewRequest])

  useEffect(() => {
    if (showOverview) return
    // Tải danh sách cơ sở được phân lịch (super_hrm: mọi cơ sở).
    let active = true
    getBranches()
      .then((result) => {
        if (!active) return
        setBranches(result.branches)
        setAllBranches(result.allBranches)
        const saved = rememberedBranch(session.userId)
        if (result.allBranches && saved && saved !== session.branchId && result.branches.some((b) => b.id === saved))
          setBranchId(saved)
        else if (!session.branchId) {
          if (result.branches[0]) setBranchId(result.branches[0].id)
          else {
            setError('Chưa có cơ sở nào để phân lịch.')
            setLoading(false)
          }
        }
      })
      .catch((cause) => {
        // Không lấy được danh sách: vẫn dùng cơ sở của tài khoản (SUPER_HRM không có cơ sở thì báo lỗi).
        if (!active || session.branchId) return
        setError(cause instanceof Error ? cause.message : 'Không tải được danh sách cơ sở.')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [session.userId, session.branchId, showOverview])

  const changeBranch = (next: string) => {
    if (next === branchId || savingShifts) return
    rememberBranch(session.userId, next)
    latestBranch.current = next
    setSnapshot(null)
    setEmployees([])
    setUnclassified(0)
    setNotice('')
    setCalendarPersonId(null)
    setSearch('')
    setDialog(null)
    setSelected(null)
    setBranchId(next)
  }

  useEffect(() => {
    if (!selected) return
    const detail = detailRef.current
    detail?.showModal()
    return () => detail?.close()
  }, [selected])

  const load = useCallback(async () => {
    latestBranch.current = branchId
    if (!branchId) return
    setLoading(true)
    setError('')
    try {
      const [next, catalog] = await Promise.all([getSnapshot(branchId), getEmployees(branchId)])
      if (latestBranch.current !== branchId) return
      setSnapshot(next)
      setCanAssign(Boolean(next.canAssign))
      setEmployees(catalog.employees)
      setUnclassified(catalog.unclassified)
    } catch (cause) {
      if (latestBranch.current !== branchId) return
      if (cause instanceof ApiError && cause.status === 403) {
        setSnapshot(null)
        setEmployees([])
        setUnclassified(0)
        setCanAssign(false)
      }
      setError(
        cause instanceof ApiError && cause.status === 403
          ? 'Tài khoản chưa được cấp vai trò "Nhân sự phân lịch". Liên hệ quản trị viên để được cấp quyền.'
          : cause instanceof Error ? cause.message : 'Không tải được phân lịch.',
      )
    } finally {
      if (latestBranch.current === branchId) setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    if (showOverview) return
    // Tải dữ liệu từ máy chủ khi mở trang (đồng bộ với hệ thống bên ngoài).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load, showOverview])

  /** Ghi phân lịch; 409 (revision lệch) thì tải lại và báo người dùng. */
  const mutate = async (action: (revision: number) => Promise<WorkSnapshot>, message: string, revision = snapshot?.revision) => {
    if (revision === undefined) throw new Error('Vui lòng tải lại lịch làm việc trước khi lưu.')
    try {
      const next = await action(revision)
      if (latestBranch.current !== branchId) return
      setSnapshot(next)
      setNotice(message)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        await load()
        throw new Error(CONFLICT, { cause })
      }
      throw cause
    }
  }

  const saveShifts = async (shifts: WorkSnapshot['shifts'], revision: number) => {
    setSavingShifts(true)
    setNotice('')
    try {
      await mutate((currentRevision) => configureWorkShifts(branchId, currentRevision, shifts), 'Đã lưu khung giờ ca làm.', revision)
    } finally {
      setSavingShifts(false)
    }
  }

  const assign = async (items: AssignItem[]) => {
    await mutate((revision) => assignEmployees(branchId, revision, items), `Đã phân ${items.length} lịch làm việc.`)
    setDialog(null)
  }

  const remove = async (item: WorkAssignment) => {
    if (removing || !canRemove) return
    setRemoving(true)
    setError('')
    setOverviewActionError('')
    try {
      const message = `Đã gỡ lịch của ${item.personName || 'nhân viên'}.`
      if (showOverview && selectedOverviewBranch) {
        const current = selectedOverviewBranch.snapshot
        const next = await removeAssignment(current.branchId, item.id, current.revision)
        setOverviewLoad((previous) => previous && {
          ...previous,
          results: previous.results.map((entry) => entry.branch.id === next.branchId
            ? { ...entry, snapshot: { ...next, canAssign: current.canAssign } }
            : entry),
        })
        setNotice(message)
      } else {
        await mutate((revision) => removeAssignment(branchId, item.id, revision), message)
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Không gỡ được lịch.'
      if (showOverview) {
        const conflict = cause instanceof ApiError && cause.status === 409
        if (conflict || (cause instanceof ApiError && cause.status === 403)) refreshOverview()
        setOverviewActionError(conflict ? CONFLICT : message)
      } else setError(message)
    } finally {
      setRemoving(false)
      setSelected(null)
    }
  }

  const today = todayVn()
  const days = weekDays(week)
  const end = days[6]
  const branchName = branches.find((branch) => branch.id === branchId)?.name
  const shifts = snapshot?.shifts || []
  const assignments = snapshot?.roster.assignments.filter((item) => item.branchId === branchId && item.kind === 'employee') || []
  const weekAssignments = assignments.filter((item) => item.date >= week && item.date <= end)
  const previousDay = addDays(week, -1)
  const calendarAssignments = weekAssignments.concat(assignments.filter((item) => item.date === previousDay && item.end < item.start))
  const branchDaysOff = snapshot?.roster.preferences.filter((item) => item.shiftId === 'OFF' && item.branchId === branchId) || []
  const daysOff = branchDaysOff.filter((item) => item.date >= week && item.date <= end)
  const peopleById = new Map(employees.map((person) => [person.id, person]))
  const assignmentNames = new Map(assignments.map((item) => [item.personId, item.personName]))
  const personName = (personId: string) => peopleById.get(personId)?.name || assignmentNames.get(personId) || 'Nhân viên'
  const query = workSearchText(search)
  const matchesPerson = (personId: string, name = personName(personId)) =>
    calendarPersonId ? personId === calendarPersonId : !query || workSearchText(`${name} ${peopleById.get(personId)?.code || ''}`).includes(query)
  const dateLabel = (date: string) => date.split('-').reverse().join('/')
  const period = `${dateLabel(week)} – ${dateLabel(end)}`
  const openAssignment = (shiftId: string, date: string, employee?: WorkEmployee) => {
    setNotice('')
    setDialog({ shiftId, date, employee })
  }
  const openWeek = (employee?: WorkEmployee) => {
    setWeek(weekStart(today))
    setSearch(employee?.code || employee?.name || '')
    setCalendarPersonId(employee?.id ?? null)
    setView('calendar')
    window.scrollTo(0, 0)
  }
  const defaultShift = shifts[0]
  const showEmployees = view === 'employees'
  const showCalendar = view === 'calendar'
  const showShiftManagement = view === 'shifts'
  const pageTitle = pageTitles[view]
  const description = {
    overview: 'Tổng hợp ca làm và ngày nghỉ từ tất cả chi nhánh được phép xem.',
    employees: branchName ? `Tra cứu nhân viên và phân ca tại ${branchName}.` : 'Tra cứu nhân viên và phân ca theo chi nhánh.',
    calendar: 'Quản lý lịch làm việc của nhân viên CSKH và Sale theo chi nhánh.',
    shifts: 'Thiết lập ca sáng, ca tối và các ca bổ sung theo chi nhánh.',
  }[view]
  const branchPicker = allBranches && branches.length > 0 && (
    <select aria-label="Chi nhánh" value={branchId} onChange={(event) => changeBranch(event.target.value)} disabled={loading || savingShifts}>
      {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
    </select>
  )

  return (
    <HrmLayout
      fullName={session.fullName}
      branchName={showOverview ? undefined : branchName}
      view={view}
      onViewChange={(next) => {
        if (next === 'overview') refreshOverview()
        setNotice('')
        setView(next)
      }}
      onLogout={onLogout}
      search={search}
      onSearch={(value) => {
        setCalendarPersonId(null)
        setSearch(value)
      }}
    >
      <header className="hrm-page-header">
        <nav className="hrm-breadcrumb" aria-label="Đường dẫn">
          <span>Cổng nhân sự</span>
          <ChevronRight size={12} aria-hidden="true" />
          <span aria-current="page">{pageTitle}</span>
        </nav>
        <div className="hrm-page-heading">
          <div>
            <h1>{pageTitle}</h1>
            <p>{description}</p>
          </div>
          <div className="hrm-page-actions">
            {showEmployees && branchPicker}
            <button type="button" onClick={showOverview ? refreshOverview : () => void load()}
              disabled={showOverview ? !overview || removing : loading || savingShifts || !branchId}>
              <RefreshCw size={16} aria-hidden="true" />
              {(showOverview ? !overview : loading) ? 'Đang tải…' : 'Tải lại'}
            </button>
          </div>
        </div>
        {(showCalendar || showShiftManagement) && (
          <nav className="hrm-schedule-tabs" aria-label="Lịch và cấu hình ca làm">
            <button type="button" aria-current={showCalendar ? 'page' : undefined} onClick={() => setView('calendar')}>Lịch tuần</button>
            <button type="button" aria-current={showShiftManagement ? 'page' : undefined} onClick={() => setView('shifts')}>Quản lý ca làm</button>
          </nav>
        )}
      </header>
      {!showOverview && error && <p className="hrm-message hrm-message-error" role="alert">{error}</p>}
      {notice && <p className="hrm-message hrm-message-success" role="status">{notice}</p>}
      {!showOverview && snapshot && !canAssign && <p className="hrm-message">Bạn có quyền xem lịch làm việc.</p>}
      {showOverview && overviewActionError && <p className="hrm-message hrm-message-error" role="alert">{overviewActionError}</p>}
      {showOverview && !overview && <p className="hrm-message" role="status">Đang tải tổng quan phân ca…</p>}
      {showOverview && overview?.error && <p className="hrm-message hrm-message-error" role="alert">{overview.error}</p>}
      {showOverview && overview && !overview.error && !overview.results.length && <p className="hrm-message">Chưa có chi nhánh để tổng hợp.</p>}
      {showOverview && overview && overview.results.length > 0 && (
        <WorkOverview
          today={today}
          results={overview.results}
          onOpenWeek={openWeek}
          onDetail={setSelected}
        />
      )}
      {showEmployees && loading && <p className="hrm-message" role="status">Đang tải danh sách nhân viên…</p>}
      {showEmployees && snapshot && (
        <EmployeeDirectory
          key={branchId}
          today={today}
          employees={employees}
          assignments={assignments}
          unclassified={unclassified}
          onViewSchedule={openWeek}
          onAssign={canAssign && !loading && !savingShifts && defaultShift
            ? (employee) => openAssignment(defaultShift.id, today, employee)
            : undefined}
        />
      )}
      {showCalendar && unclassified > 0 && (
        <p className="hrm-message">Có {unclassified} nhân viên cần được phân loại CSKH hoặc Sale trước khi phân ca.</p>
      )}
      {showCalendar && snapshot && (
        <dl className="hrm-stats" aria-label="Tổng quan tuần">
          <div data-tone="blue">
            <dt>Ca được phân <CalendarDays className="hrm-stat-icon" aria-hidden="true" /></dt>
            <dd>{weekAssignments.length}</dd>
          </div>
          <div data-tone="green">
            <dt>Nhân viên có lịch <Users className="hrm-stat-icon" aria-hidden="true" /></dt>
            <dd>{new Set(weekAssignments.map((item) => item.personId)).size}</dd>
          </div>
          <div data-tone="amber">
            <dt>Lượt nghỉ <CalendarOff className="hrm-stat-icon" aria-hidden="true" /></dt>
            <dd>{daysOff.length}</dd>
          </div>
        </dl>
      )}
      {showCalendar && <section className="hrm-panel" aria-labelledby="hrm-calendar-title">
        <div className="hrm-panel-heading">
          <div>
            <h2 id="hrm-calendar-title">Lịch tuần {branchName && `· ${branchName}`}</h2>
            <p>Phân ca theo ngày và khung giờ</p>
          </div>
          <span className="hrm-period">{period}</span>
        </div>
        <div className="hrm-filters">
          <div className="hrm-week-nav">
            <button type="button" aria-label="Tuần trước" onClick={() => setWeek(addDays(week, -7))}>‹</button>
            <label className="hrm-week-picker">
              <span aria-hidden="true">{period}</span>
              <input aria-label="Chọn tuần" type="date" value={week} onChange={(event) => {
                if (event.target.value) setWeek(weekStart(event.target.value))
              }} />
            </label>
            <button type="button" aria-label="Tuần sau" onClick={() => setWeek(addDays(week, 7))}>›</button>
            <button type="button" onClick={() => setWeek(weekStart(today))}>Tuần này</button>
          </div>
          {branchPicker}
        </div>
        {snapshot && (
          <WorkTimeGrid
            week={week}
            today={today}
            shifts={shifts}
            assignments={calendarAssignments.filter((item) => matchesPerson(item.personId, item.personName))}
            rangeAssignments={calendarAssignments}
            daysOff={daysOff.filter((item) => matchesPerson(item.personId))}
            personName={personName}
            onAdd={canAssign && !loading && !savingShifts ? openAssignment : undefined}
            onDetail={setSelected}
          />
        )}
        {loading && <p className="hrm-panel-message" role="status">Đang tải lịch làm việc…</p>}
        {snapshot && !loading && !shifts.length && <p className="hrm-panel-message">Chi nhánh chưa có ca làm được cấu hình.</p>}
      </section>}
      {snapshot && (
        <div hidden={!showShiftManagement}>
          <ShiftManagement
            key={snapshot.branchId}
            snapshot={snapshot}
            branchName={branchName}
            branchPicker={branchPicker}
            canAssign={canAssign}
            loading={loading}
            saving={savingShifts}
            onSave={saveShifts}
          />
        </div>
      )}
      {showShiftManagement && !snapshot && branchPicker && <div className="hrm-shift-branch">{branchPicker}</div>}
      {showShiftManagement && loading && <p className="hrm-message" role="status">Đang tải cấu hình ca làm…</p>}
      {dialog && snapshot && (
        <AssignDialog
          branchName={branchName}
          shifts={shifts}
          employees={employees}
          days={weekDays(weekStart(dialog.date))}
          existing={assignments}
          initial={dialog}
          onSubmit={assign}
          onClose={() => setDialog(null)}
        />
      )}
      {selected && (
        <dialog
          ref={detailRef}
          className="assign-dialog hrm-detail"
          aria-labelledby="hrm-detail-title"
          onCancel={(event) => {
            event.preventDefault()
            if (!removing) setSelected(null)
          }}
          onClick={(event) => {
            if (!removing && event.target === event.currentTarget) setSelected(null)
          }}
        >
          <header className="assign-header">
            <h2 id="hrm-detail-title">Chi tiết ca làm</h2>
            <button type="button" className="assign-close" aria-label="Đóng" disabled={removing} onClick={() => setSelected(null)}>×</button>
          </header>
          <div className="assign-form">
            <dl className="hrm-detail-fields">
              <div><dt>Nhân viên</dt><dd>{selected.personName || (showOverview ? 'Nhân viên' : personName(selected.personId))}</dd></div>
              {selectedOverviewBranch && showOverview && <div><dt>Chi nhánh</dt><dd>{selectedOverviewBranch.branch.name}</dd></div>}
              {selected.employeeType && <div><dt>Loại nhân viên</dt><dd>{EMPLOYEE_TYPE_LABEL[selected.employeeType]}</dd></div>}
              <div><dt>Ngày làm việc</dt><dd>{dateLabel(selected.date)}</dd></div>
              <div><dt>Khung giờ</dt><dd>{selected.start}–{selected.end}</dd></div>
            </dl>
            {canRemove && <p className="hrm-detail-note">Khi gỡ lịch, hệ thống cũng xóa bản ghi chấm công gắn với ca này nếu có.</p>}
            <footer className="assign-actions">
              <button type="button" disabled={removing} onClick={() => setSelected(null)}>Đóng</button>
              {canRemove && <button type="button" className="assign-save" disabled={removing || (!showOverview && (loading || savingShifts))} onClick={() => void remove(selected)}>{removing ? 'Đang gỡ…' : 'Gỡ lịch'}</button>}
            </footer>
          </div>
        </dialog>
      )}
    </HrmLayout>
  )
}
