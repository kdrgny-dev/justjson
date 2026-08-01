import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type Schema, slugify } from '@justjson/core'
import { CheckCircle2, ExternalLink, Globe, Loader2, Rocket } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import * as api from './api'
import { PageBody, PageHeader, PageShell } from './components/PageShell'
import { connectNetlify, publishToNetlify } from './browser/netlify'
import { type ProjectData, renderSite } from './browser/render'
import { t } from './i18n'

function pickName(singletons: Record<string, Record<string, unknown>>, fallback: string): string {
  for (const data of Object.values(singletons)) {
    for (const key of ['siteName', 'title', 'name']) {
      const v = data[key]
      if (typeof v === 'string' && v.trim()) return v
    }
  }
  return fallback
}

export function Ship({ schema }: { schema: Schema }) {
  const [displayName, setDisplayName] = useState('My site')
  const [address, setAddress] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState<string | null>(null)

  // gather the whole project from the browser store
  const gather = useCallback(async (): Promise<ProjectData> => {
    const theme = await api.getTheme()
    const entries: ProjectData['entries'] = {}
    for (const c of schema.collections) {
      const rows = await api.listRows(c.name)
      const list: { slug: string; data: Record<string, unknown> }[] = []
      for (const r of rows) {
        const data = (await api.getEntry(c.name, r.slug)) ?? {}
        list.push({ slug: r.slug, data })
      }
      entries[c.name] = list
    }
    const singletons: ProjectData['singletons'] = {}
    for (const s of schema.singletons) singletons[s.name] = await api.getSingleton(s.name)
    const name = pickName(singletons, 'My site')
    return { schema, entries, singletons, theme, siteName: name }
  }, [schema])

  // default site name + address from content
  useEffect(() => {
    void (async () => {
      const singletons: Record<string, Record<string, unknown>> = {}
      for (const s of schema.singletons) singletons[s.name] = await api.getSingleton(s.name)
      const name = pickName(singletons, 'My site')
      setDisplayName(name)
      if (!touched) setAddress(slugify(name) || 'my-site')
    })()
  }, [schema, touched])

  const publish = async () => {
    setBusy(true)
    setUrl(null)
    try {
      const token = await connectNetlify()
      const data = await gather()
      const files = renderSite(data)
      const live = await publishToNetlify(files, slugify(address) || 'my-site', token)
      setUrl(live)
      toast.success(t('Your site is live.'))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title={t('Publish')}
        subtitle={t('Put your site online — on your own Netlify. Nothing is stored here.')}
      />
      <PageBody>
        <div className="mx-auto max-w-xl space-y-5 px-8 py-6">
          <section className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <Globe className="size-5 text-primary" />
              <h2 className="font-medium">{t('Publish to the web')}</h2>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="addr" className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('Address')}
              </Label>
              <div className="flex items-center gap-0">
                <Input
                  id="addr"
                  value={address}
                  onChange={(e) => {
                    setTouched(true)
                    setAddress(e.target.value)
                  }}
                  onBlur={() => setAddress(slugify(address))}
                  placeholder="my-site"
                  className="rounded-r-none font-mono text-sm"
                />
                <span className="inline-flex h-9 items-center rounded-r-md border border-l-0 bg-muted px-3 font-mono text-sm text-muted-foreground">
                  .netlify.app
                </span>
              </div>
            </div>

            <Button onClick={publish} disabled={busy} className="w-full">
              {busy ? <Loader2 className="animate-spin" /> : <Rocket />}
              {t('Connect Netlify & publish')}
            </Button>

            <p className="text-xs text-muted-foreground">
              {t('Opens Netlify in a popup to sign in, then deploys to your account.')}
            </p>
          </section>

          {url && (
            <section className="rounded-xl border border-primary/40 bg-primary/5 p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <CheckCircle2 className="size-5" />
                <h2 className="font-medium">{t('Your site is live!')}</h2>
              </div>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 break-all font-mono text-sm text-primary hover:underline"
              >
                {url} <ExternalLink className="size-3.5 shrink-0" />
              </a>
            </section>
          )}
        </div>
      </PageBody>
    </PageShell>
  )
}
