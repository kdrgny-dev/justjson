import { ContentStore, loadSchema, parseSchema, saveSchema, slugify } from '@justjson/core'
import { resolveContentDir } from '../config'
import { FsAdapter } from '../fs-adapter'
import blog from '../templates/blog.json'
import cv from '../templates/cv.json'

export interface Template {
  schema: unknown
  samples: Record<string, Record<string, unknown>[]>
}

const templates: Record<string, Template> = {
  blog: blog as Template,
  cv: cv as Template,
}

export function listTemplates(): string[] {
  return Object.keys(templates)
}

export async function initProject(root: string, templateName: string): Promise<void> {
  const template = templates[templateName]
  if (!template) throw new Error(`Bilinmeyen template: ${templateName}`)

  const adapter = new FsAdapter(root)
  const contentDir = await resolveContentDir(root)
  if (await loadSchema(adapter, contentDir)) {
    throw new Error('Bu klasörde zaten bir şema var (content/_schema.json).')
  }

  const schema = parseSchema(template.schema)
  await saveSchema(adapter, schema, contentDir)

  const store = new ContentStore(adapter, schema, contentDir)
  for (const [collection, rows] of Object.entries(template.samples)) {
    for (const row of rows) {
      const slug = slugify(typeof row.slug === 'string' ? row.slug : String(row.title ?? 'icerik'))
      await store.writeEntry(collection, slug, row)
    }
  }
}
