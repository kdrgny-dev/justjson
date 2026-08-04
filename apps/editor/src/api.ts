// Browser api — the editor's data layer with NO server. Every call runs
// against @justjson/core over an IndexedDB StorageAdapter, so schema building,
// content editing and theming work entirely in the user's browser. Same
// exported surface as the old fetch-based module, so the UI is unchanged.
// Publish (ship) is wired to the host adapters (Netlify…) separately.
import {
  ContentStore,
  type EntryRow,
  type Schema,
  type Theme,
  inferProject,
  loadSchema,
  loadTheme,
  parseSchema,
  saveSchema,
  saveTheme,
  slugify,
} from '@justjson/core'
import { IdbAdapter, clearProject } from './browser/idb'
import * as proj from './browser/project'
import blog from './templates/blog.json'
import catalog from './templates/catalog.json'
import changelog from './templates/changelog.json'
import cv from './templates/cv.json'
import docs from './templates/docs.json'
import event from './templates/event.json'
import portfolio from './templates/portfolio.json'
import psikolog from './templates/psikolog.json'
import recipe from './templates/recipe.json'

export type { EntryRow }
export type Entry = Record<string, unknown>

const CONTENT = 'content'
const adapter = new IdbAdapter()
const EMPTY_SCHEMA: Schema = { version: 1, collections: [], singletons: [] }

async function schema(): Promise<Schema> {
  return (await loadSchema(adapter, CONTENT)) ?? EMPTY_SCHEMA
}
async function store(): Promise<ContentStore> {
  return new ContentStore(adapter, await schema(), CONTENT)
}

// ---------- templates (bundled) ----------
interface Template {
  title: string
  description: string
  schema: unknown
  samples: Record<string, Record<string, unknown>[] | Record<string, unknown>>
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
  psikolog: psikolog as Template,
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
  const s = await schema()
  return {
    name: proj.activeProject().name,
    path: 'browser',
    contentDir: CONTENT,
    collections: s.collections.length,
    singletons: s.singletons.length,
  }
}

// ---------- projects (multi-site) ----------
export type ProjectMeta = proj.ProjectMeta
export const listProjects = proj.listProjects
export const activeProject = proj.activeProject
export const createProject = (name: string) => proj.createProject(name)
export const switchProject = (id: string) => proj.switchProject(id)
export const renameProject = (id: string, name: string) => proj.renameProject(id, name)
export function deleteProject(id: string): void {
  void clearProject(id)
  proj.removeProject(id)
}
export const getSiteMeta = (id: string) => proj.getSite(id)
export const setSiteMeta = (id: string, siteId: string, url: string, provider?: string) =>
  proj.setSite(id, siteId, url, provider)

export async function getSchema(): Promise<Schema> {
  return schema()
}

export async function listTemplates(): Promise<TemplateMeta[]> {
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

export async function applyTemplate(template: string): Promise<void> {
  const t = templates[template]
  if (!t) throw new Error(`Unknown template: ${template}`)
  const parsed = parseSchema(t.schema)
  await saveSchema(adapter, parsed, CONTENT)
  const cs = new ContentStore(adapter, parsed, CONTENT)
  const singletonNames = new Set(parsed.singletons.map((s) => s.name))
  for (const [name, sample] of Object.entries(t.samples)) {
    if (!Array.isArray(sample)) {
      if (singletonNames.has(name)) await cs.writeSingleton(name, sample)
      continue
    }
    for (const row of sample) {
      const slug = slugify(typeof row.slug === 'string' ? row.slug : String(row.title ?? 'content'))
      await cs.writeEntry(name, slug, row)
    }
  }
}

export async function importProject(raw: unknown): Promise<void> {
  const inferred = inferProject(raw)
  await saveSchema(adapter, inferred.schema, CONTENT)
  const cs = new ContentStore(adapter, inferred.schema, CONTENT)
  for (const [name, rows] of Object.entries(inferred.entries)) {
    for (const row of rows) {
      const slug = slugify(String(row.slug ?? row.title ?? row.name ?? 'content'))
      await cs.writeEntry(name, slug, row)
    }
  }
  for (const [name, data] of Object.entries(inferred.singletons)) {
    await cs.writeSingleton(name, data)
  }
}

export const exportUrl = '#'

export async function downloadExport(): Promise<void> {
  // No server/zip: bundle every stored file into a single JSON download.
  const files: Record<string, string> = {}
  const s = await schema()
  files[`${CONTENT}/_schema.json`] = (await adapter.read(`${CONTENT}/_schema.json`)) ?? ''
  const cs = new ContentStore(adapter, s, CONTENT)
  for (const col of s.collections) {
    for (const slug of await cs.listEntries(col.name)) {
      const data = await cs.readEntry(col.name, slug)
      if (data) files[`${CONTENT}/${col.path}/${slug}.json`] = JSON.stringify(data, null, 2)
    }
  }
  for (const sg of s.singletons) {
    const data = await cs.readSingleton(sg.name)
    if (data) files[`${CONTENT}/${sg.path}`] = JSON.stringify(data, null, 2)
  }
  const blob = new Blob([JSON.stringify(files, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'justjson-export.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
}

export async function putSchema(next: Schema): Promise<void> {
  await saveSchema(adapter, next, CONTENT)
}

export async function listRows(collection: string): Promise<EntryRow[]> {
  return (await store()).listRows(collection)
}
export async function listEntries(collection: string): Promise<string[]> {
  return (await store()).listEntries(collection)
}
export async function getEntry(collection: string, slug: string): Promise<Entry | null> {
  return (await store()).readEntry(collection, slug)
}
export async function putEntry(collection: string, slug: string, data: Entry): Promise<string> {
  const finalSlug = slug || slugify(String(data.slug ?? data.title ?? 'entry'))
  await (await store()).writeEntry(collection, finalSlug, data)
  return finalSlug
}
export async function deleteEntry(collection: string, slug: string): Promise<void> {
  await (await store()).deleteEntry(collection, slug)
}

export async function uploadMedia(dataBase64: string, filename: string): Promise<string> {
  // No media server: embed as a data URL so it works in preview and in the
  // published (self-contained) site.
  const ext = (filename.split('.').pop() || 'png').toLowerCase()
  const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
  const clean = dataBase64.includes(',') ? dataBase64.split(',')[1] : dataBase64
  return `data:${mime};base64,${clean}`
}

export async function getSingleton(name: string): Promise<Entry> {
  return (await (await store()).readSingleton(name)) ?? {}
}
export async function putSingleton(name: string, data: Entry): Promise<void> {
  await (await store()).writeSingleton(name, data)
}

// ---------- AI (browser build: not wired yet) ----------
export interface AiModel {
  id: string
  label: string
}
export async function aiGenerate(
  _config: { provider: string; model: string; apiKey: string; baseUrl?: string },
  _system: string,
  _prompt: string,
): Promise<string> {
  throw new Error('AI generation is not available in the browser build yet.')
}
export async function aiListModels(_config: {
  provider: string
  apiKey: string
  baseUrl?: string
}): Promise<AiModel[]> {
  throw new Error('AI models are not available in the browser build yet.')
}

// ---------- theme ----------
export interface Theme_ extends Theme {}
export async function getTheme(): Promise<Theme> {
  return loadTheme(adapter, CONTENT)
}
export async function putTheme(theme: Theme): Promise<Theme> {
  await saveTheme(adapter, theme, CONTENT)
  return loadTheme(adapter, CONTENT)
}
export type { Theme }

// ---------- ship / preview (wired to host adapters in a later step) ----------
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
  return {
    framework: 'unknown',
    git: {
      isRepo: false,
      branch: null,
      hasRemote: false,
      remoteUrl: null,
      pendingFiles: 0,
      remoteWebUrl: null,
      hasGh: false,
    },
  }
}
const shipNA = (): never => {
  throw new Error('Publishing from the browser is coming next.')
}
export const shipScaffold = async (): Promise<{ written: string[]; skipped: string[] }> => shipNA()
export const shipPublish = async (
  _message: string,
): Promise<{ committed: boolean; count: number; branch: string }> => shipNA()
export const shipCommit = async (
  _message: string,
): Promise<{ committed: boolean; count: number }> => shipNA()
export const shipPush = async (): Promise<{ branch: string }> => shipNA()
export const shipCreateRepo = async (
  _name: string,
  _isPrivate: boolean,
): Promise<{ name: string }> => shipNA()

export type PreviewState =
  | { status: 'idle' }
  | { status: 'starting' }
  | { status: 'running'; url: string }
  | { status: 'error'; message: string }
export async function getPreview(): Promise<PreviewState> {
  return { status: 'idle' }
}
export async function startPreview(): Promise<PreviewState> {
  return { status: 'error', message: 'Live preview is not available in the browser build.' }
}
export async function stopPreview(): Promise<PreviewState> {
  return { status: 'idle' }
}
