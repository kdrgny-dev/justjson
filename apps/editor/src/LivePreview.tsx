import type { Schema } from '@justjson/core'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { gatherProject } from './browser/gather'
import { type ProjectData, renderSite } from './browser/render'
import { t } from './i18n'

// Live preview of the page the CURRENT (unsaved) record renders to, using the
// same renderer as publishing + the project's selected theme. Re-gathers the
// whole project and injects the in-memory record, debounced.
// ponytail: full re-gather per edit — projects are small; revisit if it lags.
export function LivePreview({
  schema,
  kind,
  name,
  path,
  slug,
  data,
}: {
  schema: Schema
  kind: 'entry' | 'singleton'
  /** collection name (entry) or singleton name */
  name: string
  /** collection path, entry only */
  path?: string
  /** entry slug (effective), entry only */
  slug?: string
  data: Record<string, unknown>
}) {
  const [files, setFiles] = useState<Record<string, string> | null>(null)
  const [view, setView] = useState('/index.html')
  const [busy, setBusy] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    let cancelled = false
    const id = setTimeout(async () => {
      setBusy(true)
      try {
        const project = await gatherProject(schema)
        const target = injectRecord(project, kind, name, path, slug, data)
        if (cancelled) return
        setFiles(renderSite(project))
        setView(target)
      } finally {
        if (!cancelled) setBusy(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [schema, kind, name, path, slug, data])

  // srcDoc iframes are same-origin — intercept in-page nav to browse the built
  // site without the parent trying to fetch a non-existent URL.
  const onLoad = () => {
    const doc = frameRef.current?.contentDocument
    if (!doc || !files) return
    // Themes hide [data-reveal] until scrolled into view; in a static preview
    // pane that leaves content greyed out. Force the revealed state so the
    // editor always shows finished content (the published site still animates).
    doc.documentElement.removeAttribute('data-js')
    for (const el of doc.querySelectorAll('[data-reveal]')) el.setAttribute('data-shown', '')
    doc.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement | null)?.closest('a')
      if (!a) return
      const href = a.getAttribute('href') || ''
      if (/^(https?:|mailto:|tel:|#)/.test(href)) {
        e.preventDefault()
        if (/^https?:/.test(href)) window.open(href, '_blank', 'noreferrer')
        return
      }
      e.preventDefault()
      const to = new URL(href, `http://x${view}`).pathname
      if (files[to]) setView(to)
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <span className="font-mono text-[11px] text-muted-foreground">{t('Live preview')}</span>
        {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        <span className="ml-auto truncate font-mono text-[11px] text-muted-foreground/70">
          {view}
        </span>
      </div>
      {files ? (
        <iframe
          ref={frameRef}
          srcDoc={files[view] ?? files['/index.html'] ?? ''}
          onLoad={onLoad}
          title={t('Live preview')}
          className="min-h-0 flex-1 border-0 bg-white"
        />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center bg-white">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      )}
    </div>
  )
}

// Merge the unsaved record into the gathered project and return the file path of
// the page it renders to.
function injectRecord(
  project: ProjectData,
  kind: 'entry' | 'singleton',
  name: string,
  path: string | undefined,
  slug: string | undefined,
  data: Record<string, unknown>,
): string {
  if (kind === 'singleton') {
    project.singletons = { ...project.singletons, [name]: data }
    return '/index.html'
  }
  const s = slug || 'preview'
  const rows = [...(project.entries[name] ?? [])]
  const i = rows.findIndex((r) => r.slug === s)
  const row = { slug: s, data }
  if (i >= 0) rows[i] = row
  else rows.unshift(row)
  project.entries = { ...project.entries, [name]: rows }
  return name === 'pages' ? `/${s}.html` : `/${path}/${s}.html`
}
