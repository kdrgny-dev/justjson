import type { EntryRow, Schema } from '@justjson/core'

export type { EntryRow }
export type Entry = Record<string, unknown>

async function ok(res: Response): Promise<Response> {
  if (!res.ok) throw new Error(`İstek başarısız: ${res.status}`)
  return res
}

export interface TemplateMeta {
  id: string
  title: string
  description: string
  collections: { label: string; fields: number }[]
  singletons: { label: string }[]
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
    throw new Error(err.error ?? `Template uygulanamadı: ${res.status}`)
  }
}

export async function putSchema(schema: Schema): Promise<void> {
  const res = await fetch('/api/_schema', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(schema),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Şema kaydedilemedi: ${res.status}`)
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
