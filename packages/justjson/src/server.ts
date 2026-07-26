import { exec } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { ContentStore, loadSchema, parseSchema, saveSchema, slugify } from '@justjson/core'
import type { Schema } from '@justjson/core'
import { Hono } from 'hono'
import { resolveContentDir } from './config'
import { FsAdapter } from './fs-adapter'

const editorDir = fileURLToPath(new URL('./editor', import.meta.url))

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

export async function createServer(root: string): Promise<Hono> {
  const adapter = new FsAdapter(root)
  const contentDir = await resolveContentDir(root)
  const empty: Schema = { version: 1, collections: [], singletons: [] }
  let schema = (await loadSchema(adapter, contentDir)) ?? empty
  let store = new ContentStore(adapter, schema, contentDir)

  const app = new Hono()

  app.onError((err, c) => {
    const msg = err.message
    if (msg.startsWith('Bilinmeyen')) return c.json({ error: msg }, 404)
    if (msg.startsWith('Güvensiz') || msg.startsWith('Yol')) return c.json({ error: msg }, 400)
    return c.json({ error: 'sunucu hatası' }, 500)
  })

  app.get('/api/_schema', (c) => c.json(schema))

  app.put('/api/_schema', async (c) => {
    let next: Schema
    try {
      next = parseSchema(await c.req.json())
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400)
    }
    await saveSchema(adapter, next, contentDir)
    schema = next
    store = new ContentStore(adapter, schema, contentDir)
    return c.json({ ok: true })
  })

  app.get('/api/_singleton/:name', async (c) => {
    const data = await store.readSingleton(c.req.param('name'))
    return c.json(data ?? {})
  })

  app.put('/api/_singleton/:name', async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>
    await store.writeSingleton(c.req.param('name'), body)
    return c.json({ ok: true })
  })

  app.get('/api/:collection', async (c) => {
    const slugs = await store.listEntries(c.req.param('collection'))
    return c.json({ slugs })
  })

  app.get('/api/:collection/:slug', async (c) => {
    const data = await store.readEntry(c.req.param('collection'), c.req.param('slug'))
    return data ? c.json(data) : c.json({ error: 'bulunamadı' }, 404)
  })

  app.put('/api/:collection/:slug', async (c) => {
    const slug = slugify(c.req.param('slug'))
    const body = (await c.req.json()) as Record<string, unknown>
    await store.writeEntry(c.req.param('collection'), slug, body)
    return c.json({ ok: true, slug })
  })

  app.delete('/api/:collection/:slug', async (c) => {
    await store.deleteEntry(c.req.param('collection'), c.req.param('slug'))
    return c.json({ ok: true })
  })

  app.get('/*', async (c) => {
    const urlPath = c.req.path === '/' ? '/index.html' : c.req.path
    const rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, '')
    const file = join(editorDir, rel)
    if (!file.startsWith(editorDir)) return c.text('forbidden', 403)
    const type = MIME[extname(file)] ?? 'application/octet-stream'
    try {
      return new Response(await readFile(file), { headers: { 'content-type': type } })
    } catch {
      try {
        const html = await readFile(join(editorDir, 'index.html'))
        return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
      } catch {
        return c.text('Editör arayüzü bulunamadı (justjson build gerekli).', 404)
      }
    }
  })

  return app
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  exec(`${cmd} ${url}`, () => {})
}

export async function startServer(root: string, port: number): Promise<void> {
  const app = await createServer(root)
  serve({ fetch: app.fetch, port })
  const url = `http://localhost:${port}`
  console.log(`JustJSON çalışıyor: ${url}`)
  openBrowser(url)
}
