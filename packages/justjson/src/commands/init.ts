import { ContentStore, loadSchema, parseSchema, saveSchema, slugify } from '@justjson/core'
import type { Schema, StorageAdapter } from '@justjson/core'
import { resolveContentDir } from '../config'
import { FsAdapter } from '../fs-adapter'
import blog from '../templates/blog.json'
import changelog from '../templates/changelog.json'
import cv from '../templates/cv.json'
import docs from '../templates/docs.json'
import portfolio from '../templates/portfolio.json'

export interface Template {
  title: string
  description: string
  schema: unknown
  samples: Record<string, Record<string, unknown>[]>
}

export interface TemplateMeta {
  id: string
  title: string
  description: string
  collections: { label: string; fields: number }[]
  singletons: { label: string }[]
}

const templates: Record<string, Template> = {
  blog: blog as Template,
  cv: cv as Template,
  portfolio: portfolio as Template,
  docs: docs as Template,
  changelog: changelog as Template,
}

export function listTemplates(): string[] {
  return Object.keys(templates)
}

export function getTemplate(name: string): Template | undefined {
  return templates[name]
}

export function templateList(): TemplateMeta[] {
  return Object.entries(templates).map(([id, t]) => {
    const s = t.schema as Schema
    return {
      id,
      title: t.title,
      description: t.description,
      collections: s.collections.map((c) => ({
        label: c.label ?? c.name,
        fields: c.fields.length,
      })),
      singletons: s.singletons.map((sg) => ({ label: sg.label ?? sg.name })),
    }
  })
}

export async function applyTemplate(
  adapter: StorageAdapter,
  contentDir: string,
  template: Template,
): Promise<Schema> {
  const schema = parseSchema(template.schema)
  await saveSchema(adapter, schema, contentDir)

  const store = new ContentStore(adapter, schema, contentDir)
  for (const [collection, rows] of Object.entries(template.samples)) {
    for (const row of rows) {
      const slug = slugify(typeof row.slug === 'string' ? row.slug : String(row.title ?? 'icerik'))
      await store.writeEntry(collection, slug, row)
    }
  }
  return schema
}

export async function initProject(root: string, templateName: string): Promise<void> {
  const template = templates[templateName]
  if (!template) throw new Error(`Bilinmeyen template: ${templateName}`)

  const adapter = new FsAdapter(root)
  const contentDir = await resolveContentDir(root)
  if (await loadSchema(adapter, contentDir)) {
    throw new Error('Bu klasörde zaten bir şema var (content/_schema.json).')
  }

  await applyTemplate(adapter, contentDir, template)
}
