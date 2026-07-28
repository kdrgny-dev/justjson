import { ContentStore, loadSchema, parseSchema, saveSchema, slugify } from '@justjson/core'
import type { Schema, StorageAdapter } from '@justjson/core'
import { resolveContentDir } from '../config'
import { FsAdapter } from '../fs-adapter'
import blog from '../templates/blog.json'
import catalog from '../templates/catalog.json'
import changelog from '../templates/changelog.json'
import cv from '../templates/cv.json'
import docs from '../templates/docs.json'
import event from '../templates/event.json'
import portfolio from '../templates/portfolio.json'
import recipe from '../templates/recipe.json'

export interface Template {
  title: string
  description: string
  schema: unknown
  /** Koleksiyon adı → satırlar, ya da tekil adı → tek kayıt. */
  samples: Record<string, Record<string, unknown>[] | Record<string, unknown>>
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
  recipe: recipe as Template,
  event: event as Template,
  catalog: catalog as Template,
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
  const singletonNames = new Set(schema.singletons.map((s) => s.name))
  for (const [name, sample] of Object.entries(template.samples)) {
    // Dizi olmayan örnek bir tekil kaydıdır; dosyası olmadan Astro koleksiyonu boş görünür.
    if (!Array.isArray(sample)) {
      if (singletonNames.has(name)) await store.writeSingleton(name, sample)
      continue
    }
    for (const row of sample) {
      const slug = slugify(typeof row.slug === 'string' ? row.slug : String(row.title ?? 'content'))
      await store.writeEntry(name, slug, row)
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
    throw new Error('This folder already has a schema (content/_schema.json).')
  }

  await applyTemplate(adapter, contentDir, template)
}
