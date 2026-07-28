import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Schema } from '@justjson/core'
import { AlertTriangle, Check, Copy, GitBranch, Loader2, Terminal, Upload } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import * as api from './api'
import { PageBody, PageHeader, PageShell } from './components/PageShell'
import { t } from './i18n'

function pascalCase(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

interface Snippet {
  install: string | null
  file: string
  code: string
}

function snippetFor(framework: api.Framework, schema: Schema): Snippet {
  if (framework === 'astro') {
    return {
      install: 'npm install @kdrgny/justjson-astro',
      file: 'src/content.config.ts',
      code: [
        "import { justjsonCollections } from '@kdrgny/justjson-astro'",
        '',
        'export const collections = await justjsonCollections()',
      ].join('\n'),
    }
  }

  const loaders = [
    ...schema.collections.map((c) => `load${pascalCase(c.name)}`),
    ...schema.singletons.map((s) => `load${pascalCase(s.name)}`),
  ].slice(0, 3)
  const first = loaders[0] ?? 'loadPosts'

  return {
    install: 'npx @kdrgny/justjson types',
    file: 'anywhere in your build',
    code: [
      `import { ${loaders.join(', ') || 'loadPosts'} } from './content'`,
      '',
      `const items = await ${first}()`,
    ].join('\n'),
  }
}

const FRAMEWORK_LABEL: Record<api.Framework, string> = {
  astro: 'Astro',
  next: 'Next.js',
  nuxt: 'Nuxt',
  sveltekit: 'SvelteKit',
  vite: 'Vite',
  node: 'Node',
  unknown: 'this project',
}

function CodeBlock({ code }: { code: string }) {
  const copy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(code)
    toast.success(t('Copied'))
  }
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center gap-2 border-b bg-muted/60 px-3 py-1.5">
        <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <Button
          variant="ghost"
          size="xs"
          onClick={copy}
          className="ml-auto text-muted-foreground hover:text-primary"
        >
          <Copy /> {t('Copy')}
        </Button>
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground">
        {code}
      </pre>
    </div>
  )
}

function Step({
  index,
  title,
  done,
  children,
}: {
  index: number
  title: string
  done?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
            done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          {done ? <Check className="size-3.5" /> : index}
        </span>
        <h2 className="font-medium text-foreground">{title}</h2>
      </div>
      <div className="space-y-3 pl-8.5">{children}</div>
    </section>
  )
}

export function Ship({ schema }: { schema: Schema }) {
  const [info, setInfo] = useState<api.ShipInfo | null>(null)
  const [message, setMessage] = useState('content: update')
  const [repoName, setRepoName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setInfo(await api.getShip())
    } catch {
      setInfo(null)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Sunucu veri döndürür, mesajı editör kendi dilinde kurar.
  const act = async (key: string, fn: () => Promise<string>) => {
    setBusy(key)
    try {
      toast.success(await fn())
      await refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const commit = async () => {
    const { committed, count } = await api.shipCommit(message)
    return committed
      ? t('Committed {n} file(s).', { n: count })
      : t('Nothing to commit — content is up to date.')
  }

  const push = async () => {
    const { branch } = await api.shipPush()
    return t('Pushed {branch} to origin.', { branch })
  }

  const createRepo = async () => {
    const created = await api.shipCreateRepo(repoName, true)
    return t('Created {name} on GitHub and pushed it.', { name: created.name })
  }

  const git = info?.git
  const snippet = snippetFor(info?.framework ?? 'unknown', schema)
  const pending = git?.pendingFiles ?? 0

  return (
    <PageShell>
      <PageHeader
        title={t('Ship it')}
        subtitle={t('Your content is on disk. Here is what comes next.')}
      />
      <PageBody>
        <div className="mx-auto max-w-2xl space-y-4 px-8 py-6">
          <Step
            index={1}
            title={t('Use it in {framework}', {
              framework: FRAMEWORK_LABEL[info?.framework ?? 'unknown'],
            })}
          >
            {snippet.install && <CodeBlock code={snippet.install} />}
            <p className="text-xs text-muted-foreground">{snippet.file}</p>
            <CodeBlock code={snippet.code} />
          </Step>

          <Step index={2} title={t('Commit your content')} done={!!git?.isRepo && pending === 0}>
            {!git?.isRepo ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{t('This folder is not a git repository yet.')}</span>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {pending > 0
                    ? t('{n} file(s) waiting on branch {branch}.', {
                        n: pending,
                        branch: git.branch ?? '—',
                      })
                    : t('Everything is committed.')}
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="font-mono text-xs"
                    disabled={pending === 0}
                  />
                  <Button
                    onClick={() => act('commit', commit)}
                    disabled={pending === 0 || busy !== null}
                  >
                    {busy === 'commit' ? <Loader2 className="animate-spin" /> : <GitBranch />}
                    {t('Commit')}
                  </Button>
                </div>
              </>
            )}
          </Step>

          <Step index={3} title={t('Send it to GitHub')} done={!!git?.hasRemote}>
            {git?.hasRemote ? (
              <>
                <p className="truncate font-mono text-xs text-muted-foreground">{git.remoteUrl}</p>
                <Button
                  variant="outline"
                  onClick={() => act('push', push)}
                  disabled={busy !== null}
                >
                  {busy === 'push' ? <Loader2 className="animate-spin" /> : <Upload />}
                  {t('Push')}
                </Button>
              </>
            ) : git?.hasGh ? (
              <>
                <Label className="text-sm">{t('Create a private repository')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    placeholder="my-site"
                    className="font-mono text-xs"
                  />
                  <Button
                    onClick={() => act('repo', createRepo)}
                    disabled={!repoName.trim() || busy !== null}
                  >
                    {busy === 'repo' ? <Loader2 className="animate-spin" /> : <Upload />}
                    {t('Create & push')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('Uses the GitHub CLI already signed in on this machine — no token is stored.')}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {t('Add a remote yourself, then come back to push:')}
                </p>
                <CodeBlock code={'git remote add origin <url>\ngit push -u origin main'} />
              </>
            )}
          </Step>
        </div>
      </PageBody>
    </PageShell>
  )
}
