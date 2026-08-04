// Browser site renderer — turns a project (schema + content + theme) into a
// set of self-contained static HTML files, entirely in the browser. The local
// CLI scaffolds an Astro project (needs a Node build); here we render final
// HTML directly so publishing needs no build step.
//
// Theme-bundle driven: the renderer owns content gathering + safe field HTML +
// routing + a slot convention; a ThemeBundle (logic-less Mustache templates +
// CSS) owns layout. A theme composes against slots/nav, never sector field
// names, so one generic theme renders any schema across four page types:
// home, page (from the `pages` collection), list and entry.
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

const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  )

// A collection is the site's standalone pages when named `pages`: each row is
// its own route (/<slug>.html) and a nav item, not a listed collection.
const PAGES = 'pages'

function entryTitle(fields: Field[], data: Record<string, unknown>): string {
  const key =
    fields.find((f) => f.key === 'title' || f.key === 'name')?.key ??
    fields.find((f) => f.type === 'text')?.key
  return String((key && data[key]) || 'Untitled')
}

// One repeater cell → safe HTML by subfield type.
function cellHtml(f: Field, v: unknown): string {
  if (v == null || v === '') return ''
  switch (f.type) {
    case 'richtext':
      return marked.parse(String(v)) as string
    case 'boolean':
      return v ? '✓' : '—'
    case 'image':
      return `<img class="img" src="${esc(v)}" alt="">`
    case 'url':
      return `<a href="${esc(v)}">${esc(v)}</a>`
    case 'email':
      return `<a href="mailto:${esc(v)}">${esc(v)}</a>`
    default:
      return esc(v)
  }
}

// A repeater → a generic <table class="jj-table"> (contract class themes style).
// Non-dev fills rows; every theme renders them the same responsive way.
function repeaterTableHtml(f: Field, value: unknown): string {
  const subs = f.fields ?? []
  const rows = (Array.isArray(value) ? value : []) as Record<string, unknown>[]
  if (rows.length === 0 || subs.length === 0) return ''
  const head = subs.map((s) => `<th>${esc(s.label ?? s.key)}</th>`).join('')
  const body = rows
    .map((r) => `<tr>${subs.map((s) => `<td>${cellHtml(s, r[s.key])}</td>`).join('')}</tr>`)
    .join('')
  return `<div class="jj-table-wrap"><table class="jj-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
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
    case 'repeater':
      return `<div class="fld">${label}${repeaterTableHtml(f, value)}</div>`
    default:
      return `<div class="fld">${label}<div>${esc(value)}</div></div>`
  }
}

function fieldVM(f: Field, value: unknown): FieldVM {
  return { key: f.key, label: String(f.label ?? f.key), html: renderField(f, value) }
}

// Bare value by field type — no label, no wrapper. Lets a theme COMPOSE content
// freely (e.g. `<h1>{{s.hakkinda.ad_soyad}}</h1>`) instead of dumping labeled
// rows. text/number/etc → raw (Mustache `{{ }}` escapes); richtext → HTML (use
// `{{{ }}}`); image/url/email → raw string; boolean → bool.
function fieldValue(f: Field, value: unknown): unknown {
  if (value == null || value === '') return ''
  switch (f.type) {
    case 'richtext':
      return marked.parse(String(value)) as string
    case 'boolean':
      return Boolean(value)
    case 'repeater':
      return Array.isArray(value)
        ? value.map((row) => byKey(f.fields ?? [], row as Record<string, unknown>))
        : []
    default:
      return value
  }
}

// { fieldKey: value } for a whole record (singleton entry or one collection row).
function byKey(fields: Field[], data: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  for (const f of fields) o[f.key] = fieldValue(f, data[f.key])
  return o
}

type FieldType = Field['type']
interface Meta {
  key: string
  label: string
  value: string
  type: FieldType
  /** href for url/email meta so themes can render a link; '' otherwise */
  href: string
}
interface Slots {
  title: string
  lead: string
  cover: string
  body: string
  meta: Meta[]
  /** repeater fields rendered as <table class="jj-table"> — place after body */
  extras: string
}
const EMPTY_SLOTS: Slots = { title: '', lead: '', cover: '', body: '', meta: [], extras: '' }

// The convention that frees a generic theme from knowing sector field names.
// Derives a small, stable set of slots from ANY record:
//   title  — `title`/`name`, else the first text field
//   lead   — the next text field (tagline/subtitle/role), if any
//   cover  — the first image field
//   body   — every richtext field, concatenated to HTML (place with {{{body}}})
//   meta   — remaining scalars (date/url/email/select/number) as labeled chips
// Plumbing fields that carry no display value — never surface them as a slot.
// siteName is site-level metadata (brand/nav), not page content — never a slot.
const IGNORED_SLOT_KEYS = new Set(['slug', 'order', 'siteName'])

function slots(fields: Field[], data: Record<string, unknown>): Slots {
  const val = (k: string) => data[k]
  const nonEmpty = (f: Field) => val(f.key) != null && val(f.key) !== ''
  const usable = (f: Field) => nonEmpty(f) && !IGNORED_SLOT_KEYS.has(f.key)

  const titleField =
    fields.find((f) => f.key === 'title' || f.key === 'name') ??
    fields.find((f) => f.type === 'text' && usable(f))
  const leadField = fields.find((f) => f.type === 'text' && f !== titleField && usable(f))
  const coverField = fields.find((f) => f.type === 'image' && usable(f))

  const body = fields
    .filter((f) => f.type === 'richtext' && nonEmpty(f))
    .map((f) => marked.parse(String(val(f.key))) as string)
    .join('\n')

  const metaTypes: FieldType[] = ['date', 'url', 'email', 'select', 'number']
  const meta: Meta[] = fields
    .filter((f) => metaTypes.includes(f.type) && usable(f))
    .map((f) => {
      const value = String(val(f.key))
      const href = f.type === 'url' ? value : f.type === 'email' ? `mailto:${value}` : ''
      return { key: f.key, label: String(f.label ?? f.key), value, type: f.type, href }
    })

  const extras = fields
    .filter((f) => f.type === 'repeater' && nonEmpty(f))
    .map((f) => repeaterTableHtml(f, val(f.key)))
    .join('\n')

  return {
    title: titleField ? String(val(titleField.key) ?? '') : '',
    lead: leadField ? String(val(leadField.key) ?? '') : '',
    cover: coverField ? String(val(coverField.key) ?? '') : '',
    body,
    meta,
    extras,
  }
}

// The user's chosen theme for the active project (theme-store); default fallback.
function getActiveThemeBundle(): ThemeBundle {
  return getSelectedBundle()
}

// Page shell wraps each template's output. themeCss(theme) (the --jj-* block the
// Design panel edits) is injected BEFORE the bundle css so the default theme —
// and any bundle that opts into --jj-* — respects the user's palette/accent/font.
function page(title: string, theme: Theme, bundle: ThemeBundle, body: string): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${themeCss(theme)}\n${bundle.css}</style></head><body>${body}</body></html>`
}

// Built-in fallbacks so themes shipped before the multi-page contract (only
// index+entry) still produce list/page routes.
const FALLBACK_LIST =
  '<main class="wrap"><h1>{{collection.label}}</h1><ul>{{#items}}<li><a href="{{_url}}">{{_title}}</a></li>{{/items}}</ul></main>'
const FALLBACK_PAGE =
  '<main class="wrap"><h1>{{slots.title}}</h1>{{{slots.body}}}{{{slots.extras}}}</main>'

export function renderSite(p: ProjectData): Record<string, string> {
  return renderWithBundle(p, getActiveThemeBundle())
}

export function renderWithBundle(p: ProjectData, bundle: ThemeBundle): Record<string, string> {
  const files: Record<string, string> = {}
  const listable = p.schema.collections.filter((c) => c.name !== PAGES)
  const pagesCol = p.schema.collections.find((c) => c.name === PAGES)
  const pageRows = pagesCol ? (p.entries[PAGES] ?? []) : []

  // Contact lines a generic theme can drop in a footer: email/url fields from
  // any singleton, plus text fields (phone/address) from singletons that ALSO
  // carry a contact field — so a "Contact" singleton surfaces its details while
  // a bio/about singleton's prose doesn't leak in. Base-independent (abs hrefs).
  // display = the human label to show: the address/email/phone value itself, but
  // a link's label (e.g. "Instagram") instead of its raw URL.
  const contact: { label: string; value: string; display: string; href: string }[] = []
  for (const [i, sg] of p.schema.singletons.entries()) {
    // The first singleton feeds the hero; its fields (title, tagline, CTAs) are
    // already shown there and must not leak into the footer contact strip.
    if (i === 0) continue
    const d = p.singletons[sg.name]
    if (!d) continue
    const isContactBlock = sg.fields.some(
      (f) => (f.type === 'email' || f.type === 'url') && d[f.key],
    )
    for (const f of sg.fields) {
      const v = d[f.key]
      if (v == null || v === '' || IGNORED_SLOT_KEYS.has(f.key)) continue
      const label = String(f.label ?? f.key)
      const value = String(v)
      if (f.type === 'email')
        contact.push({ label, value, display: value, href: `mailto:${value}` })
      else if (f.type === 'url') contact.push({ label, value, display: label, href: value })
      else if (f.type === 'text' && isContactBlock)
        contact.push({ label, value, display: value, href: '' })
    }
  }

  // Root-relative routes (no leading slash); a per-page `base` turns them into
  // links correct for that page's directory depth.
  const listUrl = (path: string) => `${esc(path)}/index.html`
  const entryUrl = (path: string, slug: string) => `${esc(path)}/${esc(slug)}.html`
  const pageUrl = (slug: string) => `${esc(slug)}.html`

  // Everything a template can reach, with all URLs prefixed for the current
  // page depth. Rebuilt per page (data is small) so links resolve from any dir.
  function ctx(base: string, activeUrl: string) {
    const sByKey: Record<string, Record<string, unknown>> = {}
    for (const sg of p.schema.singletons) {
      const d = p.singletons[sg.name]
      if (d) sByKey[sg.name] = byKey(sg.fields, d)
    }

    const cByKey: Record<string, Record<string, unknown>[]> = {}
    for (const col of p.schema.collections) {
      cByKey[col.name] = (p.entries[col.name] ?? []).map((r) => {
        const sl = slots(col.fields, r.data)
        const url = col.name === PAGES ? pageUrl(r.slug) : entryUrl(col.path, r.slug)
        return {
          ...byKey(col.fields, r.data),
          _slug: r.slug,
          _title: sl.title || 'Untitled',
          _lead: sl.lead,
          _cover: sl.cover,
          _url: base + url,
        }
      })
    }

    // New generic array for slot themes to iterate collections it doesn't name.
    const sections = listable.map((col) => ({
      name: col.name,
      label: String(col.label ?? col.name),
      url: base + listUrl(col.path),
      items: cByKey[col.name] ?? [],
    }))

    const nav = [
      { label: 'Home', url: `${base}index.html`, active: activeUrl === 'index.html' },
      ...(cByKey[PAGES] ?? []).map((r) => ({
        label: String(r._title),
        url: String(r._url),
        active: activeUrl === pageUrl(String(r._slug)),
      })),
      ...listable.map((col) => ({
        label: String(col.label ?? col.name),
        url: base + listUrl(col.path),
        active: activeUrl === listUrl(col.path),
      })),
    ]

    // Legacy VMs (labeled-field arrays) kept intact for pre-slot free themes
    // (default/bold/editorial/signal). Urls stay `./`-relative (depth-0), which
    // is where old index templates — the only consumer — use them.
    const singletons = p.schema.singletons
      .filter((s) => p.singletons[s.name])
      .map((s) => ({
        name: s.name,
        label: String(s.label ?? s.name),
        fields: s.fields.map((f) =>
          fieldVM(f, (p.singletons[s.name] as Record<string, unknown>)[f.key]),
        ),
      }))
    const collections = listable.map((col) => ({
      name: col.name,
      label: String(col.label ?? col.name),
      entries: (p.entries[col.name] ?? []).map((r) => ({
        title: entryTitle(col.fields, r.data),
        slug: r.slug,
        url: `./${esc(col.path)}/${esc(r.slug)}.html`,
        fields: col.fields.map((f) => fieldVM(f, r.data[f.key])),
      })),
    }))

    return {
      siteName: p.siteName,
      homeUrl: `${base}index.html`,
      nav,
      contact,
      s: sByKey,
      c: cByKey,
      sections,
      collections,
      singletons,
    }
  }

  // Home — hero from the first singleton; sections composed by the theme.
  {
    const c = ctx('', 'index.html')
    const firstS = p.schema.singletons.find((s) => p.singletons[s.name])
    const hero = firstS ? slots(firstS.fields, p.singletons[firstS.name] ?? {}) : EMPTY_SLOTS
    files['/index.html'] = page(
      p.siteName,
      p.theme,
      bundle,
      Mustache.render(bundle.templates.index, { ...c, hero }),
    )
  }

  // Standalone pages (the `pages` collection).
  if (pagesCol) {
    for (const r of pageRows) {
      const c = ctx('', pageUrl(r.slug))
      const sl = slots(pagesCol.fields, r.data)
      files[`/${r.slug}.html`] = page(
        sl.title || p.siteName,
        p.theme,
        bundle,
        Mustache.render(bundle.templates.page ?? FALLBACK_PAGE, {
          ...c,
          title: sl.title,
          slots: sl,
          this: byKey(pagesCol.fields, r.data),
        }),
      )
    }
  }

  // Collection list + entry pages (depth 1 → base '../').
  for (const col of listable) {
    const base = '../'
    const listCtx = ctx(base, listUrl(col.path))
    files[`/${col.path}/index.html`] = page(
      String(col.label ?? col.name),
      p.theme,
      bundle,
      Mustache.render(bundle.templates.list ?? FALLBACK_LIST, {
        ...listCtx,
        collection: { name: col.name, label: String(col.label ?? col.name) },
        items: (listCtx.c[col.name] as Record<string, unknown>[]) ?? [],
      }),
    )

    for (const r of p.entries[col.name] ?? []) {
      const c = ctx(base, listUrl(col.path))
      const sl = slots(col.fields, r.data)
      files[`/${col.path}/${r.slug}.html`] = page(
        sl.title || p.siteName,
        p.theme,
        bundle,
        Mustache.render(bundle.templates.entry, {
          ...c,
          title: sl.title,
          slug: r.slug,
          slots: sl,
          this: byKey(col.fields, r.data),
          // Legacy field-VM array for pre-slot entry templates.
          fields: col.fields
            .filter((f) => f.key !== 'title' && f.key !== 'name')
            .map((f) => fieldVM(f, r.data[f.key])),
          collection: {
            name: col.name,
            label: String(col.label ?? col.name),
            url: base + listUrl(col.path),
          },
        }),
      )
    }
  }

  return files
}
