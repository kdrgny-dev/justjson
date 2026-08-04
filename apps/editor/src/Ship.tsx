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
import { NameTakenError, PROVIDERS, getProvider, getToken, setToken } from './browser/publish'
import { renderSite } from './browser/render'
import { PageBody, PageHeader, PageShell } from './components/PageShell'
import { t } from './i18n'

export function Ship({ schema }: { schema: Schema }) {
  const proj = api.activeProject()
  const meta = api.getSiteMeta(proj.id)

  const [providerId, setProviderId] = useState(meta.provider || 'netlify')
  const provider = getProvider(providerId)
  const [address, setAddress] = useState('')
  const [touched, setTouched] = useState(false)
  const [token, setTok] = useState(() => getToken(providerId))
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState<string | null>(null)

  // "name taken" dialog — Netlify subdomains are global; ask for another name
  // instead of silently suffixing.
  const [taken, setTaken] = useState<string | null>(null)
  const [retryName, setRetryName] = useState('')
  const resolveRef = useRef<((v: string | null) => void) | null>(null)

  // A site is "already published" only for the provider it was published with;
  // picking a different host is a fresh publish. Legacy sites predate the
  // provider field — they were all Netlify.
  const publishedHere = !!meta.siteUrl && (meta.provider || 'netlify') === providerId
  const isToken = provider.auth.kind === 'token'

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

  // Reload the pasted token when switching provider.
  useEffect(() => {
    setTok(getToken(providerId))
  }, [providerId])

  useEffect(() => {
    if (publishedHere || touched) return
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
  }, [schema, touched, publishedHere, proj.name])

  const publish = async () => {
    setBusy(true)
    setUrl(null)
    try {
      let authToken: string
      if (provider.auth.kind === 'oauth') {
        authToken = await provider.auth.connect()
      } else {
        authToken = token.trim()
        if (!authToken) {
          toast.error(t('Paste your {name} token first.', { name: provider.name }))
          return
        }
        setToken(providerId, authToken)
      }

      const data = await gatherProject(schema)
      const files = renderSite(data)
      let name = slugify(address) || 'my-site'
      const existingSiteId = publishedHere ? meta.siteId : undefined
      // Retry loop only matters for Netlify's global names; others never throw
      // NameTakenError.
      while (true) {
        try {
          const res = await provider.publish(files, name, authToken, existingSiteId)
          api.setSiteMeta(proj.id, res.siteId, res.url, providerId)
          setUrl(res.url)
          setAddress(name)
          toast.success(publishedHere ? t('Your site was updated.') : t('Your site is live.'))
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

  const liveUrl = url ?? (publishedHere ? meta.siteUrl : null) ?? null

  return (
    <PageShell>
      <PageHeader
        title={t('Publish')}
        subtitle={t('Put your site online — on your own hosting. Nothing is stored here.')}
      />
      <PageBody>
        <div className="mx-auto max-w-xl space-y-5 px-8 py-6">
          <section className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <Globe className="size-5 text-primary" />
              <h2 className="font-medium">{t('Publish to the web')}</h2>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('Host')}
              </Label>
              <div className="grid grid-cols-3 gap-1.5">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProviderId(p.id)}
                    className={`rounded-md border px-2 py-2 text-sm transition ${
                      p.id === providerId
                        ? 'border-primary bg-primary/10 font-medium text-primary'
                        : 'border-input text-muted-foreground hover:bg-accent/60'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {publishedHere ? (
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
                <Label
                  htmlFor="addr"
                  className="text-xs uppercase tracking-wide text-muted-foreground"
                >
                  {provider.id === 'github' ? t('Repository name') : t('Address')}
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
                    className={`font-mono text-sm ${provider.suffix ? 'rounded-r-none' : ''}`}
                  />
                  {provider.suffix && (
                    <span className="inline-flex h-9 items-center rounded-r-md border border-l-0 bg-muted px-3 font-mono text-sm text-muted-foreground">
                      {provider.suffix}
                    </span>
                  )}
                </div>
                {provider.id === 'github' && (
                  <p className="text-xs text-muted-foreground">
                    {t('Publishes to {owner}.github.io/{repo}/', {
                      owner: t('your-username'),
                      repo: slugify(address) || 'my-site',
                    })}
                  </p>
                )}
              </div>
            )}

            {isToken && provider.auth.kind === 'token' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="tok"
                    className="text-xs uppercase tracking-wide text-muted-foreground"
                  >
                    {t('{name} token', { name: provider.name })}
                  </Label>
                  <a
                    href={provider.auth.tokenUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {t('Get a token')} <ExternalLink className="size-3" />
                  </a>
                </div>
                <Input
                  id="tok"
                  type="password"
                  value={token}
                  onChange={(e) => setTok(e.target.value)}
                  placeholder="••••••••••••"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">{provider.auth.help}</p>
              </div>
            )}

            <Button onClick={publish} disabled={busy} className="w-full">
              {busy ? (
                <Loader2 className="animate-spin" />
              ) : publishedHere ? (
                <RefreshCw />
              ) : (
                <Rocket />
              )}
              {publishedHere
                ? t('Republish')
                : provider.auth.kind === 'oauth'
                  ? t('Connect {name} & publish', { name: provider.name })
                  : t('Publish to {name}', { name: provider.name })}
            </Button>

            {provider.auth.kind === 'oauth' && (
              <p className="text-xs text-muted-foreground">
                {t('Opens {name} in a popup to sign in, then deploys to your account.', {
                  name: provider.name,
                })}
              </p>
            )}
          </section>

          {liveUrl && (
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
              {provider.id === 'github' && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('First build takes about a minute to go live.')}
                </p>
              )}
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
