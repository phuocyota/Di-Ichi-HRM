import { afterEach, describe, expect, it, vi } from 'vitest'
import { getWorkOverview } from './workShifts.ts'

const branches = [
  { id: 'branch-a', name: 'Tân Bình' },
  { id: 'branch-b', name: 'Bình Tân' },
]

function mockSnapshots(failingBranch?: string) {
  vi.stubGlobal('sessionStorage', { getItem: () => null })
  vi.stubGlobal('localStorage', { getItem: () => null })
  const fetch = vi.fn(async (url: string) => {
    const id = url.split('/').at(-1)
    if (id === failingBranch) return Response.json({ message: 'Tải thất bại' }, { status: 503 })
    return Response.json({ data: id === 'branches' ? { branches } : { branchId: id } })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => vi.unstubAllGlobals())

describe('tổng quan chi nhánh', () => {
  it('tải snapshot của mọi chi nhánh do máy chủ trả về', async () => {
    const fetch = mockSnapshots()
    const data = await getWorkOverview()
    expect(data.map(({ branch, snapshot }) => [branch.id, snapshot.branchId])).toEqual([
      ['branch-a', 'branch-a'],
      ['branch-b', 'branch-b'],
    ])
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('báo lỗi khi thiếu dữ liệu chi nhánh, tránh tổng hợp thiếu', async () => {
    mockSnapshots('branch-b')
    await expect(getWorkOverview()).rejects.toThrow('Không tải được dữ liệu của Bình Tân')
  })
})
