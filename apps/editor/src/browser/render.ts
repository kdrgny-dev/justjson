// Browser site renderer — turns a project (schema + content + theme) into a
// set of self-contained static HTML files, entirely in the browser. The local
// CLI scaffolds an Astro project (needs a Node build); here we render final
// HTML directly so publishing needs no build step.
import type { Collection, Field, Schema, Singleton } from '@justjson/core'
import { marked } from 'marked'

export interface ProjectData {
  schema: Schema
  entries: Record<string, { slug: string; data: Record<string, unknown> }[]>
  singletons: Record<string, Record<string, unknown>>
  theme: { palette: string; accent: string; font: string; radius: number; density: string }
  siteName: string
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

function entryTitle(fields: Field[], data: Record<string, unknown>): string {
  const key =
    fields.find((f) => f.key === 'title' || f.key === 'name')?.key ??
    fields.find((f) => f.type === 'text')?.key
  return String((key && data[key]) || 'Untitled')
}

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

function themeCss(t: ProjectData['theme']): string {
  const dark = /ink|dark|noir|night|slate/i.test(t.palette)
  const bg = dark ? '#14120e' : '#faf7ef'
  const raised = dark ? '#1e1b15' : '#ffffff'
  const ink = dark ? '#f0eada' : '#231c12'
  const muted = dark ? '#a99e85' : '#6b6350'
  const line = dark ? '#332c20' : '#e6ddc6'
  const font =
    t.font === 'serif' ? 'Georgia, "Times New Roman", serif'
    : t.font === 'mono' ? 'ui-monospace, "SF Mono", Menlo, monospace'
    : 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  const pad = t.density === 'tight' ? '10px' : t.density === 'roomy' ? '22px' : '16px'
  return `:root{--bg:${bg};--raised:${raised};--ink:${ink};--muted:${muted};--line:${line};--a:${t.accent || '#d69a1f'};--r:${t.radius ?? 6}px;--pad:${pad}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:${font};line-height:1.6}
a{color:var(--a)}.wrap{max-width:880px;margin:0 auto;padding:48px 22px}
h1{font-size:clamp(2rem,5vw,3rem);margin:0 0 6px}h2{margin:44px 0 14px;font-size:1.5rem}
h3{margin:0 0 6px}.sub{color:var(--muted);font-size:1.1rem;margin:0 0 10px}
.card{display:block;background:var(--raised);border:1px solid var(--line);border-radius:var(--r);padding:var(--pad);margin:12px 0;text-decoration:none;color:inherit}
.card:hover{border-color:var(--a)}.grid{display:grid;gap:12px}
.fld{margin:16px 0}.fld-label{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:4px}
.rt img,.img{max-width:100%;border-radius:var(--r)}.img{max-height:360px}
.swatch{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:middle;border:1px solid var(--line)}
.back{color:var(--muted);text-decoration:none;font-size:14px}
footer{border-top:1px solid var(--line);margin-top:48px;padding:20px 0;color:var(--muted);font-size:13px;text-align:center}`
}

function page(title: string, css: string, body: string): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}</style></head><body><div class="wrap">${body}</div><footer>Made with Just&#123;JSON&#125;</footer></body></html>`
}

export function renderSite(p: ProjectData): Record<string, string> {
  const css = themeCss(p.theme)
  const files: Record<string, string> = {}
  const colByName = (n: string) => p.schema.collections.find((c) => c.name === n) as Collection

  // singletons rendered as sections on the home page
  const singletonSections = p.schema.singletons
    .map((s: Singleton) => {
      const data = p.singletons[s.name]
      if (!data) return ''
      return `<section><h2>${esc(s.label ?? s.name)}</h2>${s.fields.map((f) => renderField(f, data[f.key])).join('')}</section>`
    })
    .join('')

  // home: one section per collection, cards linking to entry pages
  const collectionSections = p.schema.collections
    .map((c) => {
      const rows = p.entries[c.name] ?? []
      const cards = rows
        .map((r) => {
          const tt = entryTitle(c.fields, r.data)
          return `<a class="card" href="./${esc(c.path)}/${esc(r.slug)}.html"><h3>${esc(tt)}</h3></a>`
        })
        .join('')
      return `<section><h2>${esc(c.label ?? c.name)}</h2><div class="grid">${cards || `<p class="sub">Henüz içerik yok.</p>`}</div></section>`
    })
    .join('')

  files['/index.html'] = page(
    p.siteName,
    css,
    `<h1>${esc(p.siteName)}</h1>${singletonSections}${collectionSections}`,
  )

  // entry pages
  for (const c of p.schema.collections) {
    for (const r of p.entries[c.name] ?? []) {
      const col = colByName(c.name)
      const tt = entryTitle(col.fields, r.data)
      const body = col.fields
        .filter((f) => f.key !== 'title' && f.key !== 'name')
        .map((f) => renderField(f, r.data[f.key]))
        .join('')
      files[`/${c.path}/${r.slug}.html`] = page(
        tt,
        css,
        `<a class="back" href="../index.html">← ${esc(p.siteName)}</a><h1>${esc(tt)}</h1>${body}`,
      )
    }
  }

  return files
}
