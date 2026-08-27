import type { Schema } from '@justjson/core'
import {
  ExternalLink,
  Laptop,
  Loader2,
  Maximize2,
  RefreshCw,
  Smartphone,
  Tablet as TabletIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { gatherProject } from './browser/gather'
import { type ProjectData, renderSite } from './browser/render'
import { t } from './i18n'
import { cn } from './lib/utils'

type DeviceMode = 'desktop' | 'tablet' | 'mobile'

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
  const [device, setDevice] = useState<DeviceMode>('desktop')
  const [refreshKey, setRefreshKey] = useState(0)
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

  const onLoad = () => {
    const doc = frameRef.current?.contentDocument
    if (!doc || !files) return
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

  const openInNewTab = () => {
    if (!files) return
    const content = files[view] ?? files['/index.html'] ?? ''
    const blob = new Blob([content], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/20">
      {/* Device Toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-muted/40 px-3 py-1.5 backdrop-blur-md">
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-foreground/80">{t('Live preview')}</span>
          {busy && <Loader2 className="h-3 w-3 animate-spin text-primary ml-1" />}
        </div>

        {/* Device Switcher */}
        <div className="flex items-center rounded-lg border border-border/70 bg-card/70 p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setDevice('desktop')}
            title={t('Desktop')}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md text-xs transition-colors',
              device === 'desktop'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Laptop className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDevice('tablet')}
            title={t('Tablet')}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md text-xs transition-colors',
              device === 'tablet'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <TabletIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDevice('mobile')}
            title={t('Mobile')}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md text-xs transition-colors',
              device === 'mobile'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            title={t('Refresh')}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-card hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={openInNewTab}
            title={t('Open in a tab')}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-card hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Frame Container */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 sm:p-4">
        {files ? (
          <div
            className={cn(
              'flex h-full flex-col overflow-hidden bg-white transition-all duration-300',
              device === 'desktop' && 'w-full rounded-xl border border-border/80 shadow-sm',
              device === 'tablet' &&
                'h-[96%] w-[768px] max-w-full rounded-2xl border-4 border-neutral-800 shadow-xl ring-1 ring-border',
              device === 'mobile' &&
                'h-[96%] w-[375px] max-w-full rounded-3xl border-8 border-neutral-900 shadow-2xl ring-1 ring-border',
            )}
          >
            <iframe
              key={refreshKey}
              ref={frameRef}
              srcDoc={files[view] ?? files['/index.html'] ?? ''}
              onLoad={onLoad}
              title={t('Live preview')}
              className="h-full w-full border-0 bg-white"
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-card/50 rounded-xl border border-dashed">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}
      </div>
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
