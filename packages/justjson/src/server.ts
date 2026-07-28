import { exec } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import {
  ContentStore,
  NotFoundError,
  PathEscapeError,
  UnsafeSlugError,
  inferProject,
  loadSchema,
  parseSchema,
  saveSchema,
  slugify,
} from '@justjson/core'
import type { Schema } from '@justjson/core'
import { Hono } from 'hono'
import { collectExportZip } from './commands/export'
import { applyTemplate, getTemplate, templateList } from './commands/init'
import { resolveContentDir } from './config'
import { detectFramework } from './detect'
import { FsAdapter } from './fs-adapter'
import { commitContent, createGitHubRepo, gitStatus, pushContent } from './git'
import { writeAstroSite } from './scaffold'

const editorDir = fileURLToPath(new URL('./editor', import.meta.url))

type AiProvider = 'gemini' | 'groq' | 'openrouter' | 'custom'

interface AiRequest {
  provider?: AiProvider
  baseUrl?: string
  model?: string
  apiKey?: string
  system?: string
  prompt?: string
}

const PROVIDER_BASE_URLS: Partial<Record<AiProvider, string>> = {
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
  error?: { message?: string }
}

async function callGemini(
  apiKey: string,
  model: string,
  system: string | undefined,
  prompt: string,
): Promise<string> {
  const cleanModel = model.trim().replace(/^models\//, '')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    }),
  })
  const data = (await res.json()) as GeminiResponse
  if (!res.ok) throw new Error(data.error?.message ?? `Gemini request failed (${res.status})`)
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text) throw new Error('Gemini returned an empty response')
  return text
}

interface GeminiModelsResponse {
  models?: { name?: string; displayName?: string; supportedGenerationMethods?: string[] }[]
  error?: { message?: string }
}

async function listGeminiModels(apiKey: string): Promise<{ id: string; label: string }[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=1000`
  const res = await fetch(url)
  const data = (await res.json()) as GeminiModelsResponse
  if (!res.ok)
    throw new Error(data.error?.message ?? `Could not fetch the model list (${res.status})`)
  return (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => ({
      id: (m.name ?? '').replace(/^models\//, ''),
      label: m.displayName ?? (m.name ?? '').replace(/^models\//, ''),
    }))
    .filter(
      (m) => m.id && !/tts|image|embedding|robotics|computer-use|veo|lyria|imagen|aqa/i.test(m.id),
    )
}

interface OpenAiCompatibleResponse {
  choices?: { message?: { content?: string } }[]
  error?: { message?: string }
}

interface OpenAiModelsResponse {
  data?: { id?: string }[]
  error?: { message?: string }
}

async function listOpenAiCompatibleModels(
  baseUrl: string,
  apiKey: string,
): Promise<{ id: string; label: string }[]> {
  if (!baseUrl) throw new Error('This provider needs a base URL')
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
    headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
  })
  const data = (await res.json()) as OpenAiModelsResponse
  if (!res.ok)
    throw new Error(data.error?.message ?? `Could not fetch the model list (${res.status})`)
  return (data.data ?? []).map((m) => ({ id: m.id ?? '', label: m.id ?? '' })).filter((m) => m.id)
}

async function callOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string | undefined,
  prompt: string,
): Promise<string> {
  if (!baseUrl) throw new Error('This provider needs a base URL')
  const messages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    { role: 'user', content: prompt },
  ]
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages }),
  })
  const data = (await res.json()) as OpenAiCompatibleResponse
  if (!res.ok) throw new Error(data.error?.message ?? `Request failed (${res.status})`)
  const text = data.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('The provider returned an empty response')
  return text
}

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
    if (err instanceof NotFoundError) return c.json({ error: err.message }, 404)
    if (err instanceof UnsafeSlugError || err instanceof PathEscapeError) {
      return c.json({ error: err.message }, 400)
    }
    return c.json({ error: 'server error' }, 500)
  })

  app.get('/api/_project', (c) =>
    c.json({
      name: basename(root) || 'project',
      path: root,
      contentDir,
      collections: schema.collections.length,
      singletons: schema.singletons.length,
    }),
  )

  app.post('/api/_ship/scaffold', async (c) => {
    if (schema.collections.length === 0 && schema.singletons.length === 0) {
      return c.json({ error: 'Pick a template or build a schema first.' }, 400)
    }
    return c.json(await writeAstroSite(root, schema, basename(root) || 'my-site'))
  })

  // Ship: içeriği yazdıktan sonraki adım — kurulum kodu, commit, GitHub.
  app.get('/api/_ship', async (c) =>
    c.json({
      framework: await detectFramework(root),
      git: await gitStatus(root, contentDir),
    }),
  )

  app.post('/api/_ship/commit', async (c) => {
    const { message } = (await c.req.json()) as { message?: string }
    try {
      return c.json(await commitContent(root, contentDir, message?.trim() || 'content: update'))
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400)
    }
  })

  app.post('/api/_ship/push', async (c) => {
    try {
      return c.json(await pushContent(root))
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400)
    }
  })

  app.post('/api/_ship/repo', async (c) => {
    const { name, private: isPrivate } = (await c.req.json()) as {
      name?: string
      private?: boolean
    }
    if (!name?.trim()) return c.json({ error: 'A repository name is required.' }, 400)
    try {
      return c.json(
        await createGitHubRepo(root, { name: name.trim(), private: isPrivate !== false }),
      )
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400)
    }
  })

  app.get('/api/_templates', (c) => c.json({ items: templateList() }))

  app.post('/api/_init', async (c) => {
    const { template: id } = (await c.req.json()) as { template?: string }
    const t = id ? getTemplate(id) : undefined
    if (!t) return c.json({ error: 'Unknown template' }, 404)
    if (schema.collections.length > 0 || schema.singletons.length > 0) {
      return c.json({ error: 'This folder already has a schema.' }, 400)
    }
    schema = await applyTemplate(adapter, contentDir, t)
    store = new ContentStore(adapter, schema, contentDir)
    return c.json({ ok: true })
  })

  app.post('/api/_import', async (c) => {
    if (schema.collections.length > 0 || schema.singletons.length > 0) {
      return c.json({ error: 'This folder already has a schema.' }, 400)
    }
    const { raw } = (await c.req.json()) as { raw?: unknown }

    let next: Schema
    let entries: Record<string, Record<string, unknown>[]> = {}
    let singletonData: Record<string, Record<string, unknown>> = {}
    try {
      // Zaten bir JustJSON şeması mı? Öyleyse doğrudan kullan; değilse içerikten çıkar.
      next = parseSchema(raw)
    } catch {
      try {
        const inferred = inferProject(raw)
        next = parseSchema(inferred.schema)
        entries = inferred.entries
        singletonData = inferred.singletons
      } catch (e) {
        return c.json({ error: `Import failed: ${(e as Error).message}` }, 400)
      }
    }

    await saveSchema(adapter, next, contentDir)
    schema = next
    store = new ContentStore(adapter, schema, contentDir)
    for (const [collection, rows] of Object.entries(entries)) {
      for (const row of rows) {
        const slug = slugify(String(row.slug ?? row.title ?? 'content')) || 'content'
        await store.writeEntry(collection, slug, row)
      }
    }
    for (const [name, data] of Object.entries(singletonData)) {
      await store.writeSingleton(name, data)
    }
    return c.json({ ok: true })
  })

  app.get('/api/_export', async (c) => {
    const zipped = await collectExportZip(adapter, contentDir)
    return new Response(zipped, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': 'attachment; filename="justjson-export.zip"',
      },
    })
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

  app.post('/api/_media', async (c) => {
    const body = (await c.req.json()) as { filename?: string; dataBase64?: string }
    if (!body.dataBase64) return c.json({ error: 'no data' }, 400)
    const base = slugify((body.filename ?? 'gorsel').replace(/\.[^.]+$/, '')) || 'gorsel'
    const name = `${base}-${Date.now().toString(36)}.webp`
    const rel = `${contentDir}/media/${name}`
    const abs = join(root, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, Buffer.from(body.dataBase64, 'base64'))
    return c.json({ path: rel })
  })

  app.post('/api/_ai/models', async (c) => {
    const body = (await c.req.json()) as AiRequest
    const { provider, apiKey } = body
    if (!provider) return c.json({ error: 'provider is required' }, 400)
    try {
      const models =
        provider === 'gemini'
          ? await listGeminiModels(apiKey ?? '')
          : await listOpenAiCompatibleModels(
              body.baseUrl || PROVIDER_BASE_URLS[provider] || '',
              apiKey ?? '',
            )
      return c.json({ models })
    } catch (e) {
      return c.json({ error: (e as Error).message }, 502)
    }
  })

  app.post('/api/_ai/generate', async (c) => {
    const body = (await c.req.json()) as AiRequest
    const { provider, apiKey, model, system, prompt } = body
    if (!provider || !apiKey || !model || !prompt) {
      return c.json({ error: 'provider, model, apiKey and prompt are required' }, 400)
    }
    try {
      const text =
        provider === 'gemini'
          ? await callGemini(apiKey, model, system, prompt)
          : await callOpenAiCompatible(
              body.baseUrl || PROVIDER_BASE_URLS[provider] || '',
              apiKey,
              model,
              system,
              prompt,
            )
      return c.json({ text })
    } catch (e) {
      return c.json({ error: (e as Error).message }, 502)
    }
  })

  app.get('/media/:file', async (c) => {
    const file = c.req.param('file')
    if (file.includes('/') || file.includes('\\') || file.includes('..')) {
      return c.text('forbidden', 400)
    }
    try {
      const bytes = await readFile(join(root, contentDir, 'media', file))
      return new Response(bytes, { headers: { 'content-type': 'image/webp' } })
    } catch {
      return c.text('not found', 404)
    }
  })

  app.get('/api/:collection', async (c) => {
    const items = await store.listRows(c.req.param('collection'))
    return c.json({ items })
  })

  app.get('/api/:collection/:slug', async (c) => {
    const data = await store.readEntry(c.req.param('collection'), c.req.param('slug'))
    return data ? c.json(data) : c.json({ error: 'not found' }, 404)
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
        return c.text('Editor UI not found (run the justjson build first).', 404)
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
  console.log(`JustJSON is running at ${url}`)
  openBrowser(url)
}
