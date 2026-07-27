import { NotFoundError, UnsafeSlugError } from '../errors'
import { parseSchema, serializeSchema } from '../schema/schema'
import type { Collection, Schema, Singleton } from '../schema/types'
import type { StorageAdapter } from '../storage/adapter'
import { entryTitle } from './title'

export interface EntryRow {
  slug: string
  title: string
  updatedAt: number | null
}

const SCHEMA_FILE = '_schema.json'

function schemaPath(contentDir: string): string {
  return `${contentDir}/${SCHEMA_FILE}`
}

function assertSafeSlug(slug: string): void {
  if (slug.length === 0 || slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
    throw new UnsafeSlugError(`Unsafe slug: ${slug}`)
  }
}

export async function loadSchema(
  adapter: StorageAdapter,
  contentDir = 'content',
): Promise<Schema | null> {
  const raw = await adapter.read(schemaPath(contentDir))
  if (raw === null) return null
  return parseSchema(JSON.parse(raw))
}

export async function saveSchema(
  adapter: StorageAdapter,
  schema: Schema,
  contentDir = 'content',
): Promise<void> {
  await adapter.write(schemaPath(contentDir), serializeSchema(schema))
}

export class ContentStore {
  constructor(
    private readonly adapter: StorageAdapter,
    private readonly schema: Schema,
    private readonly contentDir = 'content',
  ) {}

  private collection(name: string): Collection {
    const col = this.schema.collections.find((c) => c.name === name)
    if (!col) throw new NotFoundError(`Bilinmeyen koleksiyon: ${name}`)
    return col
  }

  private singleton(name: string): Singleton {
    const s = this.schema.singletons.find((x) => x.name === name)
    if (!s) throw new NotFoundError(`Bilinmeyen singleton: ${name}`)
    return s
  }

  private entryPath(col: Collection, slug: string): string {
    assertSafeSlug(slug)
    return `${this.contentDir}/${col.path}/${slug}.json`
  }

  async listEntries(collection: string): Promise<string[]> {
    const col = this.collection(collection)
    const files = await this.adapter.list(`${this.contentDir}/${col.path}`)
    return files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length))
  }

  async listRows(collection: string): Promise<EntryRow[]> {
    const col = this.collection(collection)
    const slugs = await this.listEntries(collection)
    const rows: EntryRow[] = []
    for (const slug of slugs) {
      const path = this.entryPath(col, slug)
      const raw = await this.adapter.read(path)
      const data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
      rows.push({
        slug,
        title: entryTitle(col.fields, data) ?? slug,
        updatedAt: await this.adapter.mtime(path),
      })
    }
    return rows
  }

  async readEntry(collection: string, slug: string): Promise<Record<string, unknown> | null> {
    const col = this.collection(collection)
    const raw = await this.adapter.read(this.entryPath(col, slug))
    return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>)
  }

  async writeEntry(collection: string, slug: string, data: Record<string, unknown>): Promise<void> {
    const col = this.collection(collection)
    await this.adapter.write(this.entryPath(col, slug), `${JSON.stringify(data, null, 2)}\n`)
  }

  async deleteEntry(collection: string, slug: string): Promise<void> {
    const col = this.collection(collection)
    await this.adapter.delete(this.entryPath(col, slug))
  }

  async readSingleton(name: string): Promise<Record<string, unknown> | null> {
    const s = this.singleton(name)
    const raw = await this.adapter.read(`${this.contentDir}/${s.path}`)
    return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>)
  }

  async writeSingleton(name: string, data: Record<string, unknown>): Promise<void> {
    const s = this.singleton(name)
    await this.adapter.write(`${this.contentDir}/${s.path}`, `${JSON.stringify(data, null, 2)}\n`)
  }
}
