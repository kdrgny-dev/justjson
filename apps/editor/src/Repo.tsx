// Repo paneli — studio'yu var olan bir GitHub repo'sunun içerik klasörüne bağlar.
// Publish sekmesinden farkı: burada site render edilmez, yalnızca content/*.json
// alınır ve geri commit'lenir. Site kendi build'ini (Astro, Next, ne ise) çalıştırır.
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CloudDownload, CloudUpload, ExternalLink, Link2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import * as api from './api'
import { PageBody, PageHeader, PageShell, Surface } from './components/PageShell'
import { t } from './i18n'

export function Repo({ onChanged }: { onChanged: () => void }) {
  const project = api.activeProject()
  const saved = api.getRepoLink(project.id)

  const [address, setAddress] = useState(saved ? `${saved.owner}/${saved.repo}` : '')
  const [branch, setBranch] = useState(saved?.branch ?? 'main')
  const [contentDir, setContentDir] = useState(saved?.contentDir ?? 'content')
  const [token, setTokenValue] = useState(() => api.getRepoToken(project.id))
  const [busy, setBusy] = useState<'pull' | 'push' | 'check' | null>(null)
  const [lastCommit, setLastCommit] = useState<string | null>(null)

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

  function persist(link: api.RepoLink) {
    api.setRepoLink(project.id, link)
    api.setRepoToken(project.id, token)
  }

  async function run<T>(kind: 'pull' | 'push' | 'check', job: (link: api.RepoLink) => Promise<T>) {
    const link = readLink()
    if (!link) return
    // Okuma public repo'da tokensiz çalışır; yazma her hâlükârda token ister.
    if (kind === 'push' && !token.trim()) {
      toast.error(t('Paste a GitHub token with write access to this repository.'))
      return
    }
    persist(link)
    setBusy(kind)
    try {
      return await job(link)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
      return undefined
    } finally {
      setBusy(null)
    }
  }

  const onCheck = () =>
    run('check', async (link) => {
      await api.checkRepo(link, token)
      toast.success(t('Connected.'))
    })

  const onPull = () =>
    run('pull', async (link) => {
      const result = await api.pullFromRepo(link, token)
      onChanged()
      toast.success(`${result.pulled} ${t('files pulled from the repository.')}`)
    })

  const onPush = () =>
    run('push', async (link) => {
      const result = await api.pushToRepo(link, token, 'content: update from JustJSON Studio')
      if (result.changed === 0 && result.removed === 0) {
        toast.info(t('Nothing to publish.'))
        return
      }
      setLastCommit(result.commitUrl)
      toast.success(t('Published. The site rebuilds on its own.'))
    })

  return (
    <PageShell>
      <PageHeader
        title={t('Repository')}
        subtitle={t('Edit the content of a site that lives in its own repository.')}
      />
      <PageBody>
        <Surface className="grid gap-5 p-5">
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
            <Button variant="outline" onClick={onCheck} disabled={busy !== null}>
              {busy === 'check' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {t('Check connection')}
            </Button>
            <Button variant="outline" onClick={onPull} disabled={busy !== null}>
              {busy === 'pull' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudDownload className="h-4 w-4" />
              )}
              {t('Pull content')}
            </Button>
            <Button onClick={onPush} disabled={busy !== null}>
              {busy === 'push' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="h-4 w-4" />
              )}
              {t('Publish content')}
            </Button>
          </div>

          {lastCommit && (
            <a
              className="inline-flex items-center gap-1.5 text-sm underline underline-offset-4"
              href={lastCommit}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('See the commit')}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          <p className="text-xs text-muted-foreground">
            {t(
              'Pulling replaces what is in the editor with the repository. Publishing writes only the content folder — the rest of the repository is left untouched.',
            )}
          </p>
        </Surface>
      </PageBody>
    </PageShell>
  )
}
