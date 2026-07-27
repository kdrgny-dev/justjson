import { describe, expect, it } from 'vitest'
import { ContentStore } from './content/store'
import { JustJsonError, NotFoundError, UnsafeSlugError } from './errors'
import { parseSchema } from './schema/schema'
import { MemoryAdapter } from './storage/memory'

const schema = parseSchema({
  version: 1,
  collections: [{ name: 'posts', path: 'posts', fields: [{ key: 'title', type: 'text' }] }],
  singletons: [{ name: 'settings', path: 'settings.json', fields: [] }],
})

describe('hata sınıfları', () => {
  it('hepsi JustJsonError ve Error türevi', () => {
    expect(new NotFoundError('x')).toBeInstanceOf(JustJsonError)
    expect(new NotFoundError('x')).toBeInstanceOf(Error)
    expect(new UnsafeSlugError('x')).toBeInstanceOf(JustJsonError)
  })

  it('name doğru ve mesaj korunur', () => {
    const e = new NotFoundError('Bilinmeyen koleksiyon: yok')
    expect(e.name).toBe('NotFoundError')
    expect(e.message).toBe('Bilinmeyen koleksiyon: yok')
  })
})

describe('ContentStore tipli hatalar fırlatır', () => {
  it('bilinmeyen koleksiyon → NotFoundError', async () => {
    const store = new ContentStore(new MemoryAdapter(), schema)
    await expect(store.listEntries('bilinmeyen')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('bilinmeyen singleton → NotFoundError', async () => {
    const store = new ContentStore(new MemoryAdapter(), schema)
    await expect(store.readSingleton('bilinmeyen')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('güvensiz slug → UnsafeSlugError', async () => {
    const store = new ContentStore(new MemoryAdapter(), schema)
    await expect(store.readEntry('posts', '../../etc/passwd')).rejects.toBeInstanceOf(
      UnsafeSlugError,
    )
  })
})
