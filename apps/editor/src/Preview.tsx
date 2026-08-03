import { Button } from '@/components/ui/button'
import type { Schema } from '@justjson/core'
import { Loader2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { gatherProject } from './browser/gather'
import { renderSite } from './browser/render'
import { PageBody, PageHeader, PageShell } from './components/PageShell'
import { t } from './i18n'

// In-browser preview: render the site from the current content and show the
// home page in an iframe. No dev server — same renderer used for publishing.
export function Preview({ schema }: { schema: Schema }) {
  const [html, setHtml] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const build = useCallback(async () => {
    setBusy(true)
    try {
      const data = await gatherProject(schema)
      setHtml(renderSite(data)['/index.html'] ?? '')
    } finally {
      setBusy(false)
    }
  }, [schema])

  useEffect(() => {
    void build()
  }, [build])

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
        {html !== null ? (
          <iframe
            srcDoc={html}
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
