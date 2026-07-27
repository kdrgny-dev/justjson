import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ContentStore, loadSchema, validateProject } from '@justjson/core'
import type { ProjectContent, ProjectEntry, ProjectIssue, Schema } from '@justjson/core'
import { resolveContentDir } from '../config'
import { FsAdapter } from '../fs-adapter'

async function listDir(path: string): Promise<{ name: string; isDir: boolean }[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true })
    return entries.map((e) => ({ name: e.name, isDir: e.isDirectory() }))
  } catch {
    return []
  }
}

export async function loadProjectContent(
  root: string,
): Promise<{ schema: Schema; content: ProjectContent } | null> {
  const adapter = new FsAdapter(root)
  const contentDir = await resolveContentDir(root)
  const schema = await loadSchema(adapter, contentDir)
  if (!schema) return null
  const store = new ContentStore(adapter, schema, contentDir)

  const collections: Record<string, ProjectEntry[]> = {}
  for (const col of schema.collections) {
    const slugs = await store.listEntries(col.name)
    const entries: ProjectEntry[] = []
    for (const slug of slugs) {
      entries.push({ slug, data: (await store.readEntry(col.name, slug)) ?? {} })
    }
    collections[col.name] = entries
  }

  // Diskte olup şemada olmayan koleksiyon klasörleri (media hariç)
  const known = new Set(schema.collections.map((c) => c.name))
  for (const { name, isDir } of await listDir(join(root, contentDir))) {
    if (!isDir || name === 'media' || known.has(name) || collections[name]) continue
    const files = await listDir(join(root, contentDir, name))
    collections[name] = files
      .filter((f) => !f.isDir && f.name.endsWith('.json'))
      .map((f) => ({ slug: f.name.slice(0, -'.json'.length), data: {} }))
  }

  const singletons: Record<string, Record<string, unknown> | null> = {}
  for (const s of schema.singletons) {
    singletons[s.name] = await store.readSingleton(s.name)
  }

  const media = (await listDir(join(root, contentDir, 'media')))
    .filter((f) => !f.isDir)
    .map((f) => `${contentDir}/media/${f.name}`)

  return { schema, content: { collections, singletons, media } }
}

export async function validateProjectAt(root: string): Promise<ProjectIssue[] | null> {
  const loaded = await loadProjectContent(root)
  if (!loaded) return null
  return validateProject(loaded.schema, loaded.content)
}

export function summarize(issues: ProjectIssue[]): { errors: number; warnings: number } {
  let errors = 0
  let warnings = 0
  for (const i of issues) {
    if (i.level === 'error') errors++
    else warnings++
  }
  return { errors, warnings }
}

export function shouldFail(issues: ProjectIssue[], strict: boolean): boolean {
  const { errors, warnings } = summarize(issues)
  return errors > 0 || (strict && warnings > 0)
}

function location(issue: ProjectIssue): string {
  const parts: string[] = []
  if (issue.collection) parts.push(issue.collection)
  if (issue.singleton) parts.push(issue.singleton)
  if (issue.slug) parts.push(issue.slug)
  if (issue.field) parts.push(issue.field)
  return parts.join(':') || '(proje)'
}

export function formatText(issues: ProjectIssue[]): string {
  if (issues.length === 0) return '✓ Sorun yok — içerik şemayla uyumlu.'
  const lines = issues.map((i) => {
    const tag = i.level === 'error' ? 'HATA ' : 'UYARI'
    return `  ${tag}  ${location(i)}  ${i.message}`
  })
  const { errors, warnings } = summarize(issues)
  lines.push('')
  lines.push(`${errors} hata, ${warnings} uyarı`)
  return lines.join('\n')
}

export function formatJson(issues: ProjectIssue[]): string {
  const { errors, warnings } = summarize(issues)
  return JSON.stringify({ ok: errors === 0, errors, warnings, issues }, null, 2)
}
