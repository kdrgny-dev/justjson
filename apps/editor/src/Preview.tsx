import { Button } from '@/components/ui/button'
import type { Schema } from '@justjson/core'
import { Loader2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { gatherProject } from './browser/gather'
import { renderSite } from './browser/render'
import { PageBody, PageHeader, PageShell } from './components/PageShell'
import { t } from './i18n'

// In-browser preview: render the WHOLE site from the current content (no dev
// server, same renderer as publishing) and show it in an iframe. Internal
// links are intercepted so navigating between pages swaps the iframe content
// instead of the browser trying to fetch a non-existent /studio/... URL.
export function Preview({ schema }: { schema: Schema }) {
  const [files, setFiles] = useState<Record<string, string> | null>(null)
  const [path, setPath] = useState('/index.html')
  const [busy, setBusy] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)

  const build = useCallback(async () => {
    setBusy(true)
    try {
      const data = await gatherProject(schema)
      setFiles(renderSite(data))
      setPath('/index.html')
    } finally {
      setBusy(false)
    }
  }, [schema])

  useEffect(() => {
    void build()
  }, [build])

  // srcDoc iframes are same-origin, so we can intercept in-page navigation.
  const onLoad = () => {
    const doc = frameRef.current?.contentDocument
    if (!doc || !files) return
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
      const target = new URL(href, `http://x${path}`).pathname
      if (files[target]) setPath(target)
    })
  }

  return (
    <PageShell>
      <PageHeader
        title={t('Preview')}
        subtitle={t('Your site, rendered from your content. Refresh to see changes.')}
        actions={
          <Button variant="outline" onClick={build} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} {t('Refresh')}
          </Button>
        }
      />
      <PageBody>
        {files ? (
          <iframe
            ref={frameRef}
            srcDoc={files[path] ?? files['/index.html'] ?? ''}
            onLoad={onLoad}
            title={t('Site preview')}
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}
      </PageBody>
    </PageShell>
  )
}
