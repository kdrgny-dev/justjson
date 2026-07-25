import { describe, expect, it } from 'vitest'
import { parseSchema } from '../schema/schema'
import { MemoryAdapter } from '../storage/memory'
import { ContentStore, loadSchema, saveSchema } from './store'

const schema = parseSchema({
  version: 1,
  collections: [{ name: 'posts', path: 'posts', fields: [{ key: 'title', type: 'text' }] }],
  singletons: [{ name: 'settings', path: 'settings.json', fields: [] }],
})

describe('loadSchema / saveSchema', () => {
  it('şema yoksa null', async () => {
    expect(await loadSchema(new MemoryAdapter())).toBeNull()
  })

  it('kaydedilen şema geri yüklenir', async () => {
    const a = new MemoryAdapter()
    await saveSchema(a, schema)
    expect(await a.exists('content/_schema.json')).toBe(true)
    expect(await loadSchema(a)).toEqual(schema)
  })
})

describe('ContentStore koleksiyon', () => {
  it('yazar, listeler, okur', async () => {
    const a = new MemoryAdapter()
    const store = new ContentStore(a, schema)
    await store.writeEntry('posts', 'merhaba', { title: 'Merhaba' })
    expect(await store.listEntries('posts')).toEqual(['merhaba'])
    expect(await store.readEntry('posts', 'merhaba')).toEqual({ title: 'Merhaba' })
    expect(await a.exists('content/posts/merhaba.json')).toBe(true)
  })

  it('siler', async () => {
    const a = new MemoryAdapter()
    const store = new ContentStore(a, schema)
    await store.writeEntry('posts', 'x', { title: 'X' })
    await store.deleteEntry('posts', 'x')
    expect(await store.listEntries('posts')).toEqual([])
  })

  it('olmayan kayıt null', async () => {
    const store = new ContentStore(new MemoryAdapter(), schema)
    expect(await store.readEntry('posts', 'yok')).toBeNull()
  })

  it('bilinmeyen koleksiyon hata verir', async () => {
    const store = new ContentStore(new MemoryAdapter(), schema)
    await expect(store.listEntries('bilinmeyen')).rejects.toThrow()
  })
})

describe('ContentStore singleton', () => {
  it('yazar ve okur', async () => {
    const a = new MemoryAdapter()
    const store = new ContentStore(a, schema)
    await store.writeSingleton('settings', { title: 'Site' })
    expect(await store.readSingleton('settings')).toEqual({ title: 'Site' })
    expect(await a.exists('content/settings.json')).toBe(true)
  })
})

describe('ContentStore slug güvenliği', () => {
  const store = new ContentStore(new MemoryAdapter(), schema)

  it('path traversal içeren slug reddedilir (read/write/delete)', async () => {
    await expect(store.readEntry('posts', '../../etc/passwd')).rejects.toThrow()
    await expect(store.writeEntry('posts', 'a/b', { title: 'X' })).rejects.toThrow()
    await expect(store.deleteEntry('posts', '..')).rejects.toThrow()
  })
})
