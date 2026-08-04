import 'fake-indexeddb/auto'
import type { Schema } from '@justjson/core'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'

// api.ts is backed by IndexedDB (IdbAdapter) + a localStorage project registry.
// Provide an in-memory localStorage and a fresh IndexedDB per test.
class MemStorage {
  private m = new Map<string, string>()
  get length() {
    return this.m.size
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v))
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
}
globalThis.localStorage = new MemStorage() as unknown as Storage

import { deleteEntry, getEntry, getSchema, listEntries, putEntry, putSchema } from './api'

const schema: Schema = {
  version: 1,
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      path: 'posts',
      fields: [
        { key: 'title', type: 'text' },
        { key: 'body', type: 'richtext' },
      ],
    },
  ],
  singletons: [],
}

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory()
  localStorage.clear()
  await putSchema(schema)
})

describe('api client (IndexedDB-backed)', () => {
  it('round-trips the schema', async () => {
    expect(await getSchema()).toEqual(schema)
  })

  it('writes and reads an entry back', async () => {
    const slug = await putEntry('posts', 'hello', { title: 'Hello', body: '# Hi' })
    expect(slug).toBe('hello')
    expect(await getEntry('posts', 'hello')).toEqual({ title: 'Hello', body: '# Hi' })
  })

  it('derives a slug from the title when none is given', async () => {
    expect(await putEntry('posts', '', { title: 'Yeni Yazı' })).toBe('yeni-yazi')
  })

  it('lists entry slugs for a collection', async () => {
    await putEntry('posts', 'a', { title: 'A' })
    await putEntry('posts', 'b', { title: 'B' })
    expect((await listEntries('posts')).sort()).toEqual(['a', 'b'])
  })

  it('returns null for a missing entry', async () => {
    expect(await getEntry('posts', 'nope')).toBeNull()
  })

  it('deletes an entry', async () => {
    await putEntry('posts', 'gone', { title: 'Gone' })
    await deleteEntry('posts', 'gone')
    expect(await getEntry('posts', 'gone')).toBeNull()
  })

  // A work-in-progress schema can fail strict validation (e.g. a select with no
  // options yet). The editor must still open it so the user can repair it —
  // otherwise one bad field bricks the whole app.
  it('opens a strict-invalid schema instead of bricking', async () => {
    const invalid: Schema = {
      version: 1,
      collections: [
        { name: 'svc', label: 'Svc', path: 'svc', fields: [{ key: 'plan', type: 'select' }] },
      ],
      singletons: [],
    }
    await putSchema(invalid)
    await expect(getSchema()).resolves.toEqual(invalid)
  })
})
