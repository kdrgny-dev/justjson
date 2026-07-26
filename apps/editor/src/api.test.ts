import { afterEach, describe, expect, it, vi } from 'vitest'
import { deleteEntry, getEntry, listEntries, putEntry } from './api'

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(status === 204 ? null : JSON.stringify(body), { status }))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('api client', () => {
  it('listEntries slug listesini çıkarır', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { slugs: ['a', 'b'] }))
    expect(await listEntries('posts')).toEqual(['a', 'b'])
  })

  it('getEntry 404 için null döner', async () => {
    vi.stubGlobal('fetch', mockFetch(404, { error: 'yok' }))
    expect(await getEntry('posts', 'yok')).toBeNull()
  })

  it('putEntry sunucunun döndürdüğü slug ile çözülür', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { ok: true, slug: 'yeni-yazi' }))
    expect(await putEntry('posts', 'Yeni Yazı', { title: 'X' })).toBe('yeni-yazi')
  })

  it('deleteEntry hata durumunda throw eder', async () => {
    vi.stubGlobal('fetch', mockFetch(500, { error: 'x' }))
    await expect(deleteEntry('posts', 'a')).rejects.toThrow()
  })
})
