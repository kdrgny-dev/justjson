import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LoaderContext } from 'astro/loaders'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { justjson } from './loader'

const SCHEMA = {
  version: 1,
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      path: 'posts',
      fields: [
        { key: 'title', type: 'text', required: true },
        { key: 'body', type: 'richtext' },
      ],
    },
  ],
  singletons: [
    {
      name: 'settings',
      label: 'Settings',
      path: 'settings.json',
      fields: [{ key: 'title', type: 'text' }],
    },
  ],
}

let root: string

interface StoredEntry {
  id: string
  data: Record<string, unknown>
  digest?: string
  filePath?: string
}

interface FakeWatcher {
  add: (path: string) => void
  on: (event: string, handler: (path: string) => unknown) => void
  emit: (event: string, path: string) => Promise<void>
  added: string[]
}

function fakeWatcher(): FakeWatcher {
  const handlers = new Map<string, ((path: string) => unknown)[]>()
  const added: string[] = []
  return {
    added,
    add: (path) => added.push(path),
    on: (event, handler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler])
    },
    emit: async (event, path) => {
      for (const handler of handlers.get(event) ?? []) await handler(path)
    },
  }
}

function fakeContext(
  collection: string,
  watcher?: FakeWatcher,
): { ctx: LoaderContext; entries: StoredEntry[] } {
  const entries: StoredEntry[] = []
  const store = {
    clear: () => {
      entries.length = 0
    },
    set: (entry: StoredEntry) => {
      const at = entries.findIndex((e) => e.id === entry.id)
      if (at === -1) entries.push(entry)
      else entries[at] = entry
      return true
    },
    delete: (id: string) => {
      const at = entries.findIndex((e) => e.id === id)
      if (at !== -1) entries.splice(at, 1)
    },
  }
  const ctx = {
    watcher,
    collection,
    store,
    parseData: async ({ data }: { data: Record<string, unknown> }) => data,
    generateDigest: (data: unknown) => JSON.stringify(data).length.toString(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    config: { root: new URL(`file://${root}/`) },
  } as unknown as LoaderContext
  return { ctx, entries }
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'jj-astro-'))
  await mkdir(join(root, 'content/posts'), { recursive: true })
  await writeFile(join(root, 'content/_schema.json'), JSON.stringify(SCHEMA))
  await writeFile(
    join(root, 'content/posts/hello.json'),
    JSON.stringify({ title: 'Hello', body: 'Hi' }),
  )
  await writeFile(
    join(root, 'content/posts/wip.json'),
    JSON.stringify({ title: 'WIP', _status: 'draft' }),
  )
  await writeFile(join(root, 'content/settings.json'), JSON.stringify({ title: 'My site' }))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('justjson loader — koleksiyon', () => {
  it('yayınlanmış kayıtları dosya adını id yaparak yükler', async () => {
    const loader = justjson({ collection: 'posts' })
    const { ctx, entries } = fakeContext('posts')
    await loader.load(ctx)
    expect(entries.map((e) => e.id)).toEqual(['hello'])
    expect(entries[0]?.data).toMatchObject({ title: 'Hello', body: 'Hi' })
  })

  it('taslakları varsayılan olarak atlar', async () => {
    const loader = justjson({ collection: 'posts' })
    const { ctx, entries } = fakeContext('posts')
    await loader.load(ctx)
    expect(entries.map((e) => e.id)).not.toContain('wip')
  })

  it('drafts: true ile taslakları da yükler', async () => {
    const loader = justjson({ collection: 'posts', drafts: true })
    const { ctx, entries } = fakeContext('posts')
    await loader.load(ctx)
    expect(entries.map((e) => e.id).sort()).toEqual(['hello', 'wip'])
  })

  it('her kayda digest ve filePath verir', async () => {
    const loader = justjson({ collection: 'posts' })
    const { ctx, entries } = fakeContext('posts')
    await loader.load(ctx)
    expect(entries[0]?.digest).toBeTruthy()
    expect(entries[0]?.filePath).toBe('content/posts/hello.json')
  })

  it('şemadan zod şeması üretir', async () => {
    // schema() Astro'dan context almaz; root verilmezse cwd kullanılır.
    const loader = justjson({ collection: 'posts', root })
    const schema = await (typeof loader.schema === 'function' ? loader.schema() : loader.schema)
    expect(schema?.safeParse({ title: 'x' }).success).toBe(true)
    expect(schema?.safeParse({ body: 'x' }).success).toBe(false)
  })

  it('koleksiyon şemada yoksa anlaşılır hata verir', async () => {
    const loader = justjson({ collection: 'yok' })
    const { ctx } = fakeContext('yok')
    await expect(loader.load(ctx)).rejects.toThrow(/yok/)
  })
})

describe('justjson loader — tekil', () => {
  it('tekil kaydı tek entry olarak yükler', async () => {
    const loader = justjson({ singleton: 'settings' })
    const { ctx, entries } = fakeContext('settings')
    await loader.load(ctx)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.id).toBe('settings')
    expect(entries[0]?.data).toMatchObject({ title: 'My site' })
  })

  it('tekil dosyası yoksa boş bırakır, patlamaz', async () => {
    await rm(join(root, 'content/settings.json'))
    const loader = justjson({ singleton: 'settings' })
    const { ctx, entries } = fakeContext('settings')
    await loader.load(ctx)
    expect(entries).toHaveLength(0)
  })
})

describe('justjson loader — dev izleme', () => {
  it('içerik klasörünü izlemeye alır', async () => {
    const watcher = fakeWatcher()
    const { ctx } = fakeContext('posts', watcher)
    await justjson({ collection: 'posts' }).load(ctx)
    expect(watcher.added.some((p) => p.endsWith('content/posts'))).toBe(true)
  })

  it('dosya değişince kaydı yeniden yükler', async () => {
    const watcher = fakeWatcher()
    const { ctx, entries } = fakeContext('posts', watcher)
    await justjson({ collection: 'posts' }).load(ctx)

    const file = join(root, 'content/posts/hello.json')
    await writeFile(file, JSON.stringify({ title: 'Updated' }))
    await watcher.emit('change', file)

    expect(entries.find((e) => e.id === 'hello')?.data).toMatchObject({ title: 'Updated' })
  })

  it('yeni dosya eklenince kaydı ekler', async () => {
    const watcher = fakeWatcher()
    const { ctx, entries } = fakeContext('posts', watcher)
    await justjson({ collection: 'posts' }).load(ctx)

    const file = join(root, 'content/posts/fresh.json')
    await writeFile(file, JSON.stringify({ title: 'Fresh' }))
    await watcher.emit('add', file)

    expect(entries.map((e) => e.id).sort()).toEqual(['fresh', 'hello'])
  })

  it('kayıt taslağa çevrilince listeden düşer', async () => {
    const watcher = fakeWatcher()
    const { ctx, entries } = fakeContext('posts', watcher)
    await justjson({ collection: 'posts' }).load(ctx)

    const file = join(root, 'content/posts/hello.json')
    await writeFile(file, JSON.stringify({ title: 'Hello', _status: 'draft' }))
    await watcher.emit('change', file)

    expect(entries.map((e) => e.id)).not.toContain('hello')
  })

  it('dosya silinince kaydı kaldırır', async () => {
    const watcher = fakeWatcher()
    const { ctx, entries } = fakeContext('posts', watcher)
    await justjson({ collection: 'posts' }).load(ctx)

    await watcher.emit('unlink', join(root, 'content/posts/hello.json'))
    expect(entries).toHaveLength(0)
  })

  it('ilgisiz dosyaları yok sayar', async () => {
    const watcher = fakeWatcher()
    const { ctx, entries } = fakeContext('posts', watcher)
    await justjson({ collection: 'posts' }).load(ctx)

    await watcher.emit('change', join(root, 'src/pages/index.astro'))
    expect(entries.map((e) => e.id)).toEqual(['hello'])
  })

  it('tekil dosyası değişince yeniden yükler', async () => {
    const watcher = fakeWatcher()
    const { ctx, entries } = fakeContext('settings', watcher)
    await justjson({ singleton: 'settings' }).load(ctx)

    const file = join(root, 'content/settings.json')
    await writeFile(file, JSON.stringify({ title: 'Renamed' }))
    await watcher.emit('change', file)

    expect(entries[0]?.data).toMatchObject({ title: 'Renamed' })
  })
})
