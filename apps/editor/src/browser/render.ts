// Browser site renderer — turns a project (schema + content + theme) into a
// set of self-contained static HTML files, entirely in the browser. The local
// CLI scaffolds an Astro project (needs a Node build); here we render final
// HTML directly so publishing needs no build step.
//
// Theme-bundle driven: the renderer owns content gathering + safe field HTML +
// routing; a ThemeBundle (logic-less Mustache templates + CSS) owns layout.
import { type Field, type Schema, type Theme, themeCss } from '@justjson/core'
import { marked } from 'marked'
import Mustache from 'mustache'
import type { ThemeBundle } from './theme-bundle'
import { getSelectedBundle } from './theme-store'

export interface ProjectData {
  schema: Schema
  entries: Record<string, { slug: string; data: Record<string, unknown> }[]>
  singletons: Record<string, Record<string, unknown>>
  theme: Theme
  siteName: string
}

interface FieldVM {
  key: string
  label: string
  html: string
}
interface EntryVM {
  title: string
  slug: string
  url: string
  fields: FieldVM[]
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

function entryTitle(fields: Field[], data: Record<string, unknown>): string {
  const key =
    fields.find((f) => f.key === 'title' || f.key === 'name')?.key ??
    fields.find((f) => f.type === 'text')?.key
  return String((key && data[key]) || 'Untitled')
}

// Produces SAFE HTML per field (escaped text, marked for richtext). Themes only
// place this via triple-mustache {{{html}}}, so a theme can't XSS through it.
function renderField(f: Field, value: unknown): string {
  if (value == null || value === '') return ''
  const label = `<div class="fld-label">${esc(f.label ?? f.key)}</div>`
  switch (f.type) {
    case 'richtext':
      return `<div class="fld">${label}<div class="rt">${marked.parse(String(value)) as string}</div></div>`
    case 'image':
      return `<div class="fld">${label}<img class="img" src="${esc(value)}" alt="${esc(f.label ?? f.key)}"></div>`
    case 'url':
      return `<div class="fld">${label}<a href="${esc(value)}">${esc(value)}</a></div>`
    case 'email':
      return `<div class="fld">${label}<a href="mailto:${esc(value)}">${esc(value)}</a></div>`
    case 'boolean':
      return `<div class="fld">${label}<span>${value ? '✓' : '—'}</span></div>`
    case 'color':
      return `<div class="fld">${label}<span class="swatch" style="background:${esc(value)}"></span> ${esc(value)}</div>`
    case 'list':
      return `<div class="fld">${label}<ul>${(Array.isArray(value) ? value : []).map((v) => `<li>${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</li>`).join('')}</ul></div>`
    case 'group':
      return `<div class="fld">${label}<div class="group">${(f.fields ?? []).map((sf) => renderField(sf, (value as Record<string, unknown>)?.[sf.key])).join('')}</div></div>`
    default:
      return `<div class="fld">${label}<div>${esc(value)}</div></div>`
  }
}

function fieldVM(f: Field, value: unknown): FieldVM {
  return { key: f.key, label: String(f.label ?? f.key), html: renderField(f, value) }
}

// The user's chosen theme for the active project (theme-store); default fallback.
function getActiveThemeBundle(): ThemeBundle {
  return getSelectedBundle()
}

// Page shell wraps each template's output. themeCss(theme) (the --jj-* block the
// Design panel edits) is injected BEFORE the bundle css so the default theme —
// and any bundle that opts into --jj-* — respects the user's palette/accent/font.
function page(title: string, theme: Theme, bundle: ThemeBundle, body: string): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${themeCss(theme)}\n${bundle.css}</style></head><body>${body}<footer>Made with Just&#123;JSON&#125;</footer></body></html>`
}

export function renderSite(p: ProjectData): Record<string, string> {
  return renderWithBundle(p, getActiveThemeBundle())
}

// The theme injection seam. Studio theme-picking (later phase) will pass the
// user's chosen bundle here; renderSite uses the default for now.
export function renderWithBundle(p: ProjectData, bundle: ThemeBundle): Record<string, string> {
  const files: Record<string, string> = {}

  const singletons = p.schema.singletons
    .filter((s) => p.singletons[s.name])
    .map((s) => ({
      name: s.name,
      label: String(s.label ?? s.name),
      fields: s.fields.map((f) => fieldVM(f, (p.singletons[s.name] as Record<string, unknown>)[f.key])),
    }))

  const collections = p.schema.collections.map((c) => {
    const rows = p.entries[c.name] ?? []
    const entries: EntryVM[] = rows.map((r) => ({
      title: entryTitle(c.fields, r.data),
      slug: r.slug,
      url: `./${esc(c.path)}/${esc(r.slug)}.html`,
      fields: c.fields.map((f) => fieldVM(f, r.data[f.key])),
    }))
    return { name: c.name, label: String(c.label ?? c.name), entries }
  })

  files['/index.html'] = page(
    p.siteName,
    p.theme,
    bundle,
    Mustache.render(bundle.templates.index, { siteName: p.siteName, singletons, collections }),
  )

  for (const c of p.schema.collections) {
    for (const r of p.entries[c.name] ?? []) {
      const title = entryTitle(c.fields, r.data)
      const fields = c.fields
        .filter((f) => f.key !== 'title' && f.key !== 'name')
        .map((f) => fieldVM(f, r.data[f.key]))
      files[`/${c.path}/${r.slug}.html`] = page(
        title,
        p.theme,
        bundle,
        Mustache.render(bundle.templates.entry, {
          siteName: p.siteName,
          title,
          slug: r.slug,
          url: `./${esc(c.path)}/${esc(r.slug)}.html`,
          fields,
        }),
      )
    }
  }

  return files
}
