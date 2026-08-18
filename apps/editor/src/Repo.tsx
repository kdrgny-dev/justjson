// Repo paneli — studio'yu var olan bir GitHub repo'sunun içerik klasörüne bağlar.
// Publish sekmesinden farkı: burada site render edilmez, yalnızca content/*.json
// alınır ve geri commit'lenir. Site kendi build'ini (Astro, Next, ne ise) çalıştırır.
//
// Kullanan kişi bir emlakçı, bir doktor, bir kuaför olabilir; "pull/push" onun
// sözlüğünde yok. Bağlantı bir kez kurulduktan sonra tek düğme kalır: Yayınla.
// İçerik açılışta kendiliğinden tazelenir.
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CloudUpload, ExternalLink, Link2, Loader2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import * as api from './api'
import { PageBody, PageHeader, PageShell, Surface } from './components/PageShell'
import { t } from './i18n'
import { Hosted } from './Hosted'
import { getHostedConfig } from './browser/hosted'

export function Repo({ onChanged }: { onChanged: () => void }) {
  // Site kendi yayın uçlarını sunuyorsa (studio-config), GitHub panelini hiç
  // gösterme; Ömer'e parolalı hosted panel gelir.
  const [mode, setMode] = useState<'loading' | 'hosted' | 'direct'>('loading')
  useEffect(() => {
    getHostedConfig().then((config) => setMode(config ? 'hosted' : 'direct'))
  }, [])
  if (mode === 'loading') return null
  if (mode === 'hosted') return <Hosted />
  return <RepoDirect onChanged={onChanged} />
}

function RepoDirect({ onChanged }: { onChanged: () => void }) {
  const project = api.activeProject()
  // State olarak tutulur: her render'da yeni bir nesne üretmek, aşağıdaki
  // efektin bağımlılığını her seferinde değiştirip sonsuz döngü yaratıyordu.
  const [saved, setSaved] = useState(() => api.getRepoLink(project.id))

  const [address, setAddress] = useState(saved ? `${saved.owner}/${saved.repo}` : '')
  const [branch, setBranch] = useState(saved?.branch ?? 'main')
  const [contentDir, setContentDir] = useState(saved?.contentDir ?? 'content')
  const [token, setTokenValue] = useState(() => api.getRepoToken(project.id))
  const [busy, setBusy] = useState<'load' | 'publish' | null>(null)
  const [lastCommit, setLastCommit] = useState<string | null>(null)
  const [ready, setReady] = useState(() =>
    saved ? Boolean(api.getSyncedCommit(project.id, saved)) : false,
  )
  const [showSettings, setShowSettings] = useState(!saved || !ready)

  function readLink(): api.RepoLink | null {
    const parsed = api.parseRepoInput(address)
    if (!parsed) {
      toast.error(t('Repo address should look like owner/repo.'))
      return null
    }
    return {
      owner: parsed.owner,
      repo: parsed.repo,
      branch: branch.trim() || 'main',
      contentDir: contentDir.trim().replace(/\/+$/, '') || 'content',
    }
  }

  const load = useCallback(
    async (link: api.RepoLink, quiet: boolean) => {
      setBusy('load')
      try {
        const result = await api.pullFromRepo(link, api.getRepoToken(project.id))
        setReady(true)
        setShowSettings(false)
        onChanged()
        if (!quiet) toast.success(`${result.pulled} ${t('files loaded from the site.')}`)
      } catch (error) {
        if (!quiet) toast.error(error instanceof Error ? error.message : String(error))
      } finally {
        setBusy(null)
      }
    },
    [onChanged, project.id],
  )

  // Açılışta OTOMATİK ÇEKME YOK. İçerik zaten tarayıcıda duruyor; panele her
  // girişte repodan çekmek, kullanıcının henüz yayınlamadığı düzenlemeyi
  // sessizce siliyordu — sonra Publish "değişen yok" diyordu.
  // Repodan tazeleme yalnızca açık istekle ("Reload from the site") yapılır.
  const bootstrapped = useRef(false)

  function onConnect() {
    const link = readLink()
    if (!link) return
    if (!token.trim()) {
      toast.error(t('Paste a GitHub token with write access to this repository.'))
      return
    }
    api.setRepoLink(project.id, link)
    api.setRepoToken(project.id, token)
    setSaved(link)
    bootstrapped.current = true
    void load(link, false)
  }

  async function onPublish() {
    const link = saved ?? readLink()
    if (!link) return
    setBusy('publish')
    try {
      const result = await api.pushToRepo(
        link,
        api.getRepoToken(project.id),
        'content: update from JustJSON Studio',
      )
      if (result.changed === 0 && result.removed === 0) {
        toast.info(t('Nothing to publish.'))
        return
      }
      setLastCommit(result.commitUrl)
      toast.success(t('Published. The site updates in about a minute.'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title={t('Publish')}
        subtitle={
          ready
            ? t('Your changes go live on the site.')
            : t('Connect the site once; after that this page only publishes.')
        }
        actions={
          ready ? (
            <Button onClick={onPublish} disabled={busy !== null}>
              {busy === 'publish' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="h-4 w-4" />
              )}
              {t('Publish')}
            </Button>
          ) : undefined
        }
      />
      <PageBody>
        <Surface className="grid gap-5 p-5">
          {ready && !showSettings && (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                {t('Edit your content on the left, then press Publish.')}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saved && void load(saved, false)}
                  disabled={busy !== null}
                >
                  {busy === 'load' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {t('Reload from the site')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
                  {t('Connection settings')}
                </Button>
              </div>
            </div>
          )}

          {showSettings && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="repo-address">{t('Repository')}</Label>
                <Input
                  id="repo-address"
                  value={address}
                  placeholder="kdrgny-dev/omerguzey.com"
                  onChange={(event) => setAddress(event.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="repo-branch">{t('Branch')}</Label>
                  <Input
                    id="repo-branch"
                    value={branch}
                    onChange={(event) => setBranch(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="repo-dir">{t('Content folder')}</Label>
                  <Input
                    id="repo-dir"
                    value={contentDir}
                    onChange={(event) => setContentDir(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="repo-token">{t('GitHub token')}</Label>
                <Input
                  id="repo-token"
                  type="password"
                  value={token}
                  placeholder="github_pat_…"
                  onChange={(event) => setTokenValue(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t(
                    'Use a fine-grained token limited to this repository with read and write access to contents. It stays in this browser tab only.',
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={onConnect} disabled={busy !== null}>
                  {busy === 'load' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                  {t('Connect')}
                </Button>
                {ready && (
                  <Button variant="ghost" onClick={() => setShowSettings(false)}>
                    {t('Cancel')}
                  </Button>
                )}
              </div>
            </>
          )}

          {lastCommit && (
            <a
              className="inline-flex items-center gap-1.5 text-sm underline underline-offset-4"
              href={lastCommit}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('See the change')}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </Surface>
      </PageBody>
    </PageShell>
  )
}
