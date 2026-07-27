import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ContentStore, saveSchema } from '@justjson/core'
import type { Schema } from '@justjson/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FsAdapter } from '../fs-adapter'
import { formatText, shouldFail, summarize, validateProjectAt } from './validate'

const schema = {
  version: 1,
  collections: [
    {
      name: 'posts',
      path: 'posts',
      fields: [
        { key: 'title', type: 'text', required: true },
        { key: 'cover', type: 'image' },
        { key: 'tags', type: 'relation', to: 'tags' },
      ],
    },
    { name: 'tags', path: 'tags', fields: [{ key: 'title', type: 'text' }] },
  ],
  singletons: [],
} as unknown as Schema

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'jj-validate-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function setup(): Promise<ContentStore> {
  const adapter = new FsAdapter(root)
  await saveSchema(adapter, schema)
  return new ContentStore(adapter, schema)
}

describe('validateProjectAt', () => {
  it('şema yoksa null', async () => {
    expect(await validateProjectAt(root)).toBeNull()
  })

  it('temiz proje → boş', async () => {
    const store = await setup()
    await store.writeEntry('tags', 'js', { title: 'JS' })
    await store.writeEntry('posts', 'hello', { title: 'Hello', tags: ['js'] })
    expect(await validateProjectAt(root)).toEqual([])
  })

  it('kırık relation yakalar', async () => {
    const store = await setup()
    await store.writeEntry('posts', 'hello', { title: 'Hello', tags: ['yok'] })
    const issues = (await validateProjectAt(root)) ?? []
    expect(issues.some((i) => i.kind === 'broken-relation' && i.slug === 'hello')).toBe(true)
  })

  it('eksik medya yakalar', async () => {
    const store = await setup()
    await store.writeEntry('posts', 'hello', { title: 'Hello', cover: 'content/media/yok.webp' })
    const issues = (await validateProjectAt(root)) ?? []
    expect(issues.some((i) => i.kind === 'missing-media')).toBe(true)
  })

  it('şemada olmayan disk klasörünü uyarır', async () => {
    await setup()
    await writeFile(join(root, 'content', 'eskiler', 'x.json'), '{}', { flag: 'w' }).catch(
      async () => {
        const { mkdir } = await import('node:fs/promises')
        await mkdir(join(root, 'content', 'eskiler'), { recursive: true })
        await writeFile(join(root, 'content', 'eskiler', 'x.json'), '{}')
      },
    )
    const issues = (await validateProjectAt(root)) ?? []
    expect(
      issues.some((i) => i.kind === 'schema-content-mismatch' && i.collection === 'eskiler'),
    ).toBe(true)
  })
})

describe('summarize / shouldFail', () => {
  const issues = [
    { level: 'error', kind: 'type', message: 'x' },
    { level: 'warning', kind: 'unknown-key', message: 'y' },
    { level: 'warning', kind: 'required', message: 'z' },
  ] as Parameters<typeof summarize>[0]

  it('hata ve warning sayar', () => {
    expect(summarize(issues)).toEqual({ errors: 1, warnings: 2 })
  })

  it('hata varsa her zaman fail', () => {
    expect(shouldFail(issues, false)).toBe(true)
  })

  it('sadece warning: default geçer, strict fail', () => {
    const warns = issues.filter((i) => i.level === 'warning')
    expect(shouldFail(warns, false)).toBe(false)
    expect(shouldFail(warns, true)).toBe(true)
  })

  it('temiz: her iki modda geçer', () => {
    expect(shouldFail([], false)).toBe(false)
    expect(shouldFail([], true)).toBe(false)
  })
})

describe('formatText', () => {
  it('temizde olumlu mesaj', () => {
    expect(formatText([]).toLowerCase()).toContain('no issues')
  })

  it('konum ve mesaj içerir', () => {
    const out = formatText([
      {
        level: 'error',
        kind: 'type',
        collection: 'posts',
        slug: 'hello',
        field: 'title',
        message: 'expected text',
      },
    ] as Parameters<typeof formatText>[0])
    expect(out).toContain('posts')
    expect(out).toContain('hello')
    expect(out).toContain('title')
    expect(out).toContain('expected text')
  })
})
