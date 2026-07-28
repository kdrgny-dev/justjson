import type { EntryRow, Schema } from '@justjson/core'

export type { EntryRow }
export type Entry = Record<string, unknown>

async function ok(res: Response): Promise<Response> {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res
}

export interface TemplateMeta {
  id: string
  title: string
  description: string
  collections: { label: string; fields: number }[]
  singletons: { label: string }[]
}

export interface ProjectInfo {
  name: string
  path: string
  contentDir: string
  collections: number
  singletons: number
}

export async function getProject(): Promise<ProjectInfo> {
  const res = await ok(await fetch('/api/_project'))
  return res.json() as Promise<ProjectInfo>
}

export async function getSchema(): Promise<Schema> {
  const res = await ok(await fetch('/api/_schema'))
  return res.json() as Promise<Schema>
}

export async function listTemplates(): Promise<TemplateMeta[]> {
  const res = await ok(await fetch('/api/_templates'))
  const data = (await res.json()) as { items: TemplateMeta[] }
  return data.items
}

export async function applyTemplate(template: string): Promise<void> {
  const res = await fetch('/api/_init', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ template }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Could not apply the template: ${res.status}`)
  }
}

// raw: either a JustJSON schema or plain content JSON — the server tells
// them apart and infers a schema from content.
export async function importProject(raw: unknown): Promise<void> {
  const res = await fetch('/api/_import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Import failed: ${res.status}`)
  }
}

export const exportUrl = '/api/_export'

export function downloadExport(): void {
  const a = document.createElement('a')
  a.href = exportUrl
  a.download = 'justjson-export.zip'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function putSchema(schema: Schema): Promise<void> {
  const res = await fetch('/api/_schema', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(schema),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Could not save the schema: ${res.status}`)
  }
}

export async function listRows(collection: string): Promise<EntryRow[]> {
  const res = await ok(await fetch(`/api/${encodeURIComponent(collection)}`))
  const data = (await res.json()) as { items: EntryRow[] }
  return data.items
}

export async function listEntries(collection: string): Promise<string[]> {
  return (await listRows(collection)).map((r) => r.slug)
}

export async function getEntry(collection: string, slug: string): Promise<Entry | null> {
  const res = await fetch(`/api/${encodeURIComponent(collection)}/${encodeURIComponent(slug)}`)
  if (res.status === 404) return null
  await ok(res)
  return res.json() as Promise<Entry>
}

export async function putEntry(collection: string, slug: string, data: Entry): Promise<string> {
  const res = await ok(
    await fetch(`/api/${encodeURIComponent(collection)}/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    }),
  )
  const out = (await res.json()) as { slug: string }
  return out.slug
}

export async function deleteEntry(collection: string, slug: string): Promise<void> {
  await ok(
    await fetch(`/api/${encodeURIComponent(collection)}/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    }),
  )
}

export async function uploadMedia(dataBase64: string, filename: string): Promise<string> {
  const res = await ok(
    await fetch('/api/_media', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dataBase64, filename }),
    }),
  )
  const out = (await res.json()) as { path: string }
  return out.path
}

export async function getSingleton(name: string): Promise<Entry> {
  const res = await ok(await fetch(`/api/_singleton/${encodeURIComponent(name)}`))
  return res.json() as Promise<Entry>
}

export async function putSingleton(name: string, data: Entry): Promise<void> {
  await ok(
    await fetch(`/api/_singleton/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    }),
  )
}

export async function aiGenerate(
  config: { provider: string; model: string; apiKey: string; baseUrl?: string },
  system: string,
  prompt: string,
): Promise<string> {
  const res = await fetch('/api/_ai/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...config, system, prompt }),
  })
  const data = (await res.json()) as { text?: string; error?: string }
  if (!res.ok || !data.text) throw new Error(data.error || `The AI request failed (${res.status})`)
  return data.text
}

export interface AiModel {
  id: string
  label: string
}

export async function aiListModels(config: {
  provider: string
  apiKey: string
  baseUrl?: string
}): Promise<AiModel[]> {
  const res = await fetch('/api/_ai/models', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(config),
  })
  const data = (await res.json()) as { models?: AiModel[]; error?: string }
  if (!res.ok || !data.models)
    throw new Error(data.error || `Could not fetch models (${res.status})`)
  return data.models
}

export type Framework = 'astro' | 'next' | 'nuxt' | 'sveltekit' | 'vite' | 'node' | 'unknown'

export interface GitStatus {
  isRepo: boolean
  branch: string | null
  hasRemote: boolean
  remoteUrl: string | null
  pendingFiles: number
  remoteWebUrl: string | null
  hasGh: boolean
}

export interface ShipInfo {
  framework: Framework
  git: GitStatus
}

export async function getShip(): Promise<ShipInfo> {
  const res = await ok(await fetch('/api/_ship'))
  return res.json() as Promise<ShipInfo>
}

async function shipAction<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/_ship/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`)
  return data
}

export const shipScaffold = () =>
  shipAction<{ written: string[]; skipped: string[] }>('scaffold', {})

export const shipPublish = (message: string) =>
  shipAction<{ committed: boolean; count: number; branch: string }>('publish', { message })

export const shipCommit = (message: string) =>
  shipAction<{ committed: boolean; count: number }>('commit', { message })
export const shipPush = () => shipAction<{ branch: string }>('push', {})
export const shipCreateRepo = (name: string, isPrivate: boolean) =>
  shipAction<{ name: string }>('repo', { name, private: isPrivate })
