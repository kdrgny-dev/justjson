import type { Schema } from '@justjson/core'

export type Entry = Record<string, unknown>

async function ok(res: Response): Promise<Response> {
  if (!res.ok) throw new Error(`İstek başarısız: ${res.status}`)
  return res
}

export async function getSchema(): Promise<Schema> {
  const res = await ok(await fetch('/api/_schema'))
  return res.json() as Promise<Schema>
}

export async function listEntries(collection: string): Promise<string[]> {
  const res = await ok(await fetch(`/api/${encodeURIComponent(collection)}`))
  const data = (await res.json()) as { slugs: string[] }
  return data.slugs
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
