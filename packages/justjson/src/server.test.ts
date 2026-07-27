import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initProject } from './commands/init'
import { createServer } from './server'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'justjson-'))
  await initProject(root, 'blog')
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('createServer', () => {
  it('şema döndürür', async () => {
    const app = await createServer(root)
    const res = await app.request('/api/_schema')
    expect(res.status).toBe(200)
    const schema = (await res.json()) as { collections: Array<{ name: string }> }
    expect(schema.collections[0]?.name).toBe('posts')
  })

  it('koleksiyon satırlarını başlıkla verir', async () => {
    const app = await createServer(root)
    const res = await app.request('/api/posts')
    const data = (await res.json()) as { items: Array<{ slug: string; title: string }> }
    const row = data.items.find((i) => i.slug === 'ilk-yazi')
    expect(row?.title).toBe('İlk yazı')
  })

  it('tek kaydı verir, olmayanda 404', async () => {
    const app = await createServer(root)
    expect((await app.request('/api/posts/ilk-yazi')).status).toBe(200)
    expect((await app.request('/api/posts/yok')).status).toBe(404)
  })

  it('PUT yazar ve slugify eder', async () => {
    const app = await createServer(root)
    const res = await app.request('/api/posts/Yeni Yazı', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Yeni Yazı' }),
    })
    expect(res.status).toBe(200)
    const listRes = await app.request('/api/posts')
    const list = (await listRes.json()) as { items: Array<{ slug: string }> }
    expect(list.items.map((i) => i.slug)).toContain('yeni-yazi')
  })

  it('DELETE siler', async () => {
    const app = await createServer(root)
    await app.request('/api/posts/ilk-yazi', { method: 'DELETE' })
    const listRes = await app.request('/api/posts')
    const list = (await listRes.json()) as { items: Array<{ slug: string }> }
    expect(list.items.map((i) => i.slug)).not.toContain('ilk-yazi')
  })

  it('GET path traversal ile dosya okuyamaz', async () => {
    const app = await createServer(root)
    const res = await app.request('/api/posts/..%2F..%2F..%2F..%2Fetc%2Fpasswd')
    expect(res.status).not.toBe(200)
  })

  it('PUT /api/_schema şemayı kaydeder ve GET yansıtır', async () => {
    const app = await createServer(root)
    const next = {
      version: 1,
      collections: [{ name: 'urunler', path: 'urunler', fields: [{ key: 'ad', type: 'text' }] }],
      singletons: [],
    }
    const put = await app.request('/api/_schema', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    })
    expect(put.status).toBe(200)
    const got = (await (await app.request('/api/_schema')).json()) as {
      collections: Array<{ name: string }>
    }
    expect(got.collections[0]?.name).toBe('urunler')
  })

  it('PUT /api/_schema geçersiz şemayı 400 ile reddeder', async () => {
    const app = await createServer(root)
    const res = await app.request('/api/_schema', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: 1, collections: [{ name: 'x' }], singletons: [] }),
    })
    expect(res.status).toBe(400)
  })

  it('GET /api/_project proje adını ve sayıları verir', async () => {
    const app = await createServer(root)
    const info = (await (await app.request('/api/_project')).json()) as {
      name: string
      contentDir: string
      collections: number
      singletons: number
    }
    expect(info.name).toMatch(/^justjson-/)
    expect(info.contentDir).toBe('content')
    expect(info.collections).toBe(1)
    expect(info.singletons).toBe(1)
  })

  it('GET /api/_templates hazır template listesini verir', async () => {
    const app = await createServer(root)
    const data = (await (await app.request('/api/_templates')).json()) as {
      items: Array<{ id: string; title: string }>
    }
    const ids = data.items.map((t) => t.id)
    expect(ids).toEqual(expect.arrayContaining(['blog', 'cv', 'portfolio', 'docs', 'changelog']))
    expect(data.items.every((t) => t.title.length > 0)).toBe(true)
  })

  it('POST /api/_init dolu şemada 400 döner', async () => {
    const app = await createServer(root)
    const res = await app.request('/api/_init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ template: 'blog' }),
    })
    expect(res.status).toBe(400)
  })

  it('GET /api/_export zip döndürür', async () => {
    const app = await createServer(root)
    const res = await app.request('/api/_export')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/zip')
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(bytes.length).toBeGreaterThan(0)
    expect(bytes[0]).toBe(0x50) // 'P'
    expect(bytes[1]).toBe(0x4b) // 'K'
  })

  it('POST /api/_import dolu şemada 400 döner', async () => {
    const app = await createServer(root)
    const res = await app.request('/api/_import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ raw: { version: 1, collections: [], singletons: [] } }),
    })
    expect(res.status).toBe(400)
  })
})

describe('createServer boş klasörde', () => {
  it('şema olmadan başlar, boş şema döner', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'justjson-empty-'))
    try {
      const app = await createServer(dir)
      const res = await app.request('/api/_schema')
      expect(res.status).toBe(200)
      const schema = (await res.json()) as { collections: unknown[]; singletons: unknown[] }
      expect(schema.collections).toEqual([])
      expect(schema.singletons).toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('POST /api/_init template uygular, bilinmeyende 404', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'justjson-init-'))
    try {
      const app = await createServer(dir)
      const bad = await app.request('/api/_init', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ template: 'yok' }),
      })
      expect(bad.status).toBe(404)

      const ok = await app.request('/api/_init', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ template: 'portfolio' }),
      })
      expect(ok.status).toBe(200)

      const schema = (await (await app.request('/api/_schema')).json()) as {
        collections: Array<{ name: string }>
      }
      expect(schema.collections.map((c) => c.name)).toContain('projects')

      const rows = (await (await app.request('/api/projects')).json()) as {
        items: Array<{ slug: string }>
      }
      expect(rows.items.length).toBeGreaterThan(0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('POST /api/_import hazır şemayı uygular, çöp veride 400', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'justjson-imp-'))
    try {
      const app = await createServer(dir)
      const bad = await app.request('/api/_import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ raw: 42 }),
      })
      expect(bad.status).toBe(400)

      const mySchema = {
        version: 1,
        collections: [
          { name: 'kitaplar', path: 'kitaplar', fields: [{ key: 'ad', type: 'text' }] },
        ],
        singletons: [],
      }
      const ok = await app.request('/api/_import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ raw: mySchema }),
      })
      expect(ok.status).toBe(200)

      const schema = (await (await app.request('/api/_schema')).json()) as {
        collections: Array<{ name: string }>
      }
      expect(schema.collections.map((c) => c.name)).toContain('kitaplar')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('POST /api/_import ham içerikten şema çıkarır ve veriyi yazar', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'justjson-inf-'))
    try {
      const app = await createServer(dir)
      const raw = {
        home: { name: 'Kadir', summary: '<div>Merhaba <strong>dünya</strong></div>' },
        experience: [
          { title: 'Balina', content: '<ul><li>iş</li></ul>' },
          { title: 'Acme', content: 'düz' },
        ],
      }
      const res = await app.request('/api/_import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ raw }),
      })
      expect(res.status).toBe(200)

      const schema = (await (await app.request('/api/_schema')).json()) as {
        collections: Array<{ name: string }>
        singletons: Array<{ name: string }>
      }
      expect(schema.collections.map((c) => c.name)).toContain('experience')
      expect(schema.singletons.map((s) => s.name)).toContain('home')

      const rows = (await (await app.request('/api/experience')).json()) as {
        items: Array<{ slug: string }>
      }
      expect(rows.items.length).toBe(2)

      const home = (await (await app.request('/api/_singleton/home')).json()) as { name?: string }
      expect(home.name).toBe('Kadir')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('/api/_ai/generate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('provider/model/apiKey/prompt eksikse 400 döner', async () => {
    const app = await createServer(root)
    const res = await app.request('/api/_ai/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'gemini' }),
    })
    expect(res.status).toBe(400)
  })

  it('key sunucuya kalıcı yazılmaz, her istekte doğrudan sağlayıcıya gider', async () => {
    const app = await createServer(root)
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'merhaba' }] } }] }),
        {
          status: 200,
        },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await app.request('/api/_ai/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        apiKey: 'sahte-key',
        prompt: 'başlık üret',
      }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()) as { text: string }).toEqual({ text: 'merhaba' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('sahte-key')
  })

  it('gemini modelindeki fazladan "models/" önekini ve boşluğu temizler', async () => {
    const app = await createServer(root)
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), {
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await app.request('/api/_ai/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'gemini',
        model: '  models/gemini-2.0-flash  ',
        apiKey: 'x',
        prompt: 'başlık üret',
      }),
    })
    const calledUrl = String(fetchMock.mock.calls[0]?.[0])
    expect(calledUrl).toContain('/v1beta/models/gemini-2.0-flash:generateContent')
    expect(calledUrl).not.toContain('models/models/')
  })

  it('sağlayıcı hata döndürürse mesajı ileterek 502 verir', async () => {
    const app = await createServer(root)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: { message: 'geçersiz key' } }), { status: 401 }),
        ),
    )

    const res = await app.request('/api/_ai/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        apiKey: 'x',
        prompt: 'başlık üret',
      }),
    })
    expect(res.status).toBe(502)
    expect((await res.json()) as { error: string }).toEqual({ error: 'geçersiz key' })
  })
})

describe('/api/_ai/models', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('gemini modellerini generateContent destekleyenlerle sınırlar ve models/ önekini atar', async () => {
    const app = await createServer(root)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            models: [
              {
                name: 'models/gemini-2.0-flash',
                displayName: 'Gemini 2.0 Flash',
                supportedGenerationMethods: ['generateContent'],
              },
              {
                name: 'models/text-embedding-004',
                displayName: 'Embedding',
                supportedGenerationMethods: ['embedContent'],
              },
              {
                name: 'models/gemini-2.5-flash-image',
                displayName: 'Nano Banana',
                supportedGenerationMethods: ['generateContent'],
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    )

    const res = await app.request('/api/_ai/models', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'gemini', apiKey: 'x' }),
    })
    expect(res.status).toBe(200)
    const { models } = (await res.json()) as { models: { id: string }[] }
    expect(models.map((m) => m.id)).toEqual(['gemini-2.0-flash'])
  })

  it('provider eksikse 400 döner', async () => {
    const app = await createServer(root)
    const res = await app.request('/api/_ai/models', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})
