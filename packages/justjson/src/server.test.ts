import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

  it('koleksiyon slug listesini verir', async () => {
    const app = await createServer(root)
    const res = await app.request('/api/posts')
    const data = (await res.json()) as { slugs: string[] }
    expect(data.slugs).toContain('ilk-yazi')
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
    const list = (await listRes.json()) as { slugs: string[] }
    expect(list.slugs).toContain('yeni-yazi')
  })

  it('DELETE siler', async () => {
    const app = await createServer(root)
    await app.request('/api/posts/ilk-yazi', { method: 'DELETE' })
    const listRes = await app.request('/api/posts')
    const list = (await listRes.json()) as { slugs: string[] }
    expect(list.slugs).not.toContain('ilk-yazi')
  })

  it('GET path traversal ile dosya okuyamaz', async () => {
    const app = await createServer(root)
    const res = await app.request('/api/posts/..%2F..%2F..%2F..%2Fetc%2Fpasswd')
    expect(res.status).not.toBe(200)
  })
})
