import { request } from './api.ts'
import { SUPER_HRM, type HrmSession } from './session.ts'

export type EmployeeType = 'cskh' | 'sale'

export type WorkShift = { id: string; name: string; start: string; end: string }

export type WorkAssignment = {
  id: string
  kind: string
  personId: string
  branchId: string
  date: string
  start: string
  end: string
  shiftId?: string
  employeeType?: EmployeeType
  personName?: string
}

export type WorkPreference = { personId: string; branchId: string; date: string; shiftId: string }

export type WorkSnapshot = {
  branchId: string
  revision: number
  saved?: boolean
  shifts: WorkShift[]
  roster: { assignments: WorkAssignment[]; preferences: WorkPreference[]; attendance: unknown[] }
  canAssign?: boolean
}

export type WorkEmployee = {
  id: string
  code: string
  name: string
  position: string
  department?: string
  employeeTypes: EmployeeType[]
}

export type AssignItem = { personId: string; date: string; shiftId: string; employeeType: EmployeeType }

export type NewWorkEmployee = {
  code: string
  name: string
  departmentId: string
  phone?: string
  email: string
}

export type WorkEmployeeCredentials = { email: string; password: string }
type CreatedWorkEmployee = Pick<WorkEmployee, 'id' | 'code' | 'name'> & { credentials: WorkEmployeeCredentials }
export type WorkEmployeeDraft = Omit<NewWorkEmployee, 'email'> & { id: string; email?: string }
export type WorkDepartment = { id: string; code: string; name: string; status: string }
export type WorkDepartmentInput = Omit<WorkDepartment, 'id' | 'status'> & { status: 'active' | 'inactive' }
export const isActiveDepartment = (department: WorkDepartment) => department.status.trim().toLowerCase() === 'active'

export const EMPLOYEE_TYPE_LABEL: Record<EmployeeType, string> = { cskh: 'CSKH', sale: 'Sale' }

export async function loginStaff(email: string, password: string): Promise<HrmSession> {
  const data = await request<Partial<HrmSession>>('POST', '/auth/staff/login', { email, password })
  if (!data.accessToken || (!data.branchId && data.userType !== SUPER_HRM))
    throw new Error('Tài khoản chưa được gắn với chi nhánh.')
  return {
    accessToken: data.accessToken,
    userId: data.userId || '',
    userType: data.userType || '',
    branchId: data.branchId || null,
    fullName: data.fullName || '',
  }
}

export type WorkBranch = { id: string; code: string; name: string }

/** Cơ sở được phân lịch: tài khoản `super_hrm` nhận mọi cơ sở (`allBranches`), còn lại chỉ cơ sở của mình. */
export const getBranches = () =>
  request<{ homeBranchId: string | null; allBranches: boolean; branches: WorkBranch[] }>('GET', '/work-shifts/branches')

export const getEmployeeBranches = () =>
  request<WorkBranch[]>('GET', '/work-shifts/employee-branches')

const base = (branchId: string) => `/work-shifts/branches/${encodeURIComponent(branchId)}`

export const getSnapshot = (branchId: string) => request<WorkSnapshot>('GET', base(branchId))

export type BranchWorkOverview = { branch: WorkBranch; snapshot: WorkSnapshot }

export async function getWorkOverview(): Promise<BranchWorkOverview[]> {
  const { branches } = await getBranches()
  const results = await Promise.allSettled(branches.map(async (branch) => {
    const snapshot = await getSnapshot(branch.id)
    if (snapshot.branchId !== branch.id) throw new Error('Chi nhánh trả về không khớp yêu cầu.')
    return { branch, snapshot }
  }))
  const unavailable = results.flatMap((result, index) => result.status === 'rejected' ? [branches[index].name] : [])
  if (unavailable.length) throw new Error(`Không tải được dữ liệu của ${unavailable.join(', ')}. Vui lòng thử lại để xem tổng đầy đủ.`)
  return results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
}

export const configureWorkShifts = (branchId: string, revision: number, shifts: WorkShift[]) =>
  request<WorkSnapshot>('PUT', base(branchId), { revision, shifts })

export const getEmployees = (branchId: string) =>
  request<{ employees: WorkEmployee[]; unclassified: number; canCreateEmployee?: boolean }>('GET', `${base(branchId)}/employees`)

export const createWorkEmployee = (branchId: string, employee: NewWorkEmployee) =>
  request<CreatedWorkEmployee>('POST', `${base(branchId)}/employees`, employee)

export const getWorkDepartments = (branchId: string) =>
  request<{ departments: WorkDepartment[]; canManage: boolean }>('GET', `${base(branchId)}/departments`)

export const saveWorkDepartment = (branchId: string, department: WorkDepartmentInput, id?: string) =>
  request<WorkDepartment>(
    id ? 'PATCH' : 'POST',
    `${base(branchId)}/departments${id ? `/${encodeURIComponent(id)}` : ''}`,
    department,
  )

const draftsPath = (branchId: string) => `${base(branchId)}/employee-drafts`

export const getWorkEmployeeDrafts = (branchId: string) =>
  request<WorkEmployeeDraft[]>('GET', draftsPath(branchId))

export const saveWorkEmployeeDraft = (branchId: string, employee: NewWorkEmployee, id?: string) =>
  request<WorkEmployeeDraft>(
    id ? 'PATCH' : 'POST',
    `${draftsPath(branchId)}${id ? `/${encodeURIComponent(id)}` : ''}`,
    employee,
  )

export const attachWorkEmployeeDraft = (branchId: string, id: string) =>
  request<CreatedWorkEmployee>('POST', `${draftsPath(branchId)}/${encodeURIComponent(id)}/attach`)

export const assignEmployees = (branchId: string, revision: number, assignments: AssignItem[]) =>
  request<WorkSnapshot>('POST', `${base(branchId)}/employee-assignments`, { revision, assignments })

export const removeAssignment = (branchId: string, assignmentId: string, revision: number) =>
  request<WorkSnapshot>(
    'DELETE',
    `${base(branchId)}/assignments/${encodeURIComponent(assignmentId)}?revision=${revision}`,
  )
