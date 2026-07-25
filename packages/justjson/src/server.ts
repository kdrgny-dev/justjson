import { serve } from '@hono/node-server'
import { ContentStore, loadSchema, slugify } from '@justjson/core'
import { Hono } from 'hono'
import { resolveContentDir } from './config'
import { FsAdapter } from './fs-adapter'

export async function createServer(root: string): Promise<Hono> {
  const adapter = new FsAdapter(root)
  const contentDir = await resolveContentDir(root)
  const schema = await loadSchema(adapter, contentDir)
  if (!schema) throw new Error('Şema bulunamadı. Önce `justjson init` çalıştırın.')
  const store = new ContentStore(adapter, schema, contentDir)

  const app = new Hono()

  app.get('/api/_schema', (c) => c.json(schema))

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

  return app
}

export async function startServer(root: string, port: number): Promise<void> {
  const app = await createServer(root)
  serve({ fetch: app.fetch, port })
  console.log(`JustJSON çalışıyor: http://localhost:${port}`)
}
