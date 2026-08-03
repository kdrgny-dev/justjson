import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type Schema, slugify } from '@justjson/core'
import { CheckCircle2, ExternalLink, Globe, Loader2, RefreshCw, Rocket } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import * as api from './api'
import { gatherProject } from './browser/gather'
import { NameTakenError, connectNetlify, publishToNetlify } from './browser/netlify'
import { renderSite } from './browser/render'
import { PageBody, PageHeader, PageShell } from './components/PageShell'
import { t } from './i18n'

export function Ship({ schema }: { schema: Schema }) {
  const [address, setAddress] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState<string | null>(null)

  // "name taken" dialog — asks the user for another address instead of silently
  // suffixing a random string.
  const [taken, setTaken] = useState<string | null>(null)
  const [retryName, setRetryName] = useState('')
  const resolveRef = useRef<((v: string | null) => void) | null>(null)

  const proj = api.activeProject()
  const meta = api.getSiteMeta(proj.id)
  const published = !!meta.siteUrl

  const askAnotherName = (takenName: string): Promise<string | null> => {
    setTaken(takenName)
    setRetryName(slugify(`${takenName}-2`))
    return new Promise((resolve) => {
      resolveRef.current = resolve
    })
  }
  const closeTaken = (value: string | null) => {
    setTaken(null)
    resolveRef.current?.(value)
    resolveRef.current = null
  }

  useEffect(() => {
    if (published || touched) return
    void (async () => {
      const singletons: Record<string, Record<string, unknown>> = {}
      for (const s of schema.singletons) singletons[s.name] = await api.getSingleton(s.name)
      let name = proj.name
      for (const data of Object.values(singletons)) {
        for (const key of ['siteName', 'title', 'name']) {
          const v = data[key]
          if (typeof v === 'string' && v.trim()) name = v
        }
      }
      setAddress(slugify(name) || 'my-site')
    })()
  }, [schema, touched, published, proj.name])

  const publish = async () => {
    setBusy(true)
    setUrl(null)
    try {
      const token = await connectNetlify()
      const data = await gatherProject(schema)
      const files = renderSite(data)
      let name = slugify(address) || 'my-site'
      // Retry loop: if the address is taken, ask for another (existing sites
      // republish by id and never hit this).
      while (true) {
        try {
          const res = await publishToNetlify(files, name, token, meta.siteId)
          api.setSiteMeta(proj.id, res.siteId, res.url)
          setUrl(res.url)
          setAddress(name)
          toast.success(published ? t('Your site was updated.') : t('Your site is live.'))
          break
        } catch (e) {
          if (!(e instanceof NameTakenError)) throw e
          const next = await askAnotherName(e.takenName)
          if (!next) {
            toast.message(t('Publishing cancelled.'))
            break
          }
          name = slugify(next) || name
        }
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const liveUrl = url ?? meta.siteUrl ?? null

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
              <h2 className="font-medium">
                {published ? t('Update your site') : t('Publish to the web')}
              </h2>
            </div>

            {published ? (
              <p className="text-sm text-muted-foreground">
                {t('Publishing again updates the same site.')}{' '}
                <a
                  href={meta.siteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-primary hover:underline"
                >
                  {meta.siteUrl?.replace(/^https?:\/\//, '')}
                </a>
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="addr" className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('Address')}
                </Label>
                <div className="flex items-center">
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
            )}

            <Button onClick={publish} disabled={busy} className="w-full">
              {busy ? (
                <Loader2 className="animate-spin" />
              ) : published ? (
                <RefreshCw />
              ) : (
                <Rocket />
              )}
              {published ? t('Republish') : t('Connect Netlify & publish')}
            </Button>

            <p className="text-xs text-muted-foreground">
              {t('Opens Netlify in a popup to sign in, then deploys to your account.')}
            </p>
          </section>

          {liveUrl && (url || published) && (
            <section className="rounded-xl border border-primary/40 bg-primary/5 p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <CheckCircle2 className="size-5" />
                <h2 className="font-medium">{t('Your site is live!')}</h2>
              </div>
              <a
                href={liveUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 break-all font-mono text-sm text-primary hover:underline"
              >
                {liveUrl} <ExternalLink className="size-3.5 shrink-0" />
              </a>
            </section>
          )}
        </div>
      </PageBody>

      <Dialog open={taken !== null} onOpenChange={(o) => !o && closeTaken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('That address is taken')}</DialogTitle>
            <DialogDescription>
              {t('“{name}.netlify.app” is already in use. Pick another address.', {
                name: taken ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center">
            <Input
              autoFocus
              value={retryName}
              onChange={(e) => setRetryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && slugify(retryName)) closeTaken(retryName)
              }}
              className="rounded-r-none font-mono text-sm"
            />
            <span className="inline-flex h-9 items-center rounded-r-md border border-l-0 bg-muted px-3 font-mono text-sm text-muted-foreground">
              .netlify.app
            </span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeTaken(null)}>
              {t('Cancel')}
            </Button>
            <Button onClick={() => closeTaken(retryName)} disabled={!slugify(retryName)}>
              {t('Try this address')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
