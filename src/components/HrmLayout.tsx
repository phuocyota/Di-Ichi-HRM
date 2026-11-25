import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Building2, CalendarDays, GraduationCap, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Presentation, Search, Users, X } from 'lucide-react'
import diIchiLogo from '../assets/logo/LOGO_Diichi.webp'
import './HrmLayout.css'

export type HrmView = 'overview' | 'employees' | 'departments' | 'students' | 'teachers' | 'calendar' | 'shifts'
type Props = {
  fullName: string
  accountScope?: string
  view: HrmView
  onViewChange: (view: HrmView) => void
  onLogout: () => void
  search: string
  onSearch: (value: string) => void
  children: ReactNode
}

const sidebarKey = 'diIchiHrmSidebar'
const readCollapsed = () => {
  try {
    return localStorage.getItem(sidebarKey) === 'collapsed'
  } catch {
    return false
  }
}

export default function HrmLayout({
  fullName, accountScope, view, onViewChange, onLogout, search, onSearch, children,
}: Props) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const drawer = useRef<HTMLDialogElement>(null)
  const name = fullName.trim() || 'Nhân sự'
  const initials = name.split(/\s+/).slice(-2).map((word) => word[0]).join('').toLocaleUpperCase('vi')
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeDrawerOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) drawer.current?.close()
    }
    desktop.addEventListener('change', closeDrawerOnDesktop)
    return () => desktop.removeEventListener('change', closeDrawerOnDesktop)
  }, [])

  const toggleSidebar = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(sidebarKey, next ? 'collapsed' : 'expanded')
    } catch {
      // Vẫn cho phép thu gọn trong phiên hiện tại.
    }
  }

  const navigate = (next: HrmView) => {
    drawer.current?.close()
    if (view !== next) {
      onViewChange(next)
      window.scrollTo(0, 0)
    }
  }

  const menuItems = <>
    <nav aria-label="Điều hướng chính" className="hrm-nav">
      <button type="button" title="Tổng quan" aria-current={view === 'overview' ? 'page' : undefined} onClick={() => navigate('overview')}>
        <LayoutDashboard className="hrm-nav-icon" aria-hidden="true" />
        <span>Tổng quan</span>
      </button>
      <button type="button" title="Quản lý nhân viên" aria-current={view === 'employees' ? 'page' : undefined} onClick={() => navigate('employees')}>
        <Users className="hrm-nav-icon" aria-hidden="true" />
        <span>Quản lý nhân viên</span>
      </button>
      <button type="button" title="Quản lý phòng ban" aria-current={view === 'departments' ? 'page' : undefined} onClick={() => navigate('departments')}>
        <Building2 className="hrm-nav-icon" aria-hidden="true" />
        <span>Quản lý phòng ban</span>
      </button>
      <button type="button" title="Danh sách học viên" aria-current={view === 'students' ? 'page' : undefined} onClick={() => navigate('students')}>
        <GraduationCap className="hrm-nav-icon" aria-hidden="true" />
        <span>Danh sách học viên</span>
      </button>
      <button type="button" title="Danh sách giáo viên" aria-current={view === 'teachers' ? 'page' : undefined} onClick={() => navigate('teachers')}>
        <Presentation className="hrm-nav-icon" aria-hidden="true" />
        <span>Danh sách giáo viên</span>
      </button>
      <button type="button" title="Lịch làm việc" aria-current={view === 'calendar' || view === 'shifts' ? 'page' : undefined} onClick={() => navigate('calendar')}>
        <CalendarDays className="hrm-nav-icon" aria-hidden="true" />
        <span>Lịch làm việc</span>
      </button>
    </nav>
    <div className="hrm-nav-footer">
      <button type="button" title="Đăng xuất" onClick={onLogout}>
        <LogOut size={18} aria-hidden="true" />
        <span>Đăng xuất</span>
      </button>
    </div>
  </>

  const brand = (
    <div className="hrm-brand">
      <img src={diIchiLogo} alt="Di-Ichi" />
      <p>Cổng nhân sự</p>
    </div>
  )

  return (
    <div className={collapsed ? 'hrm-schedule hrm-sidebar-collapsed' : 'hrm-schedule'}>
      <a className="hrm-skip-link" href="#hrm-main">Đến nội dung chính</a>
      <aside className="hrm-sidebar" aria-label="Menu nhân sự">
        {brand}
        {menuItems}
      </aside>
      <dialog
        ref={drawer}
        className="hrm-drawer"
        aria-label="Menu nhân sự"
        onClick={(event) => {
          if (event.target === event.currentTarget) drawer.current?.close()
        }}
      >
        <div className="hrm-drawer-panel">
          <header className="hrm-drawer-heading">
            {brand}
            <button className="hrm-icon-button" type="button" aria-label="Đóng menu" onClick={() => drawer.current?.close()}>
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          {menuItems}
        </div>
      </dialog>
      <div className="hrm-workspace">
        <header className="hrm-topbar">
          <div className="hrm-topbar-controls">
            <button className="hrm-icon-button hrm-mobile-menu" type="button" aria-label="Mở menu" aria-haspopup="dialog" onClick={() => drawer.current?.showModal()}>
              <Menu size={18} aria-hidden="true" />
            </button>
            <button className="hrm-icon-button hrm-desktop-menu" type="button" aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'} onClick={toggleSidebar}>
              <ToggleIcon size={18} aria-hidden="true" />
            </button>
            {view === 'calendar' && (
              <div className="hrm-quick-search" role="search">
                <Search size={16} aria-hidden="true" />
                <input type="search" aria-label="Tìm nhân viên trong lịch" placeholder="Tìm tên hoặc mã nhân viên…" value={search} onChange={(event) => onSearch(event.target.value)} />
              </div>
            )}
          </div>
          <div className="hrm-user" title={name}>
            <span className="hrm-user-avatar" aria-hidden="true">{initials}</span>
            <div className="hrm-user-details">
              <strong>{name}</strong>
              {accountScope && <small>{accountScope}</small>}
            </div>
          </div>
        </header>
        <main id="hrm-main" className="hrm-main" tabIndex={-1}>{children}</main>
      </div>
    </div>
  )
}
